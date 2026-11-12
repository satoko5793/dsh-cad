import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ROOT } from './build.mjs';

export class Harness {
  constructor(onNotification) {this.onNotification=onNotification; this.pending=new Map(); this.seq=0; this.process=null; this.ready=null; this.lastError='';}
  async start() {
    if(this.ready) return this.ready;
    this.ready=this.boot().catch(error=>{this.ready=null; throw error;}); return this.ready;
  }
  async boot() {
    const home=process.env.DSH_HOME || path.join(os.homedir(),'.dsh');
    const profile=path.join(home,'profiles','cad-studio'); await mkdir(profile,{recursive:true});
    await writeFile(path.join(profile,'package.json'),JSON.stringify({name:'cad-studio-profile',private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-sdk-app']}}},null,2));
    await writeFile(path.join(profile,'cordis.yml'),'[]\n');
    // Dedicated profile: existing web profile and its API credentials are preserved.
    const persona=await readFile(path.join(ROOT,'prompt.txt'),'utf8');
    const patch=[{id:'system-prompt',config:{personaPrefix:persona}},{insert:[{id:'cad-studio-tools',name:path.join(ROOT,'cad-plugin.mjs').replaceAll('\\','/')}]},{id:'tool-plugin-manager',disabled:true}];
    await writeFile(path.join(profile,'cordis.patch.yml'),JSON.stringify(patch,null,2));
    const cli=path.resolve(ROOT,'../node_modules/@deepseek-ai/dsh/lib/bin.js');
    const child=spawn(process.execPath,[cli,'--profile','cad-studio'],{cwd:ROOT,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,DSH_HOME:home}});
    this.process=child; this.lastError='';
    child.stderr.on('data',b=>{this.lastError=(this.lastError+b).slice(-10000);});
    createInterface({input:child.stdout}).on('line',line=>{
      let frame;try{frame=JSON.parse(line);}catch{return;}
      if(frame.id!==undefined && !frame.method){const pending=this.pending.get(frame.id);if(pending){clearTimeout(pending.timer);this.pending.delete(frame.id);frame.error?pending.reject(new Error(frame.error.message)):pending.resolve(frame.result);}}
      else if(frame.method && frame.id!==undefined){child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:frame.id,result:frame.method==='approval/request'?{outcome:'rejected'}:{cancelled:true}})+'\n');}
      else if(frame.method) this.onNotification(frame.method,frame.params);
    });
    const fail=error=>{this.ready=null;this.process=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();};
    child.on('error',fail); child.on('exit',code=>fail(new Error(`DSH runtime exited (${code}). ${this.lastError.slice(-1500)}`))); child.stdin.on('error',()=>{});
    const info=await this.request('initialize',{cwd:ROOT,provider:'deepseek-official',model:'deepseek-flash',reasoningEffort:'high',maxTokens:12000},45000);
    return info;
  }
  request(method,params,timeout=600000) {
    if(!this.process) return Promise.reject(new Error('DSH is not running'));
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('DSH request timed out')); if(this.process)this.process.kill();},timeout);
      this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
    });
  }
  async prompt(sessionId,text) {
    await this.start();
    await this.request('session/prompt',{sessionId,contentBlocks:[{type:'text',text}]});
    await this.request('session/wait',{sessionId});
  }
  async close(){if(this.process){try{await this.request('shutdown',{},5000);}catch{this.process?.kill();}}}
}
