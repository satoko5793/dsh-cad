// Drives the actual desktop/main.mjs window and narrow preload/IPC API.
// DOM probes below are renderer integration checks, separate from native visual QA.
import {app} from 'electron';
import {writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
import {evaluate} from '../design.mjs';
const directory=process.env.GOUXING_DATA_DIR;
assert.ok(path.resolve(directory||'').startsWith(path.join(ROOT,'.data','airplane-loop')+path.sep));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const symmetryOnly=process.env.GOUXING_SYMMETRY_ONLY==='1',layoutOnly=process.env.GOUXING_LAYOUT_ONLY==='1',resultFile=layoutOnly?'layout-review-results.json':symmetryOnly?'symmetry-review-results.json':'loop-results.json';
let window,report={date:new Date().toISOString(),passed:false,checks:[],turns:[]};
app.on('browser-window-created',(_event,created)=>{
  window=created;
  created.webContents.once('did-finish-load',()=>void delay(400).then(run).catch(fail));
});
async function finish(code){if(window&&!window.isDestroyed()){if(code)try{await call('cancel');}catch{}window.destroy();}app.exit(code);}
async function fail(error){report.error=String(error.stack||error).replace(/sk-[\w-]+/g,'[redacted]');await atomicJson(path.join(directory,resultFile),report);console.error(report.error);await finish(1);}
const js=code=>window.webContents.executeJavaScript(code);
const call=(method,payload)=>js(`window.harness.call(${JSON.stringify(method)},${JSON.stringify(payload)})`);
const state=()=>call('state');
const check=(name,detail={})=>{report.checks.push({name,passed:true,...detail});console.log('PASS '+name);};
const probe=()=>js(`(()=>{const c=document.getElementById('messages'),d=document.getElementById('draft');return {distance:c.scrollHeight-c.scrollTop-c.clientHeight,top:c.scrollTop,height:c.clientHeight,draft:d.value,focused:document.activeElement===d,compact:document.body.classList.contains('compact'),cards:document.querySelectorAll('.tool-card').length,reasoning:document.querySelectorAll('.reasoning').length,overflow:document.documentElement.scrollWidth>innerWidth,composerBottom:d.getBoundingClientRect().bottom,viewport:innerHeight};})()`);
async function send(text){
  await js(`(()=>{const d=document.getElementById('draft');d.focus();d.value=${JSON.stringify(text)};d.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('send').click();})()`);
  const deadline=Date.now()+10000;while(Date.now()<deadline){const s=await state();if(s.messages.at(-1)?.streaming||s.phase==='ready')return;await delay(50);}throw Error('UI did not start model turn');
}
async function ask(text,{compact=false}={}){
  const previous=(await state()).messages.length;await send(text);
  const stats={request:text,textVersions:0,reasoningVersions:0,toolRunning:false,toolReturned:false,switchedDuringRun:false,scrollHeld:false,draftHeld:false,focusHeld:false};
  let oldText='',oldReasoning='',didRead=false,readTop=0,readUntil=0,switched=false,expanded=false;
  const deadline=Date.now()+300000;
  while(Date.now()<deadline){
    const s=await state(),message=s.messages.slice(previous).find(m=>m.role==='assistant'&&(m.attempts?.length||m.streaming));
    if(message){
      if(message.text&&message.text!==oldText){stats.textVersions++;oldText=message.text;}
      const reasoning=JSON.stringify(message.attempts?.map(a=>Object.values(a.blocks).filter(b=>b.type==='reasoning'))||[]);if(reasoning!==oldReasoning&&reasoning!=='[]'){stats.reasoningVersions++;oldReasoning=reasoning;}
      stats.toolRunning||=message.tools?.some(t=>t.state==='running')||false;stats.toolReturned||=message.tools?.some(t=>t.state==='done')||false;
    }
    if(compact&&s.phase==='planning'&&message?.attempts?.length&&!switched){
      await js(`document.getElementById('toggle').click()`);await delay(120);
      await js(`(()=>{const d=document.getElementById('draft');d.focus();d.value='下一步再检查机尾';d.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(250);
      const p=await probe();assert.equal(p.compact,true);assert.equal(p.overflow,false);assert.ok(p.height>=40);assert.ok(p.composerBottom<p.viewport);stats.switchedDuringRun=true;stats.draftHeld=p.draft==='下一步再检查机尾';stats.focusHeld=p.focused;switched=true;
      await js(`(()=>{const d=document.querySelector('.reasoning');if(d)d.open=true;const c=document.getElementById('messages');c.dispatchEvent(new WheelEvent('wheel',{deltaY:-100}));c.scrollTop=0;})()`);await delay(100);readTop=(await probe()).top;readUntil=Date.now()+1700;didRead=true;
    }
    if(didRead&&Date.now()<readUntil){const p=await probe();assert.ok(Math.abs(p.top-readTop)<6,'stream must preserve history reading position');stats.scrollHeld=true;stats.draftHeld&&=p.draft==='下一步再检查机尾';stats.focusHeld&&=p.focused;}
    if(didRead&&Date.now()>=readUntil&&!expanded){await js(`document.getElementById('latest').click();document.getElementById('toggle').click()`);await delay(150);const p=await probe();assert.equal(p.compact,false);assert.equal(p.draft,'下一步再检查机尾');expanded=true;}
    if(!['preparing','planning'].includes(s.phase)&&!s.messages.some(m=>m.streaming)){
      stats.phase=s.phase;stats.tools=(message?.tools||[]).map(({name,state})=>({name,state}));
      report.turns.push(stats);await writeFile(path.join(directory,`${symmetryOnly?'symmetry-':''}turn-${report.turns.length}.txt`),s.messages.slice(previous).filter(m=>m.role==='assistant').map(m=>m.text).join('\n\n'));
      console.log('TURN '+report.turns.length+' '+JSON.stringify(stats));
      assert.ok(!s.messages.slice(previous).some(m=>m.text.includes('本次未操作 CAD：')),'model turn failed');
      assert.ok(stats.textVersions>1,'must observe real incremental text');await delay(100);assert.ok((await probe()).distance<5,'latest stream must stay visible');
      return {state:s,message};
    }
    await delay(100);
  }
  throw Error('Real model turn timed out');
}
async function run(){
  window.setTitle('构形 · 飞机闭环实测');
  const bridge=new FreeCADBridge(directory);await bridge.restore();const before=await bridge.snapshot();assert.ok(before.connected&&before.document.components.length===3);
  if(layoutOnly){
    const screenshot=async name=>{await delay(150);await writeFile(path.join(directory,name+'.png'),(await window.webContents.capturePage()).toPNG());};
    if((await state()).window.small){await call('toggle');await delay(150);}
    await call('capture');await js(`document.getElementById('observation-panel').open=true`);await screenshot('full-review');
    await call('toggle');await delay(150);const p=await probe();assert.equal(p.compact,true);assert.equal(p.overflow,false);assert.ok(p.height>=90,'compact conversation must remain readable');await screenshot('compact-review');
    assert.equal(await js(`(()=>{const b=document.getElementById('send').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&!document.querySelector('.task-area').contains(document.getElementById('send'));})()`),true,'send must remain visible with expanded CAD preview');
    check('Production compact layout retains readable chat and visible composer with actual CAD preview',{chatHeight:p.height,viewportHeight:p.viewport});
    await js(`document.getElementById('settings').click()`);await delay(100);await js(`document.getElementById('settings-dialog').scrollTop=10000`);await delay(100);
    const controls=await js(`(()=>{const d=document.getElementById('settings-dialog').getBoundingClientRect(),c=document.getElementById('settings-close').getBoundingClientRect(),s=document.getElementById('settings-save').getBoundingClientRect();return c.top>=d.top&&c.bottom<=d.bottom&&s.top>=d.top&&s.bottom<=d.bottom;})()`);assert.equal(controls,true);await screenshot('compact-settings');check('Settings close/save stay visible after compact scrolling');
    await js(`document.getElementById('settings-close').click();document.getElementById('observation-panel').open=false`);
    const changes=Object.fromEntries(Object.entries(before.document.design.parameters).map(([k,p])=>[k,p.value+.1]));await call('parameters',{changes,expected:before.fingerprint});await delay(100);await screenshot('compact-plan');assert.equal((await state()).phase,'ready');await call('cancel');
    assert.equal((await bridge.snapshot()).fingerprint,before.fingerprint);check('Six-parameter plan can be inspected/cancelled without modifying CAD');
    report.passed=true;report.finishedAt=new Date().toISOString();report.note='Application renderer captures via Electron capturePage; not OS screenshots or an OS focus/shortcut acceptance test.';await atomicJson(path.join(directory,resultFile),report);console.log('LAYOUT_REVIEW_PASSED '+directory);await delay(Number(process.env.GOUXING_TEST_HOLD_MS)||1000);await finish(0);return;
  }
  if(symmetryOnly){
    const design=before.document.design,values=Object.fromEntries(Object.entries(design.parameters).map(([k,p])=>[k,p.value]));
    report.planformSymmetry={};for(const id of ['wing','tail']){const component=design.components.find(c=>c.id===id),points=component.features[0].profile.points.map(p=>p.map(v=>evaluate(v,values)));report.planformSymmetry[id]=points.every(([x,y])=>points.some(([u,v])=>Math.abs(x-u)<1e-6&&Math.abs(values.bodyWidth-y-v)<1e-6));assert.equal(report.planformSymmetry[id],true);}
    const result=await ask('请重新检查当前飞机的主翼、尾翼是否左右对称。透视图可能看错，请加载视觉检查技能，结合实际截图、轮廓坐标和中心线核对后给出结论；纠正前面对对称性的误判，先别修改。',{compact:true});
    assert.ok(result.message.tools.some(t=>t.name==='freecad_inspect'&&t.state==='done'));assert.ok(result.message.tools.some(t=>t.name==='freecad_capture'&&t.state==='done'));assert.ok(/对称/.test(result.message.text));assert.equal((await bridge.snapshot()).fingerprint,before.fingerprint);
    check('Model rechecks real images and coordinates against deterministic symmetric planforms');report.passed=true;report.finishedAt=new Date().toISOString();await atomicJson(path.join(directory,resultFile),report);console.log('SYMMETRY_REVIEW_PASSED '+directory);await delay(Number(process.env.GOUXING_TEST_HOLD_MS)||30000);await finish(0);return;
  }
  const initial=await bridge.capture('isometric');await copyFile(path.join(bridge.directory,'observations',initial.id+'.png'),path.join(directory,'before.png'));
  report.before={token:before.document.token,parameters:before.document.design.parameters,components:before.document.components};
  const review=await ask('请看看这个飞机模型，获取等轴测和俯视图。它哪里看起来不像飞机？先检查，别修改。',{compact:true});
  assert.equal((await bridge.snapshot()).fingerprint,before.fingerprint);assert.equal(review.state.observation?.vision,true);assert.ok(review.message.tools.some(t=>t.name==='freecad_capture'&&t.state==='done'));check('Agent inspected real aircraft images without modifying CAD');
  assert.ok(report.turns[0].switchedDuringRun&&report.turns[0].scrollHeld&&report.turns[0].draftHeld&&report.turns[0].focusHeld);check('Production compact/full switch preserves live turn, reading position, draft and renderer focus');
  const edit=await ask('按你刚看到的问题改一版，让它更像飞机。保持同一个工程，先优化能修改的尺寸和比例；做不到的结构改动直接说明，不要新建工程代替修改。');
  const plan=edit.state.plan;assert.equal(edit.state.phase,'ready');assert.equal(plan?.action,'update_design','must update the existing model, not silently create a replacement');
  report.changes=plan.changes;assert.ok(Object.keys(plan.changes).length);assert.equal((await bridge.snapshot()).fingerprint,before.fingerprint);check('Model proposes concrete parameter changes; CAD unchanged before confirmation',{changes:plan.changes});
  await js(`document.getElementById('confirm').click()`);const deadline=Date.now()+30000;let executed;while(Date.now()<deadline){executed=await state();if(!['ready','executing'].includes(executed.phase))break;await delay(100);}assert.equal(executed.phase,'done',executed.status);
  const after=await bridge.snapshot();assert.equal(after.document.token,before.document.token);assert.equal(after.document.name,before.document.name);assert.equal(after.document.components.length,before.document.components.length);assert.notEqual(after.fingerprint,before.fingerprint);
  for(const [key,p] of Object.entries(before.document.design.parameters))assert.equal(after.document.design.parameters[key].value,Object.hasOwn(plan.changes,key)?plan.changes[key]:p.value);
  assert.ok(after.document.components.every(c=>c.valid&&c.solids===1));report.after={token:after.document.token,parameters:after.document.design.parameters,components:after.document.components};check('Confirmed UI plan modifies the same native document, preserves unspecified parameters and valid solids');
  const image=await bridge.capture('isometric');await copyFile(path.join(bridge.directory,'observations',image.id+'.png'),path.join(directory,'after.png'));
  await bridge.execute({action:'save_as',path:path.join(directory,'after.FCStd'),expected:(await bridge.snapshot()).fingerprint});
  const recheck=await ask('现在再看一遍等轴测和俯视图，对照第一轮的检查描述，哪些外观问题改善了，哪些还没解决？区分看图结论和数据依据，先别继续修改。');
  assert.ok(recheck.message.tools.some(t=>t.name==='freecad_capture'&&t.state==='done'));assert.equal((await bridge.snapshot()).fingerprint,recheck.state.context.fingerprint);check('Agent recaptures modified CAD and reports remaining limitations');
  await delay(200);const p=await probe();assert.ok(p.cards>=3&&p.reasoning>0);check('Real text/reasoning/tool cards appear in production UI');
  report.passed=true;report.finishedAt=new Date().toISOString();await atomicJson(path.join(directory,resultFile),report);
  console.log('AIRPLANE_LOOP_PASSED '+directory);await delay(Number(process.env.GOUXING_TEST_HOLD_MS)||30000);await finish(0);
}
await import('../main.mjs');
