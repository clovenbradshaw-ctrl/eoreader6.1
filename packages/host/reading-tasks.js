// Recursive deeper-reading task scheduler.
//
// Reading is not a fixed sequence of extractive passes. The Fold itself opens
// work, but unresolved structure is NOT sufficient to earn work. A task exists
// only when the alternatives make a counterfactual difference downstream.

import { identityDifference, frontierDifference, hyperlexiconDifference } from './difference-gate.js';

const freeze = x => Object.freeze(x);
const stable = x => typeof x === 'string' ? x : JSON.stringify(x);

export const READING_TASK_LEDGER_SCHEMA = 'EOReadingTaskLedger@3';

export function createReadingTaskLedger() {
  return {
    schema: READING_TASK_LEDGER_SCHEMA,
    tasks: new Map(),
    history: [],
  };
}

const taskId = (kind, target) => `${kind}:${stable(target)}`;

const upsert = (ledger, spec, eventIndex) => {
  const id = spec.id ?? taskId(spec.kind, spec.target);
  const current = ledger.tasks.get(id);
  if (current?.status === 'open') {
    current.lastTriggeredAt = eventIndex;
    current.triggers = [...current.triggers, spec.trigger];
    current.witnesses = [...current.witnesses, ...(spec.witnesses ?? [])];
    current.consequences = [...new Map([
      ...(current.consequences ?? []).map(x => [stable(x), x]),
      ...(spec.consequences ?? []).map(x => [stable(x), x]),
    ]).values()];
    return { type: 'persisted', task: { ...current } };
  }
  const task = {
    id,
    kind: spec.kind,
    target: spec.target,
    status: 'open',
    openedAt: eventIndex,
    lastTriggeredAt: eventIndex,
    trigger: spec.trigger,
    triggers: [spec.trigger],
    witnesses: [...(spec.witnesses ?? [])],
    consequences: [...(spec.consequences ?? [])],
    query: spec.query ?? null,
    closure: spec.closure ?? null,
    terrain: spec.terrain ?? null,
  };
  ledger.tasks.set(id, task);
  return { type: 'opened', task: { ...task } };
};

export function closeReadingTask(ledger, id, { eventIndex, reason, witnesses = [] } = {}) {
  const task = ledger.tasks.get(id);
  if (!task || task.status !== 'open') return null;
  task.status = 'closed';
  task.closedAt = eventIndex;
  task.closeReason = reason ?? 'resolved_by_fold';
  task.witnesses = [...task.witnesses, ...witnesses];
  return freeze({ ...task, witnesses: freeze([...task.witnesses]) });
}

const identityTasks = ({ recursive, eventIndex, byteStart, byteEnd }) => {
  const out = [];
  for (const identity of recursive?.identityAlternatives ?? []) {
    if (identity.standing === 'distinct') continue;
    const difference = identityDifference(identity, recursive);
    if (!difference.makesDifference) continue;
    out.push({
      kind: 'resolve_identity',
      terrain: 'Entity',
      target: identity.id,
      trigger: { type: 'identity_alternative', standing: identity.standing, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, history: identity.history ?? [] }],
      consequences: difference.consequences,
      query: { identity: identity.id, seek: ['co-presence', 'segregation', 'displacement', 'explicit-witness'] },
      closure: 'distinct, explicitly witnessed same-being, or stable typed gap',
    });
  }
  return out;
};

const frontierTasks = ({ frontier, eventIndex, byteStart, byteEnd }) => {
  const out = [];
  for (const open of frontier?.open ?? []) {
    const difference = frontierDifference(open);
    if (!difference.makesDifference) continue;
    out.push({
      kind: 'resolve_open_structure',
      terrain: open.terrain ?? null,
      target: open.id,
      trigger: { type: 'frontier_pressure', standing: open.standing, age: open.age ?? 0, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, provenance: open.provenance ?? [] }],
      consequences: difference.consequences,
      query: { openStructure: open.id, expectation: open.expectation ?? null },
      closure: 'frontier record resolves, reframes, splits, merges, or is superseded',
    });
  }
  return out;
};

