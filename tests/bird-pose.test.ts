import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAmbientState } from '../lib/trait/ambient-life';
import { sampleBirdPose } from '../lib/trait/ambient-bird-renderer';
import { PLATFORM_LEVELS } from '../lib/trait/platform-levels';

test('extending a flight and recapturing an offscreen bird preserve the airborne silhouette', () => {
  const bird = createAmbientState(PLATFORM_LEVELS[0]).birds[0];
  assert(bird);
  Object.assign(bird, { phase: 'flying', age: 5, wingPhase: 2.2, wingPower: .7, pitch: -.2, glide: .15 });
  const before = sampleBirdPose(bird, 6);
  // A flight segment can end or restart while the camera is following. The
  // anatomical pose belongs to the continuous flight, not the segment timer.
  bird.phase = 'away';
  bird.flight = null;
  assert.deepEqual(sampleBirdPose(bird, 6), before);
  bird.phase = 'flying';
  assert.equal(sampleBirdPose(bird, 6).opening, 1);
  assert.equal(sampleBirdPose(bird, 6).airborne, 1);
});

test('switching reduced motion freezes the current pose instead of folding a flying bird into a perched one', () => {
  const bird = createAmbientState(PLATFORM_LEVELS[0]).birds[0];
  Object.assign(bird, { phase: 'flying', age: 2, wingPhase: 4.3, wingPower: .8, pitch: -.18, glide: .1 });
  assert.deepEqual(sampleBirdPose(bird, 3, true), sampleBirdPose(bird, 3, false));
});

test('wing recovery folds continuously through the cycle and opens for gliding and landing', () => {
  const bird = createAmbientState(PLATFORM_LEVELS[0]).birds[0];
  Object.assign(bird, { phase: 'flying', age: 2, wingPhase: 0, wingPower: 1, glide: 0, landing: 0 });
  let previous = sampleBirdPose(bird, 2), maxFold = 0;
  for (let i = 0; i <= 720; i++) {
    bird.wingPhase = i / 360 * Math.PI * 2;
    const pose = sampleBirdPose(bird, 2);
    assert(Math.abs(pose.wingFold - previous.wingFold) < .02, 'no snapping wrist on the cycle seam');
    assert(pose.wingFold >= 0 && pose.wingFold <= 1);
    maxFold = Math.max(maxFold, pose.wingFold);
    previous = pose;
  }
  assert(maxFold > .95, 'the recovery is visibly folded, not a rigid up/down paddle');
  bird.wingPhase = Math.PI * 1.4;
  bird.glide = 1;
  assert.equal(sampleBirdPose(bird, 2).wingFold, 0, 'gliding keeps the wing extended');
  bird.glide = 0; bird.landing = 1;
  assert(sampleBirdPose(bird, 2).wingFold < .16, 'the landing wing stays spread to brake');
});
