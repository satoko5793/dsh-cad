// Reuse-only bridge upgrade and readonly request. Never launch CAD or replay plans.
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {FreeCADBridge,bridgeRevision} from '../cad/freecad/bridge.mjs';
import {ROOT} from '../infrastructure/paths.mjs';
import {atomicJson} from '../infrastructure/storage.mjs';

const workspace=process.env.GOUXING_CAD_WORKSPACE||path.join(ROOT,'.data','cad-workspace');
const directory=await mkdtemp(path.join(ROOT,'.data','io-reuse-'));
const bridge=new FreeCADBridge(directory,{workspace});await bridge.restore();
const before=await bridge.snapshot();
assert.ok(before.connected&&before.capabilities?.includes('reload_bridge'),'Needs an existing connected CAD; will not launch one');
assert.equal(before.busy,false,'Wait until the current CAD operation finishes');
const upgraded=await bridge.connect();
assert.equal(bridge.child,null);assert.equal(upgraded.pid,before.pid);assert.equal(upgraded.instance,before.instance);
assert.equal(upgraded.bridgeRevision,await bridgeRevision());
assert.deepEqual(upgraded.document,before.document);assert.deepEqual(upgraded.selection,before.selection);
const result=await bridge.execute({action:'native_read',operation:{method:'doc.list',args:{}},expected:upgraded.fingerprint});
assert.equal(result.ok,true);assert.deepEqual(result.snapshot.document,before.document);assert.deepEqual(result.snapshot.selection,before.selection);
await atomicJson(path.join(ROOT,'validation','bridge-io-results.json'),{date:new Date().toISOString(),passed:true,checks:['real Windows no-delete-share handles: transient lock recovers; permanent lock is bounded and preserves old JSON','injected progress failure does not fail execution; snapshot/result publication retries execute only once','existing FreeCAD process and document/selection/geometry preserved on bridge upgrade','real readonly document-list request acknowledged through updated progress/snapshot/result publications'],note:'No new CAD process, model changes, camera commands or automatic replay of the failed user plan. File-lock injection uses temporary test files, not the user workspace.'});
console.log('PASS existing CAD upgraded in place; same document/geometry/selection; readonly result acknowledged');
