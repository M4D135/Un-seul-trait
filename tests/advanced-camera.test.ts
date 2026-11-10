import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../lib/trait/platformer';
import {ADVANCED_LEVELS} from '../lib/trait/platform-advanced-levels';
import {createCamera, updateCamera} from '../lib/trait/camera';
import {ADVANCED_WALKTHROUGHS, runAdvancedAction, type WalkAction} from './advanced-walkthrough';

for (const size of [{width: 390, height: 844}, {width: 320, height: 568}, {width: 844, height: 390}]) {
  test(`every advanced solution can reach both ends of each actual gesture inside ${size.width} × ${size.height}`, () => {
    for (const level of ADVANCED_LEVELS) for (const choice of ['balcon', 'rive'] as const) {
      const world = E.createWorld(level), camera = createCamera();
      const frame = () => updateCamera(camera, world, level, {
        ...size, dt: 1 / 60, locked: !!world.handInteraction || !!world.activeDrawing?.started,
      });
      const settle = () => { for (let i = 0; i < 120; i++) frame(); };
      const visible = (point: E.PlatformPoint, message: string) => {
        const x = (point.x - camera.cameraX) * camera.scale, y = point.y * camera.scale + camera.offsetY;
        assert(x >= 12 && x <= size.width - 12,
          `${level.id}/${choice}/${message}: horizontal gesture target ${x.toFixed(2)} outside viewport`);
        assert(y >= 52 && y <= size.height - 80,
          `${level.id}/${choice}/${message}: vertical gesture target ${y.toFixed(2)} beneath the controls`);
      };
      const action = (next: WalkAction) => {
        settle();
        if (next.kind === 'drag') {
          const mechanism = level.mechanisms!.find(m => m.id === next.id)!;
          const handle = E.getMechanismHandlePosition(world, mechanism), position = E.getMechanismPosition(world, mechanism);
          const target = {
            x: handle.x + mechanism.from.x + (mechanism.to.x - mechanism.from.x) * next.at - position.x,
            y: handle.y + mechanism.from.y + (mechanism.to.y - mechanism.from.y) * next.at - position.y,
          };
          visible(handle, `${next.id} grab`);
          // The camera freezes while held: the final finger position must fit
          // the SAME viewport, not a hypothetical recentered view after moving.
          visible(target, `${next.id} release`);
        } else if (next.kind === 'draw') {
          const drawing = level.drawings.find(d => d.id === next.id)!;
          const route = drawing.choices!.find(c => c.id === choice)!;
          assert(E.selectDrawingChoice(world, level, drawing.id, route.id).ok);
          settle();
          for (const point of route.path) visible(point, `${drawing.id} stroke`);
        }
        runAdvancedAction(world, level, next, choice, frame);
      };
      for (const next of ADVANCED_WALKTHROUGHS[level.id]) {
        if (next.kind === 'draw' && choice === 'rive') {
          const number = Number(next.id.split('-').at(-1));
          const press = level.mechanisms?.find(m => m.id === `presse-${level.id}-${number}`);
          if (press) action({kind: 'drag', id: press.id, at: 1});
        }
        action(next);
      }
      for (let i = 0; i < 240 && world.phase !== 'won'; i++) {
        E.updateWorld(world, level, {left: false, right: true, crouch: true, draw: false}, 1 / 60); frame();
      }
      assert.equal(world.phase, 'won', `${level.id}/${choice}: visible gestures must still finish the actual level`);
      assert.equal(world.deaths, 0);
    }
  });
}
