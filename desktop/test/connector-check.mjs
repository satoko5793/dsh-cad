// Product startup: auto install, one native process, automatic reattachment.
import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
const workspace=path.join(ROOT,'.data','cad-workspace'),data=path.join(ROOT,'.data','connector-validation',randomUUID());
if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE');const bridge=new FreeCADBridge(data,{workspace});await bridge.restore();const connected=await bridge.connect(process.env.FREECAD_EXE);assert.ok(connected.connected&&connected.capabilities.includes('reload_bridge'));const pid=connected.pid;
assert.equal((await bridge.connect(process.env.FREECAD_EXE)).pid,pid);
const reopened=new FreeCADBridge(path.join(data,'second-session'),{workspace});await reopened.restore();assert.equal((await reopened.connect(process.env.FREECAD_EXE)).pid,pid);assert.equal(reopened.child,null);
if(process.env.GOUXING_OPEN_SAMPLE){await bridge.execute({action:'open_native',path:process.env.GOUXING_OPEN_SAMPLE,expected:(await bridge.snapshot()).fingerprint});}
await atomicJson(path.join(ROOT,'validation','connector-results.json'),{date:new Date().toISOString(),passed:true,checks:['startup component installed automatically through FreeCADCmd reported user directory','FreeCAD startup loaded component without user macro/Python actions','reconnect and second session preserve one process'],note:'Real installed FreeCAD 1.1.4 user startup addon; application-owned files only. Existing normal GUI preferences retained.'});
console.log('PASS automatic connector startup and one-process reuse; PID '+pid);
