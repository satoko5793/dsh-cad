import test from 'node:test';
import assert from 'node:assert/strict';
import {componentColor,explodedOffsets} from '../public/viewer-math.js';

test('exploded display is reversible, translation invariant and does not alter design bounds',()=>{
  const parts=[{name:'底座',bounds:[-20,-10,0,20,10,4]},{name:'盖子',bounds:[-20,-10,14,20,10,18]}];
  const original=structuredClone(parts);
  assert.deepEqual(explodedOffsets(parts,0),[[0,0,0],[0,0,0]]);
  const offset=explodedOffsets(parts,1);
  assert.ok(offset[0][2]<0&&offset[1][2]>0);
  const shifted=parts.map(c=>({...c,bounds:c.bounds.map((v,i)=>v+[100,-50,80][i%3])}));
  assert.deepEqual(explodedOffsets(shifted,1),offset);
  assert.deepEqual(parts,original);
  assert.equal(componentColor('底座'),componentColor('底座'));
  const coincident=explodedOffsets([{bounds:[-1,-1,-1,1,1,1]},{bounds:[-1,-1,-1,1,1,1]}],1);
  assert.ok(coincident.flat().every(Number.isFinite));assert.notDeepEqual(coincident[0],coincident[1]);
  assert.deepEqual(explodedOffsets([parts[0]],1),[[0,0,0]]);
});
