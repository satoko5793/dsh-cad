import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Session} from '../application/session.mjs';
import {applyFrame,commitMessage,finishMessage} from '../agent/stream.mjs';
import {defaults,validateConfig,saveConfig,loadConfig} from '../agent/config.mjs';

test('durable content repairs missed text frames and does not duplicate commits',()=>{
  const message={text:''};applyFrame(message,{type:'start',attemptId:'a'});
  applyFrame(message,{type:'chunk',attemptId:'a',index:0,chunk:{type:'reasoning-delta',index:0,text:'thinking'}});
  const committed={id:'m1',content:[{type:'reasoning',text:'thinking'},{type:'text',text:'actual answer'}]};
  commitMessage(message,committed);commitMessage(message,committed);
  assert.equal(message.text,'actual answer');assert.equal(message.attempts.length,1);
  applyFrame(message,{type:'end',attemptId:'a',outcome:{kind:'committed'}});assert.equal(message.text,'actual answer');
});
test('token-capped and empty replies produce explicit notices without pretending CAD ran',()=>{
  const message={text:''};finishMessage(message,'max-tokens');assert.match(message.notice,/输出上限/);assert.match(message.notice,/没有生成正文/);assert.equal(message.completionReason,'max-tokens');
  const partial={text:'partial'};finishMessage(partial,'max-tokens');assert.match(partial.notice,/不完整/);
  const plan={text:''};finishMessage(plan,'max-tokens',true);assert.match(plan.notice,/确认后执行/);
});
test('Session handles the recorded reasoning-only token limit and emits bounded stream updates',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-cap-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let writes=0,options,streamChanges=0;
  class FakeHarness{
    constructor(notify,config){this.notify=notify;options=config;}
    async prompt(id){
      this.notify('gouxing.stream',{sessionId:id,frame:{type:'start',attemptId:'a'}});
      for(let i=0;i<100;i++)this.notify('gouxing.stream',{sessionId:id,frame:{type:'chunk',attemptId:'a',index:i,chunk:{type:'reasoning-delta',index:0,text:'thought'}}});
      await new Promise(r=>setTimeout(r,45));
      this.notify('session.event',{sessionId:id,event:{type:'assistant/message',data:{message:{id:'m',content:[{type:'reasoning',text:'thought'.repeat(100)}]}}}});
      this.notify('session.event',{sessionId:id,event:{type:'turn/end',data:{reason:{kind:'max-tokens'}}}});
    }
    async close(){}
  }
  const session=new Session(directory,{snapshot:async()=>({connected:false}),execute:async()=>writes++},{Harness:FakeHarness});
  session.on('change',(_state,meta)=>{if(meta?.stream)streamChanges++;});await session.load();await session.send('加个窗户，先看看有什么建议');
  while(session.turn)await new Promise(r=>setTimeout(r,5));await session.saving;
  const message=session.state.messages.at(-1);assert.equal(message.streaming,false);assert.equal(message.completionReason,'max-tokens');assert.match(message.notice,/只有思考/);assert.equal(session.state.plan,null);assert.equal(writes,0);
  assert.ok(streamChanges>=1&&streamChanges<10);assert.equal(options.reasoningEffort,'low');assert.equal(options.maxTokens,32768);
  const restored=new Session(directory,{});await restored.load();assert.equal(restored.state.messages.at(-1).notice,message.notice);
});
test('generation controls migrate old settings and persist a larger budget and effort',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-budget-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const old=validateConfig({version:2,tools:['skill_read'],disabledSkills:[]});assert.equal(old.generation.maxTokens,32768);assert.deepEqual(old.tools,['skill_read']);
  await saveConfig(directory,{...defaults(),generation:{reasoningEffort:'high',maxTokens:65536}});assert.deepEqual((await loadConfig(directory)).generation,{reasoningEffort:'high',maxTokens:65536});
  for(const generation of [{maxTokens:0},{maxTokens:1.5},{maxTokens:262145},{reasoningEffort:'invalid'}])assert.throws(()=>validateConfig({...defaults(),generation}));
});
