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
    language: 'en',
  });
  const first = reading.trajectory[0];
  const last = reading.trajectory.at(-1);
  return {
    reading,
    schema: reading.schema,
    posGiver: reading.languagePriors?.posGiver ?? null,
    historicalSnapshots: reading.trajectory.length,
    candidateBeingBoundaryExposed: Boolean(first?.admission?.candidates && first?.admission?.beings),
    firstCandidates: count(first?.admission?.candidates),
    firstBeings: count(first?.admission?.beings),
    finalBeings: count(last?.admission?.beings),
    provisionalRelationsByEvent: reading.trajectory.map(x => count(x.fold?.provisional?.links)),
    identityAlternativesByEvent: reading.trajectory.map(x => count(x.fold?.identityAlternatives)),
    settledRelationsByEvent: reading.trajectory.map(x => count(x.fold?.links)),
    unresolvedByEvent: reading.trajectory.map(x => count(x.fold?.unresolved)),
    reorganizedByEvent: reading.trajectory.map(x => x.surprise?.reorganized ?? 0),
    surpriseByEvent: reading.trajectory.map(x => x.surprise?.score ?? 0),
    tensionByEvent: reading.trajectory.map(x => x.fold?.tension ?? 0),
    releaseByEvent: reading.trajectory.map(x => x.fold?.release ?? 0),
    transformationsByEvent: reading.trajectory.map(x => x.surprise?.transformations ?? {}),
    horizonBytes: reading.trajectory.map(x => x.surf?.horizonByteEnd ?? null),
  };
};

test('held-out: frozen constitutive reader is measured against unchanged legacy whole-document reading', () => {
  const legacy = legacyMeasurement();
  const constitutive = constitutiveMeasurement();

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

  assert.match(constitutive.posGiver ?? '', /Universal Dependencies UD_English-EWT/,
    'English grammatical structure was not grounded in the received POS prior');

  // Anti-false-green checks added after earlier held-out runs exposed generic
  // token adjacency masquerading as identity and then the adverb "again"
  // masquerading as a relation. Neither is allowed to return.
  assert.ok(constitutive.identityAlternativesByEvent.every(n => n === 0),
    'ordinary adjacency fabricated identity alternatives on held-out prose');
  for (const step of constitutive.reading.trajectory) {
    for (const rel of step.fold.provisional.links ?? []) {
      assert.notEqual(String(rel.object ?? '').trim().toLowerCase(), 'the',
        'bare determiner was emitted as a relation object');
      assert.notEqual(String(rel.relation ?? rel.predicate ?? '').trim().toLowerCase(), 'again',
        'nonverb-dominant connector was emitted as a relation despite the received POS prior');
      assert.ok(Array.isArray(rel.participants), 'canonical provisional relation lost role participants');
    }
  }

  for (let i = 1; i < constitutive.horizonBytes.length; i++) {
    assert.ok(constitutive.horizonBytes[i] > constitutive.horizonBytes[i - 1],
      'reader horizon did not advance monotonically');
  }

  const printable = { ...constitutive };
  delete printable.reading;
  console.log('HELD_OUT_READING_COMPARISON ' + JSON.stringify({ legacy, constitutive: printable }));
});
