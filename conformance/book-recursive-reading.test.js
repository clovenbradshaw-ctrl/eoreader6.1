import test from 'node:test';
import assert from 'node:assert/strict';

import { openBookReading, advanceBookReading } from '../packages/host/book-reading.js';

const ENTITY_SPEC = { window: 8, draws: 16, reseeds: 8, minArrivals: 2 };
const event = value => ({ kind: 'text', unit: 'passage', value });
const EVENTS = [
  event('Near the west arch, Nera watched a hooded courier place a blue token on the table. Later that hour, Nera called the courier Rowan.\n\n'),
  event('Before sunset, Rowan returned to Nera and spoke about the blue token. Nera again referred to the hooded courier as Rowan.\n\n'),
  event('At the next bell, Nera stood beside Rowan at the fountain while the hooded courier crossed the west arch behind them carrying another blue token.\n\n'),
  event('Nera then learned that the courier was Iven, who had carried both blue tokens while Rowan had remained with her at the fountain.\n\n'),
];

test('book reader opens consequence-bearing deeper work, reopens exact evidence, and closes resolved work', () => {
  const book = openBookReading({
    sourceId: 'book-recursive-task',
    language: 'en',
    entitySpec: ENTITY_SPEC,
  });

  const first = advanceBookReading(book, EVENTS[0], { executeTopTasks: 2 });
  const identityTask = first.tasks.open.find(t => t.kind === 'resolve_identity');
  assert.ok(identityTask, 'difference-making identity alternative should open deeper reading');
  assert.ok(identityTask.consequences.some(x => x.type === 'ontology_cardinality'));

  const evidenceRun = first.executed.find(x => x.taskId === identityTask.id);
  assert.ok(evidenceRun, 'top deeper task should execute against the already-read horizon');
  assert.ok(evidenceRun.evidence.length > 0, 'deeper reading must reopen source evidence rather than emit an answer');
  for (const evidence of evidenceRun.evidence) {
    assert.ok(Number.isFinite(evidence.byteStart));
    assert.ok(Number.isFinite(evidence.byteEnd));
    assert.ok(evidence.byteEnd > evidence.byteStart);
    assert.equal(typeof evidence.text, 'string');
    assert.ok(evidence.text.length > 0);
  }

  advanceBookReading(book, EVENTS[1], { executeTopTasks: 1 });
  const collision = advanceBookReading(book, EVENTS[2], { executeTopTasks: 1 });
  assert.ok(collision.tasks.delta.closed.some(t => t.id === identityTask.id),
    'once the Fold resolves the identity distinction, its deeper-reading task should close');

  const stored = book.tasks.tasks.get(identityTask.id);
  assert.equal(stored.status, 'closed');
  assert.equal(stored.openedAt, 0);
  assert.equal(stored.closedAt, 2);
  assert.ok(stored.witnesses.length >= 1, 'closed task must preserve its provenance history');

  advanceBookReading(book, EVENTS[3], { executeTopTasks: 1 });
  assert.equal(book.tasks.tasks.get(identityTask.id).status, 'closed',
    'later reinterpretation must not resurrect a resolved Rowan/courier task unless it becomes difference-making again');
});
