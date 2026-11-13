// Actual production entry/preload/UI, in a hidden window with isolated app data.
// No CAD connection command, camera action, model request or global shortcuts.
import {app,BrowserWindow,globalShortcut} from 'electron';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT} from '../infrastructure/paths.mjs';

process.env.GOUXING_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'gouxing-shell-'));
BrowserWindow.prototype.show=function(){};
globalShortcut.register=()=>false;
const timeout=setTimeout(()=>{console.error('Shell check timed out');app.exit(1);},20000);
app.on('browser-window-created',(_event,window)=>{
  window.webContents.once('did-finish-load',()=>void check(window).catch(error=>{console.error(error);app.exit(1);}));
});
async function check(window){
  const js=code=>window.webContents.executeJavaScript(code);
  const version=JSON.parse(await readFile(path.join(ROOT,'..','package.json'),'utf8')).version;
  const state=await js(`window.harness.call('state')`);
  assert.equal(state.app.version,version);assert.equal(state.phase,'idle');
  assert.equal(window.isVisible(),false);
  assert.equal(window.webContents.getLastWebPreferences().nodeIntegration,false);
  await js(`window.harness.call('draft','shell fixture draft')`);
  await js(`window.harness.call('toggle')`);
  let next=await js(`window.harness.call('state')`);
  assert.equal(next.window.small,true);assert.equal(next.draft,'shell fixture draft');
  await js(`window.harness.call('toggle')`);
  next=await js(`window.harness.call('state')`);assert.equal(next.window.small,false);
  assert.equal(await js(`!!document.getElementById('messages') && !!document.getElementById('draft')`),true);
  clearTimeout(timeout);
  console.log('PASS production shell: stable entry / preload / IPC / UI assets / draft / full-compact state');
  app.exit(0);
}
await import('../main.mjs');
