import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Session, validateProposal, localIntent } from '../session.mjs';

const context=()=>({connected:true,fingerprint:'original',document:{name:'Plate',owned:true},selection:[{document:'Plate',object:'ThroughHoles',subelements:[]}]});
test('only supported precise offline commands bypass model; dimensions are never silently discarded',()=>{
  assert.equal(localIntent('做一个四孔安装板').action,'create_plate');
  assert.equal(localIntent('孔径改成8毫米，其他不变').diameter,8);
  assert.equal(localIntent('做一个100毫米长的安装板'),null);
  assert.equal(localIntent('这个孔改成-8毫米'),null);
});
test('reject ambiguous selections, foreign documents, unsupported shapes and invalid diameters',()=>{
  for(const patch of [{connected:false},{document:{name:'Plate',owned:false}},{selection:[]},{selection:[{document:'Other',object:'ThroughHoles',subelements:[]}]},{selection:[{document:'Plate',object:'ThroughHoles',subelements:['Face1']}]}])assert.throws(()=>validateProposal({action:'set_diameter',diameter:8},{...context(),...patch}));
  for(const value of [NaN,Infinity,0,-1,16,'8'])assert.throws(()=>validateProposal({action:'set_diameter',diameter:value},context()));
  assert.throws(()=>validateProposal({action:'run_python'},context()));
});
test('one confirmed plan executes once, pause blocks writes, and context changes invalidate it',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-session-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let current=context(),writes=0,resolveWrite;
  const bridge={snapshot:async()=>current,execute:async()=>{writes++;await new Promise(r=>resolveWrite=r);return {snapshot:current,message:'done'};}};
  const session=new Session(directory,bridge);await session.load();
  await session.send('孔径改成8毫米，其他不变');const id=session.state.plan.id;
  session.pause();await assert.rejects(session.confirm(id));assert.equal(writes,0);session.pause();
  const first=session.confirm(id);await assert.rejects(session.confirm(id));assert.equal(writes,1);resolveWrite();await first;
  await session.send('孔径改成9毫米');current={...current,fingerprint:'manual edit'};await session.poll();
  assert.equal(session.state.phase,'stale');assert.equal(session.state.plan,null);
  await assert.rejects(session.confirm(id));assert.equal(writes,1);
  await session.saving;
});
test('restart restores messages, drafts and attachments without replaying pending writes',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-session-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const bridge={snapshot:async()=>context()};const first=new Session(directory,bridge);await first.load();
  await first.send('做一个四孔安装板');first.state.draft='保留这段草稿';first.state.attachments=[{id:'example',name:'参考图.png'}];first.state.history=[{id:'unfinished',state:'executing'}];first.publish();await first.saving;
  const next=new Session(directory,bridge);await next.load();assert.equal(next.state.draft,'保留这段草稿');assert.equal(next.state.messages.length,2);assert.equal(next.state.attachments.length,1);assert.equal(next.state.plan,null);assert.equal(next.state.phase,'idle');
  assert.equal(next.state.history[0].state,'needs-review');await next.poll();assert.match(next.state.status,/已连接/);
});
test('a delayed CAD result resolves uncertainty without replaying a write',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-session-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let writes=0;
  const bridge={snapshot:async()=>context(),execute:async()=>{writes++;},lateResult:async()=>({ok:true,message:'迟到的执行结果',snapshot:context()})};
  const session=new Session(directory,bridge);await session.load();session.state.phase='uncertain';session.state.history=[{id:'late',state:'uncertain'}];
  await assert.rejects(session.send('孔径改成8毫米'));await session.poll();
  assert.equal(session.state.phase,'done');assert.equal(writes,0);assert.equal(session.state.messages.at(-1).text,'迟到的执行结果');assert.equal(session.state.history[0].state,'done');await session.saving;
});
