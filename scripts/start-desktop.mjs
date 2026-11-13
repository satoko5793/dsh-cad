import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let executable;
try{executable=require('electron');}catch{
  console.error('桌面运行时尚未安装。请在仓库根目录运行 npm ci，然后运行 node node_modules/electron/install.js。');process.exit(1);
}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,[path.join(root,'desktop','main.mjs')],{cwd:root,env,stdio:'inherit',windowsHide:false});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code||0;});
