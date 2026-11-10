import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../lib/trait/platformer';
import {ADVANCED_LEVELS} from '../lib/trait/platform-advanced-levels';
import {preparePlayerStroke} from '../lib/trait/platform-drawing';

test('wrong reachable partial settings can always be corrected; no advanced chamber has an irreversible logical deadlock', () => {
  let audited = 0;
  for (const level of ADVANCED_LEVELS) for (const scene of level.puzzles!) {
    const drawing = level.drawings.find(d => d.triggerX >= scene.fromX && d.triggerX <= scene.toX)!;
    assert(drawing, `${level.id}/${scene.id}: missing drawing beyond the mechanical room`);
    const roomMechanisms = level.mechanisms!.filter(m => m.from.x >= scene.fromX
      && Math.max(m.from.x, m.to.x) < drawing.path[0].x);
    const exit = roomMechanisms.reduce((last, m) => Math.max(m.from.x, m.to.x) > Math.max(last.from.x, last.to.x) ? m : last);
    assert(exit.interlock?.requirements.length, `${level.id}/${scene.id}: the physical exit must have prerequisites`);
    // Prove that each room's last door/platform can be operated, including
    // its contacts. Earlier rooms need not retain those contacts forever.
    const goals: E.PuzzleRequirement[] = [
      ...exit.interlock.requirements,
      { mechanismId: exit.id, min: .88, label: 'Sortie physique de la salle libérée' },
    ];
    const needed = new Set(goals.flatMap(r => 'mechanismId' in r ? [r.mechanismId] : []));
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...needed]) {
        const mechanism = level.mechanisms!.find(m => m.id === id)!;
        assert(mechanism, `missing prerequisite ${id}`);
        for (const requirement of mechanism.interlock?.requirements ?? []) {
          if ('mechanismId' in requirement && !needed.has(requirement.mechanismId)) {
            needed.add(requirement.mechanismId); changed = true;
          }
        }
      }
    }
    const controls = level.mechanisms!.filter(m => needed.has(m.id));
    // Include off-notch errors as well as every intended detent. This audits
    // logical recovery; the separate walkthrough tests exercise body collisions.
    const values = controls.map(m => [...new Set([0, .1, .5, .9, 1, m.initialProgress ?? 0, ...(m.detents ?? [])])].sort((a, b) => a - b));
    const world = E.createWorld(level);
    const states = [controls.map((m, i) => values[i].indexOf(m.initialProgress ?? 0))];
    const previous: number[][] = [[]], lookup = new Map([[states[0].join(','), 0]]), solved: number[] = [];
    for (let index = 0; index < states.length; index++) {
      const state = states[index];
      controls.forEach((m, i) => { world.mechanisms[m.id] = {progress: values[i][state[i]], target: values[i][state[i]]}; });
      if (!E.evaluatePuzzleRequirements(world, level, goals).locked) solved.push(index);
      for (let c = 0; c < controls.length; c++) {
        if (E.getMechanismInterlock(world, level, controls[c]).locked) continue;
        for (let v = 0; v < values[c].length; v++) {
          if (v === state[c]) continue;
          const next = [...state]; next[c] = v;
          const key = next.join(','); let successor = lookup.get(key);
          if (successor === undefined) {
            successor = states.length; lookup.set(key, successor); states.push(next); previous.push([]);
          }
          previous[successor].push(index);
        }
      }
      assert(states.length < 100000, 'bounded authored chamber search');
    }
    assert(solved.length > 0, `${level.id}/${scene.id}: unreachable local solution`);
    const recoverable = new Set(solved), queue = [...solved];
    for (let index = 0; index < queue.length; index++) for (const state of previous[queue[index]]) {
      if (!recoverable.has(state)) { recoverable.add(state); queue.push(state); }
    }
    assert.equal(recoverable.size, states.length, `${level.id}/${scene.id}: a wrong gesture permanently traps the locks`);
    audited += states.length;
  }
  assert(audited > 10000, 'the audit must include combinations, not only the advertised successful settings');
});

test('drawing budgets distinguish the low shortcut from a large arch and reject lines escaping a whole puzzle room', () => {
  for (const level of ADVANCED_LEVELS) for (const drawing of level.drawings) {
    const low = drawing.choices!.find(choice => choice.id === 'rive')!;
    const a = low.path[0], b = low.path.at(-1)!;
    const largeArch = [a, {x: a.x + 180, y: 150}, {x: b.x - 180, y: 150}, b];
    assert(preparePlayerStroke(largeArch, a, b).ok, 'the arch is drawable geometry before applying its ink allowance');
    assert.equal(preparePlayerStroke(largeArch, a, b, {inkLimit: low.inkLimit}).ok, false,
      `${level.id}/${drawing.id}: the short-route crayon must not admit every giant arch`);
    const escapeBack = [a, {x: a.x - 160, y: a.y - 100}, b];
    const escapeAhead = [a, {x: b.x + 300, y: 200}, b];
    for (const stroke of [escapeBack, escapeAhead]) assert.equal(preparePlayerStroke(stroke, a, b).ok, false,
      `${level.id}/${drawing.id}: a stroke must not become a ramp around the preceding or next room's locks`);
    const high = drawing.choices!.find(choice => choice.id === 'balcon')!;
    assert.notEqual(high.path.at(-1)!.y, b.y, 'route choice must change the real landing, not only a menu value');
  }
});
