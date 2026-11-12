import {readFile,access,cp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DATA,validId} from '../cad-studio/build.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const samples=JSON.parse(await readFile(path.join(root,'samples/projects.json'),'utf8'));
await mkdir(DATA,{recursive:true});
for(const {slug,id} of samples){
  if(!validId(slug)||!validId(id))throw new Error('Invalid sample manifest');
  const source=path.join(root,'samples/projects',slug),target=path.join(DATA,id);
  const project=JSON.parse(await readFile(path.join(source,'project.json'),'utf8'));
  if(project.id!==id)throw new Error('Sample ID mismatch');
  let exists=false;try{await access(target);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(exists){console.log(`已保留现有项目：${project.title}`);continue;}
  await cp(source,target,{recursive:true,force:false,errorOnExist:true});
  console.log(`已导入：${project.title}`);
}
