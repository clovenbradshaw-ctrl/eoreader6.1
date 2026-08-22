import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readExperienceStream, readExperienceStreamIncremental } from '../packages/host/index.js';

const golden = JSON.parse(fs.readFileSync(new URL('../goldens/reading/meaningful-trajectory.json', import.meta.url), 'utf8'));
const norm = x => String(x ?? '').toLowerCase();
const events = golden.events.map((g, i) => ({ kind:'text', unit:'passage', value:g.text, start:i, end:undefined }));
const ENTITY_SPEC = { window:8, draws:32, reseeds:16, minArrivals:2 };

function surfaceText(xs) {
  return xs.flatMap(x => [x.display, ...(x.surfaces ?? [])]).filter(Boolean).map(norm);
}

function audit(name, reader) {
  test(`${name}: hand-audited golden keeps perception distinct from beinghood`, () => {
    const reading = reader({ sourceId:`semantic-${name}`, events, entitySpec:ENTITY_SPEC });
    assert.equal(reading.trajectory.length, golden.events.length);

    for (let i=0; i<golden.events.length; i++) {
      const expected = golden.events[i].expect;
      const step = reading.trajectory[i];
      const candidates = surfaceText(step.admission.candidates);
      const beings = step.admission.beings.flatMap(x => x.surfaces ?? []).map(norm);

      for (const wanted of expected.candidateSurfaces ?? []) {
        assert.ok(candidates.some(x => x.includes(norm(wanted))), `event ${i}: expected perceived candidate ${wanted}`);
      }
      for (const wanted of expected.beingSurfaces ?? []) {
        assert.ok(beings.some(x => x.includes(norm(wanted))), `event ${i}: expected admitted being ${wanted}`);
      }
      for (const forbidden of expected.mustNotTreatAsBeing ?? []) {
        assert.ok(!beings.some(x => x === norm(forbidden)), `event ${i}: ${forbidden} was admitted as a being`);
      }

      // The Fold is downstream of admission. Every cast member in it must be
      // backed by at least one currently admitted witnessed surface.
      for (const c of step.fold.cast) {
        assert.ok((c.surfaces ?? []).some(s => beings.includes(norm(s))), `event ${i}: Fold contains unadmitted cast member ${c.display}`);
      }

      if (expected.requiresPerturbationWhenAdmitted && step.fold.cast.length) {
        assert.ok(step.fold.unresolved.length > 0 || step.fold.links.some(x => x.disposition !== 'survives'), `event ${i}: admitted contradiction/revision produced no perturbation`);
      }
      if (expected.requiresReorganizationWhenAdmitted && step.fold.cast.length) {
        assert.ok(step.delta.reorganized > 0 || step.admission.lapsedThisEvent > 0, `event ${i}: admitted causal revision produced no structural change`);
      }
    }
  });
}

audit('prefix-oracle', readExperienceStream);
audit('incremental', readExperienceStreamIncremental);
