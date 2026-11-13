import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {REPOSITORY_ROOT} from '../infrastructure/paths.mjs';

test('Python bridge survives real Windows file locks and retries publications without replaying CAD',()=>{
  const python=process.env.CAD_PYTHON||path.join(REPOSITORY_ROOT,'cad-studio','.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const run=spawnSync(python,['-I','-X','utf8',path.join(REPOSITORY_ROOT,'desktop/test/bridge-io-check.py')],{encoding:'utf8',windowsHide:true,timeout:15000});
  assert.ifError(run.error);assert.equal(run.status,0,run.stderr||run.stdout);
});
