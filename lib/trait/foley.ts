/** Local, bounded sound gestures. Nothing here owns an animation or an audio loop. */
export type FoleyBird = {
  id: string | number; x: number; y: number; phase: string;
  wingPhase: number; wingPower: number; glide?: number; idleAction?: string;
};
export type FoleyMechanism = {
  id: string; type: 'platform' | 'gate' | 'gear'; x: number; y: number; progress: number;
};
export type FoleyScene = {
  levelId: number; dt: number; active: boolean; reducedMotion?: boolean;
  viewport: { cameraX: number; viewWidth: number; top?: number; height?: number };
  listener: { x: number; y: number };
  birds?: readonly FoleyBird[];
  mechanisms?: readonly FoleyMechanism[];
};
export type FoleyKind = 'step' | 'click' | 'wing' | 'chirp' | 'slide' | 'stop' | 'ready';
export type FoleyCue = {
  kind: FoleyKind; id: string | null; gain: number; pan: number; variation: number;
  motion?: number; material?: FoleyMechanism['type'];
};
export type FoleyPlan = { cues: FoleyCue[]; audible: Set<string>; moving: Set<string> };

const TAU = Math.PI * 2;
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const finitePoint = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);
function hash(value: string): number {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) seed = Math.imul(seed ^ value.charCodeAt(i), 16777619);
  return seed >>> 0;
}

/** Strictly in the shot and near the hero; attenuation reaches zero at both limits. */
function placement(point: { x: number; y: number }, scene: FoleyScene) {
  const view = scene.viewport, top = view.top ?? 0, height = view.height ?? 560;
  if (!finitePoint(point) || !finitePoint(scene.listener) || !Number.isFinite(view.cameraX)
    || !Number.isFinite(view.viewWidth) || view.viewWidth <= 0
    || point.x <= view.cameraX || point.x >= view.cameraX + view.viewWidth
    || point.y <= top || point.y >= top + height) return null;
  const distance = Math.hypot(point.x - scene.listener.x, point.y - scene.listener.y);
  if (distance >= 540) return null;
  const edge = Math.min(point.x - view.cameraX, view.cameraX + view.viewWidth - point.x,
    point.y - top, top + height - point.y);
  const gain = (1 - (distance / 540) ** 2) * clamp(edge / 34);
  return gain > .015 ? { gain, pan: clamp((point.x - scene.listener.x) / (view.viewWidth * .45), -.85, .85) } : null;
}

type BirdMemory = { phase: string; wing: number; idle?: string; lastWing: number; lastChirp: number };
type MechanismMemory = { x: number; y: number; progress: number; grainAt: number; stopAt: number; movedAt: number; motion: number };

/** Deterministic scheduling from observed motion; no timers, catch-up burst, or idle motor. */
export class FoleyPlanner {
  private level: number | null = null;
  private birds = new Map<string, BirdMemory>();
  private mechanisms = new Map<string, MechanismMemory>();
  private nextChirp = 0;
  private serial = 0;
  private reducedMotion = false;
  private lastFrame: number | null = null;
  private lastMechanism: string | null = null;

  reset(): void {
    this.level = null; this.birds.clear(); this.mechanisms.clear(); this.nextChirp = 0; this.serial = 0; this.lastFrame = null; this.lastMechanism = null;
  }

