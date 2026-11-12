import test from 'node:test';
import assert from 'node:assert/strict';
import {parameterSpecs,validateParameters} from '../public/parameters.js';
test('display metadata keeps lengths, angles and counts distinct, and enforces declared bounds',()=>{
  const values={length:80,angle:45,hole_count:4};
  const specs=parameterSpecs(values,{length:{label:'底板长度',min:20,max:120,unit:'mm'},angle:{label:'倾角',unit:'°'}});
  assert.equal(specs.length.label,'底板长度');assert.equal(specs.angle.unit,'°');assert.equal(specs.hole_count.unit,'个');
  validateParameters(values,specs);
  assert.throws(()=>validateParameters({...values,length:121},specs),/底板长度不能大于 120mm/);
  assert.throws(()=>validateParameters({...values,hole_count:2.5},specs),/孔数量需要填写整数/);
  assert.throws(()=>validateParameters({...values,length:NaN},specs),/numeric/);
  const inferred=parameterSpecs({thickness:5});
  assert.equal(inferred.thickness.min,undefined);
  assert.throws(()=>validateParameters({thickness:0},inferred),/厚度需要大于 0mm/);
});
