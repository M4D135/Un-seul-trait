/** Replaced by the standalone build with the complete local WAV as a data URL. */
declare const __TRAIT_ORIGINAL_AUDIO_ASSET__: string | undefined;

export type OriginalVoiceClip = { id: string; offset: number; duration: number };

/**
 * Short excerpts from the official Quipos series 100/200 files. Atlas/source
 * timecodes are documented in public/original-voice-manifest.json. These are
 * soundtrack excerpts, not isolated voices or emotion-certified utterances.
 */
export const ORIGINAL_VOICE_CLIPS: readonly OriginalVoiceClip[] = [
  { id: 'reaction-a', offset: 0, duration: 1.18 },
  { id: 'reaction-b', offset: 1.3, duration: 0.84 },
  { id: 'reaction-c', offset: 2.26, duration: 0.66 },
];

export function originalVoiceAsset(): string | null {
  if (typeof __TRAIT_ORIGINAL_AUDIO_ASSET__ !== 'undefined' && __TRAIT_ORIGINAL_AUDIO_ASSET__) return __TRAIT_ORIGINAL_AUDIO_ASSET__;
  if (typeof document === 'undefined') return null;
  try { return new URL('original-voice.wav', document.baseURI).href; }
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
