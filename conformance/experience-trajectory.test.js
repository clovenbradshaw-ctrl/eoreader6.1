import test from 'node:test';
import assert from 'node:assert/strict';
import { readExperienceStream, readExperienceStreamIncremental } from '../packages/host/index.js';

const ENTITY_SPEC = { window: 8, draws: 16, reseeds: 8, minArrivals: 2 };
const e = (value, start, end) => ({ kind: 'text', unit: 'passage', value, start, end });
const semanticTrajectory = reading => reading.trajectory.map(({ surf, admission, perturbation, fold, delta }) => ({ surf, admission, perturbation, fold, delta }));
const read = (reader, sourceId, events) => reader({ sourceId, events, entitySpec: ENTITY_SPEC });

test('trajectory: later revelation cannot leak into an earlier Fold', () => {
  const first = e('Inside the yard, Alice saw Bob beside the gate.\n\n', 0, 49);
  const reveal = e('Later, Alice learned that Bob had never been the keeper.\n\n', 49, 106);

  const prefixOnly = read(readExperienceStream, 'blind', [first]);
  const full = read(readExperienceStream, 'blind', [first, reveal]);

  assert.deepEqual(full.trajectory[0], prefixOnly.trajectory[0]);
  assert.equal(full.trajectory[0].surf.horizonByteEnd, Buffer.byteLength(first.value));
  assert.equal(full.trajectory[1].surf.horizonByteEnd, Buffer.byteLength(first.value + reveal.value));
});

test('trajectory: a perceived candidate is not silently promoted to a being', () => {
  const event = e('Inside the observatory, Mara checked the brass door.\n\n', 0, 52);
  const reading = read(readExperienceStream, 'candidate-not-being', [event]);
  const step = reading.trajectory[0];
  assert.ok(step.tentative.cast.some(x => (x.surfaces ?? []).some(s => /mara/i.test(s))), 'Mara should be perceptible as a candidate');
  assert.equal(step.admission.beings.length, 0, 'one encounter does not earn beinghood');
  assert.equal(step.fold.cast.length, 0, 'Fold must not confuse candidate surfaces with admitted beings');
});

test('trajectory: persistent incremental reader is semantically identical to prefix oracle', () => {
  const events = [
    e('Inside the yard, Alice saw Bob beside the gate.\n\n', 0, 49),
    e('Near the wall, Bob spoke while Alice listened.\n\n', 49, 96),
    e('At noon, Alice returned and Bob remained nearby.\n\n', 96, 145),
    e('Before dusk, Bob left while Alice stayed behind.\n\n', 145, 195),
  ];
  const oracle = read(readExperienceStream, 'equivalence', events);
  const incremental = read(readExperienceStreamIncremental, 'equivalence', events);
  assert.deepEqual(semanticTrajectory(incremental), semanticTrajectory(oracle));
});

test('trajectory: incremental reader cannot know event n before event n arrives', () => {
  const first = e('Inside the hall, Mara watched the doorway.\n\n', 0, 43);
  const reveal = e('At dawn, Mara learned the doorway had never been locked.\n\n', 43, 99);
  const prefix = read(readExperienceStreamIncremental, 'incremental-blind', [first]);
  const full = read(readExperienceStreamIncremental, 'incremental-blind', [first, reveal]);
  assert.deepEqual(full.trajectory[0], prefix.trajectory[0]);
});
