import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, sessionReferents, sessionRelations } from '../packages/host/corpus.js';
import { admitReading } from '../packages/host/reading.js';
import { readExperienceStream } from '../packages/host/experience-stream.js';

const ENTITY_SPEC = { window: 8, draws: 32, reseeds: 16, minArrivals: 2 };
const event = value => ({ kind: 'text', unit: 'passage', value });

// HELD OUT: written after EOExperienceTrajectory@7 was frozen. This fixture is
// measurement-only. Do not tune the reader against it; a failure is evidence.
const events = [
  event('At the river station, Nora inspected the pump. Elias watched Nora. Nora said the pump worked.\n\n'),
  event('Before dusk, Nora returned to the station. Elias tested the pump. Nora again said the pump worked.\n\n'),
  event('After midnight, Elias said the pump failed. Nora heard the pressure alarm and stopped beside the pump.\n\n'),
  event('At dawn, Elias opened the sensor box. The cracked sensor line caused the alarm. The pump moved water while Nora watched.\n\n'),
];

const text = events.map(x => x.value).join('');
const count = x => Array.isArray(x) ? x.length : 0;

const legacyMeasurement = () => {
  const session = createSession();
  const reading = admitReading(session, {
    sourceId: 'held-out-river-station',
    text,
    strict: false,
  });
  const refs = sessionReferents(session, { sourceId: 'held-out-river-station', limit: Infinity });
  const rels = sessionRelations(session, { sourceId: 'held-out-river-station' });
  return {
    schema: reading.schema,
    historicalSnapshots: 1,
    candidateBeingBoundaryExposed: Boolean(reading.admission),
    referents: count(refs?.referents),
    relations: count(rels?.relations),
    eotTuples: count(reading.eot?.tuples ?? reading.eot),
    reasoningDisposition: reading.reasoning?.disposition ?? null,
    findings: count(reading.reasoning?.findings),
    assemblies: (reading.assemblies ?? []).map(x => `${x.name}:${x.status}`),
  };
};

const constitutiveMeasurement = () => {
  const reading = readExperienceStream({
    sourceId: 'held-out-river-station',
    events,
    entitySpec: ENTITY_SPEC,
  });
  const first = reading.trajectory[0];
  const last = reading.trajectory.at(-1);
  return {
    schema: reading.schema,
    historicalSnapshots: reading.trajectory.length,
    candidateBeingBoundaryExposed: Boolean(first?.admission?.candidates && first?.admission?.beings),
    firstCandidates: count(first?.admission?.candidates),
    firstBeings: count(first?.admission?.beings),
    finalBeings: count(last?.admission?.beings),
    provisionalRelationsByEvent: reading.trajectory.map(x => count(x.fold?.provisional?.links)),
    settledRelationsByEvent: reading.trajectory.map(x => count(x.fold?.links)),
    unresolvedByEvent: reading.trajectory.map(x => count(x.fold?.unresolved)),
    reorganizedByEvent: reading.trajectory.map(x => x.surprise?.reorganized ?? 0),
    surpriseByEvent: reading.trajectory.map(x => x.surprise?.score ?? 0),
    transformationsByEvent: reading.trajectory.map(x => x.surprise?.transformations ?? {}),
    horizonBytes: reading.trajectory.map(x => x.surf?.horizonByteEnd ?? null),
  };
};

test('held-out: frozen constitutive reader is measured against unchanged legacy whole-document reading', () => {
  const legacy = legacyMeasurement();
  const constitutive = constitutiveMeasurement();

  // These are architectural, not fixture-tuned semantic thresholds.
  assert.equal(constitutive.historicalSnapshots, events.length,
    'constitutive reading lost its event-by-event history');
  assert.equal(constitutive.firstBeings, 0,
    'first perception silently became beinghood on unseen material');
  assert.equal(constitutive.candidateBeingBoundaryExposed, true,
    'candidate/being distinction disappeared from the public reading record');
  assert.ok(constitutive.provisionalRelationsByEvent.some(n => n > 0),
    'unseen material produced no provisional relational meaning at all');
  assert.ok(constitutive.reorganizedByEvent.slice(1).some(n => n > 0),
    'later unseen evidence never reorganized the Fold');
  for (let i = 1; i < constitutive.horizonBytes.length; i++) {
    assert.ok(constitutive.horizonBytes[i] > constitutive.horizonBytes[i - 1],
      'reader horizon did not advance monotonically');
  }

  console.log('HELD_OUT_READING_COMPARISON ' + JSON.stringify({ legacy, constitutive }));
});
