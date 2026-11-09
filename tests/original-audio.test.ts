import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameAudio } from '../lib/trait/audio';
import { OriginalVoiceDeck, ORIGINAL_VOICE_CLIPS, ORIGINAL_VOICE_DURATION, type OriginalSpeechContext } from '../lib/trait/original-media';

class FakeParam {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { this.value = value; }
  setValueAtTime(value: number) { this.value = value; }
  linearRampToValueAtTime(value: number) { this.value = value; }
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
  const samples = new Float32Array(Math.round(ORIGINAL_VOICE_DURATION * 1000));
  for (const clip of ORIGINAL_VOICE_CLIPS) {
    samples.fill(.75, Math.round(clip.offset * 1000), Math.round(clip.offset * 1000) + 100);
  }
  const buffer = {
    duration: ORIGINAL_VOICE_DURATION, sampleRate: 1000, numberOfChannels: 1, length: samples.length,
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

test('original excerpts use exact contextual markers and real sample amplitude, with one reaction at a time', async () => {
  const rig = audioRig();
  try {
    assert.equal(rig.state.fetches.length, 0, 'construction alone must not load or play audio');
    rig.audio.unlock();
    await flushAudio();
    assert.deepEqual(rig.state.fetches, ['https://game.example/chapter/original-voice.wav?v=3']);
    rig.resolveDecode(rig.buffer);
    await flushAudio();
    assert.equal(rig.audio.getOriginalVoiceStatus(), 'ready');
    const heard: string[] = [];
    for (let i = 0; i < ORIGINAL_VOICE_CLIPS.length; i++) {
      rig.audio.speak('start');
      await flushAudio();
      assert.equal(rig.sources.length, i + 1);
      const source = rig.sources[i], context = rig.contexts[0];
      const clip = ORIGINAL_VOICE_CLIPS.find(candidate => candidate.offset === source.starts[0][1]);
      assert(clip, 'the actual source marker exists in the documented bank');
      assert(clip.contexts.includes('start'), 'the original game cue survives asynchronous decoding');
      assert(!heard.slice(-5).includes(clip.id), 'the five last clips remain excluded after a pause');
      heard.push(clip.id);
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
      rig.audio.hush();
      assert.equal(source.disconnected, true);
      assert.equal(rig.audio.getTalkAmount(), 0);
    }
    assert(new Set(heard).size >= 6, 'one recurring situation has a real variety of original takes');
    assert.equal(rig.state.oscillators, 0);
    assert.equal(rig.utterances.length, 0);
  } finally { rig.cleanup(); }
});

test('every cue has a shuffle bag and mixed conversations never repeat their five last takes', () => {
  const cues: OriginalSpeechContext[] = ['waiting', 'start', 'grumble', 'win', 'ready', 'call', 'surprise', 'thanks'];
  assert.equal(ORIGINAL_VOICE_CLIPS.length, 16);
  assert(ORIGINAL_VOICE_CLIPS.every(clip => clip.duration > .3 && clip.duration < 1.1));
  for (const cue of cues) {
    const eligible = ORIGINAL_VOICE_CLIPS.filter(clip => clip.contexts.includes(cue));
    assert(eligible.length >= 6, `${cue}: enough choices to exclude the recent five`);
    const deck = new OriginalVoiceDeck(() => .37);
    const firstBag = Array.from({ length: eligible.length }, () => deck.pick(cue));
    assert.equal(new Set(firstBag.map(clip => clip.id)).size, eligible.length, `${cue}: no restart before the bag is consumed`);
    assert(firstBag.every(clip => clip.contexts.includes(cue)));
  }
  const deck = new OriginalVoiceDeck(() => .61), heard: string[] = [];
  for (let i = 0; i < 256; i++) {
    const cue = cues[(i * 5 + Math.floor(i / 9)) % cues.length];
    const clip = deck.pick(cue);
    assert(clip.contexts.includes(cue), `context stays correct for ${cue}`);
    assert(!heard.slice(-5).includes(clip.id), `no cross-context repeat at reaction ${i}`);
    heard.push(clip.id);
  }
  assert.equal(new Set(heard).size, ORIGINAL_VOICE_CLIPS.length, 'all documented reactions can actually be selected');
});

test('a stale three-clip atlas is rejected rather than silently breaking the new reactions', async () => {
  const rig = audioRig();
  try {
    rig.audio.unlock();
    rig.audio.speak('call');
    rig.resolveDecode({ ...rig.buffer, duration: 2.92 } as AudioBuffer);
    await flushAudio();
    assert.equal(rig.audio.getOriginalVoiceStatus(), 'unavailable');
    assert.equal(rig.sources.length, 0);
    assert.equal(rig.state.oscillators, 0);
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
