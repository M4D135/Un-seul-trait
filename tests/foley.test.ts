import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FoleyEngine, FoleyPlanner, synthesizeFoley, type FoleyBird, type FoleyKind, type FoleyScene } from '../lib/trait/foley';
import { GameAudio } from '../lib/trait/audio';

const bird = (extra: Partial<FoleyBird> = {}): FoleyBird => ({
  id: 1, x: 460, y: 370, phase: 'flying', wingPhase: 5.9, wingPower: .85, glide: 0, idleAction: 'rest', ...extra,
});
const scene = (extra: Partial<FoleyScene> = {}): FoleyScene => ({
  levelId: 1, dt: .02, active: true, viewport: { cameraX: 0, viewWidth: 1000, top: 0, height: 560 },
  listener: { x: 400, y: 330 }, birds: [], mechanisms: [], ...extra,
});

test('wing sounds follow a real downstroke and never repeat while a wing or a gliding bird is still', () => {
  const planner = new FoleyPlanner();
  assert.equal(planner.update(scene({ birds: [bird()] }), 0).cues.length, 0);
  const flap = planner.update(scene({ birds: [bird({ wingPhase: 6.5 })] }), .2);
  assert.equal(flap.cues.filter(cue => cue.kind === 'wing').length, 1);
  assert.equal(planner.update(scene({ birds: [bird({ wingPhase: 6.5 })] }), .22).cues.length, 0);
  assert.equal(planner.update(scene({ birds: [bird({ wingPhase: 13, glide: .99, wingPower: .7 })] }), .4).cues.length, 0);
});

test('only visible nearby birds are audible, including vertical crop and away state', () => {
  for (const extra of [{ x: -20 }, { x: 1100 }, { y: -30 }, { y: 650 }, { phase: 'away' }, { x: 950 }]) {
    const planner = new FoleyPlanner();
    const s = scene({ listener: { x: 200, y: 330 }, birds: [bird(extra)] });
    planner.update(s, 0);
    s.birds = [bird({ ...extra, wingPhase: 6.6 })];
    const plan = planner.update(s, .2);
    assert.equal(plan.cues.length, 0, JSON.stringify(extra));
    assert.equal(plan.audible.size, 0, JSON.stringify(extra));
  }
});

test('chirps require a visible change of attitude and leave several seconds of quiet', () => {
  const planner = new FoleyPlanner(), times: number[] = [];
  for (let i = 0; i < 200; i++) {
    const calls = planner.update(scene({ birds: [bird({ phase: 'perched', wingPower: 0,
      idleAction: i % 10 < 5 ? 'rest' : 'look' })] }), i * .1).cues.filter(cue => cue.kind === 'chirp');
    if (calls.length) times.push(i * .1);
  }
  assert(times.length >= 2 && times.length <= 3);
  for (let i = 1; i < times.length; i++) assert(times[i] - times[i - 1] >= 8, 'one bird never chatters continuously');
  for (let i = 200; i < 350; i++) {
    assert.equal(planner.update(scene({ birds: [bird({ phase: 'perched', wingPower: 0, idleAction: 'look' })] }), i * .1).cues.length, 0);
  }
});

test('friction depends on observed movement; idle rails are silent and a real endpoint produces one stop', () => {
  const planner = new FoleyPlanner();
  const rail = (x: number, progress: number) => scene({ mechanisms: [{ id: 'gate', type: 'gate', x, y: 300, progress }] });
  assert.equal(planner.update(rail(400, .4), 0).cues.length, 0);
  assert.equal(planner.update(rail(406, .46), .02).cues.filter(cue => cue.kind === 'slide').length, 1);
  const coalesced = planner.update(rail(406, .46), .04);
  assert.equal(coalesced.cues.length, 0);
  assert(coalesced.moving.has('mechanism:gate'), 'one render without a pointer event retains the short friction tail');
  assert.equal(planner.update(rail(406, .46), .14).moving.size, 0);
  const end = planner.update(rail(460, 1), .16);
  assert.equal(end.cues.filter(cue => cue.kind === 'stop').length, 1);
  for (let i = 9; i < 25; i++) assert.equal(planner.update(rail(460, 1), i * .02).cues.length, 0);
});

