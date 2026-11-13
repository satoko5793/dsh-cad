import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,REPOSITORY_ROOT} from '../infrastructure/paths.mjs';
import {Harness} from '../../shared/harness.mjs';

async function modules(directory){const files=[];for(const entry of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await modules(file));else if(entry.name.endsWith('.mjs'))files.push(file);}return files;}
const inside=(file,root)=>file===root||file.startsWith(root+path.sep);
test('desktop layers resolve imports and shared/domain code stays independent of the web prototype',async()=>{
  const roots=['shell','application','agent','domain','cad','infrastructure'].map(d=>path.join(ROOT,d)),shared=path.join(REPOSITORY_ROOT,'shared'),prototype=path.join(REPOSITORY_ROOT,'cad-studio'),domain=path.join(ROOT,'domain');
  for(const file of (await Promise.all([...roots,shared].map(modules))).flat()){
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)){
      const specifier=match[1];
      if(specifier.startsWith('.')){const target=path.resolve(path.dirname(file),specifier);await access(target);assert.ok(!inside(target,prototype),'Production layer depends on prototype: '+file);if(inside(file,shared))assert.ok(inside(target,shared),'Shared runtime depends on an application');if(inside(file,domain))assert.ok(inside(target,domain),'Domain imports another layer');}
      else if(inside(file,domain))assert.fail('Domain must remain data-only: '+specifier);
    }
  }
});
test('stable profile and module entry points forward to the same implementations',async()=>{
  for(const [oldPath,newPath,name] of [['session.mjs','application/session.mjs','Session'],['bridge.mjs','cad/freecad/bridge.mjs','FreeCADBridge'],['design.mjs','domain/design.mjs','validateDesign'],['native-tools.mjs','cad/freecad/contracts.mjs','validateNativeCall'],['plan-plugin.mjs','agent/tools.mjs','apply']]){const old=await import('../'+oldPath),current=await import('../'+newPath);assert.equal(old[name],current[name],oldPath);}
  const old=await import('../../cad-studio/node-runtime.mjs'),current=await import('../../shared/node-runtime.mjs');assert.equal(old.resolveNode,current.resolveNode);
});
test('shared Harness requires application-owned paths rather than loading prototype defaults',async()=>{
  await assert.rejects(new Harness(()=>{}).start(),/absolute cwd, prompt and plugin/);
});
