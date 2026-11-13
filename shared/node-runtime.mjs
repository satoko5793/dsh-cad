import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access} from 'node:fs/promises';
import path from 'node:path';

const execFileAsync=promisify(execFile);
export function standaloneEnvironment(source=process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key])=>key.toUpperCase()!=='ELECTRON_RUN_AS_NODE'));
}
const unavailable=message=>Object.assign(new Error(message),{code:'DSH_NODE_UNAVAILABLE'});
export async function inspectNode(executable,env=process.env) {
  if(typeof executable!=='string'||!path.isAbsolute(executable)||!/^node(?:js|\.exe)?$/i.test(path.basename(executable)))throw unavailable('模型服务需要独立的 node.exe；不能使用 Electron 可执行文件。');
  try {
    await access(executable);
    const {stdout}=await execFileAsync(executable,['-e','process.stdout.write(JSON.stringify({node:process.versions.node,electron:process.versions.electron||null,release:process.release.name}))'],{env:standaloneEnvironment(env),windowsHide:true,timeout:8000,maxBuffer:4096});
    const info=JSON.parse(stdout),[major,minor]=String(info.node).split('.').map(Number);
    if(info.electron||info.release!=='node'||!Number.isInteger(major)||!Number.isInteger(minor)||major<24||(major===24&&minor<9))throw Error('unsupported runtime');
    return {executable,node:info.node,electron:null};
  }catch{throw unavailable('独立 Node.js 不可用或版本过旧。请使用 Node.js 24.9 或更新版本运行桌面启动脚本。');}
}
export async function resolveNode({env=process.env,execPath=process.execPath,versions=process.versions,executable}={}) {
  // An explicitly configured runtime must fail clearly rather than silently using Electron.
  const configured=executable||env.GOUXING_NODE_EXE;
  if(configured)return inspectNode(configured,env);
  if(!versions.electron)return inspectNode(execPath,env);
  const candidates=[env.npm_node_execpath];
  const paths=Object.entries(env).find(([key])=>key.toUpperCase()==='PATH')?.[1]||'';
  for(const directory of paths.split(path.delimiter).filter(Boolean))candidates.push(path.join(directory,process.platform==='win32'?'node.exe':'node'));
  for(const candidate of new Set(candidates.filter(Boolean))){try{return await inspectNode(candidate,env);}catch{}}
  throw unavailable('找不到独立 Node.js。请通过 start-desktop-local.cmd 或 npm start 重新打开助手，或配置 GOUXING_NODE_EXE。');
}
