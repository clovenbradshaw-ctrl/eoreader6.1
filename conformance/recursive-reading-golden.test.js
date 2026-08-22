import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readExperienceStream } from '../packages/host/index.js';

const golden = JSON.parse(fs.readFileSync(new URL('../goldens/reading/recursive-identity.json', import.meta.url), 'utf8'));
const events = golden.events.map((g, i) => ({ kind:'text', unit:'passage', value:g.text, start:i, end:undefined }));
const norm = x => String(x ?? '').toLowerCase();
const read = sourceId => readExperienceStream({ sourceId, events, entitySpec:golden.entitySpec, language:'en' });

const candidateText = step => step.admission.candidates.flatMap(x => [x.display, ...(x.surfaces ?? [])]).map(norm);
const hasCandidate = (step, wanted) => candidateText(step).some(x => x.includes(norm(wanted)));

test('recursive golden: perception reaches ontology before document-scale cast projection', () => {
  const reading = read('recursive-golden');
  for (let i=0; i<golden.events.length; i++) {
    for (const wanted of golden.events[i].expect.perceive ?? []) {
      assert.ok(hasCandidate(reading.trajectory[i], wanted), `event ${i}: Surf failed to perceive ${wanted}; event-local perception must precede referent admission`);
    }
  }
});

test('recursive golden: trajectory exposes identity alternatives and applied EO acts', () => {
  const reading = read('recursive-ontology');
  const collision = reading.trajectory[2];
  assert.ok(Array.isArray(collision.fold.identityAlternatives), 'Fold lacks identityAlternatives state');
  assert.ok(Array.isArray(collision.iterations), 'transition lacks recursive reasoning iterations');
  const acts = collision.iterations.flatMap(x => x.acts ?? []).map(x => x.op ?? x);
  assert.ok(acts.includes('SEG'), 'simultaneous Rowan/courier evidence did not SEG the identity hypothesis');
  assert.ok(acts.includes('DEF'), 'defeated Rowan=courier hypothesis was not explicitly refused');
});

test('recursive golden: a reasoner-created identity obligation accumulates tension and releases on resolution', () => {
  const reading = read('recursive-frontier');
  const opened = reading.trajectory[0];
  const carried = reading.trajectory[1];
  const collision = reading.trajectory[2];

  assert.ok(opened.frontier.delta.opened.some(x => x.kind === 'identity_alternative'),
    'live Rowan/courier identity did not open an experiential obligation');
  assert.ok(opened.fold.tension > 0, 'open identity alternative produced no tension');
  assert.ok(carried.fold.tension > opened.fold.tension,
    'unresolved identity did not accumulate pressure while carried forward');
  assert.ok(collision.frontier.delta.resolved.some(x => x.kind === 'identity_alternative'),
    'SEG/DEF did not close the prior identity obligation');
  assert.ok(collision.fold.release > 0, 'closing the carried identity produced no release');
});

test('recursive golden: ontology revision re-canonicalizes affected relations before Fold commit', () => {
  const reading = read('recursive-recanonicalize');
  const collision = reading.trajectory[2];
  assert.ok(collision.surprise?.transformations, 'transition lacks transformation-ledger surprise');
  assert.ok((collision.surprise.transformations.identitySplits ?? []).length > 0, 'identity split absent from structural surprise');
  assert.ok((collision.surprise.transformations.relationRecanonicalizations ?? []).length > 0, 'relations were not re-canonicalized after ontology changed');
});

test('recursive golden: changing the revelation cannot rewrite pre-revelation experience', () => {
  const original = read('recursive-blind');
  const changed = [...events];
  changed[3] = { ...changed[3], value:'Nera then learned that the courier was Tovan, while Rowan remained beside the fountain.\n\n' };
  const counterfactual = readExperienceStream({ sourceId:'recursive-blind', events:changed, entitySpec:golden.entitySpec, language:'en' });
  assert.deepEqual(counterfactual.trajectory.slice(0,3), original.trajectory.slice(0,3));
});
