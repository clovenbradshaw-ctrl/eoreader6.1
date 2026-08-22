import test from 'node:test';
import assert from 'node:assert/strict';

import { identityDifference, hyperlexiconDifference, differenceMakingHops } from '../packages/host/difference-gate.js';
import { createReadingTaskLedger, advanceReadingTasks } from '../packages/host/reading-tasks.js';

const relation = (id, a, b) => ({ id, participants: [{ role: 'x', value: a }, { role: 'y', value: b }] });

test('identity ambiguity earns deeper work only when it changes downstream structure', () => {
  const idle = identityDifference({ left: 'mask', right: 'Mara' }, { provisionalLinks: [] });
  // Cardinality itself is a structural consequence: same vs distinct changes
  // what exists in the Fold, so this remains a real distinction even before a
  // relation happens to touch it.
  assert.equal(idle.makesDifference, true);
  assert.ok(idle.consequences.some(x => x.type === 'ontology_cardinality'));

  const linked = identityDifference({ left: 'mask', right: 'Mara' }, {
    provisionalLinks: [{ id: 'r1', relation: 'carried', participants: [{ role: 'actor', value: 'mask' }, { role: 'theme', value: 'key' }] }],
  });
  assert.ok(linked.consequences.some(x => x.type === 'relation_canonicalisation' && x.relationId === 'r1'));
});

test('Hyperlexicon recurrence alone does not earn a task unless a derivation is actually blocked', () => {
  const candidate = { left: 'parent_of', right: 'parent_of', witnesses: [['a','b'],['c','d']] };
  assert.equal(hyperlexiconDifference(candidate, []).makesDifference, false);
  const blocked = hyperlexiconDifference(candidate, [{
    leftPredicate: 'parent_of', rightPredicate: 'parent_of', bridge: 'b', from: 'a', to: 'c', tupleIds: ['a','b'], standing: 'candidate',
  }]);
  assert.equal(blocked.makesDifference, true);
});

test('node hopping crosses only relations whose removal destroys consequence reachability', () => {
  const hops = differenceMakingHops({
    relations: [relation('r-ab', 'a', 'b'), relation('r-bc', 'b', 'c'), relation('r-ad', 'a', 'd')],
    from: 'a',
    targets: ['c'],
  });
  assert.deepEqual(hops.map(x => x.relationId), ['r-ab']);
});

test('task ledger stores the named downstream consequences rather than a salience score', () => {
  const ledger = createReadingTaskLedger();
  const state = advanceReadingTasks(ledger, {
    eventIndex: 2,
    byteStart: 100,
    byteEnd: 180,
    recursive: {
      identityAlternatives: [{ id: 'identity:mask-mara', left: 'mask', right: 'Mara', standing: 'consistent', history: [] }],
      provisionalLinks: [{ id: 'r1', relation: 'carried', participants: [{ role: 'actor', value: 'mask' }, { role: 'theme', value: 'key' }] }],
    },
    frontier: { open: [] },
  });
  assert.equal(state.open.length, 1);
  assert.equal(state.open[0].kind, 'resolve_identity');
  assert.ok(state.open[0].consequences.some(x => x.type === 'relation_canonicalisation'));
  assert.equal('priority' in state.open[0], false, 'no arbitrary scalar priority should substitute for consequence structure');
});
