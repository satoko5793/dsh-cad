// Launch a separate test workspace; do not overwrite the user's session or close their apps.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {FreeCADBridge,ROOT} from '../bridge.mjs';
import {Session} from '../session.mjs';
import {resolveNode,standaloneEnvironment} from '../../shared/node-runtime.mjs';
const directory=path.join(ROOT,'.data','ui-validation',randomUUID());
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE');
const bridge=new FreeCADBridge(directory);await bridge.connect(process.env.FREECAD_EXE);
const session=new Session(directory,bridge);await session.load();await session.send('做一个带盖控制盒');await session.confirm(session.state.plan.id);
session.state.draft='把盖子加厚1毫米，盒身不变。';session.publish();await session.saving;
console.log('Isolated UI workspace:',directory);
const runtime=await resolveNode();
const require=createRequire(import.meta.url),env={...standaloneEnvironment(process.env),GOUXING_NODE_EXE:runtime.executable,GOUXING_DATA_DIR:directory};
const child=spawn(require('electron'),[path.join(ROOT,'main.mjs')],{stdio:'inherit',env,windowsHide:false});
child.on('exit',code=>{process.exitCode=code||0;});
