export type GameSound =
  | 'draw'
  | 'ready'
  | 'step'
  | 'star'
  | 'grumble'
  | 'win'
  | 'erase'
  | 'click';

export type GameSpeech = 'waiting' | 'start' | 'grumble' | 'win' | 'ready' | 'call' | 'surprise' | 'thanks';
export type VoiceMode = 'grammelot' | 'italian';

type Voice = {
  source: AudioScheduledSourceNode;
  nodes: AudioNode[];
};

type MouthBeat = { start: number; end: number; strength: number };
type PencilVoice = { source: AudioBufferSourceNode; filter: BiquadFilterNode; envelope: GainNode };
type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';
type Syllable = readonly [vowel: Vowel, duration: number, pitch: number, endPitch: number, pause: number];

const SPEECH_LINES: Record<GameSpeech, readonly string[]> = {
  waiting: ['Eh! Brum badà badà?', 'Ehi! Brrr, badabù?', 'Oh! Ma dai, brabadà!'],
  start: ['Eh! Bidi badà!', 'Ah, via! Trallabù!', 'Oplà! Badabim!'],
  grumble: ['Ma dai! Brum badà!', 'Eh! Brrr, brabadà!', 'Oh! Badabù, ma dai!'],
  win: ['Ah, bene! Bidibì!', 'Evviva! Badabà!', 'Ah! Bravà, bibidì!'],
  ready: ['Eh! Ah, bene!', 'Ah! Bidi badà.', 'Eh, via! Bababì!'],
  call: ['Ehi! Oh, badà?', 'Ohé! Bidibà?', 'Eh! Ma dai!'],
  surprise: ['Oh! Oplà!', 'Eh? Badabù!', 'Ah! Brrr!'],
  thanks: ['Ah, grazie! Bidibì!', 'Eh! Bene, bene!', 'Ah! Bravà!'],
};

const SPEECH_COOLDOWN: Record<GameSpeech, number> = {
  waiting: 7,
  start: 1.2,
  grumble: 1.8,
  win: 1.6,
  ready: 2,
  call: 4.2,
  surprise: 1.8,
  thanks: 2.5,
};

// Vowel resonances and changing pitch make short vocal gestures, not melodies.
const FORMANTS: Record<Vowel, readonly [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};

const GRAMMELOT: Record<GameSpeech, readonly Syllable[]> = {
  waiting: [
    ['e', 0.14, 225, 280, 0.12], ['u', 0.065, 170, 145, 0.03],
    ['a', 0.08, 200, 230, 0.025], ['a', 0.15, 220, 290, 0],
  ],
  start: [
    ['e', 0.10, 220, 270, 0.08], ['i', 0.07, 245, 200, 0.025],
    ['i', 0.07, 225, 260, 0.025], ['a', 0.12, 240, 190, 0.025],
    ['u', 0.10, 225, 280, 0],
  ],
  grumble: [
    ['e', 0.10, 260, 160, 0.09], ['u', 0.045, 165, 150, 0.018],
    ['u', 0.045, 175, 155, 0.018], ['u', 0.045, 170, 145, 0.035],
    ['a', 0.10, 230, 170, 0.025], ['a', 0.08, 190, 240, 0.025],
    ['o', 0.17, 205, 115, 0],
  ],
  win: [
    ['a', 0.11, 230, 310, 0.035], ['e', 0.13, 290, 240, 0.10],
    ['i', 0.075, 250, 285, 0.025], ['i', 0.075, 265, 235, 0.025],
    ['a', 0.18, 250, 185, 0],
  ],
  ready: [
    ['e', 0.10, 230, 265, 0.07], ['a', 0.13, 210, 245, 0.03],
    ['e', 0.13, 235, 280, 0],
  ],
  call: [
    ['e', 0.11, 205, 315, 0.09], ['o', 0.12, 245, 305, 0.025],
    ['a', 0.10, 275, 210, 0],
  ],
  surprise: [
    ['o', 0.055, 185, 330, 0.045], ['a', 0.16, 340, 175, 0],
  ],
  thanks: [
    ['a', 0.085, 225, 275, 0.035], ['i', 0.065, 260, 300, 0.018],
    ['i', 0.065, 285, 255, 0.025], ['e', 0.13, 245, 185, 0],
  ],
};

