import test from 'node:test';
import assert from 'node:assert/strict';
import { openExperienceReading, advanceReading, readExperienceStream } from '../packages/host/index.js';

const ENTITY_SPEC = { window: 8, draws: 16, reseeds: 8, minArrivals: 2 };
const e = value => ({ kind: 'text', unit: 'passage', value });
const read = (sourceId, events) => readExperienceStream({ sourceId, events, entitySpec: ENTITY_SPEC });
const bytes = s => new TextEncoder().encode(s).length;

test('trajectory: changing future material cannot alter an earlier Fold', () => {
  const first = e('Inside the yard, Alice saw Bob beside the gate.\n\n');
  const futureA = e('Later, Alice learned that Bob had never been the keeper.\n\n');
  const futureB = e('Later, Alice learned that Bob had owned the gate for years.\n\n');

  const prefix = read('blind', [first]);
  const a = read('blind', [first, futureA]);
  const b = read('blind', [first, futureB]);
  assert.deepEqual(a.trajectory[0], prefix.trajectory[0]);
  assert.deepEqual(b.trajectory[0], prefix.trajectory[0]);
});

test('trajectory: the live transition sees one event and advances absolute horizon coordinates', () => {
  const first = e('Inside the yard, Alice saw Bob beside the gate.\n\n');
  const second = e('Near the wall, Bob spoke while Alice listened.\n\n');
  const state = openExperienceReading({ sourceId: 'live-blind', entitySpec: ENTITY_SPEC });

  const t0 = advanceReading(state, first);
  const frozenT0 = structuredClone(t0);
  assert.equal(state.eventIndex, 1);
  assert.equal(t0.surf.admission.byteStart, 0);
  assert.equal(t0.surf.admission.byteEnd, bytes(first.value));
  assert.equal(t0.surf.horizonByteEnd, bytes(first.value));
  assert.equal(state.horizon.documents.get('live-blind').text, first.value);

  const t1 = advanceReading(state, second);
  assert.deepEqual(t0, frozenT0, 'later experience mutated the already-committed prior transition');
  assert.equal(state.eventIndex, 2);
  assert.equal(t1.surf.admission.byteStart, bytes(first.value));
  assert.equal(t1.surf.admission.byteEnd, bytes(first.value + second.value));
  assert.equal(state.horizon.documents.get('live-blind').text, first.value + second.value);
});

test('trajectory: a perceived candidate is not silently promoted to a being', () => {
  const reading = read('candidate-not-being', [e('Inside the observatory, Mara checked the brass door.\n\n')]);
  const step = reading.trajectory[0];
  assert.ok(
    step.surf.perception.candidates.some(x => (x.surfaces ?? []).some(s => /mara/i.test(s))),
    'Mara should be perceptible at Surf before document-scale referent projection',
  );
  assert.equal(step.admission.beings.length, 0, 'one encounter does not earn beinghood');
  assert.equal(step.fold.cast.length, 0, 'Fold must not confuse candidate surfaces with admitted beings');
});

test('trajectory: appending event n cannot rewrite snapshots before n', () => {
  const events = [
    e('Inside the yard, Alice saw Bob beside the gate.\n\n'),
    e('Near the wall, Bob spoke while Alice listened.\n\n'),
    e('At noon, Alice returned and Bob remained nearby.\n\n'),
  ];
  const prefix = read('append-blind', events.slice(0, 2));
  const full = read('append-blind', events);
  assert.deepEqual(full.trajectory.slice(0, 2), prefix.trajectory);
});
