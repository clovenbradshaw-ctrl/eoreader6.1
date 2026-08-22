import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readExperienceStream, readExperienceStreamIncremental } from '../packages/host/index.js';

const golden = JSON.parse(fs.readFileSync(new URL('../goldens/reading/meaningful-trajectory.json', import.meta.url), 'utf8'));
const norm = x => String(x ?? '').toLowerCase();
const events = golden.events.map((g, i) => ({ kind:'text', unit:'passage', value:g.text, start:i, end:undefined }));

function hasMeaning(step, expected) {
  return step.fold.links.some(({ assertion }) => {
    const subject = norm(assertion.subject);
    const predicate = norm(assertion.predicate);
    const object = norm(assertion.object);
    return subject.includes(norm(expected.subjectContains)) &&
      predicate.includes(norm(expected.predicateContains)) &&
      object.includes(norm(expected.objectContains)) &&
      (!expected.polarity || norm(assertion.polarity) === norm(expected.polarity));
  });
}

function audit(name, reader) {
  test(`${name}: hand-audited golden extracts relational meaning, not merely cast`, () => {
    const reading = reader({ sourceId:`semantic-${name}`, events });
    assert.equal(reading.trajectory.length, golden.events.length);

    for (let i=0; i<golden.events.length; i++) {
      const expected = golden.events[i].expect;
      const step = reading.trajectory[i];
      const castText = step.fold.cast.flatMap(x => [x.display, ...(x.surfaces ?? [])]).map(norm);

      for (const wanted of expected.castSurfaces ?? []) {
        assert.ok(castText.some(x => x.includes(norm(wanted))), `event ${i}: expected cast surface ${wanted}`);
      }
      for (const forbidden of expected.mustNotTreatAsCast ?? []) {
        assert.ok(!castText.some(x => x === norm(forbidden)), `event ${i}: ${forbidden} was admitted as cast`);
      }
      for (const meaning of expected.meaning ?? []) {
        assert.ok(hasMeaning(step, meaning), `event ${i}: missing semantic relation ${JSON.stringify(meaning)}; cast=${JSON.stringify(step.fold.cast.map(x=>x.display))}; links=${JSON.stringify(step.fold.links.map(x=>x.assertion))}`);
      }
      if (expected.requiresPerturbation) {
        assert.ok(step.fold.unresolved.length > 0 || step.fold.links.some(x => x.disposition !== 'survives'), `event ${i}: contradiction/revision produced no perturbation`);
      }
      if (expected.requiresReorganization) {
        assert.ok(step.delta.reorganized > 0 && step.delta.surprise > 0, `event ${i}: causal revision produced no structural surprise`);
      }

      // Anti-cast-list invariant: once the golden expects relational meaning,
      // a nonempty cast with zero links is a failure, not partial success.
      if ((expected.meaning ?? []).length) {
        assert.ok(step.fold.links.length > 0, `event ${i}: reader returned cast but no semantic links`);
      }
    }
  });
}

audit('prefix-oracle', readExperienceStream);
audit('incremental', readExperienceStreamIncremental);
