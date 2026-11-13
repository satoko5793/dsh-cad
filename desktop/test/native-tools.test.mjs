import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {NATIVE_TOOLS,validateNativeCall,validateNativeOperations} from '../native-tools.mjs';
import {validateProposal} from '../session.mjs';
import {loadConfig,listSkills,readSkillResource} from '../agent-config.mjs';
const context={connected:true,capabilities:['native_interfaces'],fingerprint:'a',document:{name:'Current',owned:true}};
test('native catalog is typed and excludes arbitrary execution and document closing',()=>{
  assert.equal(NATIVE_TOOLS.length,66);assert.equal(new Set(NATIVE_TOOLS.map(t=>t.name)).size,66);
  for(const method of ['script.execute_python','doc.close','doc.save','doc.open'])assert.throws(()=>validateNativeCall(method,{}));
  assert.throws(()=>validateNativeCall('part.box',{label:'B',length:'10'}),/类型/);
  assert.throws(()=>validateNativeCall('part.box',{label:'B',length:Infinity}));
  assert.throws(()=>validateNativeCall('part.box',{label:'B',extra:1}));
  assert.throws(()=>validateNativeCall('part.pattern_linear',{source:'B',direction:[1,0,0],count:100000,label:'Array'}),/数量/);
});
test('native plans preserve a single explicit target and reject stale bridges and mixed file effects',()=>{
  const edit=[{method:'obj.set_property',args:{name:'Box',prop:'Length',value:10}}];
  assert.equal(validateNativeOperations(edit,context).length,1);
  assert.throws(()=>validateNativeOperations(edit,{...context,capabilities:[]}));
  assert.throws(()=>validateNativeOperations(edit,{...context,document:{name:'Foreign',owned:false}}));
  assert.throws(()=>validateNativeOperations([{...edit[0],args:{...edit[0].args,doc:'Other'}}],context));
  assert.throws(()=>validateNativeOperations([{method:'io.export_step',args:{path:'X:/a.step'}},...edit],context));
  const plan=validateProposal({action:'native_operations',operations:[{method:'doc.create',args:{name:'Aircraft'}},{method:'part.sphere',args:{label:'Nose',radius:3}}]},context);assert.equal(plan.expected,'a');assert.equal(plan.operations.length,2);assert.match(plan.description,/2/);
});
test('old configuration migrates once; skill resources are loaded from the declared manifest only',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-native-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(path.join(dir,'agent.json'),JSON.stringify({version:1,tools:['skill_read'],disabledSkills:[]}));assert.ok((await loadConfig(dir)).tools.includes('native_interfaces'));
  await writeFile(path.join(dir,'agent.json'),JSON.stringify({version:2,tools:['skill_read'],disabledSkills:[]}));assert.ok(!(await loadConfig(dir)).tools.includes('native_interfaces'));
  const skill=(await listSkills(dir)).find(s=>s.id==='freecad-native');assert.ok(skill);assert.match(await readSkillResource(skill,'part'),/part_loft/);await assert.rejects(readSkillResource(skill,'../../credentials'));
});
