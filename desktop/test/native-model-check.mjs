// Production main/preload/renderer, real DSH tools, confirmed native API execution.
import {app} from 'electron';
import {writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
const directory=process.env.GOUXING_DATA_DIR;
assert.ok(path.resolve(directory||'').startsWith(path.join(ROOT,'.data','native-model')+path.sep));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),report={date:new Date().toISOString(),passed:false,checks:[],turns:[]};
let window;
const js=code=>window.webContents.executeJavaScript(code),call=(method,payload)=>js(`window.harness.call(${JSON.stringify(method)},${JSON.stringify(payload)})`),state=()=>call('state');
const probe=()=>js(`(()=>{const c=document.getElementById('messages'),d=document.getElementById('draft');return {distance:c.scrollHeight-c.scrollTop-c.clientHeight,max:c.scrollHeight-c.clientHeight,top:c.scrollTop,draft:d.value,focused:document.activeElement===d,compact:document.body.classList.contains('compact'),cards:document.querySelectorAll('.tool-card').length,overflow:document.documentElement.scrollWidth>innerWidth,composerBottom:d.getBoundingClientRect().bottom,viewport:innerHeight};})()`);
const check=(name,detail={})=>{report.checks.push({name,passed:true,...detail});console.log('PASS '+name);};
app.on('browser-window-created',(_event,created)=>{window=created;created.webContents.once('did-finish-load',()=>void delay(400).then(run).catch(fail));});
async function finish(code){if(window&&!window.isDestroyed())window.destroy();app.exit(code);}
async function fail(error){report.error=String(error.stack||error).replace(/sk-[\w-]+/g,'[redacted]');try{report.ui=await probe();report.active=await js(`({id:document.activeElement?.id,tag:document.activeElement?.tagName,focused:document.hasFocus()})`);await writeFile(path.join(directory,'failure-ui.png'),(await window.webContents.capturePage()).toPNG());}catch{}await atomicJson(path.join(directory,'results.json'),report);console.error(report.error);await finish(1);}
async function ask(text,{compact=false}={}){
  const previous=(await state()).messages.length;
  await js(`(()=>{const d=document.getElementById('draft');d.focus();d.value=${JSON.stringify(text)};d.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('send').click();})()`);
  const stats={request:text,textVersions:0,reasoningVersions:0,toolRunning:false,toolReturned:false};let oldText='',oldReason='',switched=false,expanded=false,readUntil=0,readTop=0;
  const deadline=Date.now()+360000;
  while(Date.now()<deadline){
    const s=await state(),message=s.messages.slice(previous).find(m=>m.role==='assistant'&&(m.attempts?.length||m.streaming));
    if(message){if(message.text&&message.text!==oldText){stats.textVersions++;oldText=message.text;}const reason=JSON.stringify(message.attempts?.map(a=>Object.values(a.blocks).filter(b=>b.type==='reasoning'))||[]);if(reason!=='[]'&&reason!==oldReason){stats.reasoningVersions++;oldReason=reason;}stats.toolRunning||=message.tools?.some(t=>t.state==='running')||false;stats.toolReturned||=message.tools?.some(t=>t.state==='done')||false;}
    if(compact&&s.phase==='planning'&&message?.attempts?.length&&!switched){
      await js(`document.getElementById('toggle').click()`);await delay(150);await js(`(()=>{const d=document.getElementById('draft');d.focus();d.value='保留下一步草稿';d.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('messages').scrollTop=0;})()`);await delay(100);
      const p=await probe();assert.ok(p.compact&&!p.overflow&&p.composerBottom<p.viewport&&p.focused);switched=true;
    }
    if(switched&&!expanded){let p=await probe();assert.equal(p.draft,'保留下一步草稿');if(window.isFocused())assert.ok(p.focused);else stats.externalFocusObserved=true;if(!readUntil&&p.max>150){await js(`(()=>{const c=document.getElementById('messages');c.dispatchEvent(new WheelEvent('wheel',{deltaY:-100}));c.scrollTop=0;})()`);await delay(100);p=await probe();readTop=p.top;readUntil=Date.now()+1500;}if(readUntil&&Date.now()<readUntil)assert.ok(Math.abs(p.top-readTop)<6);else if(readUntil){await js(`document.getElementById('latest').click();document.getElementById('toggle').click()`);expanded=true;stats.compactDraftFocusAndHistory=true;}}
    if(s.messages.length>previous&&!['preparing','planning'].includes(s.phase)&&!s.messages.some(m=>m.streaming)){
      // A short turn may finish while this check is deliberately reading history.
      // Complete that gesture and return to latest before asserting auto-follow.
      if(switched&&!expanded){await delay(100);continue;}
      stats.phase=s.phase;stats.tools=(message?.tools||[]).map(({name,state})=>({name,state}));report.turns.push(stats);await writeFile(path.join(directory,'turn-'+report.turns.length+'.txt'),s.messages.slice(previous).map(m=>m.text).join('\n\n'));console.log('TURN '+report.turns.length+' '+JSON.stringify(stats));
      assert.ok(!s.messages.slice(previous).some(m=>m.text.includes('本次未操作 CAD：')));assert.ok(stats.textVersions>1);await delay(150);assert.ok((await probe()).distance<6);return {state:s,message};
    }
    await delay(100);
  }
  await call('cancel');throw Error('Native model turn timed out');
}
async function capture(bridge,name){const image=await bridge.capture('isometric');await copyFile(path.join(bridge.directory,'observations',image.id+'.png'),path.join(directory,name+'.png'));}
async function confirm(){const s=await state();await call('confirm',s.plan.id);const done=await state();assert.equal(done.phase,'done',done.status);return done;}
async function run(){
  window.setTitle('构形 · 原生接口飞机实测');const bridge=new FreeCADBridge(directory);await bridge.restore();const initial=await bridge.snapshot();assert.ok(initial.connected&&initial.capabilities.includes('native_interfaces'));
  const start=await ask('新建一个测试工程，做一架像样一点的小飞机，机身圆滑、机翼渐缩，有水平尾翼和垂直尾翼，机长约150毫米。先准备一个可修改的原生模型计划。',{compact:true});
  assert.equal(start.state.phase,'ready');const plan=start.state.plan;assert.equal(plan.action,'native_operations');assert.ok(plan.operations.some(o=>o.method==='part.loft'||o.method==='part.revolve'));assert.equal((await bridge.snapshot()).fingerprint,initial.fingerprint);report.creationMethods=[...new Set(plan.operations.map(o=>o.method))];report.creationSteps=plan.operations.length;
  check('Agent chooses native curved modeling and prepares explicit reviewed API steps',{steps:plan.operations.length,methods:report.creationMethods});assert.ok(report.turns[0].compactDraftFocusAndHistory);check('Live compact/full switch preserves draft, renderer focus and reading position');
  await confirm();const before=await bridge.snapshot();assert.ok(before.document.native&&before.document.components.length>=4);assert.ok(before.document.components.every(c=>c.valid&&c.solids>0));report.before=before.document.components;await capture(bridge,'before');
  for(const mirror of plan.operations.filter(o=>o.method==='part.mirror'))assert.ok(before.document.objects.find(o=>o.name===mirror.args.source)?.visible,'mirror must preserve its source visibility');
  await bridge.execute({action:'save_as',path:path.join(directory,'before.FCStd'),expected:(await bridge.snapshot()).fingerprint});check('Confirmed native model contains valid curved fuselage and multiple independent components');
  const edit=await ask('把左右主翼的翼尖分别向外移动10毫米，加大翼展，机身和尾翼保持不变。先读取当前特征，直接修改这个工程。');
  assert.equal(edit.state.phase,'ready');assert.equal(edit.state.plan.action,'native_operations');assert.ok(!edit.state.plan.operations.some(o=>o.method==='doc.create'));report.editOperations=edit.state.plan.operations;assert.equal((await bridge.snapshot()).document.token,before.document.token);await confirm();
  const after=await bridge.snapshot();assert.equal(after.document.token,before.document.token);assert.equal(after.document.components.length,before.document.components.length);assert.ok(after.document.components.every(c=>c.valid&&c.solids>0));
  const changed=before.document.components.filter(a=>{const b=after.document.components.find(c=>c.object===a.object);return JSON.stringify(a.bounds)!==JSON.stringify(b?.bounds)||Math.abs(a.volume-b.volume)>1e-6;});assert.ok(changed.length>0&&changed.length<before.document.components.length);report.changed=changed.map(c=>c.object);report.after=after.document.components;await capture(bridge,'after');await bridge.execute({action:'save_as',path:path.join(directory,'after.FCStd'),expected:(await bridge.snapshot()).fingerprint});check('Agent modifies existing native wing features and preserves other geometry',{changed:report.changed});
  const mainWings=parts=>parts.filter(c=>/wing|主翼|机翼/i.test(c.object+' '+c.name)&&!/tail|尾/i.test(c.object+' '+c.name)),span=parts=>Math.max(...parts.map(c=>c.bounds[4]))-Math.min(...parts.map(c=>c.bounds[1]));
  assert.ok(mainWings(report.before).length);report.wingspanBefore=span(mainWings(report.before));report.wingspanAfter=span(mainWings(report.after));assert.ok(Math.abs(report.wingspanAfter-report.wingspanBefore-20)<1e-5);
  const review=await ask('现在看看真实模型的等轴测和俯视图，检查它像不像飞机，翼展修改得对不对；结合几何数据说明还存在哪些外观问题，先别修改。');assert.equal(review.state.phase,'idle');assert.ok(review.message.tools.some(t=>t.name==='freecad_capture'&&t.state==='done'));assert.equal(review.state.observation.vision,true);check('Agent inspects actual updated CAD images and reports remaining issues');
  await writeFile(path.join(directory,'full.png'),(await window.webContents.capturePage()).toPNG());await call('toggle');await delay(200);await writeFile(path.join(directory,'compact.png'),(await window.webContents.capturePage()).toPNG());const p=await probe();assert.ok(p.compact&&!p.overflow&&p.composerBottom<p.viewport);check('Production stream, tool cards and compact composer stay visible',{cards:p.cards});
  await js(`document.getElementById('settings').click()`);await delay(100);assert.equal(await js(`document.querySelectorAll('#tool-settings input[type=checkbox]').length`),5);assert.equal((await state()).agentConfig.nativeCatalog.length,66);check('Native API catalog and its tool group appear in actual settings');
  report.passed=true;report.finishedAt=new Date().toISOString();report.note='Actual production Electron renderer/IPC, standalone DSH model, native FreeCAD API calls. capturePage is application rendering evidence, not OS focus/shortcut acceptance. No physical manufacturing or aerodynamics validation.';await atomicJson(path.join(directory,'results.json'),report);await atomicJson(path.join(ROOT,'validation','native-model-results.json'),{...report,before:report.before,after:report.after});console.log('NATIVE_MODEL_PASSED '+directory);await finish(0);
}
await import('../main.mjs');
