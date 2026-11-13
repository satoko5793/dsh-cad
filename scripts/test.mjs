import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const groups={desktop:'desktop/test',prototype:'cad-studio/test'},mode=process.argv[2]||'all';
if(mode!=='all'&&!Object.hasOwn(groups,mode))throw Error('Test group must be all, desktop or prototype');
for(const [name,directory] of Object.entries(groups)){
  if(mode!=='all'&&name!==mode)continue;
  const files=(await readdir(path.join(root,directory))).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>path.join(directory,f));
  if(!files.length)throw Error('No tests found for '+name);
  console.log('Running '+name+' tests');
  const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
