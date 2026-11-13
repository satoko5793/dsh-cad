import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,validateDesign,changeParameters} from '../design.mjs';
import {examples,gantry,enclosure} from '../examples.mjs';
import {validateProposal,localIntent,Session} from '../session.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const context=design=>({connected:true,protocol:2,fingerprint:'current',document:{name:'Design',token:'doc',owned:true,editable:true,design},selection:[]});
test('arithmetic expressions support dimensional dependencies and reject code/nonfinite results',()=>{
  assert.equal(evaluate('(length-2*wall)/2',{length:90,wall:2.5}),42.5);
  assert.equal(evaluate('-(-3)+.5',{}),3.5);
  for(const v of ['process.exit()','__import__("os")','length.foo','Math.max(1,2)','1/0','1e99','2**100','unknown','(2+3','',NaN,Infinity,true])assert.throws(()=>evaluate(v,{length:90}),String(v));
});
test('generic feature designs validate geometry dimensions, ids, and bounded complexity',()=>{
  for(const design of Object.values(examples))assert.ok(validateDesign(design));
  let bad=structuredClone(gantry);bad.components[1].id=bad.components[0].id;assert.throws(()=>validateDesign(bad));
  bad=structuredClone(gantry);bad.components[0].features[0].depth=-1;assert.throws(()=>validateDesign(bad));
  bad=structuredClone(gantry);bad.components[0].features[0].profile.items[0].width='length/0';assert.throws(()=>validateDesign(bad));
  bad=structuredClone(gantry);bad.components[0].features[0].kind='python';assert.throws(()=>validateDesign(bad));
});
test('parameter edits preserve all other values and stable native structure',()=>{
  const {design,diff}=changeParameters(enclosure,{lidThickness:4});assert.equal(diff.length,1);assert.equal(diff[0].before,3);assert.deepEqual(design.components,enclosure.components);
  for(const [key,p] of Object.entries(enclosure.parameters))if(key!=='lidThickness')assert.deepEqual(p,design.parameters[key]);
  assert.equal(enclosure.parameters.lidThickness.value,3);
  for(const changes of [{unknown:3},{lidThickness:NaN},{lidThickness:3},{wall:100},{}])assert.throws(()=>changeParameters(enclosure,changes));
});
test('native plans expose affected parts, preserve explicit sizes and require upgraded/unaltered CAD',()=>{
  const current=context(enclosure),plan=validateProposal({action:'update_design',changes:{lidThickness:4}},current);
  assert.deepEqual(plan.affected,['上盖']);assert.deepEqual(plan.changes,{lidThickness:4});
  const created=validateProposal({action:'create_design',example:'enclosure',changes:{length:105,height:36}},current);assert.equal(created.design.parameters.length.value,105);assert.equal(created.design.parameters.height.value,36);
  assert.equal(validateProposal({action:'create_design',example:'airplane',changes:{}},current).design.components.length,3);
  assert.equal(validateProposal({action:'create_design',example:'airplane',changes:{span:100}},current).design.parameters.span.value,100);
  assert.throws(()=>validateProposal({action:'create_design',example:'airplane',changes:[]},current));
  assert.throws(()=>validateProposal({action:'create_design',example:'airplane',changes:{unknown:1}},current));
  assert.throws(()=>validateProposal({action:'create_design',design:enclosure},{...current,protocol:1}));
  assert.throws(()=>validateProposal({action:'update_design',changes:{lidThickness:4}},{...current,document:{...current.document,editable:false}}));
  assert.equal(localIntent('做一个带盖控制盒').example,'enclosure');assert.equal(localIntent('做一个100毫米控制盒'),null);
  assert.equal(localIntent('孔径改成8毫米',current),null);
});
test('parameter editor rejects stale context; simultaneous chat requests do not overlap',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'gouxing-complex-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let release;const bridge={snapshot:()=>new Promise(resolve=>{release=()=>resolve(context(gantry));})};
  const session=new Session(directory,bridge);await session.load();
  const first=session.send('做一个小龙门架');await assert.rejects(session.send('做一个飞机'));release();await first;assert.equal(session.state.messages.length,2);
  const stale=session.prepareParameters({carriageX:58},'old');release();await assert.rejects(stale,/变化/);assert.equal(session.state.phase,'idle');await session.saving;
});