  update(scene: FoleyScene, now: number, confirmMechanism = false): FoleyPlan {
    const plan: FoleyPlan = { cues: [], audible: new Set(), moving: new Set() };
    if (!scene.active || !Number.isFinite(now) || !Number.isFinite(scene.dt) || scene.dt <= 0 || scene.dt > .15) {
      this.reset(); return plan;
    }
    if (scene.levelId !== this.level || !!scene.reducedMotion !== this.reducedMotion
      || (this.lastFrame !== null && (now - this.lastFrame > .25 || now < this.lastFrame))) {
      this.reset(); this.level = scene.levelId; this.reducedMotion = !!scene.reducedMotion; this.nextChirp = now + 1.2;
    }
    this.lastFrame = now;
    const birds = new Set<string>(), mechanisms = new Set<string>();
    for (const bird of scene.birds ?? []) {
      const id = `bird:${bird.id}`, old = this.birds.get(id);
      birds.add(id);
      const position = bird.phase === 'away' || scene.reducedMotion ? null : placement({ x: bird.x, y: bird.y - 15 }, scene);
      const memory: BirdMemory = { phase: bird.phase, wing: bird.wingPhase, idle: bird.idleAction,
        lastWing: old?.lastWing ?? now, lastChirp: old?.lastChirp ?? -Infinity };
      if (position) {
        plan.audible.add(id);
        const power = clamp(bird.wingPower) * (1 - clamp(bird.glide ?? 0) * .82);
        const wingMoved = old && Number.isFinite(bird.wingPhase) && bird.wingPhase > old.wing
          && bird.wingPhase - old.wing < TAU * 1.2;
        if (wingMoved && Math.floor(bird.wingPhase / TAU) > Math.floor(old.wing / TAU)
          && power > .22 && now - memory.lastWing > .14) {
          memory.lastWing = now;
          plan.cues.push({ kind: 'wing', id, ...position, gain: position.gain * power * .62, variation: this.serial++ });
        }
        // A head turn, actual takeoff or return motivates a call. Rest alone never loops chirps.
        const call = old && ((old.idle !== 'look' && bird.idleAction === 'look' && bird.phase === 'perched')
          || (old.phase === 'perched' && bird.phase === 'startled')
          || (old.phase === 'settling' && bird.phase === 'perched'));
        if (call && now >= this.nextChirp && now - memory.lastChirp >= 8) {
          memory.lastChirp = now;
          this.nextChirp = now + 4.8 + (hash(id + this.serial) % 19) * .1;
          plan.cues.push({ kind: 'chirp', id, ...position, gain: position.gain * .6, variation: hash(id) + this.serial++ });
        }
      }
      this.birds.set(id, memory);
    }
    for (const mechanism of scene.mechanisms ?? []) {
      const id = `mechanism:${mechanism.id}`, old = this.mechanisms.get(id);
      mechanisms.add(id);
      const position = placement(mechanism, scene);
      const delta = old ? Math.hypot(mechanism.x - old.x, mechanism.y - old.y) : 0;
      const speed = delta / scene.dt;
      const moving = !!old && Number.isFinite(speed) && delta > .035 && speed > 2;
      if (moving) this.lastMechanism = id;
      const motion = moving ? Math.sqrt(clamp(speed / 520)) : (old?.motion ?? 0) * Math.exp(-scene.dt * 20);
      const memory: MechanismMemory = { x: mechanism.x, y: mechanism.y, progress: mechanism.progress,
        grainAt: old?.grainAt ?? now, stopAt: old?.stopAt ?? -Infinity,
        movedAt: moving ? now : old?.movedAt ?? -Infinity, motion };
      if (position) {
        plan.audible.add(id);
        // Pointer coalescing may leave one stationary render between real moves.
        // Keep the current grain's short tail, but never schedule new idle grains.
        if (moving || now - memory.movedAt < .08) plan.moving.add(id);
        if (moving) {
          if (now >= memory.grainAt) {
            memory.grainAt = now + .072;
            plan.cues.push({ kind: 'slide', id, ...position, gain: position.gain * (.22 + motion * .62),
              motion, material: mechanism.type, variation: this.serial++ });
          }
          const atEnd = mechanism.progress < .0005 || mechanism.progress > .9995;
          const wasEnd = old.progress < .0005 || old.progress > .9995;
          if (atEnd && !wasEnd && now - memory.stopAt > .28) {
            memory.stopAt = now;
            plan.cues.push({ kind: 'stop', id, ...position, gain: position.gain * (.4 + motion * .3), variation: this.serial++ });
          }
        }
      }
      this.mechanisms.set(id, memory);
    }
    for (const id of this.birds.keys()) if (!birds.has(id)) this.birds.delete(id);
    for (const id of this.mechanisms.keys()) if (!mechanisms.has(id)) this.mechanisms.delete(id);
    if (confirmMechanism && this.lastMechanism
      && now - (this.mechanisms.get(this.lastMechanism)?.stopAt ?? -Infinity) >= .3) {
      const mechanism = scene.mechanisms?.find(item => `mechanism:${item.id}` === this.lastMechanism);
      const position = mechanism ? placement(mechanism, scene) : null;
      if (position) plan.cues.push({ kind: 'ready', id: this.lastMechanism, ...position, gain: position.gain * .8, variation: this.serial++ });
    }
    return plan;
  }
}

const DURATIONS: Record<FoleyKind, number> = { step: .125, click: .055, wing: .16, chirp: .31, slide: .16, stop: .15, ready: .245 };

