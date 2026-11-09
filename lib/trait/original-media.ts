/** Replaced by the standalone build with the complete local WAV as a data URL. */
declare const __TRAIT_ORIGINAL_AUDIO_ASSET__: string | undefined;

export type OriginalSpeechContext = 'waiting' | 'start' | 'grumble' | 'win' | 'ready' | 'call' | 'surprise' | 'thanks';
export type OriginalVoiceClip = {
  id: string;
  offset: number;
  duration: number;
  contexts: readonly OriginalSpeechContext[];
};

/**
 * Short excerpts from the official Quipos series 100/200 files. Atlas/source
 * timecodes are documented in public/original-voice-manifest.json. These are
 * soundtrack excerpts, not isolated voices or emotion-certified utterances.
 * Cue assignments follow the visible gesture, not a claimed translation.
 */
export const ORIGINAL_VOICE_CLIPS: readonly OriginalVoiceClip[] = [
  { id: 'reaction-01', offset: 0, duration: .98, contexts: ['start', 'win', 'ready', 'thanks', 'call', 'surprise'] },
  { id: 'reaction-02', offset: 1.1, duration: .76, contexts: ['waiting', 'ready', 'thanks', 'call', 'start'] },
  { id: 'reaction-03', offset: 1.98, duration: .6, contexts: ['waiting', 'grumble', 'call', 'surprise'] },
  { id: 'reaction-04', offset: 2.7, duration: .78, contexts: ['grumble', 'call', 'waiting', 'surprise'] },
  { id: 'reaction-05', offset: 3.6, duration: .84, contexts: ['grumble', 'waiting', 'ready', 'thanks', 'call'] },
  { id: 'reaction-06', offset: 4.56, duration: .68, contexts: ['waiting', 'grumble', 'call', 'ready', 'thanks'] },
  { id: 'reaction-07', offset: 5.36, duration: .64, contexts: ['start', 'surprise', 'win', 'call', 'thanks'] },
  { id: 'reaction-08', offset: 6.12, duration: .64, contexts: ['start', 'win', 'ready', 'thanks', 'waiting'] },
  { id: 'reaction-09', offset: 6.88, duration: .58, contexts: ['start', 'surprise', 'ready', 'call', 'win'] },
  { id: 'reaction-10', offset: 7.58, duration: .84, contexts: ['grumble', 'waiting', 'call', 'surprise'] },
  { id: 'reaction-11', offset: 8.54, duration: .66, contexts: ['grumble', 'call', 'waiting', 'surprise'] },
  { id: 'reaction-12', offset: 9.32, duration: .66, contexts: ['waiting', 'grumble', 'surprise', 'call'] },
  { id: 'reaction-13', offset: 10.1, duration: .64, contexts: ['grumble', 'waiting', 'surprise', 'ready'] },
  { id: 'reaction-14', offset: 10.86, duration: .76, contexts: ['grumble', 'waiting', 'call'] },
  { id: 'reaction-15', offset: 11.74, duration: .58, contexts: ['start', 'ready', 'thanks', 'win'] },
  { id: 'reaction-16', offset: 12.44, duration: .78, contexts: ['ready', 'thanks', 'win', 'start'] },
];

export const ORIGINAL_VOICE_DURATION = Math.max(...ORIGINAL_VOICE_CLIPS.map(clip => clip.offset + clip.duration));

/**
 * One shuffle bag per situation and a shared five-clip memory. A return to the
 * same obstacle cannot restart a little a/b/c loop. Hush/pause do not reset it.
 */
export class OriginalVoiceDeck {
  private bags = new Map<OriginalSpeechContext, OriginalVoiceClip[]>();
  private recent: string[] = [];

  constructor(private readonly random: () => number = Math.random) {}

  pick(context: OriginalSpeechContext): OriginalVoiceClip {
    let bag = this.bags.get(context) ?? [];
    let index = bag.findIndex(clip => !this.recent.includes(clip.id));
    if (index < 0) {
      // Every context has at least six choices: the five-clip exclusion can
      // never force an unrelated reaction or repeat, even after cue changes.
      bag = ORIGINAL_VOICE_CLIPS.filter(clip => clip.contexts.includes(context) && !this.recent.includes(clip.id));
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.max(0, Math.min(i, Math.floor(this.random() * (i + 1))));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.bags.set(context, bag);
      index = 0;
    }
    const [clip] = bag.splice(index, 1);
    this.recent.push(clip.id);
    if (this.recent.length > 5) this.recent.shift();
    return clip;
  }
}

export function originalVoiceAsset(): string | null {
  if (typeof __TRAIT_ORIGINAL_AUDIO_ASSET__ !== 'undefined' && __TRAIT_ORIGINAL_AUDIO_ASSET__) return __TRAIT_ORIGINAL_AUDIO_ASSET__;
  if (typeof document === 'undefined') return null;
  try { return new URL('original-voice.wav?v=3', document.baseURI).href; }
  catch { return null; }
}

/** data URLs are decoded locally; a single-file build never fetches its audio. */
export function embeddedAudioBytes(url: string): ArrayBuffer | null {
  if (!url.startsWith('data:')) return null;
  const comma = url.indexOf(',');
  if (comma < 0 || !url.slice(0, comma).includes(';base64')) throw new Error('Unsupported embedded audio.');
  const binary = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export type ClipEnvelope = { values: Float32Array; step: number };

/** RMS of decoded samples, measured in short windows; this never uses a microphone. */
export function measureOriginalEnvelope(buffer: AudioBuffer, clip: OriginalVoiceClip): ClipEnvelope {
  const step = 0.0125;
  const values = new Float32Array(Math.ceil(clip.duration / step));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let peak = 0;
  for (let i = 0; i < values.length; i++) {
    const start = Math.floor((clip.offset + i * step) * buffer.sampleRate);
    const end = Math.min(buffer.length, Math.ceil((clip.offset + Math.min(clip.duration, (i + 1) * step)) * buffer.sampleRate));
    let power = 0;
    for (const channel of channels) for (let sample = start; sample < end; sample++) power += channel[sample] ** 2;
    values[i] = Math.sqrt(power / Math.max(1, (end - start) * channels.length));
    peak = Math.max(peak, values[i]);
  }
  if (peak > 0.00001) for (let i = 0; i < values.length; i++) values[i] = Math.max(0, (values[i] / peak - 0.035) / 0.965);
  return { values, step };
}