function speechClock(): number {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

const COOLDOWN: Record<GameSound, number> = {
  draw: 0.085,
  ready: 0.3,
  step: 0.12,
  star: 0.085,
  grumble: 0.9,
  win: 0.9,
  erase: 0.15,
  click: 0.04,
};

/**
 * All sounds are generated locally. Construction is safe during SSR; call
 * unlock() from a pointer or keyboard gesture before the first sound.
 */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private glottalWave: PeriodicWave | null = null;
  private voices = new Set<Voice>();
  private pencil: PencilVoice | null = null;
  private voiceMode: VoiceMode = 'grammelot';
  private lastPlayed: Partial<Record<GameSound, number>> = {};
  private enabled = true;
  private volume = 0.4;
  private disposed = false;
  private stepIndex = 0;
  private gestureUnlocked = false;
  private synthesis: SpeechSynthesis | null = null;
  private italianVoice: SpeechSynthesisVoice | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private speechWatchdog: ReturnType<typeof setTimeout> | null = null;
  private speechStartedAt: number | null = null;
  private speechDeadline = 0;
  private nativeSpeechFailed = false;
  private mouthBeats: MouthBeat[] = [];
  private speechVariants: Partial<Record<GameSpeech, number>> = {};
  private lastSpoken: Partial<Record<GameSpeech, number>> = {};
  private lastSpeechAt = -Infinity;
  private readonly onVoicesChanged = () => this.refreshItalianVoice();

  unlock(): void {
    if (this.disposed || typeof window === 'undefined') return;
    this.gestureUnlocked = true;
    if (this.voiceMode === 'italian') this.prepareSpeech();

    try {
      if (!this.context) {
        const AudioConstructor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioConstructor) return;

        const context = new AudioConstructor();
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(context.destination);
      }

      if (this.context.state !== 'running' && this.context.state !== 'closed') {
        // Starting/resuming happens only here, inside the caller's gesture.
        void this.context.resume().catch(() => {});
      }
    } catch {
      // A browser without usable audio must still have a playable game.
    }
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const nextVolume = Math.max(0, Math.min(1, volume));
    const changed = nextVolume !== this.volume;
    this.volume = nextVolume;
    this.updateGain();
    // Most speech engines cannot change an utterance's volume mid-sentence.
    // Stop that short phrase; the next one uses the new level immediately.
    if (changed && this.utterance) this.stopSpeech();
    if (this.volume === 0) {
      this.stopVoices();
      this.stopSpeech();
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.updateGain();
    if (!enabled) {
      this.stopVoices();
      this.stopSpeech();
    }
  }

  /** Stop current reactions and effects without changing volume or mute preferences. */
  hush(): void {
    this.stopSpeech();
    this.stopVoices();
  }

  /** The default is entirely generated; the optional Italian voice must be installed locally. */
  setVoiceMode(mode: VoiceMode): void {
    if (mode !== 'grammelot' && mode !== 'italian') return;
    if (mode === this.voiceMode) return;
    this.hush();
    this.voiceMode = mode;
    if (mode === 'italian' && this.gestureUnlocked) this.prepareSpeech();
  }

  /** Start paper friction after unlock(). Speed is measured in scene units/second. */
  startPencil(speed = 0): void {
    const context = this.context;
    if (this.pencil || this.disposed || !this.gestureUnlocked || !this.enabled || !this.volume || !context || !this.master || context.state === 'closed') return;
    try {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      source.buffer = this.noiseBuffer();
      source.loop = true;
      filter.type = 'bandpass';
      filter.Q.value = .65;
      filter.frequency.value = 1450;
      envelope.gain.value = 0;
      source.connect(filter);filter.connect(envelope);envelope.connect(this.master);
      this.pencil = {source,filter,envelope};
      this.track(source,[source,filter,envelope]);
      source.start();
      this.updatePencil(speed);
    } catch { this.endPencil(); }
  }

  /** Smooth, bounded friction; a stationary pointer falls silent without lifting the pencil. */
  updatePencil(speed: number, pressure = .6): void {
    if (!Number.isFinite(speed)) return;
    if (!this.pencil && speed > 1) this.startPencil();
    const pencil = this.pencil, context = this.context;
    if (!pencil || !context || this.disposed || !this.enabled || !this.volume) return;
    const motion = Math.min(1,Math.sqrt(Math.max(0,speed)/600));
    const weight = Math.max(0,Math.min(1,Number.isFinite(pressure)?pressure:.6));
    const amplitude = speed > 1 ? (.006 + motion*.03) * (.45 + weight*.55) : 0;
    try {
      const now = context.currentTime;
      pencil.filter.frequency.setTargetAtTime(850 + motion*2450,now,.035);
      pencil.source.playbackRate.setTargetAtTime(.75 + motion*.6,now,.035);
      pencil.envelope.gain.cancelScheduledValues(now);
      pencil.envelope.gain.setTargetAtTime(amplitude,now,.018);
      // Pointer events may stop while the button remains held. Never leave a hiss behind.
      pencil.envelope.gain.setTargetAtTime(0,now+.1,.035);
    } catch { this.endPencil(); }
  }

  endPencil(): void {
    const pencil = this.pencil;
    this.pencil = null;
    if (!pencil) return;
    try {
      const now = this.context?.currentTime ?? 0;
      pencil.envelope.gain.cancelScheduledValues(now);
      pencil.envelope.gain.setTargetAtTime(0,now,.012);
      pencil.source.stop(now+.065);
    } catch {
      for (const node of [pencil.source,pencil.filter,pencil.envelope]) { try {node.disconnect();} catch {} }
    }
  }

  /** Short original Italian-sounding grammelot; never queues several phrases. */
  speak(kind: GameSpeech): void {
    if (this.disposed || !this.gestureUnlocked || !this.enabled || this.volume === 0) return;

    const now = speechClock();
    const audioNow = this.context?.currentTime ?? 0;
    if (
      this.utterance ||
      this.mouthBeats.some((beat) => beat.end > audioNow) ||
      now - this.lastSpeechAt < 0.8 ||
      now - (this.lastSpoken[kind] ?? -Infinity) < SPEECH_COOLDOWN[kind]
    ) return;

    this.lastSpeechAt = now;
    this.lastSpoken[kind] = now;
    const variant = this.speechVariants[kind] ?? 0;
    this.speechVariants[kind] = variant + 1;
    if (this.voiceMode === 'italian') {
      this.prepareSpeech();
      this.refreshItalianVoice();
    }

    const synthesis = this.synthesis;
    if (
      this.voiceMode === 'italian' && synthesis && this.italianVoice && !this.nativeSpeechFailed &&
      typeof window !== 'undefined' && window.SpeechSynthesisUtterance
    ) {
      // Do not append our line behind speech owned by another component.
      if (synthesis.speaking || synthesis.pending) return;
      try {
        const lines = SPEECH_LINES[kind];
        const utterance = new window.SpeechSynthesisUtterance(lines[variant % lines.length]);
        utterance.voice = this.italianVoice;
        utterance.lang = this.italianVoice.lang || 'it-IT';
        utterance.pitch = kind === 'win' ? 1.5 : kind === 'grumble' ? 1.35 : 1.4;
        utterance.rate = kind === 'waiting' ? 1.22 : kind === 'grumble' ? 1.4 : 1.3;
        utterance.volume = this.volume;
        this.utterance = utterance;
        this.speechStartedAt = null;
        this.mouthBeats = [];

        utterance.onstart = () => {
          if (this.utterance !== utterance) return;
          this.clearSpeechWatchdog();
          this.speechStartedAt = speechClock();
          this.speechDeadline = this.speechStartedAt + 4;
          this.speechWatchdog = setTimeout(() => {
            if (this.utterance === utterance) this.stopSpeech();
          }, 4000);
        };
        utterance.onend = () => {
          if (this.utterance === utterance) this.releaseUtterance(false);
        };
        utterance.onerror = (event) => {
          if (this.utterance !== utterance) return;
          const interrupted = event.error === 'interrupted' || event.error === 'canceled';
          this.releaseUtterance(false);
          if (!interrupted) {
            this.nativeSpeechFailed = true;
            this.playGrammelot(kind, variant);
          }
        };
        this.speechWatchdog = setTimeout(() => {
          if (this.utterance !== utterance || this.speechStartedAt !== null) return;
          this.nativeSpeechFailed = true;
          this.releaseUtterance(true);
          this.playGrammelot(kind, variant);
        }, 750);
        synthesis.speak(utterance);
        return;
      } catch {
        this.nativeSpeechFailed = true;
        this.releaseUtterance(true);
      }
    }

    this.playGrammelot(kind, variant);
  }

  /** Mouth animation amplitude, from generated timing only; no microphone. */
  getTalkAmount(): number {
    if (this.disposed || !this.gestureUnlocked || !this.enabled || this.volume === 0) return 0;

    if (this.utterance && this.speechStartedAt !== null) {
      const now = speechClock();
      if (now >= this.speechDeadline) return 0;
      const elapsed = now - this.speechStartedAt;
      const attack = Math.min(1, Math.max(0, elapsed) / 0.045);
      const movement = 0.18 + 0.82 * Math.abs(Math.sin(elapsed * 16.5 + 0.6 * Math.sin(elapsed * 7)));
      return Math.min(1, attack * movement);
    }

    if (!this.context || this.context.state !== 'running') return 0;
    const now = this.context.currentTime;
    const beat = this.mouthBeats.find((item) => item.start <= now && item.end > now);
    if (!beat) return 0;
    const progress = (now - beat.start) / (beat.end - beat.start);
    const envelope = Math.pow(Math.sin(progress * Math.PI), 0.55);
    return Math.min(1, envelope * beat.strength * (0.78 + 0.22 * Math.abs(Math.sin(now * 29))));
  }

  play(kind: GameSound): void {
    const context = this.context;
    if (
      this.disposed ||
      !this.enabled ||
      this.volume === 0 ||
      !context ||
      !this.master ||
      context.state === 'closed'
    ) return;

    const now = context.currentTime;
    if (now - (this.lastPlayed[kind] ?? -Infinity) < COOLDOWN[kind]) return;
    this.lastPlayed[kind] = now;

    try {
      switch (kind) {
        case 'draw':
          this.scratch(now, 0.055, 0.026, 1800);
          break;
        case 'click':
          this.tone(now, 640, 0.055, 0.075, 'sine', 860);
          break;
        case 'step': {
          const frequency = this.stepIndex++ % 2 ? 210 : 245;
          this.tone(now, frequency, 0.07, 0.095, 'sine', 105);
          break;
        }
        case 'ready':
          [523.25, 659.25, 783.99].forEach((note, index) => {
            this.tone(now + index * 0.075, note, 0.18, 0.08, 'triangle');
          });
          break;
        case 'star':
          this.tone(now, 1174.66, 0.22, 0.085, 'sine');
          this.tone(now + 0.065, 1567.98, 0.32, 0.07, 'sine');
          this.tone(now + 0.065, 3135.96, 0.1, 0.018, 'sine');
          break;
        case 'grumble':
          this.syllable(now, 160, 115, 0.12, 520, 1300);
          this.syllable(now + 0.14, 185, 145, 0.085, 710, 1650);
          this.syllable(now + 0.245, 145, 195, 0.115, 410, 1100);
          this.syllable(now + 0.38, 175, 105, 0.16, 610, 1450);
          break;
        case 'win':
          [392, 523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
            const last = index === 4;
            this.tone(
              now + index * 0.12,
              note,
              last ? 0.52 : 0.2,
              last ? 0.1 : 0.085,
              'triangle',
            );
          });
          break;
        case 'erase':
          this.scratch(now, 0.18, 0.055, 950);
          this.tone(now, 280, 0.14, 0.035, 'sine', 140);
          break;
      }
    } catch {
      // Audio device changes and suspended tabs must not interrupt drawing.
      this.stopVoices();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopSpeech();
    this.stopVoices();
    try {
      this.synthesis?.removeEventListener('voiceschanged', this.onVoicesChanged);
      this.master?.disconnect();
      if (this.context && this.context.state !== 'closed') {
        void this.context.close().catch(() => {});
      }
    } catch {}
    this.master = null;
    this.context = null;
    this.noise = null;
    this.glottalWave = null;
    this.synthesis = null;
    this.italianVoice = null;
    this.lastPlayed = {};
    this.lastSpoken = {};
  }

  private prepareSpeech(): void {
    if (this.synthesis || !this.gestureUnlocked || this.disposed || typeof window === 'undefined') return;
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      this.synthesis = window.speechSynthesis;
      this.synthesis.addEventListener('voiceschanged', this.onVoicesChanged);
      this.refreshItalianVoice();
    } catch {
      this.synthesis = null;
    }
  }

  private refreshItalianVoice(): void {
    if (!this.synthesis || this.disposed) return;
    try {
      // A remote TTS voice would send text to its provider. Only installed,
      // explicitly local Italian voices are eligible; all other cases use DSP.
      const voices = this.synthesis.getVoices().filter(
        (voice) => voice.localService === true && /^it(?:[-_]|$)/i.test(voice.lang),
      );
      const voice = voices.find((item) => /^it[-_]IT$/i.test(item.lang)) ?? voices[0] ?? null;
      if (voice?.voiceURI !== this.italianVoice?.voiceURI) this.nativeSpeechFailed = false;
      this.italianVoice = voice;
    } catch {
      this.italianVoice = null;
    }
  }

  private clearSpeechWatchdog(): void {
    if (this.speechWatchdog !== null) clearTimeout(this.speechWatchdog);
    this.speechWatchdog = null;
  }

  private releaseUtterance(cancel: boolean): void {
    const utterance = this.utterance;
    this.utterance = null;
    this.speechStartedAt = null;
    this.speechDeadline = 0;
    this.clearSpeechWatchdog();
    if (utterance) {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      // SpeechSynthesis has no per-utterance cancel operation. Only call its
      // cancel when this class owns an outstanding utterance; we never queue.
      if (cancel) {
        try { this.synthesis?.cancel(); } catch {}
      }
    }
  }

  private stopSpeech(): void {
    this.releaseUtterance(true);
    this.mouthBeats = [];
  }

  private playGrammelot(kind: GameSpeech, variant: number): void {
    const context = this.context;
    if (
      this.disposed || !this.gestureUnlocked || !this.enabled || this.volume === 0 ||
      !context || !this.master || context.state === 'closed'
    ) return;

    const inflection = [1, .955, 1.055, 1.015][variant % 4];
    const tempo = [1, .91, 1.07, .96][variant % 4];
    let when = context.currentTime + 0.012;
    this.mouthBeats = [];
    try {
      GRAMMELOT[kind].forEach(([vowel, duration, pitch, endPitch, pause], index) => {
        const [first, second, third] = FORMANTS[vowel];
        const stress = index === 0 || index === GRAMMELOT[kind].length - 1 ? 1 : .72 + (index % 2)*.12;
        const length = duration * tempo;
        this.syllable(when, pitch * inflection, endPitch * inflection, length, first, second, third, .4 * stress);
        // Tiny breath/consonant attacks interrupt the vowels like comic speech.
        if (duration > 0.06 && index % 2 === 0) this.scratch(when, 0.025, 0.035, 1600);
        this.mouthBeats.push({ start: when, end: when + length, strength: stress });
        when += length + pause*tempo;
      });
    } catch {
      this.stopVoices();
    }
  }

  private updateGain(): void {
    if (!this.context || !this.master || this.disposed) return;
    try {
      const gain = this.master.gain;
      const now = this.context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(this.enabled ? this.volume : 0, now, 0.012);
    } catch {}
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    const voice: Voice = { source, nodes };
    this.voices.add(voice);
    source.onended = () => {
      for (const node of nodes) {
        try { node.disconnect(); } catch {}
      }
      source.onended = null;
      this.voices.delete(voice);
      if (this.pencil?.source === source) this.pencil = null;
    };
  }

  private stopVoices(): void {
    this.pencil = null;
    for (const voice of this.voices) {
      try { voice.source.stop(); } catch {}
      for (const node of voice.nodes) {
        try { node.disconnect(); } catch {}
      }
      voice.source.onended = null;
    }
    this.voices.clear();
    this.mouthBeats = [];
  }

  private tone(
    when: number,
    frequency: number,
    duration: number,
    amplitude: number,
    type: OscillatorType,
    endFrequency?: number,
  ): void {
    const context = this.context!;
    const source = context.createOscillator();
    const envelope = context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(frequency, when);
    if (endFrequency !== undefined) {
      source.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
    }
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(amplitude, when + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(envelope);
    envelope.connect(this.master!);
    this.track(source, [source, envelope]);
    source.start(when);
    source.stop(when + duration + 0.025);
  }

  private scratch(when: number, duration: number, amplitude: number, frequency: number): void {
    const context = this.context!;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.noiseBuffer();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(amplitude, when + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master!);
    this.track(source, [source, filter, envelope]);
    source.start(when, 0, duration + 0.025);
    source.stop(when + duration + 0.025);
  }

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const context = this.context!;
      this.noise = context.createBuffer(1,Math.ceil(context.sampleRate*.5),context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1;
    }
    return this.noise;
  }

  private syllable(
    when: number,
    pitch: number,
    endPitch: number,
    duration: number,
    firstFormant: number,
    secondFormant: number,
    thirdFormant = 2500,
    amplitude = 0.16,
  ): void {
    const context = this.context!;
    const source = context.createOscillator();
    const first = context.createBiquadFilter();
    const second = context.createBiquadFilter();
    const third = context.createBiquadFilter();
    const secondLevel = context.createGain();
    const thirdLevel = context.createGain();
    const envelope = context.createGain();
    if (!this.glottalWave) {
      const real = new Float32Array(32);
      const imaginary = new Float32Array(32);
      for (let harmonic = 1; harmonic < imaginary.length; harmonic++) {
        imaginary[harmonic] = Math.exp(-harmonic / 24) / Math.pow(harmonic, 1.25);
      }
      this.glottalWave = context.createPeriodicWave(real, imaginary);
    }
    source.setPeriodicWave(this.glottalWave);
    source.frequency.setValueAtTime(pitch, when);
    source.frequency.exponentialRampToValueAtTime(pitch * 1.045, when + duration * 0.38);
    source.frequency.exponentialRampToValueAtTime(endPitch, when + duration);
    first.type = 'bandpass';
    first.frequency.setValueAtTime(firstFormant, when);
    first.frequency.linearRampToValueAtTime(firstFormant * 0.84, when + duration);
    first.Q.value = 5;
    second.type = 'bandpass';
    second.frequency.setValueAtTime(secondFormant, when);
    second.frequency.linearRampToValueAtTime(secondFormant * 1.04, when + duration);
    second.Q.value = 6;
    third.type = 'bandpass';
    third.frequency.value = thirdFormant;
    third.Q.value = 7;
    secondLevel.gain.value = 0.7;
    thirdLevel.gain.value = 0.3;
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(amplitude, when + 0.012);
    envelope.gain.setValueAtTime(amplitude * 0.85, when + duration * 0.48);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(first);
    source.connect(second);
    source.connect(third);
    first.connect(envelope);
    second.connect(secondLevel);
    secondLevel.connect(envelope);
    third.connect(thirdLevel);
    thirdLevel.connect(envelope);
    envelope.connect(this.master!);
    this.track(source, [source, first, second, third, secondLevel, thirdLevel, envelope]);
    source.start(when);
    source.stop(when + duration + 0.025);
  }
}
