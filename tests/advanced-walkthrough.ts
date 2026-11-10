import assert from 'node:assert/strict';
import * as E from '../lib/trait/platformer';
import type { GameWorld, PlatformLevel } from '../lib/trait/platformer';

export type WalkAction = { kind: 'walk'; x: number } | { kind: 'drag'; id: string; at: number } | { kind: 'draw'; id: string; choice?: string };
const idle = { left: false, right: false, draw: false, crouch: true };
const walk = (x: number): WalkAction => ({ kind: 'walk', x });
const drag = (id: string, at: number): WalkAction => ({ kind: 'drag', id, at });
const draw = (id: string): WalkAction => ({ kind: 'draw', id });

function sas(b: number, k: string, third = false): WalkAction[] {
  return [drag(`${k}-entree`, 1), walk(b + 500), drag(`${k}-entree`, 0), drag(`${k}-sortie`, 1), walk(b + 790),
    ...(third ? [walk(b + 900), drag(`${k}-temoin`, 1)] : []), walk(b + 1120)];
}
function bridge(b: number, k: string, weight = false): WalkAction[] {
  return [walk(b + 220), ...(weight ? [drag(`${k}-poids`, .5)] : []), walk(b + 430), drag(`${k}-pont`, .5), walk(b + 1030), drag(`${k}-porte`, 1), walk(b + 1120)];
}
function ferry(b: number, k: string): WalkAction[] {
  return [walk(b + 550), drag(`${k}-plateau`, 1), drag(`${k}-cliquet`, 1), walk(b + 940), drag(`${k}-plateau`, 0), drag(`${k}-porte`, 1), walk(b + 1120)];
}
function weights(b: number, k: string, three = false, reverse = false): WalkAction[] {
  return [walk(b + 220), drag(`${k}-gauche`, reverse ? .75 : .25), walk(b + 410), drag(`${k}-droite`, reverse ? .25 : .75), ...(three ? [walk(b + 540), drag(`${k}-centre`, .5)] : []),
    walk(b + 700), drag(`${k}-plateau`, 1), walk(b + 1000), drag(`${k}-porte`, 1), walk(b + 1120)];
}
function lift(b: number, k: string): WalkAction[] {
  return [walk(b + 660), drag(`${k}-ascenseur`, 1), walk(b + 840), walk(b + 660), drag(`${k}-ascenseur`, .5),
    walk(b + 950), drag(`${k}-porte`, 1), walk(b + 1120)];
}
function relay(b: number, k: string, three = false): WalkAction[] {
  return [walk(b + 220), drag(`${k}-commande`, three ? .5 : 1), walk(b + 450), drag(`${k}-premier`, 1), drag(`${k}-commande`, three ? 1 : 0),
    walk(b + 720), drag(`${k}-second`, 1), ...(three ? [walk(b + 450), drag(`${k}-commande`, 0), walk(b + 970), drag(`${k}-dernier`, 1)] : []), walk(b + 1120)];
}
function twins(b: number, k: string, middle = false): WalkAction[] {
  return [walk(b + 480), drag(`${k}-amont`, 1), drag(`${k}-cliquet`, 1), walk(b + 780), drag(`${k}-amont`, middle ? .5 : 0),
    walk(b + 840), drag(`${k}-aval`, 1), walk(b + 1120)];
}
function press(b: number, k: string): WalkAction[] {
  return [walk(b + 220), drag(`${k}-commande`, .5), walk(b + 570), drag(`${k}-presse`, .5), walk(b + 870), walk(b + 450), drag(`${k}-commande`, 0), walk(b + 970), drag(`${k}-porte`, 1), walk(b + 1120)];
}
const joined = (id: number, rooms: WalkAction[][]): WalkAction[] => rooms.flatMap((actions, i) => [...actions, draw(`trait-${id}-${i + 1}`), walk(i * 1900 + 1830)]);

/** Hand-authored solution transcripts exercise public pointer APIs and every
 * walking interval. No hero, target, rail progress, path or star is assigned. */
export const ADVANCED_WALKTHROUGHS: Record<number, WalkAction[]> = {
  7: joined(7, [sas(0, 'sas'), bridge(1900, 'appuis'), ferry(3800, 'rappel')]),
  8: joined(8, [weights(0, 'balance'), lift(1900, 'entresol'), press(3800, 'demi-course')]),
  9: joined(9, [relay(0, 'memoire'), twins(1900, 'relais'), sas(3800, 'trois-portes', true)]),
  10: joined(10, [lift(0, 'etages'), bridge(1900, 'pont-pese', true), ferry(3800, 'retour-haut')]),
  11: joined(11, [weights(0, 'trio', true, true), relay(1900, 'trois-etats', true), twins(3800, 'tension', true)]),
  12: joined(12, [press(0, 'precision'), sas(1900, 'chambre', true), weights(3800, 'accord-final', true), twins(5700, 'dernier-relais', true)]),
};

