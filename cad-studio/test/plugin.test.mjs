import test from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../cad-plugin.mjs';

test('CAD tool exposes JSON Schema on the DSH wire and limits tools per agent',()=>{
  let definition,created;
  apply({tools:{register:value=>definition=value},on:(event,fn)=>{assert.equal(event,'agent/created');created=fn;}});
  assert.equal(definition.parameters.type,'object');
  assert.equal(definition.parameters.properties.source.type,'string');
  assert.deepEqual(definition.parameters.required,['projectId','title','source','parametersJson']);
  let restriction;
  created({agent:{ctx:{tools:{restrict:value=>restriction=value}}}});
  assert.deepEqual(restriction,{allow:['cad_build']});
});