const hyperlexiconTasks = ({ candidates = [], withheld = [], eventIndex, byteStart, byteEnd }) => {
  const out = [];
  for (const candidate of candidates) {
    const difference = hyperlexiconDifference(candidate, withheld);
    if (!difference.makesDifference) continue;
    out.push({
      kind: 'test_hyperlexicon_affordance',
      terrain: 'Network',
      target: { left: candidate.left, right: candidate.right },
      trigger: { type: 'repeated_relation_adjacency', witnesses: candidate.witnesses?.length ?? 0, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, tuplePairs: candidate.witnesses ?? [] }],
      consequences: difference.consequences,
      query: { composition: [candidate.left, candidate.right], seek: ['counterexample', 'scope-dependence', 'additional-paths'] },
      closure: 'affordance remains candidate, is explicitly GIVEN by a named giver, or is defeated; recurrence alone never grants it',
    });
  }
  for (const item of withheld) {
    out.push({
      kind: 'inspect_withheld_composition',
      terrain: 'Network',
      target: { left: item.leftPredicate, right: item.rightPredicate, bridge: item.bridge },
      trigger: { type: 'composition_withheld', standing: item.standing, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, tupleIds: item.tupleIds ?? [] }],
      consequences: [{ type: 'blocked_derivation', bridge: item.bridge, from: item.from, to: item.to, tupleIds: item.tupleIds ?? [] }],
      query: { from: item.from, bridge: item.bridge, to: item.to },
      closure: 'a GIVEN affordance licenses the bridge, or evidence preserves the withholding',
    });
  }
  return out;
};

const autoClosable = new Set(['resolve_identity', 'resolve_open_structure']);

export function advanceReadingTasks(ledger, {
  eventIndex,
  byteStart,
  byteEnd,
  recursive,
  frontier,
  hyperlexiconCandidates = [],
  withheldCompositions = [],
} = {}) {
  if (!ledger || ledger.schema !== READING_TASK_LEDGER_SCHEMA) {
    throw new TypeError('advanceReadingTasks: createReadingTaskLedger state is required');
  }
  const specs = [
    ...identityTasks({ recursive, eventIndex, byteStart, byteEnd }),
    ...frontierTasks({ frontier, eventIndex, byteStart, byteEnd }),
    ...hyperlexiconTasks({ candidates: hyperlexiconCandidates, withheld: withheldCompositions, eventIndex, byteStart, byteEnd }),
  ];
  const active = new Set(specs.map(spec => spec.id ?? taskId(spec.kind, spec.target)));
  const opened = [], persisted = [], closed = [];
  for (const spec of specs) {
    const result = upsert(ledger, spec, eventIndex);
    (result.type === 'opened' ? opened : persisted).push(result.task);
  }

  for (const task of ledger.tasks.values()) {
    if (task.status !== 'open' || !autoClosable.has(task.kind) || active.has(task.id)) continue;
    const done = closeReadingTask(ledger, task.id, {
      eventIndex,
      reason: 'current_fold_no_longer_carries_a_difference-making_unresolved_structure',
    });
    if (done) closed.push(done);
  }

  const open = [...ledger.tasks.values()]
    .filter(x => x.status === 'open')
    .sort((a, b) => b.consequences.length - a.consequences.length || a.openedAt - b.openedAt)
    .map(x => freeze({
      ...x,
      triggers: freeze([...x.triggers]),
      witnesses: freeze([...x.witnesses]),
      consequences: freeze([...x.consequences]),
    }));
  const delta = freeze({
    event: eventIndex,
    opened: freeze(opened.map(x => freeze({ ...x }))),
    persisted: freeze(persisted.map(x => freeze({ ...x }))),
    closed: freeze(closed),
  });
  ledger.history.push(delta);
  return freeze({ schema: READING_TASK_LEDGER_SCHEMA, open: freeze(open), delta });
}