/** The same deterministic PCM generator is used for playback and signal QA. */
export function synthesizeFoley(kind: FoleyKind, variation = 0, motion = .5,
  material: FoleyMechanism['type'] = 'platform', sampleRate = 24000): Float32Array {
  const duration = DURATIONS[kind], count = Math.ceil(duration * sampleRate), output = new Float32Array(count);
  let seed = (hash(kind) ^ Math.imul(variation + 1, 2654435761)) >>> 0 || 1;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296 * 2 - 1; };
  const color = random(), weight = clamp(motion), attack = .0025;
  let low = 0, middle = 0, phase = 0;
  const decay = (t: number, start: number, length: number) => t < start ? 0 :
    Math.min(1, (t - start) / attack) * Math.exp(-(t - start) / length);
  for (let i = 0; i < count; i++) {
    const t = i / sampleRate, white = random();
    low += (white - low) * .055;
    middle += (white - middle) * .32;
    const grain = middle - low;
    let value = 0;
    if (kind === 'step') {
      const heel = decay(t, 0, .023), toe = decay(t, .027 + color * .005, .018);
      phase += TAU * (108 + color * 11) / sampleRate;
      value = (grain * .7 + low * .7) * (heel + toe * .65)
        + Math.sin(phase) * heel * .12;
    } else if (kind === 'click' || kind === 'stop') {
      const body = decay(t, 0, kind === 'stop' ? .035 : .009);
      const rattle = kind === 'stop' ? decay(t, .038 + color * .005, .015) : 0;
      phase += TAU * (kind === 'stop' ? 122 + color * 15 : 460 + color * 70) / sampleRate;
      value = grain * (body * .8 + rattle * .4) + Math.sin(phase) * body * .11;
    } else if (kind === 'ready') {
      const latch = decay(t, 0, .018), settle = decay(t, .078, .025);
      value = grain * (latch * .65 + settle * .4)
        + Math.sin(TAU * 970 * t) * decay(t, .078, .048) * .07;
    } else if (kind === 'wing') {
      const down = Math.sin(Math.PI * clamp(t / .105)) ** 2;
      const up = t > .083 ? Math.sin(Math.PI * clamp((t - .083) / .077)) ** 2 : 0;
      value = (low * 1.1 + grain * .38) * (down + up * .32) * .5;
    } else if (kind === 'slide') {
      const window = Math.sin(Math.PI * t / duration) ** 2;
      const rough = material === 'gear' ? 1.1 : material === 'gate' ? .85 : .65;
      phase += TAU * (155 + weight * 190 + color * 18 + Math.sin(t * 73) * 12) / sampleRate;
      value = ((grain * rough + low * .85) * (.65 + .18 * Math.sin(t * 119 + color))
        + Math.sin(phase) * (material === 'platform' ? .025 : .055)) * window * .48;
    } else if (kind === 'chirp') {
      // Two short non-musical syrinx glides, with air and a faint second harmonic.
      const start = t < .135 ? .014 : .172, length = t < .135 ? .075 : .095;
      const u = (t - start) / length;
      if (u >= 0 && u <= 1) {
        const f = (t < .135 ? 2250 + 1500 * Math.sin(u * Math.PI * .78) : 3650 - 1300 * u)
          + color * 180 + 65 * Math.sin(t * 370);
        phase += TAU * f / sampleRate;
        value = (Math.sin(phase) + .1 * Math.sin(phase * 2) + grain * .045) * Math.sin(Math.PI * u) ** 1.4 * .12;
      }
    }
    const edge = Math.min(1, i / 32, (count - 1 - i) / 64);
    output[i] = clamp(value * edge, -.8, .8);
  }
  return output;
}

type ActiveFoley = { source: AudioBufferSourceNode; nodes: AudioNode[]; id: string | null; kind: FoleyKind };

/** Short grains only. Off-screen, pause and mute cancel their sources immediately. */
export class FoleyEngine {
  private planner = new FoleyPlanner();
  private voices = new Set<ActiveFoley>();
  private cache = new Map<string, AudioBuffer>();
  private variant = 0;
  constructor(private context: AudioContext, private output: AudioNode) {}

  update(scene: FoleyScene, confirmMechanism = false): void {
    const plan = this.planner.update(scene, this.context.currentTime, confirmMechanism);
    for (const voice of [...this.voices]) {
      if (voice.id && (!plan.audible.has(voice.id) || (voice.kind === 'slide' && !plan.moving.has(voice.id)))) this.stop(voice);
    }
    for (const cue of plan.cues) this.play(cue);
  }

  effect(kind: 'step' | 'click' | 'stop' | 'ready'): void {
    this.play({ kind, id: null, gain: kind === 'step' ? .74 : .85, pan: 0, variation: this.variant++ });
  }

  hush(): void {
    this.planner.reset();
    for (const voice of [...this.voices]) this.stop(voice);
  }

  dispose(): void { this.hush(); this.cache.clear(); }

  private play(cue: FoleyCue): void {
    if (this.context.state !== 'running' || cue.gain <= 0) return;
    const motion = Math.round(clamp(cue.motion ?? .5) * 4) / 4;
    const key = `${cue.kind}:${cue.variation % 8}:${motion}:${cue.material ?? ''}`;
    let buffer = this.cache.get(key);
    if (!buffer) {
      const samples = synthesizeFoley(cue.kind, cue.variation % 8, motion, cue.material);
      buffer = this.context.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);
      if (this.cache.size >= 64) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, buffer);
    }
    const source = this.context.createBufferSource(), level = this.context.createGain();
    source.buffer = buffer; level.gain.value = clamp(cue.gain);
    source.connect(level);
    const nodes: AudioNode[] = [source, level];
    if (typeof this.context.createStereoPanner === 'function') {
      const pan = this.context.createStereoPanner(); pan.pan.value = clamp(cue.pan, -1, 1);
      level.connect(pan); pan.connect(this.output); nodes.push(pan);
    } else level.connect(this.output);
    const voice: ActiveFoley = { source, nodes, id: cue.id, kind: cue.kind };
    this.voices.add(voice);
    source.onended = () => this.disconnect(voice);
    source.start(this.context.currentTime + .003);
  }

  private stop(voice: ActiveFoley): void {
    try { voice.source.stop(); } catch {}
    this.disconnect(voice);
  }

  private disconnect(voice: ActiveFoley): void {
    voice.source.onended = null;
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
    this.voices.delete(voice);
  }
}
