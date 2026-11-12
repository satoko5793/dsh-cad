import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=path.join(root,'cad-studio');
const url='http://127.0.0.1:3090';
const checkOnly=process.argv.includes('--check');
const open=()=>{
  if(process.argv.includes('--no-open') || checkOnly)return;
  if(process.platform==='win32'){
    const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});
    browser.on('error',()=>console.log(`请在浏览器打开 ${url}`));
    browser.unref();
  }else console.log(`请在浏览器打开 ${url}`);
};
async function ready(){
  try{const response=await fetch(url+'/api/health',{signal:AbortSignal.timeout(1500)});const value=await response.json();return response.ok && value.local===true && value.provider==='DeepSeek API';}catch{return false;}
}
if(await ready()){
  console.log(`构形 CAD 已运行：${url}`);open();
}else if(checkOnly){
  console.log('构形 CAD 尚未启动。双击根目录的 start.cmd 即可。');process.exitCode=1;
}else{
  try{
    for(const file of ['../node_modules/@deepseek-ai/dsh/lib/bin.js','node_modules/three/package.json','.venv/Scripts/python.exe'])await access(path.join(app,file));
    const child=spawn(process.execPath,[path.join(app,'server.mjs')],{cwd:app,stdio:'inherit',windowsHide:true});
    let opening=false;
    const timer=setInterval(async()=>{if(!opening && await ready()){opening=true;clearInterval(timer);open();}},700);
    const limit=setTimeout(()=>clearInterval(timer),20000);
    child.on('error',error=>{clearInterval(timer);clearTimeout(limit);console.error(error.message);process.exitCode=1;});
    child.on('exit',code=>{clearInterval(timer);clearTimeout(limit);process.exitCode=code??1;});
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
  }catch{
    console.error('本机依赖尚未就绪。请查看 cad-studio/README.md 中的安装步骤。');process.exitCode=1;
  }
}
