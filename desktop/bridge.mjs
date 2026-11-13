import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export async function atomicJson(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2)); await rename(tmp, file);
}
export class FreeCADBridge {
  constructor(dataDir) { this.dataDir = dataDir; this.directory = null; this.child = null; this.launching = false; }
  async restore() {
    try {const saved=JSON.parse(await readFile(path.join(this.dataDir,'connection.json'),'utf8'));this.directory=saved.directory;}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  async connect(executable) {
    const current=await this.snapshot();
    if (this.launching || (current.connected&&current.protocol>=2&&current.capabilities?.includes('capture_view'))) throw Error('FreeCAD 已连接或正在启动');
    await access(executable); this.launching = true;
    try {
      this.directory = path.join(this.dataDir, 'freecad', randomUUID());
      this.error=null;
      for (const dir of ['inbox', 'results', 'consumed']) await mkdir(path.join(this.directory, dir), {recursive:true});
      await atomicJson(path.join(this.dataDir,'connection.json'),{directory:this.directory});
      const macro = path.join(this.directory, 'connect.FCMacro');
      const source = path.join(ROOT, 'freecad', 'bridge.py');
      await writeFile(macro, `import sys\nsys.path.insert(0, ${JSON.stringify(path.dirname(source).replaceAll('\\','/'))})\nexec(compile(open(${JSON.stringify(source.replaceAll('\\','/'))}, encoding='utf-8').read(), 'gouxing-bridge', 'exec'))\n`);
      this.child = spawn(executable, ['--user-cfg', path.join(this.directory, 'user.cfg'), '--system-cfg', path.join(this.directory, 'system.cfg'), macro], {
        windowsHide:false, detached:true, stdio:'ignore', env:{...process.env, GOUXING_BRIDGE_DIR:this.directory}
      });
      // A separate instance owns the bridge. Never inject into/close a user's existing instance.
      this.child.on('error', error => { this.error = error.message; });
      this.child.unref();
      const end = Date.now()+45000;
      while(Date.now()<end) { const state=await this.snapshot(); if(state.connected)return state; if(this.error)throw Error(this.error); await new Promise(r=>setTimeout(r,250)); }
      throw Error('FreeCAD 启动超时。请检查路径及宏是否运行；不会自动重试或关闭 CAD。');
    } finally { this.launching=false; }
  }
  async snapshot() {
    try {
      const state=JSON.parse(await readFile(path.join(this.directory,'snapshot.json'),'utf8'));
      let progress=null;try{progress=JSON.parse(await readFile(path.join(this.directory,'progress.json'),'utf8'));}catch{}
      const busy=progress?.active&&Date.now()-progress.heartbeat*1000<5000;
      return {...state,progress,busy:!!busy,connected:!!busy||Date.now()-state.heartbeat*1000<5000};
    }
    catch{return {connected:false,document:null,selection:[]};}
  }
  async execute(plan) {
    const state=await this.snapshot(); if(!state.connected)throw Error('FreeCAD 未连接，未执行修改');
    const id=randomUUID(), file=path.join(this.directory,'inbox',`${id}.json`);
    await atomicJson(file,{...plan,id,deadline:Date.now()/1000+12});
    const end=Date.now()+20000;
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
    if(!context.capabilities?.includes('capture_view'))throw Error('当前 CAD 连接尚无视觉工具，请点击升级连接；原工程保持打开');
    const result=await this.execute({action:'capture_view',view,expected:context.fingerprint});
    const observation=result.observation;
    if(!/^[a-f0-9-]{36}$/.test(observation?.id||''))throw Error('无效的 CAD 截图标识');
    const bytes=await readFile(path.join(this.directory,'observations',observation.id+'.png'));
    if(bytes.length>8000000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('CAD 截图无效或过大');
    return {...observation,data:bytes.toString('base64'),mimeType:'image/png'};
  }
}
