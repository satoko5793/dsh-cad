import {readFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,atomicJson} from './bridge.mjs';

export const TOOLS=[
  {id:'freecad_inspect',name:'读取工程',description:'读取当前工程、选择、组件和几何检查',enabled:true},
  {id:'freecad_capture',name:'观察 CAD',description:'截取 FreeCAD 三维视口，可临时切换观察视角',enabled:true},
  {id:'freecad_propose',name:'准备操作',description:'提出建模或修改计划，仍需你确认后执行',enabled:true},
  {id:'skill_read',name:'读取技能',description:'按需加载已启用的 SKILL.md',enabled:true}
];
export const defaults=()=>({version:1,tools:TOOLS.map(t=>t.id),disabledSkills:[]});
export function validateConfig(value){
  if(!value||!Array.isArray(value.tools)||value.tools.some(id=>!TOOLS.some(t=>t.id===id))||!Array.isArray(value.disabledSkills)||value.disabledSkills.some(id=>typeof id!=='string'||!/^[-a-z0-9]{1,64}$/.test(id)))throw Error('无效的技能或工具配置');
  return {version:1,tools:[...new Set(value.tools)],disabledSkills:[...new Set(value.disabledSkills)]};
}
export async function loadConfig(directory){try{return validateConfig(JSON.parse(await readFile(path.join(directory,'agent.json'),'utf8')));}catch(e){if(e.code==='ENOENT')return defaults();throw e;}}
export async function saveConfig(directory,value){const config=validateConfig(value);await atomicJson(path.join(directory,'agent.json'),config);return config;}
export async function listSkills(directory){
  const skills=[];
  for(const [root,source] of [[path.join(ROOT,'skills'),'内置'],[path.join(directory,'skills'),'本机']]){
    let entries;try{entries=await readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')continue;throw e;}
    for(const entry of entries){
      if(!entry.isDirectory()||!/^[-a-z0-9]{1,64}$/.test(entry.name))continue;
      const file=path.join(root,entry.name,'SKILL.md');let text;try{text=await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
      if(text.length>24000)throw Error(`技能 ${entry.name} 超过24000字`);
      if(skills.some(s=>s.id===entry.name))continue;
      const name=/^name:\s*(.+)$/m.exec(text)?.[1]||entry.name,description=/^description:\s*(.+)$/m.exec(text)?.[1]||'';
      skills.push({id:entry.name,name,description,source,file,text});
    }
  }
  return skills;
}
export async function configView(directory){const config=await loadConfig(directory),skills=await listSkills(directory);return {...config,toolCatalog:TOOLS,skills:skills.map(({text,...s})=>({...s,enabled:!config.disabledSkills.includes(s.id)}))};}
export async function importSkill(directory,file){
  const text=await readFile(file,'utf8'),id=/^name:\s*([-a-z0-9]{1,64})\s*$/m.exec(text)?.[1];
  if(!text.startsWith('---')||!id||!/^description:\s*\S.+$/m.test(text)||text.length>24000)throw Error('请选择带 name（小写字母/数字/连字符）和 description 的 SKILL.md，最多24000字');
  if((await listSkills(directory)).some(s=>s.id===id))throw Error('已有同名技能，请编辑原文件或使用不同 name');
  const destination=path.join(directory,'skills',id);await mkdir(destination,{recursive:true});await copyFile(file,path.join(destination,'SKILL.md'));
  return id;
}
