// Explicit integration check; not part of npm test because it opens FreeCAD.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { FreeCADBridge, ROOT, atomicJson } from '../bridge.mjs';
const executable=process.env.FREECAD_EXE;
if(!executable)throw Error('Set FREECAD_EXE to an installed FreeCAD.exe');
const output=path.join(ROOT,'.data','validation',randomUUID());
const bridge=new FreeCADBridge(output),checks=[];
async function check(name,fn){await fn();checks.push({name,passed:true});console.log('PASS',name);}
let snapshot,changed;
await check('connect persistent GUI bridge',async()=>{snapshot=await bridge.connect(executable);assert.equal(snapshot.connected,true);});
await check('create native plate and read selection',async()=>{const result=await bridge.execute({action:'create_plate',expected:snapshot.fingerprint});snapshot=result.snapshot;assert.equal(snapshot.selection[0].object,'ThroughHoles');assert.deepEqual(snapshot.document.diameters,[6,6,6,6]);assert.equal(snapshot.document.geometry.valid,true);assert.equal(snapshot.document.geometry.solids,1);});
const obsolete=snapshot.fingerprint;
await check('edit four native hole constraints',async()=>{changed=await bridge.execute({action:'set_diameter',diameter:8,expected:snapshot.fingerprint});snapshot=changed.snapshot;assert.deepEqual(snapshot.document.diameters,[8,8,8,8]);assert.deepEqual(snapshot.document.geometry.dimensions,[80,40,5]);assert.ok(Math.abs(snapshot.document.geometry.volume-(16000-4*Math.PI*16*5))<.001);});
await check('reject stale write at actual CAD boundary',async()=>{await assert.rejects(bridge.execute({action:'set_diameter',diameter:10,expected:obsolete}),/变化/);snapshot=await bridge.snapshot();assert.deepEqual(snapshot.document.diameters,[8,8,8,8]);});
await check('undo native transaction',async()=>{const r=await bridge.execute({action:'undo',expected:snapshot.fingerprint});snapshot=r.snapshot;assert.deepEqual(snapshot.document.diameters,[6,6,6,6]);});
await check('redo native transaction',async()=>{const r=await bridge.execute({action:'redo',expected:snapshot.fingerprint});snapshot=r.snapshot;assert.deepEqual(snapshot.document.diameters,[8,8,8,8]);});
const target=path.join(output,'plate.FCStd');
await check('save native file to new path',async()=>{const r=await bridge.execute({action:'save_as',path:target,expected:snapshot.fingerprint});snapshot=r.snapshot;assert.equal(path.resolve(r.file),target);});
await check('reject overwriting an existing native file',async()=>{await assert.rejects(bridge.execute({action:'save_as',path:target,expected:snapshot.fingerprint}),/覆盖|不存在/);});
await check('reject unsupported operation and invalid diameter',async()=>{await assert.rejects(bridge.execute({action:'set_diameter',diameter:16,expected:snapshot.fingerprint}),/孔径/);await assert.rejects(bridge.execute({action:'run_python',expected:snapshot.fingerprint}),/不支持/);});
await mkdir(path.join(ROOT,'validation'),{recursive:true});
await atomicJson(path.join(ROOT,'validation','native-results.json'),{date:new Date().toISOString(),version:snapshot.version,passed:true,checks,geometry:snapshot.document.geometry,diameters:snapshot.document.diameters,note:'Dedicated FreeCAD instance. Reopen was tested separately in research/freecad-native; this check verifies the persistent bridge.'});
console.log('Native integration complete. Test FCStd remains in desktop/.data/validation/.');
