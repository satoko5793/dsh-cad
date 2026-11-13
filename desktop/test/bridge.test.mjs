import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {FreeCADBridge,bridgeRevision} from '../bridge.mjs';
const temporary=async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-bridge-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;};
test('reconnecting a live current CAD is idempotent and never starts another process',async t=>{
  const dir=await temporary(t),bridge=new FreeCADBridge(dir),snapshot={connected:true,pid:process.pid,instance:'same',bridgeRevision:await bridgeRevision()};bridge.snapshot=async()=>snapshot;
  assert.equal((await bridge.connect('missing.exe')).instance,'same');assert.equal(bridge.child,null);
});
test('old or temporarily unresponsive CAD never triggers a replacement window',async t=>{
  const dir=await temporary(t),bridge=new FreeCADBridge(dir);bridge.snapshot=async()=>({connected:true,pid:process.pid,capabilities:[]});await assert.rejects(bridge.connect(),/保存工程并重开/);assert.equal(bridge.child,null);
  bridge.snapshot=async()=>({connected:false,pid:process.pid});await assert.rejects(bridge.connect('missing.exe'),/仍在运行/);assert.equal(bridge.child,null);
});
test('separate test conversations restore one shared CAD connection',async t=>{
  const dir=await temporary(t),workspace=path.join(dir,'workspace'),endpoint=path.join(workspace,'endpoint');await mkdir(endpoint,{recursive:true});const revision=await bridgeRevision();await writeFile(path.join(endpoint,'snapshot.json'),JSON.stringify({connected:true,pid:process.pid,heartbeat:Date.now()/1000,instance:'shared',bridgeRevision:revision}));await writeFile(path.join(workspace,'connection.json'),JSON.stringify({directory:endpoint,pid:process.pid}));
  for(const name of ['one','two']){const data=path.join(dir,name),bridge=new FreeCADBridge(data,{workspace});await bridge.restore();assert.equal((await bridge.connect('missing.exe')).instance,'shared');assert.equal(bridge.child,null);assert.equal(JSON.parse(await readFile(path.join(data,'connection.json'),'utf8')).directory,endpoint);}
});