test('pause, a long frame gap, a new chapter and reduced-motion changes prime snapshots without a catch-up sound', () => {
  for (const interruption of ['pause', 'gap', 'chapter', 'reduced'] as const) {
    const planner = new FoleyPlanner();
    const before = scene({ birds: [bird()], mechanisms: [{ id: 'rail', type: 'platform', x: 400, y: 350, progress: .1 }] });
    planner.update(before, 0);
    if (interruption === 'pause') planner.update({ ...before, active: false }, .02);
    const after = { ...before, levelId: interruption === 'chapter' ? 2 : 1,
      reducedMotion: interruption === 'reduced', birds: [bird({ wingPhase: 6.8 })],
      mechanisms: [{ id: 'rail', type: 'platform' as const, x: 520, y: 350, progress: 1 }] };
    assert.equal(planner.update(after, interruption === 'gap' ? 40 : .2).cues.length, 0, interruption);
  }
});

test('releasing at an endpoint produces one termination sound, including the following render', () => {
  const planner = new FoleyPlanner();
  const rail = (x: number, progress: number) => scene({ mechanisms: [{ id: 'rail', type: 'platform', x, y: 350, progress }] });
  planner.update(rail(400, .4), 0);
  const end = planner.update(rail(460, 1), .02, true);
  assert.equal(end.cues.filter(cue => cue.kind === 'stop').length, 1);
  assert.equal(end.cues.filter(cue => cue.kind === 'ready').length, 0);
  assert.equal(planner.update(rail(460, 1), .04, true).cues.length, 0, 'pointer-up one frame later does not double the endpoint');
  const mid = planner.update(rail(425, .65), .12, true);
  assert.equal(mid.cues.filter(cue => cue.kind === 'ready').length, 0, 'an immediately repeated release stays calm');
  planner.update(rail(425, .65), .3);
  assert.equal(planner.update(rail(430, .7), .34, true).cues.filter(cue => cue.kind === 'ready').length, 1);
});

