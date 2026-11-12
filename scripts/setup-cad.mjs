import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='win32')throw new Error('当前安装脚本面向 Windows；其他系统请按开发说明配置 CAD_PYTHON。');
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<24||(major===24&&minor<9))throw new Error('请先安装 Node.js 24.9 或更新版本。');
function run(command,args,cwd=root){const result=spawnSync(command,args,{cwd,stdio:'inherit',windowsHide:true,shell:command==='npm'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run('npm',['ci']);
run('npm',['ci'],path.join(root,'cad-studio'));
const python=path.join(root,'cad-studio/.venv/Scripts/python.exe');
if(!existsSync(python))run('py',['-3.13','-m','venv','cad-studio/.venv']);
run(python,['-m','pip','install','-r','requirements.lock.txt'],path.join(root,'cad-studio'));
console.log('安装完成。配置 DSH 的 DeepSeek API 后，运行 npm run samples:import，再运行 npm start。');
