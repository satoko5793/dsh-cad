import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {parameterSpecs,validateParameters} from './public/parameters.js';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DATA = process.env.CAD_DATA_DIR || path.join(ROOT, '.data');
export const validId = id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
export function partName(title) {return String(title || '').replace(/\d+(?:\.\d+)?(?:\s*[×xX]\s*\d+(?:\.\d+)?){1,2}\s*(?:mm)?/g,'').replace(/[（(]\s*[Ø⌀φ]\s*\d+(?:\.\d+)?\s*(?:mm)?\s*[）)]/g,'').trim().slice(0,100) || '参数化零件';}
export function projectDir(id) { if (!validId(id)) throw new Error('Invalid project ID'); return path.join(DATA, id); }
export async function loadProject(id) { return JSON.parse(await readFile(path.join(projectDir(id), 'project.json'), 'utf8')); }
export async function saveProject(project) {
  const dir = projectDir(project.id); await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `project.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(project, null, 2)); await rename(temp, path.join(dir, 'project.json'));
}

async function runWorker(dir,source,parameters,signal) {
  if(typeof source!=='string'||source.length>60000)throw new Error('Invalid modeling source');
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'model.py'),source);
  await writeFile(path.join(dir,'parameters.json'),JSON.stringify(parameters,null,2));
  const python=process.env.CAD_PYTHON || path.join(ROOT,'.venv','Scripts','python.exe');
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(python,['-I','-X','utf8',path.join(ROOT,'runner.py')],{cwd:dir,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});
    let stdout='',stderr='',stopped=false;
    const stop=()=>{stopped=true;child.kill();};
    const timer=setTimeout(stop,90000);
    signal?.addEventListener('abort',stop,{once:true});
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);};
    child.stdout.on('data',b=>{stdout+=b;if(stdout.length>1000000)stop();});
    child.stderr.on('data',b=>{stderr=(stderr+b).slice(-12000);});
    child.on('error',error=>{cleanup();reject(error);});
    child.on('close',()=>{
      cleanup();if(stopped)return reject(new Error('CAD build timed out or was cancelled'));
      try{const data=JSON.parse(stdout.trim().split('\n').at(-1));if(!data.ok)reject(new Error(data.error));else resolve(data);}catch(error){reject(new Error(error.message || stderr || 'CAD worker failed'));}
    });
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source,parameters,output:dir}));
    if(signal?.aborted)stop();
  });
  await writeFile(path.join(dir,'model.py'),result.source);
  return result.geometry;
}
async function appendRevision(projectId,revision) {
  const latest=await loadProject(projectId);
  latest.revisions.push(revision);latest.activeRevision=revision.id;latest.title=revision.title;latest.updatedAt=revision.createdAt;
  await saveProject(latest);return revision;
}
export async function buildModel({projectId,title,source,parameters,parameterSpec},signal) {
  validateParameters(parameters);
  const specs=parameterSpecs(parameters,parameterSpec);validateParameters(parameters,specs);
  const project=await loadProject(projectId),id=`${Date.now()}-${randomUUID().slice(0,8)}`;
  const dir=path.join(projectDir(projectId),'revisions',id);
  const geometry=await runWorker(dir,source,parameters,signal);
  const revision={id,title:partName(title||project.title),parameters,parameterSpec:specs,geometry,createdAt:new Date().toISOString()};
  await writeFile(path.join(dir,'revision.json'),JSON.stringify(revision,null,2));
  return appendRevision(projectId,revision);
}
export function previewDir(projectId,previewId) {
  if(!validId(previewId))throw new Error('Invalid preview ID');
  const root=path.resolve(projectDir(projectId),'previews'),dir=path.resolve(root,previewId);
  if(!dir.startsWith(root+path.sep))throw new Error('Invalid preview path');
  return dir;
}
export async function loadPreview(projectId,previewId) {
  const preview=JSON.parse(await readFile(path.join(previewDir(projectId,previewId),'preview.json'),'utf8'));
  if(Date.now()-Date.parse(preview.createdAt)>30*60*1000)throw new Error('预览已过期，请重新预览修改。');
  return preview;
}
export async function previewModel({projectId,baseRevisionId,parameters},signal) {
  const project=await loadProject(projectId),base=project.revisions.find(r=>r.id===baseRevisionId);
  if(!base)throw new Error('版本不存在');
  validateParameters(parameters);
  if(Object.keys(parameters).length!==Object.keys(base.parameters).length||Object.keys(parameters).some(key=>!Object.hasOwn(base.parameters,key)))throw new Error('请保留原有参数；增加设计特征请通过对话描述。');
  const specs=parameterSpecs(base.parameters,base.parameterSpec);validateParameters(parameters,specs);
  const id=randomUUID(),dir=previewDir(projectId,id);
  const source=await readFile(path.join(projectDir(projectId),'revisions',base.id,'model.py'),'utf8');
  try{
    const geometry=await runWorker(dir,source,parameters,signal);
    const preview={id,title:base.title,baseRevisionId,parameters,parameterSpec:specs,geometry,createdAt:new Date().toISOString()};
    await writeFile(path.join(dir,'preview.json'),JSON.stringify(preview,null,2));return preview;
  }catch(error){await discardPreview(projectId,id);throw error;}
}
export async function commitPreview(projectId,previewId) {
  const preview=await loadPreview(projectId,previewId),project=await loadProject(projectId);
  const existing=project.revisions.find(r=>r.previewId===previewId);if(existing)return existing;
  if(!project.revisions.some(r=>r.id===preview.baseRevisionId))throw new Error('原始版本不存在');
  const id=`${Date.now()}-${randomUUID().slice(0,8)}`,dir=path.join(projectDir(projectId),'revisions',id);
  await mkdir(dir,{recursive:true});
  for(const file of ['model.py','parameters.json','model.step','model.stl'])await copyFile(path.join(previewDir(projectId,previewId),file),path.join(dir,file));
  const {baseRevisionId,...fields}=preview;
  const revision={...fields,id,previewId,basedOn:baseRevisionId,createdAt:new Date().toISOString()};
  await writeFile(path.join(dir,'revision.json'),JSON.stringify(revision,null,2));
  return appendRevision(projectId,revision);
}
export async function discardPreview(projectId,previewId) {
  // The checked absolute path is limited to this project's generated previews.
  await rm(previewDir(projectId,previewId),{recursive:true,force:true});
}
