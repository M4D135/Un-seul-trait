import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_IDS,DEFAULT_BINDINGS,actionForKey,normalizeKey,sanitizeBindings} from '../lib/trait/controls';

test('both posture bindings resolve without jump or automatic mechanism controls',()=>{
  const bindings=sanitizeBindings(JSON.parse(JSON.stringify(DEFAULT_BINDINGS)));
  assert.equal(actionForKey('ArrowDown',bindings),'crouch');assert.equal(actionForKey('S',bindings),'crouch');
  assert.equal(actionForKey(' ',bindings),null);assert.equal(actionForKey('ArrowUp',bindings),'stand');
  assert.equal(actionForKey('Z',bindings),'stand');
  assert.equal(actionForKey('F',bindings),null);assert.equal(actionForKey('Enter',bindings),null);
  assert.equal(normalizeKey('Tab'),null);
});

test('migration discards removed jump and automatic interaction actions without losing customized moves',()=>{
  const old={left:['f','Enter'],right:['d',null],jump:['k','ArrowUp'],interact:['h','g'],draw:['e',null],pause:['p','Escape'],restart:['r',null]};
  const bindings=sanitizeBindings(old);
  assert.deepEqual(bindings.left,['f','Enter']);assert.deepEqual(bindings.right,['d',null]);
  assert.equal('jump' in bindings,false);assert.deepEqual(bindings.crouch,['ArrowDown','s']);
  assert.equal(actionForKey('k',bindings),null);assert.equal(actionForKey('ArrowUp',bindings),'stand');
  assert.equal('interact' in bindings,false);assert.equal(actionForKey('h',bindings),null);
  assert.deepEqual(bindings.stand,['ArrowUp','z']);
  const keys=ACTION_IDS.flatMap(action=>bindings[action].filter(Boolean));
  assert.equal(new Set(keys).size,keys.length);
});

test('malformed bindings keep a usable unique key on every action',()=>{
  const bindings=sanitizeBindings({left:['ArrowRight','ArrowRight'],right:['ArrowRight',{}],crouch:[null,'K'],draw:['k'],interact:[],pause:['Tab'],restart:['K']});
  const keys=ACTION_IDS.flatMap(action=>bindings[action].filter(Boolean));
  assert.equal(new Set(keys).size,keys.length);
  for(const action of ACTION_IDS)assert.ok(bindings[action].some(Boolean),action);
  assert.equal(bindings.crouch[1],'k');
});

test('new crouch defaults never steal Down or S from an existing custom drawing action',()=>{
  const bindings=sanitizeBindings({left:['q','ArrowLeft'],right:['d','ArrowRight'],jump:[' ','ArrowUp'],draw:['ArrowDown','s'],interact:['f','Enter'],pause:['p','Escape'],restart:['r',null]});
  assert.deepEqual(bindings.draw,['ArrowDown','s']);
  assert.ok(bindings.crouch.some(Boolean));
  assert.equal(actionForKey('ArrowDown',bindings),'draw');
  assert.equal(actionForKey(' ',bindings),null);
});

test('new stand defaults preserve existing custom Up and Z assignments and remain bindable twice',()=>{
  const bindings=sanitizeBindings({left:['ArrowUp','z'],right:['ArrowRight','d'],crouch:['ArrowDown','s'],draw:['e',null],pause:['p','Escape'],restart:['r',null],interact:['f','Enter']});
  assert.deepEqual(bindings.left,['ArrowUp','z']);
  assert(bindings.stand.some(Boolean),'a spare key keeps the new action usable');
  const custom=sanitizeBindings({...bindings,stand:['u','i']});
  assert.equal(actionForKey('U',custom),'stand');
  assert.equal(actionForKey('i',custom),'stand');
  assert.equal(actionForKey('Enter',custom),null);
});
