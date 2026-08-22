import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenFrontier, advanceFrontier } from '../packages/host/frontier.js';

const blank = { identityAlternatives: [] };
const none = { links: [] };

// No text, tokens, words, names, grammatical roles, or language priors occur
// anywhere in this test. The shape is equally available to audio emergence,
// a time series, a video motion field, or text reasoning.
test('frontier: a purely structural expectation can accumulate tension and release', () => {
  const frontier = createOpenFrontier();
  const expectedReturn = {
    id: 'pattern:A:return',
    terrain: 'Field',
    kind: 'expected_continuation',
    subject: { pattern: 'A', continuation: 'return' },
    standing: 'open',
    expectation: { recurrenceOf: 'A' },
    provenance: [{ event: 0, channel: 'field-vector-pattern' }],
    pressure: 2,
  };

  const t0 = advanceFrontier(frontier, {
    eventIndex: 0,
    recursive: blank,
    perturbation: none,
    obligations: [expectedReturn],
  });
  const t1 = advanceFrontier(frontier, {
    eventIndex: 1,
    recursive: blank,
    perturbation: none,
    obligations: [expectedReturn],
  });
  const t2 = advanceFrontier(frontier, {
    eventIndex: 2,
    recursive: blank,
    perturbation: none,
    obligations: [expectedReturn],
  });
  const t3 = advanceFrontier(frontier, {
    eventIndex: 3,
    recursive: blank,
    perturbation: none,
    obligations: [],
  });

  assert.equal(t0.delta.opened.length, 1);
  assert.equal(t0.release, 0);
  assert.ok(t1.tension > t0.tension, 'persistent unresolved structure should accumulate pressure');
  assert.ok(t2.tension > t1.tension, 'tension should continue while the obligation remains open');
  assert.equal(t3.open.length, 0);
  assert.equal(t3.delta.resolved.length, 1);
  assert.ok(t3.release > 0, 'closing carried structure should produce release');
});

test('frontier: identity tension is only one source among arbitrary modality obligations', () => {
  const frontier = createOpenFrontier();
  const state = advanceFrontier(frontier, {
    eventIndex: 0,
    recursive: {
      identityAlternatives: [{ id: 'x-y', standing: 'consistent', history: [] }],
    },
    perturbation: none,
    obligations: [{
      id: 'spectral-regime-return',
      terrain: 'Field',
      kind: 'expected_continuation',
      standing: 'open',
      pressure: 1,
    }],
  });

  assert.equal(state.open.length, 2);
  assert.ok(state.open.some(x => x.kind === 'identity_alternative'));
  assert.ok(state.open.some(x => x.kind === 'expected_continuation'));
});
