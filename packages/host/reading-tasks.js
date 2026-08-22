// Recursive deeper-reading task scheduler.
//
// Reading is not a fixed sequence of extractive passes. The Fold itself opens
// work, but unresolved structure is NOT sufficient to earn work. A task exists
// only when the alternatives make a counterfactual difference downstream.
//
// Storage invariant: the ledger is append-only by DELTA. Current task state
// lives in tasks; history never embeds prior task histories again.

import { identityDifference, frontierDifference, hyperlexiconDifference } from './difference-gate.js';

const freeze = x => Object.freeze(x);
const stable = x => typeof x === 'string' ? x : JSON.stringify(x);

export const READING_TASK_LEDGER_SCHEMA = 'EOReadingTaskLedger@4';

export function createReadingTaskLedger() {
  return {
    schema: READING_TASK_LEDGER_SCHEMA,
    tasks: new Map(),
    history: [],
  };
}

const taskId = (kind, target) => `${kind}:${stable(target)}`;
const consequenceKey = x => `${x?.type ?? 'consequence'}:${x?.identityId ?? x?.bridge ?? x?.from ?? ''}:${x?.to ?? ''}`;
const witnessKey = x => `${x?.event ?? ''}:${x?.byteStart ?? ''}:${x?.byteEnd ?? ''}:${x?.relationId ?? x?.identityId ?? ''}`;

const appendUnique = (existing, incoming, keyFn) => {
  const seen = new Set(existing.map(keyFn));
  const added = [];
  for (const item of incoming ?? []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    existing.push(item);
    added.push(item);
  }
  return added;
};

const upsert = (ledger, spec, eventIndex) => {
  const id = spec.id ?? taskId(spec.kind, spec.target);
  const current = ledger.tasks.get(id);
  if (current?.status === 'open') {
    current.lastTriggeredAt = eventIndex;
    const triggerAdded = current.lastRecordedTriggerEvent === eventIndex ? [] : [spec.trigger];
    if (triggerAdded.length) {
      current.triggers.push(spec.trigger);
      current.lastRecordedTriggerEvent = eventIndex;
    }
    const witnessesAdded = appendUnique(current.witnesses, spec.witnesses ?? [], witnessKey);
    const consequencesAdded = appendUnique(current.consequences, spec.consequences ?? [], consequenceKey);
    return {
      type: 'persisted',
      delta: freeze({
        id,
        kind: current.kind,
        event: eventIndex,
        triggersAdded: freeze(triggerAdded),
        witnessesAdded: freeze(witnessesAdded),
        consequencesAdded: freeze(consequencesAdded),
      }),
    };
  }
  const task = {
    id,
    kind: spec.kind,
    target: spec.target,
    status: 'open',
    openedAt: eventIndex,
    lastTriggeredAt: eventIndex,
    lastRecordedTriggerEvent: eventIndex,
    trigger: spec.trigger,
    triggers: [spec.trigger],
    witnesses: [...(spec.witnesses ?? [])],
    consequences: [...(spec.consequences ?? [])],
    query: spec.query ?? null,
    closure: spec.closure ?? null,
    terrain: spec.terrain ?? null,
  };
  ledger.tasks.set(id, task);
  return {
    type: 'opened',
    delta: freeze({
      id,
      kind: task.kind,
      event: eventIndex,
      target: task.target,
      trigger: task.trigger,
      witnessesAdded: freeze([...task.witnesses]),
      consequencesAdded: freeze([...task.consequences]),
      query: task.query,
      closure: task.closure,
      terrain: task.terrain,
    }),
  };
};

export function closeReadingTask(ledger, id, { eventIndex, reason, witnesses = [] } = {}) {
  const task = ledger.tasks.get(id);
  if (!task || task.status !== 'open') return null;
  task.status = 'closed';
  task.closedAt = eventIndex;
  task.closeReason = reason ?? 'resolved_by_fold';
  const witnessesAdded = appendUnique(task.witnesses, witnesses, witnessKey);
  return freeze({ id, kind: task.kind, event: eventIndex, reason: task.closeReason, witnessesAdded: freeze(witnessesAdded) });
}

const identityTasks = ({ recursive, eventIndex, byteStart, byteEnd }) => {
  const out = [];
  for (const identity of recursive?.identityAlternatives ?? []) {
    if (identity.standing === 'distinct') continue;
    const difference = identityDifference(identity, recursive);
    if (!difference.makesDifference) continue;
    const latest = identity.history?.at(-1) ?? null;
    out.push({
      kind: 'resolve_identity',
      terrain: 'Entity',
      target: identity.id,
      trigger: { type: 'identity_alternative', standing: identity.standing, event: eventIndex },
      // Point at the current observation/latest act. Never embed the complete
      // identity history inside another append-only history record.
      witnesses: [{ event: eventIndex, byteStart, byteEnd, identityId: identity.id, latestAct: latest?.act ?? null }],
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
      witnesses: [{ event: eventIndex, byteStart, byteEnd, openId: open.id }],
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
      witnesses: [{ event: eventIndex, byteStart, byteEnd }],
      consequences: difference.consequences,
      query: { composition: [candidate.left, candidate.right], seek: ['counterexample', 'scope-dependence', 'additional-paths'] },
      closure: 'affordance remains candidate, is explicitly GIVEN by a named giver, or is defeated; recurrence alone never grants it',
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
    (result.type === 'opened' ? opened : persisted).push(result.delta);
  }

  for (const task of ledger.tasks.values()) {
    if (task.status !== 'open' || !autoClosable.has(task.kind) || active.has(task.id)) continue;
    const done = closeReadingTask(ledger, task.id, {
      eventIndex,
      reason: 'current_fold_no_longer_carries_a_difference-making_unresolved_structure',
    });
    if (done) closed.push(done);
  }

  // Current-state view only. This is not appended to history.
  const open = [...ledger.tasks.values()]
    .filter(x => x.status === 'open')
    .sort((a, b) => b.consequences.length - a.consequences.length || a.openedAt - b.openedAt)
    .map(x => freeze({
      id: x.id,
      kind: x.kind,
      target: x.target,
      status: x.status,
      openedAt: x.openedAt,
      lastTriggeredAt: x.lastTriggeredAt,
      consequences: freeze([...x.consequences]),
      query: x.query,
      closure: x.closure,
      terrain: x.terrain,
    }));

  const delta = freeze({
    event: eventIndex,
    opened: freeze(opened),
    persisted: freeze(persisted),
    closed: freeze(closed),
  });
  ledger.history.push(delta);
  return freeze({ schema: READING_TASK_LEDGER_SCHEMA, open: freeze(open), delta });
}