test('generated sound gestures are finite, varied, bounded and taper to digital silence', () => {
  const kinds: FoleyKind[] = ['step', 'click', 'wing', 'chirp', 'slide', 'stop', 'ready'];
  for (const kind of kinds) {
    const pcm = synthesizeFoley(kind, 1);
    let peak = 0, energy = 0;
    for (const sample of pcm) { assert(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
    assert(peak > .025 && peak <= .8, kind);
    assert(Math.sqrt(energy / pcm.length) > .002, kind);
    assert.equal(Math.abs(pcm[0]), 0); assert.equal(Math.abs(pcm[pcm.length - 1]), 0);
    assert(pcm.length <= 24000 * .32, 'no long synthetic drone');
  }
  assert.notDeepEqual(synthesizeFoley('step', 1), synthesizeFoley('step', 2));
});

class TestNode {
  disconnected = false;
  gain = { value: 1, cancelScheduledValues() {}, setTargetAtTime() {} };
  pan = { value: 0 };
  connect(_node: unknown) { return _node; }
  disconnect() { this.disconnected = true; }
}
class TestSource extends TestNode {
  buffer: unknown; loop = false; stopped = false; started = false;
  onended: (() => void) | null = null;
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class TestContext {
  static instances: TestContext[] = [];
  currentTime = 0; state = 'running'; sampleRate = 24000; destination = new TestNode();
  sources: TestSource[] = []; nodes: TestNode[] = [];
  constructor() { TestContext.instances.push(this); }
  createGain() { const node = new TestNode(); this.nodes.push(node); return node; }
  createStereoPanner() { const node = new TestNode(); this.nodes.push(node); return node; }
  createBufferSource() { const source = new TestSource(); this.sources.push(source); return source; }
  createBuffer(_channels: number, size: number) { const samples = new Float32Array(size); return { getChannelData: () => samples }; }
  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

test('scene sources stop as soon as they leave the shot; natural completion and hush disconnect all nodes', () => {
  const context = new TestContext(), engine = new FoleyEngine(context as unknown as AudioContext, context.destination as unknown as AudioNode);
  const rail = (x: number) => scene({ mechanisms: [{ id: 'rail', type: 'platform', x, y: 350, progress: x / 1000 }] });
  engine.update(rail(400)); context.currentTime = .02; engine.update(rail(408));
  assert.equal(context.sources.length, 1);
  context.currentTime = .04; engine.update({ ...rail(408), viewport: { cameraX: 1100, viewWidth: 1000 } });
  assert(context.sources[0].stopped); assert(context.sources[0].disconnected);
  engine.effect('step'); context.sources[1].onended?.(); assert(context.sources[1].disconnected);
  engine.effect('ready'); engine.hush();
  assert(context.sources.every(source => source.disconnected));
  assert(context.nodes.every(node => node.disconnected));
  assert(context.sources.every(source => !source.loop));
  engine.dispose();
});

test('GameAudio never unlocks from scene updates, and mute/disposal cannot retain or revive foley', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { AudioContext: TestContext }, configurable: true });
  const audio = new GameAudio();
  try {
    const count = TestContext.instances.length;
    const rail = (x: number) => scene({ mechanisms: [{ id: 'rail', type: 'platform', x, y: 350, progress: x / 1000 }] });
    audio.updateFoley(rail(400)); assert.equal(TestContext.instances.length, count);
    audio.setVoiceMode('grammelot'); audio.unlock();
    const context = TestContext.instances.at(-1)!;
    audio.updateFoley(rail(400)); context.currentTime = .02; audio.updateFoley(rail(410));
    assert.equal(context.sources.length, 1);
    audio.setEnabled(false); assert(context.sources[0].stopped);
    context.currentTime = .04; audio.updateFoley(rail(420)); assert.equal(context.sources.length, 1);
    audio.setEnabled(true); audio.updateFoley(rail(420)); assert.equal(context.sources.length, 1, 'resume primes instead of replaying motion');
    context.currentTime = .06; audio.updateFoley(rail(430)); assert.equal(context.sources.length, 2);
    audio.dispose(); assert(context.sources[1].stopped);
    audio.updateFoley(rail(440)); assert.equal(context.sources.length, 2);
  } finally {
    audio.dispose();
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the page event order reconciles mechanism-ready with the same-frame physical stop', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { AudioContext: TestContext }, configurable: true });
  const audio = new GameAudio();
  try {
    audio.setVoiceMode('grammelot'); audio.unlock();
    const context = TestContext.instances.at(-1)!;
    const rail = (x: number, progress: number) => scene({ mechanisms: [{ id: 'rail', type: 'platform', x, y: 350, progress }] });
    audio.updateFoley(rail(400, .5)); context.currentTime = .02;
    audio.play('mechanism-ready'); assert.equal(context.sources.length, 0, 'hold the event until its spatial frame');
    audio.updateFoley(rail(450, 1));
    assert.equal(context.sources.length, 2, 'friction and endpoint, without a second confirmation');
    context.currentTime = .5; audio.play('mechanism-ready'); audio.hush(); audio.updateFoley(rail(440, .9));
    assert.equal(context.sources.length, 2, 'pause invalidates a pending confirmation');
  } finally {
    audio.dispose();
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('blur, hidden documents and pagehide stop audio and never resume an old sound', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const bus = () => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      addEventListener(type: string, callback: () => void) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(callback); },
      removeEventListener(type: string, callback: () => void) { listeners.get(type)?.delete(callback); },
      emit(type: string) { for (const callback of listeners.get(type) ?? []) callback(); },
      count() { return [...listeners.values()].reduce((sum, group) => sum + group.size, 0); },
    };
  };
  const win = { ...bus(), AudioContext: TestContext }, doc = { ...bus(), hidden: false, hasFocus: () => true };
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const audio = new GameAudio();
  try {
    audio.setVoiceMode('grammelot'); audio.unlock(); audio.play('step');
    const context = TestContext.instances.at(-1)!;
    assert.equal(context.sources.length, 1);
    win.emit('blur'); assert(context.sources[0].stopped);
    context.currentTime = .3; audio.play('step'); assert.equal(context.sources.length, 1);
    doc.hidden = true; doc.emit('visibilitychange'); win.emit('focus');
    audio.play('ready'); audio.updateFoley(scene()); assert.equal(context.sources.length, 1);
    doc.hidden = false; doc.emit('visibilitychange');
    assert.equal(context.sources.length, 1, 'visibility alone must not restart a source');
    audio.play('step'); assert.equal(context.sources.length, 2);
    win.emit('pagehide'); assert(context.sources[1].stopped);
    context.currentTime = .7; audio.play('step'); assert.equal(context.sources.length, 2);
    audio.dispose(); assert.equal(win.count(), 0); assert.equal(doc.count(), 0);
  } finally {
    audio.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});
