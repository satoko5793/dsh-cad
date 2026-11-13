// Explicit integration, launched through run-agent-live.mjs inside Electron.
import {app,BrowserWindow,ipcMain} from 'electron';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
import {Session} from '../session.mjs';
import {configView,saveConfig} from '../agent-config.mjs';
const directory=process.env.GOUXING_TEST_DIR||path.join(ROOT,'.data','agent-regression',randomUUID());
assert.ok(path.resolve(directory).startsWith(path.join(ROOT,'.data','agent-regression')+path.sep));
app.setPath('userData',path.join(directory,'electron'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
void app.whenReady().then(run).catch(error=>{console.error(String(error.stack||error).replace(/sk-[\w-]+/g,'[redacted]'));app.exit(1);});
async function run(){
  assert.ok(process.versions.electron);await mkdir(directory,{recursive:true});
  const bridge=new FreeCADBridge(directory);await bridge.restore();if(!(await bridge.snapshot()).connected)await bridge.connect(process.env.FREECAD_EXE);
  const session=new Session(directory,bridge);await session.load();await session.send('生成一个简化飞机');await session.confirm(session.state.plan.id);assert.equal(session.state.phase,'done');
  const before=await bridge.snapshot(),captures=[];for(const view of ['isometric','front','top','right','current']){const image=await bridge.capture(view);assert.equal(image.cameraRestored,true);assert.ok(image.sampledColors>4);captures.push({view,sampledColors:image.sampledColors,cameraRestored:image.cameraRestored});}const after=await bridge.snapshot();assert.equal(before.fingerprint,after.fingerprint);
  const checks=[{name:'native screenshot and camera restoration do not change CAD fingerprint',passed:true}],stats={textUpdates:0,reasoningUpdates:0,toolUpdates:0};
  const window=new BrowserWindow({width:1120,height:800,show:true,title:'构形 · Agent 体验验证',webPreferences:{preload:path.join(ROOT,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  window.webContents.on('console-message',(_event,...args)=>console.log('renderer:',...args));
  const state=async()=>({...session.state,app:{version:'1.1.0-test'},window:{small:false,pinned:false,shortcut:'测试'},model:{name:process.env.CAD_LLM_MODEL||'deepseek-flash'},agentConfig:await configView(directory)});
  const publish=async()=>{if(!window.isDestroyed())window.webContents.send('harness:state',await state());};
  session.on('change',()=>{const m=session.turn?.message;if(m?.text)stats.textUpdates++;if(m?.attempts?.some(a=>Object.values(a.blocks).some(b=>b.type==='reasoning'&&b.text)))stats.reasoningUpdates++;if(m?.tools?.length)stats.toolUpdates++;void publish();});
  ipcMain.handle('harness:call',async(_event,method,payload)=>{
    try{if(method==='state')return state();if(method==='draft'){session.state.draft=payload;session.publish();}else if(method==='send')await session.send(payload);else if(method==='cancel')session.cancel();else if(method==='agent-config'){await saveConfig(directory,payload);await publish();}else if(method==='agent-config-refresh')await publish();return {ok:true};}catch(e){return {ok:false,error:e.message};}
  });
  await window.loadFile(path.join(ROOT,'ui','index.html'));window.setTitle('构形 · Agent 体验验证');await delay(500);
  // DOM probes inspect layout/event wiring of our own isolated renderer, not any browser origin.
  const js=code=>window.webContents.executeJavaScript(code);
  const seed=Array.from({length:24},(_,i)=>({id:'history-'+i,role:i%2?'assistant':'user',text:'历史测试消息 '+i+'\n'+('用于检查滚动位置。'.repeat(20)),time:new Date().toISOString()}));
  session.state.messages.unshift(...seed);session.publish(false);await delay(180);
  const geometry=()=>js(`(()=>{const c=document.getElementById('messages');return {distance:c.scrollHeight-c.scrollTop-c.clientHeight,top:c.scrollTop,height:c.scrollHeight};})()`);
  console.log('initial renderer geometry:',await geometry(),await js(`({articles:document.querySelectorAll('article').length,error:document.getElementById('error').textContent})`));
  assert.ok((await geometry()).distance<4,'initial history follows latest');
  await js(`document.getElementById('messages').scrollTop=50`);await delay(100);const reading=(await geometry()).top;
  session.message('assistant','新回复不应抢走历史阅读位置');session.publish(false);await delay(150);assert.ok(Math.abs((await geometry()).top-reading)<4);
  assert.equal(await js(`document.getElementById('latest').hidden`),false);
  await js(`document.getElementById('latest').click()`);await delay(100);assert.ok((await geometry()).distance<4);checks.push({name:'renderer follows latest and preserves history reading position',passed:true});
  session.state.messages=session.state.messages.filter(m=>!m.id.startsWith('history-'));session.publish(false);
  await session.send('请加载视觉检查技能，用工具查看当前工程，并获取等轴测和俯视两张截图。根据你实际收到的图片描述零件颜色、外形和相对位置，指出外观问题，并区分几何数据与未验证的加工装配项目。现在仅检查，不改模型。');
  const deadline=Date.now()+240000;while(session.turn&&Date.now()<deadline)await delay(250);if(session.turn){session.cancel();throw Error('Real visual model turn timed out');}
  const response=session.state.messages.at(-1),tools=response.tools||[];
  assert.ok(stats.textUpdates>=2,'must receive multiple live text publications before completion');assert.ok(stats.reasoningUpdates>0,'provider reasoning was actually observed');
  assert.ok(tools.some(t=>t.name==='freecad_inspect'&&t.state==='done'));assert.ok(tools.filter(t=>t.name==='freecad_capture'&&t.state==='done').length>=2,JSON.stringify(tools));assert.ok(tools.some(t=>t.name==='skill_read'&&t.state==='done'));
  assert.equal(session.state.observation?.vision,true,'configured model must declare image input');assert.ok(/颜色|蓝|棕|绿|灰|黄/.test(response.text),'response must address visual evidence');
  assert.equal((await bridge.snapshot()).fingerprint,before.fingerprint,'inspection must not alter native geometry or selection');
  await delay(200);assert.ok((await geometry()).distance<4,'streamed output follows bottom');
  assert.ok(await js(`document.querySelectorAll('.reasoning').length>0&&document.querySelectorAll('.tool-card').length>=3`));
  checks.push({name:'real Electron → DSH live text/reasoning/tools → native multiview images → model response',passed:true});
  await js(`document.getElementById('settings').click()`);await delay(150);assert.equal(await js(`document.getElementById('settings-dialog').open`),true);
  assert.equal(await js(`document.querySelectorAll('#tool-settings input').length`),4);checks.push({name:'settings dialog loads actual tool and skill configuration',passed:true});
  await session.saving;await writeFile(path.join(directory,'visual-response.txt'),response.text);
  await atomicJson(path.join(ROOT,'validation','agent-experience-results.json'),{date:new Date().toISOString(),electron:process.versions.electron,checks,stats,captures,images:tools.filter(t=>t.name==='freecad_capture').length,passed:true,note:'Isolated native airplane; real model image route. No physical fabrication/assembly test.'});
  console.log(JSON.stringify({directory,checks,stats,response:response.text},null,2));
  // Keep this isolated review window briefly for native visual QA; never close FreeCAD.
  await delay(1000);app.quit();
}
