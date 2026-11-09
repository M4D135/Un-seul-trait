import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameAudio } from '../lib/trait/audio';
import { ORIGINAL_VOICE_CLIPS } from '../lib/trait/original-media';

class FakeParam {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { this.value = value; }
}

class FakeNode {
  disconnected = false;
  connect() {}
  disconnect() { this.disconnected = true; }
}

class FakeSource extends FakeNode {
  buffer: AudioBuffer | null = null;
  playbackRate = new FakeParam();
  onended: (() => void) | null = null;
  starts: number[][] = [];
  stopped = false;
  start(...args: number[]) { this.starts.push(args); }
  stop() { this.stopped = true; this.onended?.(); }
  finish() { this.onended?.(); }
}

class FakeUtterance {
  voice: unknown = null;
  lang = '';
  pitch = 1;
  rate = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(readonly text: string) {}
}

/** Delayed decoding represents a first interaction on a slow device/network. */
function audioRig(embedded = false) {
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const install = (key: string, value: unknown) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  let milliseconds = 0;
  const state = { fetches: [] as string[], decoded: [] as ArrayBuffer[], oscillators: 0, canceled: 0 };
  const sources: FakeSource[] = [], utterances: FakeUtterance[] = [];
  const contexts: FakeContext[] = [];
  let resolveDecode!: (value: AudioBuffer) => void, rejectDecode!: (error: Error) => void;
  const decoded = new Promise<AudioBuffer>((resolve, reject) => { resolveDecode = resolve; rejectDecode = reject; });
  const samples = new Float32Array(2920);
  for (const clip of ORIGINAL_VOICE_CLIPS) {
    samples.fill(.75, Math.round(clip.offset * 1000), Math.round(clip.offset * 1000) + 100);
  }
  const buffer = {
    duration: 2.92, sampleRate: 1000, numberOfChannels: 1, length: samples.length,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
  class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = new FakeNode();
    constructor() { contexts.push(this); }
    createGain() { return Object.assign(new FakeNode(), { gain: new FakeParam() }); }
    createBufferSource() { const source = new FakeSource(); sources.push(source); return source; }
    createOscillator() { state.oscillators++; throw new Error('Unexpected synthetic fallback'); }
    decodeAudioData(bytes: ArrayBuffer) { state.decoded.push(bytes); return decoded; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const synthesis = {
    speaking: false, pending: false,
    addEventListener() {}, removeEventListener() {},
    getVoices: () => [{ localService: true, lang: 'it-IT', voiceURI: 'test-local-italian' }],
    speak(utterance: FakeUtterance) { utterances.push(utterance); this.pending = true; },
    cancel() { state.canceled++; this.pending = false; this.speaking = false; },
  };
  install('window', { AudioContext: FakeContext, speechSynthesis: synthesis, SpeechSynthesisUtterance: FakeUtterance });
  install('document', { baseURI: 'https://game.example/chapter/' });
  install('performance', { now: () => milliseconds });
  install('__TRAIT_ORIGINAL_AUDIO_ASSET__', embedded ? 'data:audio/wav;base64,AQIDBA==' : undefined);
  install('fetch', async (url: string) => {
    state.fetches.push(url);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  });
  const audio = new GameAudio();
  return {
    audio, state, contexts, sources, utterances, synthesis, buffer, resolveDecode, rejectDecode,
    advance(seconds: number) { milliseconds += seconds * 1000; },
    cleanup() {
      audio.dispose();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

async function flushAudio() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

const interruptions = [
  ['pause/hush', (audio: GameAudio) => audio.hush()],
  ['mute', (audio: GameAudio) => audio.setEnabled(false)],
  ['zero volume', (audio: GameAudio) => audio.setVolume(0)],
  ['voice change', (audio: GameAudio) => audio.setVoiceMode('grammelot')],
  ['dispose', (audio: GameAudio) => audio.dispose()],
] as const;

test('a delayed original decode never speaks after pause, mute, mode change, or disposal', async () => {
  for (const [name, interrupt] of interruptions) {
    const rig = audioRig();
    try {
      rig.audio.unlock();
      rig.audio.speak('waiting');
      await flushAudio();
      assert.equal(rig.audio.getOriginalVoiceStatus(), 'loading', name);
      interrupt(rig.audio);
      rig.resolveDecode(rig.buffer);
      await flushAudio();
      assert.equal(rig.sources.length, 0, name);
      assert.equal(rig.audio.getTalkAmount(), 0, name);
      assert.equal(rig.state.oscillators, 0, name);
    } finally { rig.cleanup(); }
  }
});

test('original excerpts use exact markers and real sample amplitude, with one reaction at a time', async () => {
  const rig = audioRig();
  try {
    assert.equal(rig.state.fetches.length, 0, 'construction alone must not load or play audio');
    rig.audio.unlock();
    await flushAudio();
    assert.deepEqual(rig.state.fetches, ['https://game.example/chapter/original-voice.wav']);
    rig.resolveDecode(rig.buffer);
    await flushAudio();
    assert.equal(rig.audio.getOriginalVoiceStatus(), 'ready');
    for (let i = 0; i < ORIGINAL_VOICE_CLIPS.length; i++) {
      const clip = ORIGINAL_VOICE_CLIPS[i];
      rig.audio.speak('start');
      await flushAudio();
      assert.equal(rig.sources.length, i + 1);
      const source = rig.sources[i], context = rig.contexts[0];
      assert.equal(source.playbackRate.value, 1);
      assert.equal(source.buffer, rig.buffer);
      assert.deepEqual(source.starts[0].slice(1), [clip.offset, clip.duration]);
      const when = source.starts[0][0];
      context.currentTime = when + .05;
      assert(rig.audio.getTalkAmount() > .9, 'audible sample opens the mouth');
      context.currentTime = when + .4;
      assert.equal(rig.audio.getTalkAmount(), 0, 'sample silence closes the mouth');
      rig.advance(2);
      rig.audio.speak('ready');
      await flushAudio();
      assert.equal(rig.sources.length, i + 1, 'a reaction may not queue behind an active sample');
      source.finish();
      assert.equal(source.disconnected, true);
      assert.equal(rig.audio.getTalkAmount(), 0);
    }
    assert.equal(rig.state.oscillators, 0);
    assert.equal(rig.utterances.length, 0);
  } finally { rig.cleanup(); }
});

test('each interruption immediately stops an already playing original excerpt', async () => {
  for (const [name, interrupt] of interruptions) {
    const rig = audioRig();
    try {
      rig.audio.unlock();
      rig.resolveDecode(rig.buffer);
      rig.audio.speak('start');
      await flushAudio();
      assert.equal(rig.sources.length, 1, name);
      interrupt(rig.audio);
      assert.equal(rig.sources[0].stopped, true, name);
      assert.equal(rig.sources[0].disconnected, true, name);
      assert.equal(rig.audio.getTalkAmount(), 0, name);
      await flushAudio();
      assert.equal(rig.sources.length, 1, 'interruption does not schedule another reaction');
    } finally { rig.cleanup(); }
  }
});

test('slow or broken original loading stays silent instead of substituting synthesis', async () => {
  for (const failure of ['late', 'decode'] as const) {
    const rig = audioRig();
    try {
      rig.audio.unlock();
      rig.audio.speak('start');
      await flushAudio();
      if (failure === 'late') { rig.advance(1.3); rig.resolveDecode(rig.buffer); }
      else rig.rejectDecode(new Error('Corrupt file'));
      await flushAudio();
      assert.equal(rig.sources.length, 0);
      assert.equal(rig.state.oscillators, 0);
      assert.equal(rig.utterances.length, 0);
      assert.equal(rig.audio.getTalkAmount(), 0);
      assert.equal(rig.audio.getOriginalVoiceStatus(), failure === 'late' ? 'ready' : 'unavailable');
    } finally { rig.cleanup(); }
  }
});

test('standalone data-URL audio decodes locally without fetching its asset', async () => {
  const rig = audioRig(true);
  try {
    rig.audio.unlock();
    rig.audio.speak('start');
    rig.resolveDecode(rig.buffer);
    await flushAudio();
    assert.equal(rig.state.fetches.length, 0);
    assert.deepEqual([...new Uint8Array(rig.state.decoded[0])], [1, 2, 3, 4]);
    assert.equal(rig.sources.length, 1);
    assert.equal(rig.audio.getOriginalVoiceStatus(), 'ready');
  } finally { rig.cleanup(); }
});

test('native Italian speech cannot queue or revive an interrupted utterance', async () => {
  const rig = audioRig();
  try {
    rig.audio.setVoiceMode('italian');
    rig.audio.unlock();
    rig.audio.speak('start');
    rig.advance(2);
    rig.audio.speak('ready');
    assert.equal(rig.utterances.length, 1, 'only one outstanding native utterance');
    const utterance = rig.utterances[0], lateError = utterance.onerror;
    rig.audio.hush();
    assert.equal(rig.state.canceled, 1);
    assert.equal(utterance.onstart, null);
    assert.equal(utterance.onerror, null);
    lateError?.({ error: 'synthesis-failed' });
    await flushAudio();
    assert.equal(rig.state.oscillators, 0, 'an obsolete callback cannot synthesize a new phrase');
    rig.synthesis.pending = true;
    rig.advance(2);
    rig.audio.speak('thanks');
    assert.equal(rig.utterances.length, 1, 'speech owned elsewhere is never queued behind');
    assert.equal(rig.audio.getTalkAmount(), 0);
  } finally { rig.cleanup(); }
});
