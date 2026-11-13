// Real production UI + real model + isolated CAD. Never uses the user's data directory.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {FreeCADBridge,ROOT} from '../bridge.mjs';
import {Session} from '../session.mjs';
import {resolveNode,standaloneEnvironment} from '../../cad-studio/node-runtime.mjs';
const reuse=process.env.GOUXING_SYMMETRY_ONLY==='1'||process.env.GOUXING_LAYOUT_ONLY==='1';
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
const directory=reuse?process.env.GOUXING_REVIEW_DIR:path.join(ROOT,'.data','airplane-loop',randomUUID());
if(!directory||!path.resolve(directory).startsWith(path.join(ROOT,'.data','airplane-loop')+path.sep))throw Error('Expected isolated airplane-loop directory');
if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE');
const bridge=new FreeCADBridge(directory);if(reuse){await bridge.restore();if(!(await bridge.snapshot()).connected)throw Error('Review CAD workspace is disconnected');}else{
  await bridge.connect(process.env.FREECAD_EXE);
  const session=new Session(directory,bridge);await session.load();await session.send('生成一个简化飞机');await session.confirm(session.state.plan.id);
  if(session.state.phase!=='done')throw Error(session.state.status);
  await session.savePlan(path.join(directory,'before.FCStd'));await session.confirm(session.state.plan.id);await session.saving;
}
console.log('AIRPLANE_TEST_DIR='+directory);
const runtime=await resolveNode(),require=createRequire(import.meta.url);
const child=spawn(require('electron'),[path.join(ROOT,'test','airplane-loop-check.mjs')],{stdio:'inherit',windowsHide:false,env:{...standaloneEnvironment(process.env),GOUXING_NODE_EXE:runtime.executable,GOUXING_DATA_DIR:directory}});
child.on('exit',code=>process.exitCode=code||0);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
