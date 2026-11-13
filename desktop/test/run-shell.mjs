import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {ROOT} from '../infrastructure/paths.mjs';
import {resolveNode,standaloneEnvironment} from '../../shared/node-runtime.mjs';
const require=createRequire(import.meta.url),runtime=await resolveNode();
const child=spawn(require('electron'),[path.join(ROOT,'test','shell-check.mjs')],{stdio:'inherit',windowsHide:true,env:{...standaloneEnvironment(process.env),GOUXING_NODE_EXE:runtime.executable,...(process.argv.includes('--model')?{GOUXING_SHELL_MODEL_CHECK:'1'}:{})}});
child.on('exit',code=>process.exitCode=code||0);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
