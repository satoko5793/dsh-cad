import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {ROOT} from '../infrastructure/paths.mjs';
import {standaloneEnvironment} from '../../shared/node-runtime.mjs';
const require=createRequire(import.meta.url);
const child=spawn(require('electron'),[path.join(ROOT,'test','shell-check.mjs')],{stdio:'inherit',windowsHide:true,env:standaloneEnvironment(process.env)});
child.on('exit',code=>process.exitCode=code||0);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
