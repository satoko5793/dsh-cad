// Actual production entry/preload/UI, in a hidden window with isolated app data.
// No CAD connection command, camera action, model request or global shortcuts.
import {app,BrowserWindow,globalShortcut} from 'electron';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT} from '../infrastructure/paths.mjs';
import {atomicJson} from '../infrastructure/storage.mjs';
import {saveConfig} from '../agent/config.mjs';

process.env.GOUXING_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'gouxing-shell-'));
const live=process.env.GOUXING_SHELL_MODEL_CHECK==='1';
if(live)await saveConfig(process.env.GOUXING_DATA_DIR,{tools:['skill_read','freecad_inspect'],disabledSkills:[]});
BrowserWindow.prototype.show=function(){};
globalShortcut.register=()=>false;
const timeout=setTimeout(()=>{console.error('Shell check timed out');app.exit(1);},live?180000:20000);
app.on('browser-window-created',(_event,window)=>{
  window.webContents.once('did-finish-load',()=>void check(window).catch(error=>{console.error(error);app.exit(1);}));
});
async function check(window){
  const js=code=>window.webContents.executeJavaScript(code);
  const version=JSON.parse(await readFile(path.join(ROOT,'..','package.json'),'utf8')).version;
  const state=await js(`window.harness.call('state')`);
  assert.equal(state.app.version,version);assert.equal(state.phase,'idle');
  assert.equal(window.isVisible(),false);
  assert.equal(window.webContents.getLastWebPreferences().nodeIntegration,false);
  await js(`window.harness.call('draft','shell fixture draft')`);
  await js(`window.harness.call('toggle')`);
  let next=await js(`window.harness.call('state')`);
  assert.equal(next.window.small,true);assert.equal(next.draft,'shell fixture draft');
  await js(`window.harness.call('toggle')`);
  next=await js(`window.harness.call('state')`);assert.equal(next.window.small,false);
  assert.equal(await js(`!!document.getElementById('messages') && !!document.getElementById('draft')`),true);
  if(live){
    await js(`window.__live={patches:0,textUpdates:0,reasoningOpened:false,stable:true};window.harness.onStream(({message})=>{__live.patches++;if(message.text)__live.textUpdates++;const d=document.querySelector('[data-message-id="'+message.id+'"] .reasoning');if(d&&!__live.reasoningOpened){__live.node=d;d.querySelector('summary').click();__live.reasoningOpened=true;}else if(__live.node&&(!__live.node.isConnected||!__live.node.open))__live.stable=false;});true;`);
    const response=await js(`window.harness.call('send','请先用skill_read加载freecad-native技能，再用freecad_inspect读取当前工程状态。只读，不准备计划、不截图、不修改CAD。用三点中文解释目前可以怎样继续细化飞机，并说明建议需要实际验证；请直接输出简明结论。')`);assert.equal(response.ok,true);
    let result;do{await new Promise(r=>setTimeout(r,100));result=await js(`window.harness.call('state')`);}while(['preparing','planning'].includes(result.phase));
    assert.equal(result.phase,'idle');assert.equal(result.plan,null);assert.equal(result.history.length,0);
    const message=result.messages.at(-1),stats=await js(`({patches:__live.patches,textUpdates:__live.textUpdates,reasoningOpened:__live.reasoningOpened,stable:__live.stable})`);
    assert.ok(message.text?.length>0&&!message.text.includes('本次未操作 CAD：'));assert.notEqual(message.completionReason,'max-tokens');
    for(const name of ['skill_read','freecad_inspect'])assert.ok(message.tools?.some(t=>t.name===name&&t.state==='done'));
    assert.ok(stats.patches>1&&stats.textUpdates>0&&stats.stable&&stats.reasoningOpened);
    assert.ok(await js(`document.querySelectorAll('.message.assistant .message-text').length>0`));
    assert.equal(result.agentConfig.generation.maxTokens,32768);assert.equal(result.agentConfig.generation.reasoningEffort,'low');
    await atomicJson(path.join(ROOT,'validation','stream-live-results.json'),{date:new Date().toISOString(),passed:true,electron:process.versions.electron,actualProductionEntry:true,hiddenWindow:true,tools:['skill_read','freecad_inspect'],stats,generation:result.agentConfig.generation,checks:['real DSH text rendered before turn finished','reasoning opens during generation and keeps the same expanded node','real tools and final answer are visible','no plan, camera operation, CAD launch or model write'],note:'Observed one real read-only run; no model-speed or system-focus guarantee.'});
    console.log('PASS live production stream:',JSON.stringify(stats));
  }
  clearTimeout(timeout);
  console.log('PASS production shell: stable entry / preload / IPC / UI assets / draft / full-compact state');
  app.exit(0);
}
await import('../main.mjs');
