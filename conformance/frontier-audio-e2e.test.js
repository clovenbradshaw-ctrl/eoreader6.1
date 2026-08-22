import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAudioReading } from '../packages/engine/perceiver/audio/reading.js';
import { surf } from '../packages/engine/loops/surf.js';
import { frontierFromSurf } from '../packages/host/frontier-surf.js';
import { isGap } from '../nul/index.js';

const SR = 22050;

const tone = ({ seconds, hz, amplitude, phase = 0 }) => {
  const n = Math.floor(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const slow = 1 + 0.04 * Math.sin((2 * Math.PI * i) / (SR * 0.37));
    out[i] = amplitude * slow * Math.sin(phase + (2 * Math.PI * hz * i) / SR);
  }
  return out;
};

const concat = parts => {
  const total = parts.reduce((n, x) => n + x.length, 0);
  const out = new Float32Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
};

test('audio E2E: PCM alone can open and release structural frontier pressure', async () => {
  // Stable field -> pronounced departure -> return. There is intentionally no
  // transcript, libretto, note name, chord label, motif label, or language.
  const pcm = concat([
    tone({ seconds: 2.2, hz: 220, amplitude: 0.20 }),
    tone({ seconds: 0.8, hz: 415, amplitude: 0.80 }),
    tone({ seconds: 2.2, hz: 220, amplitude: 0.20, phase: 0.3 }),
  ]);

  const audio = await buildAudioReading({
    channelData: [pcm],
    sampleRate: SR,
  });
  assert.equal(audio.medium, 'audio');
  assert.ok(audio.units.length > 20);

  // RMS is the last spectral-moment dimension. It is not music semantics; it
  // is one directly perceived field channel from the real audio organ.
  const rms = audio.units.map(u => u.field.at(-1));
  const ride = surf({
    material: rms,
    window: 8,
    draws: 64,
    hop: 1,
    seed: 7,
    perturbation: 'shuffle',
  });
  assert.equal(isGap(ride), false, 'audio field did not produce a causal Surf horizon');
  assert.ok(ride.broke > 0, 'the audio departure never broke the learned horizon');
  assert.ok(ride.met > 0, 'the audio ride never returned to placeable experience');

  const frontier = frontierFromSurf(ride, {
    terrain: 'Field',
    kind: 'audio_continuation_break',
  });
  const opened = frontier.trace.flatMap(x => x.frontier.delta.opened);
  const resolved = frontier.trace.flatMap(x => x.frontier.delta.resolved);

  assert.ok(opened.length > 0, 'audio structure never opened an obligation');
  assert.ok(resolved.length > 0, 'later audio structure never released an obligation');
  assert.ok(frontier.trace.some(x => x.frontier.tension > 0), 'audio produced no carried tension');
  assert.ok(frontier.trace.some(x => x.frontier.release > 0), 'audio produced no release');
});
