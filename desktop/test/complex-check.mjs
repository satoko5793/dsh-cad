import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { FreeCADBridge, ROOT, atomicJson } from '../bridge.mjs';
import { examples } from '../examples.mjs';
const executable=process.env.FREECAD_EXE;
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
if(!executable)throw Error('Set FREECAD_EXE');
const output=path.join(ROOT,'.data','complex-validation',randomUUID());
const bridge=new FreeCADBridge(output),checks=[],measurements={};
let snapshot=await bridge.connect(executable);
async function run(action,payload={}){try{const result=await bridge.execute({action,...payload,expected:snapshot.fingerprint});snapshot=result.snapshot;return result;}catch(error){snapshot=error.snapshot||await bridge.snapshot();throw error;}}
async function check(name,fn){await fn();checks.push({name,passed:true});console.log('PASS',name);}
const component=id=>snapshot.document.components.find(c=>c.id===id);
const sameGeometry=(a,b)=>{for(const key of ['dimensions','bounds'])for(let i=0;i<a[key].length;i++)assert.ok(Math.abs(a[key][i]-b[key][i])<1e-6,`${key}[${i}] changed`);assert.ok(Math.abs(a.volume-b.volume)<1e-5);};
for(const [name,design] of Object.entries(examples)){
  await check(`${name}: create native multi-body features`,async()=>{await run('create_design',{design});assert.equal(snapshot.document.components.length,design.components.length);assert.equal(snapshot.document.editable,true);assert.ok(snapshot.document.components.every(c=>c.valid&&c.solids===1&&c.volume>0));});
  measurements[name]=structuredClone(snapshot.document.components);
  const before=structuredClone(snapshot.document),change=name==='enclosure'?{lidThickness:4}:name==='gantry'?{carriageX:63}:{span:120};
  await check(`${name}: change intended parameter and preserve others`,async()=>{await run('update_design',{changes:change});assert.equal(snapshot.document.design.parameters[Object.keys(change)[0]].value,Object.values(change)[0]);const affected=name==='enclosure'?'lid':name==='gantry'?'carriage':'wing';for(const c of before.components)if(c.id!==affected)sameGeometry(c,component(c.id));assert.equal(snapshot.document.editable,true);});
  await check(`${name}: undo and redo parameter transaction`,async()=>{await run('undo');assert.deepEqual(snapshot.document.design.parameters,before.design.parameters);for(const c of before.components)sameGeometry(c,component(c.id));await run('redo');assert.equal(snapshot.document.design.parameters[Object.keys(change)[0]].value,Object.values(change)[0]);assert.equal(snapshot.document.editable,true);});
  await check(`${name}: select component by stable id`,async()=>{const id=design.components.at(-1).id;await run('select_component',{componentId:id});assert.equal(snapshot.selection[0].object,'GX_'+id);});
  if(name==='gantry')await check('gantry: world bounds reflect carriage translation',async()=>{assert.ok(Math.abs(component('carriage').bounds[0]-63)<1e-6);});
  if(name==='gantry')await check('gantry: failed multi-solid rebuild aborts whole transaction',async()=>{const before=structuredClone(snapshot.document);await assert.rejects(run('update_design',{changes:{carriageLength:4}}));assert.deepEqual(snapshot.document.design,before.design);for(const c of before.components)sameGeometry(c,component(c.id));assert.equal(snapshot.document.editable,true);});
  await check(`${name}: save native engineering file`,async()=>{await run('save_as',{path:path.join(output,name+'.FCStd')});});
}
await check('invalid geometry rejects and preserves previous native design',async()=>{const before=structuredClone(snapshot.document);await assert.rejects(run('update_design',{changes:{wingThickness:-2}}));for(const c of before.components)sameGeometry(c,component(c.id));});
await check('open native enclosure through bridge and retain editable parameters',async()=>{await run('open_native',{path:path.join(output,'enclosure.FCStd')});assert.equal(snapshot.document.design.parameters.lidThickness.value,4);assert.equal(snapshot.document.components.length,2);assert.equal(snapshot.document.editable,true);});
await check('switch back to native airplane without closing other documents',async()=>{await run('open_native',{path:path.join(output,'airplane.FCStd')});assert.equal(snapshot.document.components.length,3);assert.equal(snapshot.document.design.parameters.span.value,120);});
await mkdir(path.join(ROOT,'validation'),{recursive:true});
await atomicJson(path.join(ROOT,'validation','complex-results.json'),{date:new Date().toISOString(),version:snapshot.version,checks,measurements,passed:true,note:'Static multi-body native features. Geometry validity does not prove assembly, interference-free design or manufacturability.'});
console.log('Complex checks complete. Native files:',output);
