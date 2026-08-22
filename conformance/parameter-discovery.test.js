import test from 'node:test';
import assert from 'node:assert/strict';

import { discoverParameters } from '../packages/engine/emergence/parameter-discovery.js';

test('parameter discovery promotes consequence-predictive distinctions, not merely frequent ones', () => {
  const rows = [];
  for (let i = 0; i < 40; i++) {
    const signal = i < 20;
    const noise = i % 2 === 0;
    rows.push({
      distinctions: [
        ...(signal ? [{ address: 'anonymous-a' }] : []),
        ...(noise ? [{ address: 'anonymous-noise' }] : []),
      ],
      outcomes: [signal ? { transform: 'future-x' } : { transform: 'future-y' }],
      provenance: { event: i },
    });
  }

  const result = discoverParameters(rows, { reseeds: 256, seed: 17 });
  assert.equal(result.schema, 'EOParameterDiscovery@1');
  assert.equal(result.parameters.length, 1);
  assert.equal(result.parameters[0].id, 'p0');
  assert.deepEqual(result.parameters[0].sourceDistinction, { address: 'anonymous-a' });
  assert.ok(result.parameters[0].observed > result.parameters[0].null95);
  assert.equal(result.parameters.some(p => p.sourceDistinction?.address === 'anonymous-noise'), false);
});

test('parameter discovery does not invent dimensions when future transformations are unchanged', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({
    distinctions: i % 2 ? [{ address: 'alternating' }] : [],
    outcomes: [{ transform: 'same-future' }],
    provenance: { event: i },
  }));
  const result = discoverParameters(rows, { reseeds: 128, seed: 9 });
  assert.equal(result.parameters.length, 0);
});
