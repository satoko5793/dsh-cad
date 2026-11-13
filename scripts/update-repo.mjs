import {spawnSync} from 'node:child_process';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(command,args,{capture=false,allowFailure=false}={}){const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:capture?'pipe':'inherit',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});if(result.error)throw result.error;if(result.status!==0&&!allowFailure)throw new Error(`${command} ${args[0]} failed (${result.status})`);return capture?result.stdout.trim():result.status;}
const remote=run('git',['remote','get-url','origin'],{capture:true});
if(!['https://github.com/satoko5793/dsh-cad.git','https://github.com/satoko5793/dsh-cad','git@github.com:satoko5793/dsh-cad.git'].includes(remote))throw new Error('origin 必须是 satoko5793/dsh-cad；请先检查仓库地址。');
if(run('git',['branch','--show-current'],{capture:true})!=='main')throw new Error('请在 main 分支更新，其他分支请先完成合并。');
run('git',['fetch','origin']);
const remoteMain=run('git',['rev-parse','--verify','refs/remotes/origin/main'],{capture:true,allowFailure:true});
if(remoteMain&&run('git',['merge-base','--is-ancestor','origin/main','HEAD'],{allowFailure:true})!==0)throw new Error('远端有尚未合并的更改，请先处理；不会强制推送。');
run(process.execPath,['--test','cad-studio/test/cad.test.mjs','cad-studio/test/parameters.test.mjs','cad-studio/test/plugin.test.mjs']);
run(process.execPath,['scripts/export-samples.mjs']);
const python=process.env.CAD_PYTHON||path.join(root,'cad-studio/.venv/Scripts/python.exe');
run(python,['samples/verify-complex.py']);
run('git',['add','--','AGENTS.md','README.md','.gitignore','.gitattributes','package.json','package-lock.json','start.cmd','start-harness.cmd','docs','cad-studio','scripts','samples','research']);
const files=run('git',['diff','--cached','--name-only','--diff-filter=ACMR','-z'],{capture:true}).split('\0').filter(Boolean);
for(const file of files){
  if(/(?:^|\/)(?:node_modules|\.venv|\.data|\.qa|\.dsh)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|credentials\.json$/i.test(file))throw new Error(`不应发布的文件已暂存：${file}`);
  const meta=await stat(path.join(root,file));if(meta.size>25*1024*1024)throw new Error(`文件超过25MB，请单独检查：${file}`);
  // Inspect the actual staged bytes, including changes staged before this command.
  const content=run('git',['show',`:${file}`],{capture:true});
  if(/\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))throw new Error(`暂存文件可能含凭据，请先检查：${file}`);
}
if(run('git',['diff','--cached','--quiet'],{allowFailure:true})!==0){const message=process.argv.slice(2).join(' ').trim()||'Update CAD studio and verified samples';run('git',['commit','-m',message]);}
run('git',['push','-u','origin','main']);
const local=run('git',['rev-parse','HEAD'],{capture:true}),remoteHead=run('git',['ls-remote','origin','refs/heads/main'],{capture:true}).split(/\s+/)[0];
if(local!==remoteHead)throw new Error('远端提交与本地不一致，请检查推送结果。');
console.log(`已同步：https://github.com/satoko5793/dsh-cad/commit/${local}`);
