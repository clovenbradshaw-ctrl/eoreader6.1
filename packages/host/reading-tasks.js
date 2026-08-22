// Recursive deeper-reading task scheduler.
//
// Reading is not a fixed sequence of extractive passes. The Fold itself opens
// work: unresolved identity, frontier pressure, scope conflict, repeated
// relation paths, and withheld Hyperlexicon composition all become explicit
// tasks over already-admitted evidence. Tasks never manufacture conclusions;
// they name what must be re-read or tested, why, where, and what would close it.

const freeze = x => Object.freeze(x);
const stable = x => typeof x === 'string' ? x : JSON.stringify(x);

export const READING_TASK_LEDGER_SCHEMA = 'EOReadingTaskLedger@1';

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
    current.priority = Math.max(current.priority ?? 0, spec.priority ?? 0);
    return { type: 'persisted', task: { ...current } };
  }
  const task = {
    id,
    kind: spec.kind,
    target: spec.target,
    status: 'open',
    openedAt: eventIndex,
    lastTriggeredAt: eventIndex,
    priority: spec.priority ?? 1,
    trigger: spec.trigger,
    triggers: [spec.trigger],
    witnesses: [...(spec.witnesses ?? [])],
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
    out.push({
      kind: 'resolve_identity',
      terrain: 'Entity',
      target: identity.id,
      priority: 4,
      trigger: { type: 'identity_alternative', standing: identity.standing, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, history: identity.history ?? [] }],
      query: { identity: identity.id, seek: ['co-presence', 'segregation', 'displacement', 'explicit-witness'] },
      closure: 'distinct, explicitly witnessed same-being, or stable typed gap',
    });
  }
  return out;
};

const frontierTasks = ({ frontier, eventIndex, byteStart, byteEnd }) => {
  const out = [];
  for (const open of frontier?.open ?? []) {
    out.push({
      kind: 'resolve_open_structure',
      terrain: open.terrain ?? null,
      target: open.id,
      priority: 1 + Math.max(0, open.age ?? 0),
      trigger: { type: 'frontier_pressure', standing: open.standing, age: open.age ?? 0, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, provenance: open.provenance ?? [] }],
      query: { openStructure: open.id, expectation: open.expectation ?? null },
      closure: 'frontier record resolves, reframes, splits, merges, or is superseded',
    });
  }
  return out;
};

const hyperlexiconTasks = ({ candidates = [], withheld = [], eventIndex, byteStart, byteEnd }) => {
  const out = [];
  for (const candidate of candidates) {
    out.push({
      kind: 'test_hyperlexicon_affordance',
      terrain: 'Network',
      target: { left: candidate.left, right: candidate.right },
      priority: 2 + Math.min(4, candidate.witnesses?.length ?? 0),
      trigger: { type: 'repeated_relation_adjacency', witnesses: candidate.witnesses?.length ?? 0, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, tuplePairs: candidate.witnesses ?? [] }],
      query: { composition: [candidate.left, candidate.right], seek: ['counterexample', 'scope-dependence', 'additional-paths'] },
      closure: 'affordance remains candidate, is explicitly GIVEN by a named giver, or is defeated; recurrence alone never grants it',
    });
  }
  for (const item of withheld) {
    out.push({
      kind: 'inspect_withheld_composition',
      terrain: 'Network',
      target: { left: item.leftPredicate, right: item.rightPredicate, bridge: item.bridge },
      priority: 2,
      trigger: { type: 'composition_withheld', standing: item.standing, event: eventIndex },
      witnesses: [{ event: eventIndex, byteStart, byteEnd, tupleIds: item.tupleIds ?? [] }],
      query: { from: item.from, bridge: item.bridge, to: item.to },
      closure: 'a GIVEN affordance licenses the bridge, or evidence preserves the withholding',
    });
  }
  return out;
};

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
  const opened = [], persisted = [];
  for (const spec of specs) {
    const result = upsert(ledger, spec, eventIndex);
    (result.type === 'opened' ? opened : persisted).push(result.task);
  }
  const open = [...ledger.tasks.values()]
    .filter(x => x.status === 'open')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.openedAt - b.openedAt)
    .map(x => freeze({ ...x, triggers: freeze([...x.triggers]), witnesses: freeze([...x.witnesses]) }));
  const delta = freeze({
    event: eventIndex,
    opened: freeze(opened.map(x => freeze({ ...x }))),
    persisted: freeze(persisted.map(x => freeze({ ...x }))),
  });
  ledger.history.push(delta);
  return freeze({ schema: READING_TASK_LEDGER_SCHEMA, open: freeze(open), delta });
}
