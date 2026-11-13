import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, access, readdir, open, unlink } from 'node:fs/promises';
import { randomUUID,createHash } from 'node:crypto';
import path from 'node:path';
import {ROOT} from '../../infrastructure/paths.mjs';
import {atomicJson} from '../../infrastructure/storage.mjs';
export {ROOT,atomicJson};
import {installConnector} from './connector.mjs';

export function processExists(pid){try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}}
export async function bridgeRevision(){
  const root=path.join(ROOT,'freecad');let files=[];
  async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory()&&entry.name!=='__pycache__')await walk(path.join(dir,entry.name));else if(entry.isFile()&&entry.name.endsWith('.py'))files.push(path.join(dir,entry.name));}}
  await walk(root);files.sort();files.push(path.join(ROOT,'native-catalog.json'),path.join(ROOT,'freecad-addon','InitGui.py'));const hash=createHash('sha256');for(const file of files)hash.update(await readFile(file));return hash.digest('hex');
}
export class FreeCADBridge {
  constructor(dataDir,options={}) { this.dataDir=dataDir;this.workspace=options.workspace||process.env.GOUXING_CAD_WORKSPACE||dataDir;this.directory=null;this.child=null;this.launching=false; }
  async restore() {
    for(const base of [...new Set([this.workspace,this.dataDir])]){try {const saved=JSON.parse(await readFile(path.join(base,'connection.json'),'utf8'));this.directory=saved.directory;this.expectedPid=saved.pid;if((await this.snapshot()).connected){if(base!==this.dataDir){await mkdir(this.dataDir,{recursive:true});await atomicJson(path.join(this.dataDir,'connection.json'),saved);}return;}}catch(error){if(error.code!=='ENOENT')throw error;}}
  }
  async connect(executable) {
    await mkdir(this.dataDir,{recursive:true});
    const current=await this.snapshot();
    if(this.launching)throw Error('正在连接现有 CAD，请稍候');
    if(current.connected){
      if(current.bridgeRevision===await bridgeRevision())return current;
      if(executable)await installConnector(executable,this.workspace);
      if(!current.capabilities?.includes('reload_bridge'))throw Object.assign(Error('连接组件已准备好。首次接入旧版CAD，请先保存工程并重开FreeCAD一次，之后助手会自动连接。'),{code:'CAD_CONNECT_RESTART_REQUIRED'});
      await this.execute({action:'reload_bridge',expected:current.fingerprint});
      const end=Date.now()+15000,revision=await bridgeRevision();while(Date.now()<end){const next=await this.snapshot();if(next.bridgeRevision===revision)return next;await new Promise(r=>setTimeout(r,150));}throw Error('原窗口升级尚未完成；请检查CAD，不会新开实例');
    }
    if(current.pid&&processExists(current.pid))throw Error('原CAD仍在运行，但连接暂时无响应。请检查原窗口；不会另开CAD。');
    // Recheck the shared workspace before creating any process.
    if(this.workspace!==this.dataDir){try{const saved=JSON.parse(await readFile(path.join(this.workspace,'connection.json'),'utf8'));this.directory=saved.directory;this.expectedPid=saved.pid;const shared=await this.snapshot();if(shared.connected){await atomicJson(path.join(this.dataDir,'connection.json'),saved);return this.connect(executable);}if(shared.pid&&processExists(shared.pid))throw Error('共享CAD仍在运行，连接暂时无响应；不会另开窗口');}catch(e){if(e.code!=='ENOENT')throw e;}}
    await access(executable);await installConnector(executable,this.workspace);this.launching = true;
    await mkdir(this.workspace,{recursive:true});const lockFile=path.join(this.workspace,'connect.lock');let lock;
    try {
      try{lock=await open(lockFile,'wx');}catch(e){if(e.code!=='EEXIST')throw e;const owner=Number(await readFile(lockFile,'utf8'));if(Number.isInteger(owner)&&owner>0&&!processExists(owner)){await unlink(lockFile);lock=await open(lockFile,'wx');}else throw Error('另一个连接正在启动，请稍后重试；不会重复启动CAD');}await lock.writeFile(String(process.pid));
      this.directory = path.join(this.workspace, 'freecad', randomUUID());
      this.error=null;this.launchExit=undefined;
      for (const dir of ['inbox', 'results', 'consumed']) await mkdir(path.join(this.directory, dir), {recursive:true});
      await atomicJson(path.join(this.dataDir,'connection.json'),{directory:this.directory});
      if(this.workspace!==this.dataDir)await atomicJson(path.join(this.workspace,'connection.json'),{directory:this.directory});
      this.child = spawn(executable, ['--single-instance'], {
        windowsHide:false, detached:true, stdio:'ignore', env:{...process.env, GOUXING_BRIDGE_DIR:'',GOUXING_CONNECTION_DIR:this.directory}
      });
      // FreeCAD's own single-instance handling keeps already open CAD windows.
      this.child.on('error', error => { this.error = error.message; });
      this.child.on('exit', code => {this.launchExit=code;});
      this.child.unref();
      this.expectedPid=this.child.pid;
      const connection={directory:this.directory,pid:this.expectedPid};await atomicJson(path.join(this.dataDir,'connection.json'),connection);if(this.workspace!==this.dataDir)await atomicJson(path.join(this.workspace,'connection.json'),connection);
      const end = Date.now()+45000;
      while(Date.now()<end) { const state=await this.snapshot(); if(state.connected)return state; if(this.error)throw Error(this.error);if(this.launchExit!==undefined)throw Object.assign(Error(this.launchExit===0?'连接组件已安装。请保存并重开当前FreeCAD一次，助手会自动连接；没有额外启动CAD窗口。':'FreeCAD启动失败，请检查软件。不会反复启动新的窗口。'),{code:'CAD_CONNECT_RESTART_REQUIRED'}); await new Promise(r=>setTimeout(r,250)); }
      throw Error('FreeCAD连接尚未就绪。请检查原CAD窗口；不会自动重试或另开窗口。');
    } finally { if(lock){await lock.close();await unlink(lockFile);}this.launching=false; }
  }
  async snapshot(adopt=true) {
    let result;
    try {
      const state=JSON.parse(await readFile(path.join(this.directory,'snapshot.json'),'utf8'));
      let progress=null;try{progress=JSON.parse(await readFile(path.join(this.directory,'progress.json'),'utf8'));}catch{}
      const busy=progress?.active&&Date.now()-progress.heartbeat*1000<5000;
      result={...state,progress,busy:!!busy,connected:(!state.pid||processExists(state.pid))&&(!!busy||Date.now()-state.heartbeat*1000<5000)};
    }
    catch{result={connected:false,pid:this.expectedPid,document:null,selection:[]};}
    if(!result.connected&&adopt){try{const saved=JSON.parse(await readFile(path.join(this.workspace,'connection.json'),'utf8'));if(saved.directory!==this.directory){this.directory=saved.directory;this.expectedPid=saved.pid;await mkdir(this.dataDir,{recursive:true});await atomicJson(path.join(this.dataDir,'connection.json'),saved);return this.snapshot(false);}}catch(e){if(e.code!=='ENOENT')throw e;}}
    return result;
  }
  async execute(plan) {
    const state=await this.snapshot(); if(!state.connected)throw Error('FreeCAD 未连接，未执行修改');
    const id=randomUUID(), file=path.join(this.directory,'inbox',`${id}.json`);
    await atomicJson(file,{...plan,id,deadline:Date.now()/1000+12});
    const end=Date.now()+(plan.action==='native_operations'?120000:20000);
    while(Date.now()<end) {
      try {const result=JSON.parse(await readFile(path.join(this.directory,'results',`${id}.json`),'utf8'));if(!result.ok)throw Object.assign(Error(result.error),{cadResult:true,snapshot:result.snapshot});return result;}
      catch(error){if(error.cadResult)throw error;if(error.code!=='ENOENT')throw error;}
      await new Promise(r=>setTimeout(r,150));
    }
    this.uncertainId=id;
    throw Error('CAD 未返回结果，状态待核对。请求将在 12 秒后过期，不会自动重发；请先检查 FreeCAD。');
  }
  async lateResult() {
    if(!this.uncertainId)return null;
    try {const result=JSON.parse(await readFile(path.join(this.directory,'results',`${this.uncertainId}.json`),'utf8'));this.uncertainId=null;return result;}catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async capture(view='current') {
    const context=await this.snapshot();
    if(!context.capabilities?.includes('capture_view')||!context.capabilities.includes('displayed_view'))throw Error('当前 CAD 连接需要升级视觉工具，请点击升级连接；原工程保持打开');
    const result=await this.execute({action:'capture_view',view,expected:context.fingerprint});
    const observation=result.observation;
    if(!/^[a-f0-9-]{36}$/.test(observation?.id||''))throw Error('无效的 CAD 截图标识');
    const bytes=await readFile(path.join(this.directory,'observations',observation.id+'.png'));
    if(bytes.length>8000000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('CAD 截图无效或过大');
    return {...observation,data:bytes.toString('base64'),mimeType:'image/png'};
  }
}
