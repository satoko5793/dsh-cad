import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {installConnector} from '../cad-connector.mjs';
test('connector installs owned startup files using the CAD-reported user directory',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-connector-'));t.after(()=>rm(dir,{recursive:true,force:true}));const probe=async()=>({userData:dir,version:['1','1','4']});const first=await installConnector('unused',path.join(dir,'workspace'),{probe});assert.match(await readFile(path.join(first.directory,'InitGui.py'),'utf8'),/QTimer.singleShot/);assert.equal(JSON.parse(await readFile(path.join(first.directory,'gouxing.json'),'utf8')).owner,'gouxing-cad');assert.equal((await installConnector('unused',path.join(dir,'workspace'),{probe})).directory,first.directory);
});
test('connector never overwrites an unrelated existing FreeCAD module',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'gouxing-module-'));t.after(()=>rm(dir,{recursive:true,force:true}));const module=path.join(dir,'Mod','GouxingConnect');await mkdir(module,{recursive:true});await writeFile(path.join(module,'InitGui.py'),'keep user module');await assert.rejects(installConnector('unused',dir,{probe:async()=>({userData:dir,version:['1','1']})}),/未覆盖/);assert.equal(await readFile(path.join(module,'InitGui.py'),'utf8'),'keep user module');
});
