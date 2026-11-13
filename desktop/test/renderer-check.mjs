// Isolated renderer fixture. No model request or CAD write in this check.
import {app,BrowserWindow,ipcMain,Menu} from 'electron';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT} from '../bridge.mjs';
import {configView,saveConfig} from '../agent-config.mjs';
const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-renderer-'));
app.setPath('userData',path.join(directory,'electron'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
void app.whenReady().then(run).catch(error=>{console.error(error);app.exit(1);});
async function run(){
  Menu.setApplicationMenu(null);
  const state={messages:[],draft:'保留测试草稿',attachments:[],history:[],phase:'idle',status:'界面测试副本 · 不操作 CAD',context:{connected:false,selection:[]},window:{small:false,pinned:false,shortcut:'测试'},app:{version:'1.1.0 · 界面测试'},model:{name:'界面测试'}};
  state.agentConfig=await configView(directory);
  const window=new BrowserWindow({width:1120,height:800,frame:false,show:true,title:'构形 · 界面验证',webPreferences:{preload:path.join(ROOT,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  const publish=()=>window.webContents.send('harness:state',state);
  ipcMain.handle('harness:call',async(_event,method,payload)=>{try{
    if(method==='state')return state;
    if(method==='draft')state.draft=payload;
    if(method==='toggle'){state.window.small=!state.window.small;window.setSize(state.window.small?396:1120,state.window.small?594:800);}
    if(method==='agent-config'){await saveConfig(directory,payload);state.agentConfig=await configView(directory);}
    if(method==='close')app.quit();
    publish();return {ok:true};
  }catch(e){return {ok:false,error:e.message};}});
  await window.loadFile(path.join(ROOT,'ui','index.html'));window.setTitle('构形 · 界面验证');await delay(200);
  const js=code=>window.webContents.executeJavaScript(code),probe=()=>js(`(()=>{const c=document.getElementById('messages');return {distance:c.scrollHeight-c.scrollTop-c.clientHeight,top:c.scrollTop,draft:document.getElementById('draft').value};})()`);
  state.messages=Array.from({length:18},(_,i)=>({id:'fixture-'+i,role:i%2?'assistant':'user',text:'滚动测试 '+i+'\n'+'历史消息。'.repeat(35)}));publish();await delay(200);assert.ok((await probe()).distance<4);
  const message={id:'live',role:'assistant',text:'',streaming:true,attempts:[{id:'attempt',state:'running',blocks:{0:{type:'reasoning',text:'这是界面测试的思考示例，非真实模型输出。'},1:{type:'text',text:'**检查结果**\n- 三个零件清晰可见。\n- <img src=x onerror=alert(1)>\n![截图](C:/private/file.png)'}}}],tools:[{id:'fixture-tool',name:'freecad_inspect',state:'done',arguments:{},result:'界面测试结果'}]};state.messages.push(message);publish();await delay(200);
  assert.ok((await probe()).distance<4);assert.equal(await js(`document.querySelectorAll('.message strong').length>0`),true);assert.equal(await js(`document.querySelectorAll('.message img').length`),0);
  await js(`document.querySelector('.reasoning').open=true;document.getElementById('messages').scrollTop=40`);await delay(100);const before=(await probe()).top;
  message.attempts[0].blocks[1].text+='\n继续生成的示例内容。';publish();await delay(150);assert.ok(Math.abs((await probe()).top-before)<4);assert.equal(await js(`document.querySelector('.reasoning').open`),true);
  await js(`document.getElementById('latest').click();document.getElementById('toggle').click()`);await delay(200);assert.ok((await probe()).distance<4);assert.equal((await probe()).draft,state.draft);
  assert.equal(await js(`(()=>{const b=document.getElementById('send').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&!document.querySelector('.task-area').contains(document.getElementById('send'));})()`),true,'composer must remain outside the scrolling task panel');
  await js(`document.getElementById('settings').click()`);await delay(100);assert.equal(await js(`document.getElementById('settings-dialog').open`),true);
  await js(`document.getElementById('settings-dialog').scrollTop=10000`);await delay(100);
  assert.equal(await js(`(()=>{const d=document.getElementById('settings-dialog').getBoundingClientRect(),c=document.getElementById('settings-close').getBoundingClientRect(),s=document.getElementById('settings-save').getBoundingClientRect();return c.top>=d.top&&c.bottom<=d.bottom&&s.top>=d.top&&s.bottom<=d.bottom;})()`),true,'compact settings must keep close and save visible after scrolling');
  await js(`document.querySelector('[data-tool="freecad_capture"]').checked=false;document.getElementById('settings-form').requestSubmit()`);await delay(150);assert.equal(state.agentConfig.tools.includes('freecad_capture'),false);
  await js(`document.getElementById('settings-close').click();document.getElementById('toggle').click()`);await delay(150);assert.equal(await js(`document.body.classList.contains('compact')`),false);
  console.log('PASS renderer: scroll / reading position / expanded details / safe formatting / compact draft / config save / sticky settings controls');
  // Leave the fixture visible for optional native inspection, bounded by env.
  await delay(Number(process.env.GOUXING_UI_HOLD_MS)||1000);app.quit();
}
