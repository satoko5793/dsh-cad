import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {applyFrame} from '../stream.mjs';
import {FollowLatest} from '../ui/scroll.mjs';
import {defaults,validateConfig,saveConfig,configView,importSkill} from '../agent-config.mjs';
import {Session} from '../session.mjs';
import {apply as applyPlugin} from '../plan-plugin.mjs';
import {FreeCADBridge} from '../bridge.mjs';
test('old visual bridge requires upgrade before screenshot dispatch',async()=>{
  const bridge=new FreeCADBridge('unused');let dispatched=0;
  bridge.snapshot=async()=>({connected:true,protocol:2,capabilities:['capture_view']});bridge.execute=async()=>dispatched++;
  await assert.rejects(bridge.capture(),/升级/);assert.equal(dispatched,0);
});
test('live frames preserve order, deduplicate and exclude abandoned attempts',()=>{
  const m={text:''},start=id=>applyFrame(m,{type:'start',attemptId:id}),chunk=(id,index,c)=>applyFrame(m,{type:'chunk',attemptId:id,index,chunk:c});
  start('a');chunk('a',0,{type:'reasoning-delta',index:0,text:'读取实际几何'});chunk('a',1,{type:'text-delta',index:1,text:'你好'});chunk('a',1,{type:'text-delta',index:1,text:'重复'});assert.equal(m.text,'你好');
  chunk('a',2,{type:'tool-call-delta',index:2,id:'tool1',name:'freecad_inspect',argumentsDelta:'{}'});assert.equal(m.attempts[0].blocks[2].name,'freecad_inspect');
  applyFrame(m,{type:'end',attemptId:'a',outcome:{kind:'abandoned'}});start('b');chunk('b',0,{type:'text-delta',index:0,text:'重试结果'});assert.equal(m.text,'重试结果');
});
test('scroll follows after layout, preserves reading position, jumps and handles resize',()=>{
  const listeners={},callbacks=[],container={scrollHeight:200,scrollTop:0,clientHeight:200,addEventListener:(e,fn)=>listeners[e]=fn},button={};
  const follow=new FollowLatest(container,button,fn=>callbacks.push(fn)),flush=()=>{for(const cb of callbacks.splice(0))cb();};
  follow.changed();container.scrollHeight=600;flush();assert.equal(container.scrollTop,600);
  container.scrollTop=100;listeners.scroll();container.scrollHeight=900;follow.changed();flush();assert.equal(container.scrollTop,100);assert.equal(button.hidden,false);
  button.onclick();flush();assert.equal(container.scrollTop,900);container.clientHeight=100;follow.changed();flush();assert.equal(button.hidden,true);
});
test('configuration persists exact allowed tools and imports bounded skill descriptions',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-config-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  assert.throws(()=>validateConfig({tools:['shell'],disabledSkills:[]}));assert.throws(()=>validateConfig({tools:[],disabledSkills:['../escape']}));
  await saveConfig(dir,{...defaults(),tools:['freecad_inspect'],disabledSkills:['visual-review']});const view=await configView(dir);assert.deepEqual(view.tools,['freecad_inspect']);assert.equal(view.skills.find(s=>s.id==='visual-review').enabled,false);
  const file=path.join(dir,'test.md');await writeFile(file,'---\nname: custom-review\ndescription: 核对自定义尺寸\n---\n检查要求。');await importSkill(dir,file);assert.ok((await configView(dir)).skills.find(s=>s.id==='custom-review'));await assert.rejects(importSkill(dir,file),/同名/);
});
test('plugin applies the configured allowlist and only loads enabled skills',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-tools-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await saveConfig(dir,{tools:['freecad_inspect','skill_read'],disabledSkills:['visual-review']});
  const original=process.env.GOUXING_DATA_DIR;process.env.GOUXING_DATA_DIR=dir;t.after(()=>{if(original===undefined)delete process.env.GOUXING_DATA_DIR;else process.env.GOUXING_DATA_DIR=original;});
  const tools=new Map(),events=new Map();await applyPlugin({tools:{register:tool=>tools.set(tool.name,tool)},on:(name,callback)=>events.set(name,callback)});
  let restriction;events.get('agent/created')({agent:{ctx:{tools:{restrict:value=>restriction=value}}}});
  assert.deepEqual(restriction.allow,['freecad_inspect','skill_read']);assert.equal(tools.size,4);
  assert.doesNotMatch(tools.get('skill_read').description,/visual-review/);
  await assert.rejects(tools.get('skill_read').execute({id:'visual-review'},{}),/未启用/);
  assert.match(await tools.get('skill_read').execute({id:'native-modeling'},{}),/freecad_propose/);
});
test('Session publishes real text/tools during a model turn, cancels without CAD writes, and restores interrupted output',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-stream-'));t.after(()=>rm(dir,{recursive:true,force:true}));let emit,finish,writes=0;
  class FakeHarness{constructor(callback){emit=callback;}async prompt(){await new Promise(r=>finish=r);}async close(){finish?.();}}
  const bridge={snapshot:async()=>({connected:false}),execute:async()=>writes++},session=new Session(dir,bridge,{Harness:FakeHarness});await session.load();await session.send('看一下模型');
  while(!emit)await new Promise(r=>setTimeout(r,5));const id=session.turn.id;
  emit('gouxing.stream',{sessionId:'other',frame:{type:'start',attemptId:'ignored'}});assert.equal(session.turn.message.attempts,undefined);
  emit('gouxing.stream',{sessionId:id,frame:{type:'start',attemptId:'first'}});
  emit('gouxing.stream',{sessionId:id,frame:{type:'chunk',attemptId:'first',index:0,chunk:{type:'text-delta',index:0,text:'正在核对'}}});
  emit('gouxing.tool',{sessionId:id,id:'c1',name:'freecad_inspect',state:'running',arguments:{}});
  assert.equal(session.state.messages.at(-1).text,'正在核对');assert.equal(session.state.messages.at(-1).streaming,true);assert.equal(writes,0);
  session.cancel();emit('gouxing.stream',{sessionId:id,frame:{type:'chunk',attemptId:'first',index:1,chunk:{type:'text-delta',index:0,text:'迟到'}}});
  assert.equal(session.state.messages.at(-1).text,'正在核对');assert.equal(session.state.messages.at(-1).tools[0].state,'interrupted');await session.saving;
  const restored=new Session(dir,bridge);await restored.load();assert.equal(restored.state.messages.at(-1).interrupted,true);assert.equal(writes,0);
});
