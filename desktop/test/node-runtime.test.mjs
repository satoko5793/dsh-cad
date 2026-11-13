import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveNode,standaloneEnvironment} from '../../cad-studio/node-runtime.mjs';

test('DSH child environment removes Electron run-as-node flags and preserves model settings',()=>{
  const env=standaloneEnvironment({ELECTRON_RUN_AS_NODE:'1',electron_run_as_node:'1',DSH_HOME:'test-profile-home',CAD_LLM_PROVIDER:'test-provider'});
  assert.deepEqual(env,{DSH_HOME:'test-profile-home',CAD_LLM_PROVIDER:'test-provider'});
});
test('standalone Node is verified before starting model runtime',async()=>{
  const runtime=await resolveNode({env:{},execPath:process.execPath,versions:{node:process.versions.node}});
  assert.equal(runtime.executable,process.execPath);assert.equal(runtime.node,process.versions.node);assert.equal(runtime.electron,null);
});
test('Electron parent uses launcher-provided Node instead of its executable',async()=>{
  const runtime=await resolveNode({env:{GOUXING_NODE_EXE:process.execPath,ELECTRON_RUN_AS_NODE:'1'},execPath:'E:/app/electron.exe',versions:{electron:'45.3.1'}});
  assert.equal(runtime.executable,process.execPath);assert.equal(runtime.electron,null);
});
test('missing standalone Node or an explicit Electron path fails clearly without fallback',async()=>{
  await assert.rejects(resolveNode({env:{},execPath:'E:/app/electron.exe',versions:{electron:'45.3.1'}}),{code:'DSH_NODE_UNAVAILABLE'});
  await assert.rejects(resolveNode({env:{GOUXING_NODE_EXE:'E:/app/electron.exe'},execPath:process.execPath,versions:{node:process.versions.node}}),{code:'DSH_NODE_UNAVAILABLE'});
});
