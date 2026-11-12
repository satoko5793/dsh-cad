import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const temp=await mkdtemp(path.join(os.tmpdir(),'cad-studio-test-'));
process.env.CAD_DATA_DIR=temp;
const {saveProject,loadProject,buildModel,projectDir,previewModel,loadPreview,previewDir,commitPreview,discardPreview}=await import('../build.mjs');
const id=randomUUID();
const source=`length=params['length']
width=params['width']
thickness=params['thickness']
hole_diameter=params['hole_diameter']
offset=params['offset']
points=[(-length/2+offset,-width/2+offset),(length/2-offset,-width/2+offset),(-length/2+offset,width/2-offset),(length/2-offset,width/2-offset)]
result=cq.Workplane('XY').box(length,width,thickness).faces('>Z').workplane().pushPoints(points).hole(hole_diameter)
`;
test('CAD worker builds exact solids, preserves revisions, rejects bad geometry and disallowed imports',async()=>{
  await saveProject({id,title:'Test plate',messages:[],revisions:[]});
  const parameters={length:80,width:40,thickness:5,hole_diameter:6,offset:8};
  const first=await buildModel({projectId:id,title:'Plate',source,parameters});
  assert.deepEqual(first.geometry.size,[80,40,5]);assert.equal(first.geometry.solids,1);assert.equal(first.geometry.valid,true);
  assert.ok(Math.abs(first.geometry.volume-(80*40*5-4*Math.PI*3**2*5))<.01);
  const step=await readFile(path.join(projectDir(id),'revisions',first.id,'model.step'),'utf8');assert.ok(step.startsWith('ISO-10303-21;'));
  const stl=await readFile(path.join(projectDir(id),'revisions',first.id,'model.stl'));assert.ok(stl.length>84);
  const repeatedParamsSource='params = {"length":80,"width":40,"thickness":5,"hole_diameter":6,"offset":8}\n'+source;
  const second=await buildModel({projectId:id,title:'Plate revised',source:repeatedParamsSource,parameters:{...parameters,thickness:8,hole_diameter:8}});
  assert.deepEqual(second.geometry.size,[80,40,8]);assert.notEqual(second.id,first.id);
  assert.equal(second.geometry.cylindricalSurfaces.length,4);
  for(const surface of second.geometry.cylindricalSurfaces){assert.equal(surface.diameter,8);assert.equal(Math.abs(surface.center[0]),32);assert.equal(Math.abs(surface.center[1]),12);}
  assert.ok(Math.abs(second.geometry.volume-(80*40*8-4*Math.PI*4**2*8))<.01);
  await assert.rejects(()=>buildModel({projectId:id,source:'import os\nresult=cq.Workplane("XY").box(1,1,1)',parameters:{}}),/Only cadquery and math/);
  await assert.rejects(()=>buildModel({projectId:id,source:'result = cq.Workplane("XY").box(0,0,0)',parameters:{}}));
  await assert.rejects(()=>buildModel({projectId:id,source,parameters:{...parameters,length:NaN}}),/numeric/);
  const p=await loadProject(id);assert.equal(p.revisions.length,2);assert.equal(p.activeRevision,second.id);
  assert.ok(!(await readFile(path.join(projectDir(id),'revisions',second.id,'model.py'),'utf8')).includes('params ='));
});
test('parameter preview is non-destructive, cancel restores the original, save commits the exact preview once',async()=>{
  const projectId=randomUUID();
  await saveProject({id:projectId,title:'Preview test',messages:[],revisions:[]});
  const parameters={length:80,width:40,thickness:5,hole_diameter:6,offset:8};
  const base=await buildModel({projectId,title:'Plate',source,parameters});
  const original=await readFile(path.join(projectDir(projectId),'project.json'),'utf8');
  const preview=await previewModel({projectId,baseRevisionId:base.id,parameters:{...parameters,thickness:8,hole_diameter:8}});
  assert.deepEqual(preview.geometry.size,[80,40,8]);
  assert.ok(Math.abs(preview.geometry.volume-(80*40*8-4*Math.PI*16*8))<.01);
  assert.equal(await readFile(path.join(projectDir(projectId),'project.json'),'utf8'),original);
  await discardPreview(projectId,preview.id);
  await assert.rejects(()=>loadPreview(projectId,preview.id),{code:'ENOENT'});
  assert.equal(await readFile(path.join(projectDir(projectId),'project.json'),'utf8'),original);
  await assert.rejects(()=>previewModel({projectId,baseRevisionId:base.id,parameters:{...parameters,thickness:-1}}));
  await assert.rejects(()=>previewModel({projectId,baseRevisionId:base.id,parameters:{...parameters,hole_diameter:200}}));
  await assert.rejects(()=>previewModel({projectId,baseRevisionId:base.id,parameters:{...parameters,new_parameter:1}}),/保留原有参数/);
  assert.equal(await readFile(path.join(projectDir(projectId),'project.json'),'utf8'),original);
  const ready=await previewModel({projectId,baseRevisionId:base.id,parameters:{...parameters,thickness:8,hole_diameter:8}});
  const previewStep=await readFile(path.join(previewDir(projectId,ready.id),'model.step'));
  const saved=await commitPreview(projectId,ready.id);
  assert.deepEqual(await readFile(path.join(projectDir(projectId),'revisions',saved.id,'model.step')),previewStep);
  const retried=await commitPreview(projectId,ready.id);assert.equal(retried.id,saved.id);
  const project=await loadProject(projectId);assert.equal(project.revisions.length,2);assert.equal(project.activeRevision,saved.id);
  assert.equal(saved.basedOn,base.id);
  await assert.rejects(()=>discardPreview(projectId,'../revisions'),/Invalid preview ID/);
  assert.equal((await loadProject(projectId)).revisions.length,2);
});
test.after(async()=>{await rm(temp,{recursive:true,force:true});});
