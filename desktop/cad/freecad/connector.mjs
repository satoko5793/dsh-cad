// Install the application-owned FreeCAD startup connector using FreeCAD's API.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename,access,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {ROOT} from '../../infrastructure/paths.mjs';
const exec=promisify(execFile);
async function atomic(file,value){const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,value);await rename(temporary,file);}
export async function discoverFreeCAD(){
  if(process.platform!=='win32')return null;
  for(const root of [process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Programs')].filter(Boolean)){
    let entries;try{entries=await readdir(root,{withFileTypes:true});}catch{continue;}
    for(const folder of entries.filter(e=>e.isDirectory()&&/^FreeCAD/i.test(e.name)).sort((a,b)=>b.name.localeCompare(a.name,undefined,{numeric:true})))for(const sub of ['bin','']){const executable=path.join(root,folder.name,sub,'FreeCAD.exe');try{await access(executable);return executable;}catch{}}
  }
  return null;
}
export async function probeFreeCAD(executable,workspace){
  const command=path.join(path.dirname(executable),process.platform==='win32'?'FreeCADCmd.exe':'FreeCADCmd');await access(command);
  const directory=path.join(workspace,'connector-setup',randomUUID());await mkdir(directory,{recursive:true});const result=path.join(directory,'paths.json'),script=path.join(directory,'paths.py');
  await writeFile(script,`# coding: utf-8\nimport FreeCAD as App\nimport json\nfrom pathlib import Path\nPath(${JSON.stringify(result.replaceAll('\\','/'))}).write_text(json.dumps({'userData': App.getUserAppDataDir(), 'version': App.Version()[:3]}), encoding='utf-8')\n`);
  await exec(command,['--user-cfg',path.join(directory,'user.cfg'),'--system-cfg',path.join(directory,'system.cfg'),script],{windowsHide:true,timeout:20000,maxBuffer:128000,env:{...process.env,GOUXING_DISABLE_AUTO_CONNECT:'1'}});
  const info=JSON.parse(await readFile(result,'utf8'));if(!path.isAbsolute(info.userData)||!Array.isArray(info.version))throw Error('无法核对FreeCAD用户组件目录');return info;
}
export async function installConnector(executable,workspace,{probe=probeFreeCAD}={}){
  const info=await probe(executable,workspace),directory=path.join(info.userData,'Mod','GouxingConnect'),configFile=path.join(directory,'gouxing.json');
  try{const existing=JSON.parse(await readFile(configFile,'utf8'));if(existing.owner!=='gouxing-cad')throw Error('同名组件不属于构形，未覆盖');}
  catch(e){if(e.code==='ENOENT'){try{await access(path.join(directory,'InitGui.py'));throw Error('同名组件不属于构形，未覆盖');}catch(check){if(check.code!=='ENOENT')throw check;}}else throw e;}
  await mkdir(directory,{recursive:true});
  await atomic(configFile,JSON.stringify({owner:'gouxing-cad',schema:1,enabled:true,workspace:path.resolve(workspace),source:path.join(ROOT,'freecad')},null,2));
  await atomic(path.join(directory,'InitGui.py'),await readFile(path.join(ROOT,'freecad-addon','InitGui.py')));
  return {directory,version:info.version};
}
