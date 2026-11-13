// No BrowserWindow, CAD launch, plan confirmation or CAD write.
import {app} from 'electron';
import {mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT} from '../infrastructure/paths.mjs';
import {atomicJson} from '../infrastructure/storage.mjs';
import {FreeCADBridge} from '../cad/freecad/bridge.mjs';
import {Session,cleanError} from '../application/session.mjs';
import {saveConfig} from '../agent/config.mjs';
import {resolveNode} from '../../shared/node-runtime.mjs';
const directory=path.join(ROOT,'.data','runtime-layer',randomUUID());app.setPath('userData',path.join(directory,'electron'));
void app.whenReady().then(async()=>{
  const runtime=await resolveNode(),bridge=new FreeCADBridge(directory,{workspace:path.join(ROOT,'.data','cad-workspace')});await bridge.restore();await mkdir(directory,{recursive:true});
  await saveConfig(directory,{tools:['freecad_inspect','skill_read'],disabledSkills:[]});
  const session=new Session(directory,bridge);await session.load();await session.send('请实际加载freecad-native技能并调用freecad_inspect读取当前状态，简短说明可用的原生建模能力。只读检查，不准备计划、不改工程、不切换视角。');
  assert.ok(session.turn);let child,cwd;const deadline=Date.now()+180000;
  while(session.turn&&Date.now()<deadline){if(session.harness?.process){child=session.harness.process.spawnfile;cwd=session.harness.options.cwd;}await new Promise(r=>setTimeout(r,100));}
  if(session.turn){session.cancel();throw Error('Read-only runtime check timed out');}
  assert.equal(child,runtime.executable);assert.equal(cwd,ROOT);assert.equal(session.state.phase,'idle');assert.equal(session.state.plan,null);assert.equal(session.state.history.length,0);
  assert.ok(!session.state.messages.some(m=>m.text.includes('本次未操作 CAD：')));
  const tools=session.state.messages.flatMap(m=>m.tools||[]);assert.ok(tools.some(t=>t.name==='freecad_inspect'&&t.state==='done'));assert.ok(tools.some(t=>t.name==='skill_read'&&t.state==='done'));assert.ok(tools.every(t=>['freecad_inspect','skill_read'].includes(t.name)));
  await session.saving;await atomicJson(path.join(ROOT,'validation','runtime-layer-results.json'),{date:new Date().toISOString(),passed:true,electron:process.versions.electron,node:runtime.node,cwd:'desktop',checks:['actual standalone DSH process from Electron','desktop-owned cwd and stable plugin entry load after extraction','enabled skills and existing CAD context read through the reorganized modules','no plan, confirmation, CAD launch or model write'],note:'Read-only real model regression. CAD may be used concurrently by the user; no geometry/focus acceptance implied.'});
  console.log('PASS reorganized Electron/DSH runtime: desktop cwd, real tool/skill reads, no CAD launch or write');app.quit();
}).catch(error=>{console.error(cleanError(error));app.exit(1);});
