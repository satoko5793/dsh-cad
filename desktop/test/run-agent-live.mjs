import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {ROOT} from '../bridge.mjs';
import {resolveNode,standaloneEnvironment} from '../../cad-studio/node-runtime.mjs';
const require=createRequire(import.meta.url),runtime=await resolveNode();
process.env.GOUXING_CAD_WORKSPACE ||= path.join(ROOT,'.data','cad-workspace');
const child=spawn(require('electron'),[path.join(ROOT,'test','agent-live-check.mjs')],{stdio:'inherit',windowsHide:false,env:{...standaloneEnvironment(process.env),GOUXING_NODE_EXE:runtime.executable}});
child.on('exit',code=>process.exitCode=code||0);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
