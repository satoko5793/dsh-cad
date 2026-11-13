// Explicit reuse-only acceptance. This check MUST NOT start a CAD process.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {FreeCADBridge,ROOT,atomicJson,bridgeRevision} from '../bridge.mjs';
const directory=process.env.GOUXING_REUSE_DIR;
if(!directory)throw Error('Set GOUXING_REUSE_DIR to an existing connected workspace');
const bridge=new FreeCADBridge(directory);await bridge.restore();const before=await bridge.snapshot();assert.ok(before.connected&&before.capabilities.includes('reload_bridge'));
const cameraBefore=await bridge.capture('current');
await bridge.execute({action:'reload_bridge',expected:(await bridge.snapshot()).fingerprint});
await new Promise(r=>setTimeout(r,1200));
const after=await bridge.connect('must-not-launch.exe');assert.equal(after.pid,before.pid);assert.equal(after.instance,before.instance);assert.equal(after.document.token,before.document.token);assert.deepEqual(after.selection,before.selection);assert.deepEqual(after.document.components,before.document.components);assert.equal(after.bridgeRevision,await bridgeRevision());assert.equal(bridge.child,null);
const cameraAfter=await bridge.capture('current'),numbers=s=>[...s.matchAll(/[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g)].map(m=>Number(m[0])),a=numbers(cameraBefore.camera),b=numbers(cameraAfter.camera);assert.equal(a.length,b.length);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<Math.max(1e-4,Math.abs(v)*1e-5)));
const testing=await mkdtemp(path.join(ROOT,'.data','reuse-validation-')),shared=path.join(testing,'workspace');await mkdir(shared);await atomicJson(path.join(shared,'connection.json'),{directory:bridge.directory,pid:after.pid});
for(const name of ['first','second']){const reused=new FreeCADBridge(path.join(testing,name),{workspace:shared});await reused.restore();assert.equal((await reused.connect('must-not-launch.exe')).pid,before.pid);assert.equal(reused.child,null);}
await atomicJson(path.join(ROOT,'validation','lifecycle-results.json'),{date:new Date().toISOString(),passed:true,checks:['same-process reload preserves document token, selection, geometry and camera','reconnect is idempotent without process launch','separate conversation directories restore one shared CAD'],note:'Reuse-only real FreeCAD test; no new CAD process was launched.'});
console.log('PASS same FreeCAD process/document/camera preserved; two sessions reused one connection');
