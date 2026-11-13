// Real model, production desktop window, isolated installed FreeCAD workspace.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {FreeCADBridge,ROOT} from '../bridge.mjs';
import {resolveNode,standaloneEnvironment} from '../../shared/node-runtime.mjs';
const directory=path.join(ROOT,'.data','native-model',randomUUID());
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
if(!process.env.FREECAD_EXE)throw Error('Set FREECAD_EXE');
const bridge=new FreeCADBridge(directory);await bridge.connect(process.env.FREECAD_EXE);
console.log('NATIVE_MODEL_DIR='+directory);
const runtime=await resolveNode(),require=createRequire(import.meta.url);
const child=spawn(require('electron'),[path.join(ROOT,'test','native-model-check.mjs')],{stdio:'inherit',windowsHide:false,env:{...standaloneEnvironment(process.env),GOUXING_NODE_EXE:runtime.executable,GOUXING_DATA_DIR:directory}});
child.on('exit',code=>process.exitCode=code||0);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
