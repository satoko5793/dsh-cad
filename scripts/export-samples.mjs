import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadProject,projectDir,validId} from '../cad-studio/build.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const samples=JSON.parse(await readFile(path.join(root,'samples/projects.json'),'utf8'));
// Only these explicitly selected demonstration projects are published.
for(const {slug,id} of samples){
  if(!validId(slug)||!validId(id))throw new Error('Invalid sample manifest');
  const project=await loadProject(id),target=path.join(root,'samples/projects',slug);
  await mkdir(target,{recursive:true});
  await writeFile(path.join(target,'project.json'),JSON.stringify(project,null,2));
  for(const revision of project.revisions){
    if(!validId(revision.id))throw new Error('Invalid revision ID');
    const output=path.join(target,'revisions',revision.id);
    await mkdir(output,{recursive:true});
    for(const file of ['model.py','parameters.json','model.step','model.stl','revision.json'])await copyFile(path.join(projectDir(id),'revisions',revision.id,file),path.join(output,file));
  }
  console.log(`${project.title}: ${project.revisions.length} 个版本`);
}