export function runAdvancedAction(world: GameWorld, level: PlatformLevel, action: WalkAction, choice = 'balcon', onFrame?: (world: GameWorld) => void) {
  const name = `${level.id}/${action.kind}/${'id' in action ? action.id : action.x}`;
  if (action.kind === 'walk') {
    const right = action.x >= world.player.x;
    for (let frame = 0; frame < 2400 && (right ? world.player.x < action.x - .8 : world.player.x > action.x + .8); frame++) {
      E.updateWorld(world, level, { ...idle, right, left: !right }, 1 / 60);
      onFrame?.(world);
      assert.equal(world.deaths, 0, `${name}: death at ${world.player.x},${world.player.y}`);
      assert.equal(world.player.vy, 0, `${name}: airborne movement at ${world.player.x},${world.player.y}`);
    }
    assert(Math.abs(world.player.x - action.x) < 2, `${name}: blocked at ${world.player.x},${world.player.y}`);
    for (let i = 0; i < 8; i++) E.updateWorld(world, level, idle, 1 / 120);
  } else if (action.kind === 'drag') {
    const mechanism = level.mechanisms!.find(m => m.id === action.id)!;
    assert(mechanism, `${name}: missing mechanism`);
    const handle = E.getMechanismHandlePosition(world, mechanism), position = E.getMechanismPosition(world, mechanism);
    const grabbed = E.beginMechanismInteraction(world, level, handle);
    assert(grabbed.ok, `${name}: ${grabbed.message}`);
    E.moveMechanismInteraction(world, level, {
      x: handle.x + mechanism.from.x + (mechanism.to.x - mechanism.from.x) * action.at - position.x,
      y: handle.y + mechanism.from.y + (mechanism.to.y - mechanism.from.y) * action.at - position.y,
    });
    E.endMechanismInteraction(world);
    assert(Math.abs(world.mechanisms[action.id].progress - action.at) < 1e-5,
      `${name}: stopped at ${world.mechanisms[action.id].progress} instead of ${action.at}, hero ${world.player.x},${world.player.y}`);
    E.updateWorld(world, level, idle, 1 / 60);
  } else {
    const drawing = level.drawings.find(d => d.id === action.id)!;
    assert(drawing, `${name}: missing drawing`);
    const selected = drawing.choices!.find(c => c.id === (action.choice ?? choice))!;
    assert(E.selectDrawingChoice(world, level, drawing.id, selected.id).ok, `${name}: unavailable at ${world.player.x},${world.player.y}`);
    assert(E.beginPlayerStroke(world, level, selected.path[0]).ok);
    for (const p of selected.path.slice(1)) assert(E.appendPlayerStroke(world, level, p).ok);
    const finished = E.finishPlayerStroke(world, level);
    assert(finished.ok, `${name}: ${finished.message}`);
  }
  onFrame?.(world);
  assert.equal(world.deaths, 0, `${name}: death`);
}

export function solveAdvancedLevel(level: PlatformLevel, options: { choice?: 'balcon' | 'rive'; onFrame?: (world: GameWorld) => void; onAction?: (world: GameWorld, action: WalkAction, index: number) => void } = {}): GameWorld {
  const world = E.createWorld(level);
  for (const [index, action] of ADVANCED_WALKTHROUGHS[level.id].entries()) {
    // A low press route intentionally requires one extra physical operation.
    if (action.kind === 'draw' && options.choice === 'rive') {
      const number = Number(action.id.split('-').at(-1));
      const press = level.mechanisms?.find(m => m.id === `presse-${level.id}-${number}`);
      if (press) runAdvancedAction(world, level, { kind: 'drag', id: press.id, at: 1 }, options.choice, options.onFrame);
    }
    runAdvancedAction(world, level, action, options.choice, options.onFrame);
    options.onAction?.(world, action, index);
  }
  for (let frame = 0; frame < 240 && world.phase !== 'won'; frame++) {
    E.updateWorld(world, level, { ...idle, right: true }, 1 / 60); options.onFrame?.(world);
  }
  return world;
}
