import test from 'node:test';
import assert from 'node:assert/strict';
import { readExperienceStream } from '../packages/host/index.js';

const e = (value, start, end) => ({ kind: 'text', unit: 'passage', value, start, end });

test('trajectory: later revelation cannot leak into an earlier Fold', () => {
  const first = e('Alice said Bob is the keeper. Bob guards the gate.\n\n', 0, 51);
  const reveal = e('Alice said Bob is not the keeper. Carol guards the gate.\n\n', 51, 108);

  const prefixOnly = readExperienceStream({ sourceId: 'blind', events: [first] });
  const full = readExperienceStream({ sourceId: 'blind', events: [first, reveal] });

  // Gold invariant: Fold_1 is identical whether or not the caller possesses
  // future material. This is stronger than checking final assertion counts.
  assert.deepEqual(full.trajectory[0], prefixOnly.trajectory[0]);
  assert.equal(full.trajectory[0].surf.horizonByteEnd, Buffer.byteLength(first.value));
  assert.equal(full.trajectory[1].surf.horizonByteEnd, Buffer.byteLength(first.value + reveal.value));
});

test('trajectory: disruptive evidence is experienced as reorganization', () => {
  const events = [
    e('Alice said Bob is the keeper. Bob guards the gate.\n\n', 0, 51),
    e('Alice said Bob is not the keeper. Carol guards the gate.\n\n', 51, 108),
  ];
  const reading = readExperienceStream({ sourceId: 'change', events });
  assert.equal(reading.eventCount, 2);
  assert.ok(reading.trajectory[1].delta.reorganized > 0);
  assert.ok(reading.trajectory[1].delta.surprise > 0);
  assert.ok(reading.trajectory[1].fold.cursor.byteEnd >= reading.trajectory[0].fold.cursor.byteEnd);
});

test('trajectory: ambiguity/contestation is state, not a forced boolean', () => {
  const events = [
    e('Mara is the guide.\n\n', 0, 20),
    e('Mara is not the guide.\n\n', 20, 44),
  ];
  const reading = readExperienceStream({ sourceId: 'ambiguity', events });
  const last = reading.trajectory.at(-1);
  assert.ok(last.perturbation.links.some(x => x.disposition !== 'survives') || last.fold.unresolved.length > 0);
});
