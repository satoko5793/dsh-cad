// Explicit integration: run as an Electron main process, never as ordinary Node.
import {app} from 'electron';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {FreeCADBridge,ROOT,atomicJson} from '../bridge.mjs';
import {Session} from '../session.mjs';
import {resolveNode,standaloneEnvironment} from '../../cad-studio/node-runtime.mjs';

const directory=path.join(ROOT,'.data','electron-regression',randomUUID());
app.setPath('userData',path.join(directory,'electron'));
void app.whenReady().then(run).catch(error=>{console.error(String(error.message).replace(/sk-[\w-]+/g,'[redacted]'));app.exit(1);});
async function run(){
  assert.ok(process.versions.electron,'This regression must run inside Electron');
  if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE to an installed FreeCAD.exe');
  const runtime=await resolveNode();
  const execFileAsync=promisify(execFile);
  const legacyCode="try{require('node-addon-require-builtin').requireBuiltin('internal/modules/cjs/loader');console.log(JSON.stringify({supported:true}));}catch(e){console.log(JSON.stringify({supported:false,code:e.code||e.message}));}";
  const legacy=await execFileAsync(process.execPath,['-e',legacyCode],{cwd:path.resolve(ROOT,'..'),env:{...standaloneEnvironment(process.env),ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,timeout:15000});
  const legacyProbe=JSON.parse(legacy.stdout.trim());
  const bridge=new FreeCADBridge(directory);await bridge.connect(process.env.FREECAD_EXE);
  const session=new Session(directory,bridge);await session.load();
  const checks=[];
  async function ask(text,verify){
    await session.send(text);assert.ok(session.turn,'Regression must exercise a real model turn, not an offline command');const deadline=Date.now()+180000;
    let observedChild;
    while(session.turn&&Date.now()<deadline){if(session.harness?.process?.spawnfile)observedChild=session.harness.process.spawnfile;await new Promise(r=>setTimeout(r,250));}
    if(session.turn){session.cancel();throw Error('Desktop model request timed out');}
    assert.equal(observedChild,runtime.executable,'Actual DSH process must use the standalone Node executable');
    assert.equal(session.state.phase,'ready',session.state.messages.at(-1).text);verify(session.state.plan);
    await session.confirm(session.state.plan.id);assert.equal(session.state.phase,'done',session.state.status);
    checks.push({request:text,passed:true});console.log('PASS Electron → standalone Node → DSH → FreeCAD:',text);
  }
  await ask('我想做一个简化飞机模型，使用已有airplane参数配方示例即可。',plan=>{assert.equal(plan.action,'create_design');assert.ok(plan.design.components.length>=3);});
  assert.equal(session.state.context.document.components.length,3);
  const before=structuredClone(session.state.context.document);
  await ask('机翼展长改成120毫米，其他不变。',plan=>{assert.equal(plan.action,'update_design');assert.deepEqual(plan.changes,{span:120});});
  const after=session.state.context.document;
  assert.equal(after.design.parameters.span.value,120);
  for(const id of ['fuselage','tail']){
    const a=before.components.find(c=>c.id===id),b=after.components.find(c=>c.id===id);assert.ok(Math.abs(a.volume-b.volume)<1e-6);assert.deepEqual(a.bounds,b.bounds);
  }
  await session.saving;
  const saved=await bridge.execute({action:'save_as',path:path.join(directory,'airplane.FCStd'),expected:session.state.context.fingerprint});
  assert.ok(saved.file);
  await mkdir(path.join(ROOT,'validation'),{recursive:true});
  await atomicJson(path.join(ROOT,'validation','electron-runtime-results.json'),{date:new Date().toISOString(),parent:{electron:process.versions.electron,node:process.versions.node},child:{node:runtime.node,electron:runtime.electron},legacyProbe,checks,passed:true,note:'Actual Electron main process invoking Session/Harness, two real model calls and native CAD writes in an isolated workspace. No UI click acceptance implied.'});
  console.log('Electron regression passed. Native file:',saved.file);app.quit();
}
