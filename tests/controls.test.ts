import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_IDS,DEFAULT_BINDINGS,actionForKey,normalizeKey,sanitizeBindings} from '../lib/trait/controls';

test('both jump bindings and both interaction bindings resolve after a JSON round-trip',()=>{
  const bindings=sanitizeBindings(JSON.parse(JSON.stringify(DEFAULT_BINDINGS)));
  assert.equal(actionForKey(' ',bindings),'jump');assert.equal(actionForKey('ArrowUp',bindings),'jump');
  assert.equal(actionForKey('F',bindings),'interact');assert.equal(actionForKey('Enter',bindings),'interact');
  assert.equal(normalizeKey('Tab'),null);
});

test('adding hand interaction preserves existing customized F and Enter controls',()=>{
  const old={left:['f','Enter'],right:['d',null],jump:['k','ArrowUp'],draw:['e',null],pause:['p','Escape'],restart:['r',null]};
  const bindings=sanitizeBindings(old);
  assert.deepEqual(bindings.left,['f','Enter']);assert.deepEqual(bindings.jump,['k','ArrowUp']);
  assert.ok(bindings.interact.some(Boolean));
  const keys=ACTION_IDS.flatMap(action=>bindings[action].filter(Boolean));
  assert.equal(new Set(keys).size,keys.length);
});

test('malformed bindings keep a usable unique key on every action',()=>{
  const bindings=sanitizeBindings({left:['ArrowRight','ArrowRight'],right:['ArrowRight',{}],jump:[null,'K'],draw:['k'],interact:[],pause:['Tab'],restart:['K']});
  const keys=ACTION_IDS.flatMap(action=>bindings[action].filter(Boolean));
  assert.equal(new Set(keys).size,keys.length);
  for(const action of ACTION_IDS)assert.ok(bindings[action].some(Boolean),action);
  assert.equal(bindings.jump[1],'k');
});
