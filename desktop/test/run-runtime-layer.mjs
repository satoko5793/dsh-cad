// Read-only actual Electron -> standalone Node -> DSH regression after layering.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {ROOT} from '../infrastructure/paths.mjs';
import {resolveNode,standaloneEnvironment} from '../../shared/node-runtime.mjs';
const runtime=await resolveNode(),require=createRequire(import.meta.url);
const child=spawn(require('electron'),[path.join(ROOT,'test','runtime-layer-check.mjs')],{stdio:'inherit',windowsHide:true,env:{...standaloneEnvironment(process.env),GOUXING_NODE_EXE:runtime.executable}});
child.on('exit',code=>process.exitCode=code||0);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
