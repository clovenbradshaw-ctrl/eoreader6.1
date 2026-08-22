import fs from 'node:fs';
import { decodeWav } from '../../packages/engine/perceiver/audio/wav.js';
import { buildAudioReading } from '../../packages/engine/perceiver/audio/reading.js';
import { surf } from '../../packages/engine/loops/surf.js';
import { frontierFromSurf } from '../../packages/host/frontier-surf.js';
import { isGap } from '../../nul/index.js';

const path = process.argv[2];
if (!path) throw new Error('usage: node scripts/eval/wagner-audio-frontier.mjs <mono-or-multichannel.wav>');

const bytes = fs.readFileSync(path);
const wav = decodeWav(bytes);
const audio = await buildAudioReading({
  channelData: wav.channelData,
  sampleRate: wav.sampleRate,
  sourceBytes: bytes,
  perceiver: { id: 'audio-field-vectors:wagner-external-eval' },
});

// Keep the evaluation at the structure-neutral level. RMS is a direct field
// channel, not a musical label. Other independent channels can later ride the
// same frontier and disagree, following surf-structural.js's plural-witness
// discipline instead of being fused into a hand-weighted score.
const rms = audio.units.map(u => u.field.at(-1));
const ride = surf({
  material: rms,
  window: 24,
  draws: 96,
  hop: 4,
  seed: 11,
  perturbation: 'shuffle',
});
if (isGap(ride)) throw new Error(`Wagner Surf gap: ${JSON.stringify(ride)}`);

const frontier = frontierFromSurf(ride, {
  terrain: 'Field',
  kind: 'audio_continuation_break',
});
const peaks = frontier.trace
  .map(x => ({
    atFrame: x.at,
    seconds: audio.units[x.at]?.pos ?? null,
    outcome: x.outcome,
    tension: x.frontier.tension,
    release: x.frontier.release,
    open: x.frontier.open.length,
  }))
  .filter(x => x.tension > 0 || x.release > 0)
  .sort((a, b) => Math.max(b.tension, b.release) - Math.max(a.tension, a.release))
  .slice(0, 20);

const result = {
  schema: 'EOWagnerAudioFrontierEval@1',
  input: {
    sampleRate: wav.sampleRate,
    channels: wav.channels,
    bitDepth: wav.bitDepth,
    seconds: audio.axis.extent,
    frames: audio.units.length,
  },
  surf: {
    met: ride.met,
    broke: ride.broke,
    flat: ride.flat,
    horizon: ride.horizon.length,
    spec: ride.spec,
  },
  frontier: {
    openings: frontier.trace.reduce((n, x) => n + x.frontier.delta.opened.length, 0),
    resolutions: frontier.trace.reduce((n, x) => n + x.frontier.delta.resolved.length, 0),
    peakTension: Math.max(0, ...frontier.trace.map(x => x.frontier.tension)),
    peakRelease: Math.max(0, ...frontier.trace.map(x => x.frontier.release)),
    finalOpen: frontier.final?.open.length ?? 0,
    peaks,
  },
  disclaimers: [
    'No transcript, libretto, score, chord label, leitmotif label, or language prior was supplied.',
    'This proves modality-neutral structural tension/release, not that EOReader yet understands Wagnerian dramatic or harmonic semantics.',
    'RMS is one witness. Chroma, timbre, structural revision, and their disagreement should be added as independent witnesses rather than fused by an arbitrary weight.',
  ],
};

console.log(JSON.stringify(result, null, 2));
