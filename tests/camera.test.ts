import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCamera, updateCamera } from '../lib/trait/camera';
import { createWorld, type PlatformLevel } from '../lib/trait/platformer';
import { PLATFORM_LEVELS } from '../lib/trait/platform-levels';

const level: PlatformLevel = {
  id: 101, title: 'Camera', subtitle: '', palette: 'blue', width: 5000,
  start: { x: 160, y: 430 }, goal: { x: 4800, y: 430 },
  surfaces: [{ a: { x: 0, y: 430 }, b: { x: 760, y: 430 } }, { a: { x: 1260, y: 430 }, b: { x: 5000, y: 430 } }],
  hazards: [], stars: [], checkpoints: [], drawings: [{
    id: 'bridge', title: 'Bridge', prompt: '', triggerX: 690, duration: 2,
    path: [{ x: 760, y: 430 }, { x: 1010, y: 370 }, { x: 1260, y: 430 }],
  }],
};
const viewport = { width: 390, height: 540, dt: 1 / 60 };
function settle(camera: ReturnType<typeof createCamera>, world: ReturnType<typeof createWorld>, seconds = 2) {
  for (let i = 0; i < seconds * 60; i++) updateCamera(camera, world, level, viewport);
}

test('completing a bridge and turning at rest never recentre or reset the scrolling', () => {
  const world = createWorld(level), camera = createCamera();
  updateCamera(camera, world, level, viewport);
  world.player.x = 685;
  settle(camera, world);
  const atBridge = camera.cameraX;
  assert(atBridge > 350, 'the camera really travelled to a bridge');
  world.drawn.push('bridge'); world.constructions.bridge = level.drawings[0].path;
  world.player.facing = -1;
  settle(camera, world, 5);
  assert.equal(camera.cameraX, atBridge, 'completion must not pull the view back to walking composition');
  world.player.facing = 1; settle(camera, world);
  assert.equal(camera.cameraX, atBridge, 'a gesture or facing change has no camera effect');
});

test('crossing and returning over a completed bridge tracks the physical movement continuously', () => {
  const world = createWorld(level), camera = createCamera();
  world.drawn.push('bridge'); world.constructions.bridge = level.drawings[0].path;
  updateCamera(camera, world, level, viewport);
  for (const direction of [1, -1]) {
    for (let i = 0; i < 570; i++) {
      const before = camera.cameraX;
      world.player.x += direction * 3;
      updateCamera(camera, world, level, viewport);
      assert(direction * (camera.cameraX - before) >= -1e-7, 'the camera must not reverse at a bridge proximity boundary');
      assert(Math.abs(camera.cameraX - before) * camera.scale < 10, 'no one-frame teleport');
    }
  }
});

test('a held pointer and a paused menu freeze all three world-to-screen coordinates', () => {
  const world = createWorld(level), camera = createCamera();
  world.player.x = 690;
  updateCamera(camera, world, level, viewport);
  const before = structuredClone(camera);
  world.drawn.push('bridge'); world.player.facing = -1;
  for (const option of [{ locked: true }, { frozen: true }]) {
    for (let i = 0; i < 60; i++) updateCamera(camera, world, level, { ...viewport, ...option });
    assert.deepEqual(camera, before);
  }
});

test('all unbuilt passages fit both finger anchors before drawing in portrait and landscape', () => {
  for (const chapter of PLATFORM_LEVELS) for (const drawing of chapter.drawings) {
    for (const size of [{ width: 320, height: 500 }, { width: 844, height: 290 }, { width: 1280, height: 650 }]) {
      for (const point of [drawing.path[0], drawing.path.at(-1)!]) {
        const world = createWorld(chapter), camera = createCamera();
        world.player.x = point.x; world.player.y = point.y;
        for (let i = 0; i < 120; i++) updateCamera(camera, world, chapter, { ...size, dt: 1 / 60 });
        for (const anchor of [drawing.path[0], drawing.path.at(-1)!]) {
          const x = (anchor.x - camera.cameraX) * camera.scale, y = anchor.y * camera.scale + camera.offsetY;
          assert(x >= 20 && x <= size.width - 20, `${chapter.id}/${drawing.id}: horizontal anchor ${x}`);
          assert(y >= 20 && y <= size.height - 20, `${chapter.id}/${drawing.id}: vertical anchor ${y}`);
        }
      }
    }
  }
});

test('camera updates cannot mutate progress, constructions, physics or the level', () => {
  const world = createWorld(level), camera = createCamera();
  world.player.x = 690;
  const savedWorld = structuredClone(world), savedLevel = structuredClone(level);
  settle(camera, world);
  assert.deepEqual(world, savedWorld); assert.deepEqual(level, savedLevel);
});

test('rotating from landscape to portrait keeps a stopped player visible deep in the level', () => {
  const world = createWorld(level), camera = createCamera();
  world.player.x = 3200;
  updateCamera(camera, world, level, { width: 844, height: 390, dt: 1 / 60 });
  updateCamera(camera, world, level, { width: 320, height: 568, dt: 1 / 60 });
  const screenX = (world.player.x - camera.cameraX) * camera.scale;
  assert(screenX >= 60 && screenX <= 220, `player must be visible after rotation, got ${screenX}`);
  assert.equal(world.player.x, 3200, 'rotating never restarts the adventure');
});
