// Explicit paid/account model test, deliberately excluded from ordinary npm test.
import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
import {Session} from '../session.mjs';
if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE and DSH model configuration');
const directory=path.join(ROOT,'.data','model-complex',randomUUID());
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
const bridge=new FreeCADBridge(directory);await bridge.connect(process.env.FREECAD_EXE);
const session=new Session(directory,bridge);await session.load();
const checks=[],turns=[];
async function ask(text,verify){
  await session.send(text);
  const end=Date.now()+180000;
  while(session.turn&&Date.now()<end)await new Promise(r=>setTimeout(r,250));
  if(session.turn){session.cancel();throw Error('Model test timed out');}
  assert.equal(session.state.phase,'ready',session.state.messages.at(-1).text);
  verify(session.state.plan);
  const plan={action:session.state.plan.action,description:session.state.plan.description,changes:session.state.plan.changes};
  await session.confirm(session.state.plan.id);assert.equal(session.state.phase,'done',session.state.status);
  turns.push({request:text,plan,components:session.state.context.document.components.map(c=>({id:c.id,name:c.name,dimensions:c.dimensions,volume:c.volume}))});
  checks.push({name:text,passed:true});console.log('PASS',text);
}
await ask('帮我做个带上盖和固定柱的控制盒，外形长100毫米、宽70毫米、高35毫米，壁厚2.5毫米。上盖默认3毫米。',plan=>{assert.equal(plan.action,'create_design');for(const [key,value] of Object.entries({length:100,width:70,height:35,wall:2.5,lidThickness:3}))assert.equal(plan.design.parameters[key].value,value);});
const boxVolume=session.state.context.document.components.find(c=>c.id==='box').volume;
await ask('盖子加厚1毫米，盒身别动。',plan=>{assert.equal(plan.action,'update_design');assert.deepEqual(plan.changes,{lidThickness:4});});
assert.ok(Math.abs(session.state.context.document.components.find(c=>c.id==='box').volume-boxVolume)<1e-6);
await session.view('select_component',{componentId:'lid'});
await ask('把这个再加厚1毫米，其他不变。',plan=>{assert.equal(plan.action,'update_design');assert.deepEqual(plan.changes,{lidThickness:5});});
await ask('另外新建一个L形支架：底板80乘50毫米、厚5毫米，立板在底板左侧，厚5毫米、宽50毫米、高40毫米；底板上开两个6毫米通孔，中心在底板的(30,25)和(60,25)，单位毫米。不用圆角。',plan=>{assert.equal(plan.action,'create_design');assert.ok(plan.design.components.length>=1);assert.ok(plan.design.components.some(c=>c.features.length>=3));});
const bracket=session.state.context.document.components;
assert.equal(bracket.length,1,'L支架应为一个连接的原生实体');
for(const [i,value] of [80,50,45].entries())assert.ok(Math.abs(bracket[0].dimensions[i]-value)<1e-6);
assert.ok(Math.abs(bracket[0].volume-(80*50*5+5*50*40-2*Math.PI*9*5))<.001,'L支架实体体积与双通孔解析值一致');
await session.saving;await mkdir(path.join(ROOT,'validation'),{recursive:true});
await atomicJson(path.join(ROOT,'validation','model-complex-results.json'),{date:new Date().toISOString(),provider:process.env.CAD_LLM_PROVIDER||'deepseek-official',model:process.env.CAD_LLM_MODEL||'deepseek-flash',passed:true,checks,turns,note:'Real model planning, confirmed native execution. Static geometry only; no fabrication or assembly certification.'});
console.log('Real model complex checks complete.');
