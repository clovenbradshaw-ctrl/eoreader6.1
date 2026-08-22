import test from 'node:test';
import assert from 'node:assert/strict';

import { observeTextStructure } from '../packages/engine/perceiver/text/structural-observations.js';

const observe = text => observeTextStructure({
  text,
  eventIndex: 0,
  language: 'en',
  surf: {
    sentences: [{ text }],
    candidates: [],
  },
});

test('English identity perception abstains on ordinary determiner phrases', () => {
  const negatives = [
    'We reached the town of Lucerne before dusk.',
    'They remembered the pleasant climate of Italy.',
    'After a long time I returned home.',
    'The result was that Elizabeth remained with us.',
  ];

  for (const text of negatives) {
    assert.deepEqual(observe(text).identitySupports, [], `must not infer identity from: ${text}`);
  }
});

test('English identity perception can nominate explicitly delimited apposition', () => {
  const result = observe('We consulted the professor, Waldman, before leaving.');
  assert.ok(result.identitySupports.some(x =>
    x.left === 'professor' && x.right === 'waldman' && x.evidence?.kind === 'text_appositional_shape'
  ));
});
