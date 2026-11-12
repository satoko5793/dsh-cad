import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const profile=path.join(os.homedir(),'.dsh','profiles','cad-evaluation');await mkdir(profile,{recursive:true});
await writeFile(path.join(profile,'package.json'),JSON.stringify({name:'cad-evaluation-profile',private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-cad']}}},null,2));
await writeFile(path.join(profile,'cordis.yml'),'[]\n');
await writeFile(path.join(profile,'cordis.patch.yml'),'[]\n');
await mkdir(path.join(profile,'node_modules'),{recursive:true});console.log(profile);
