import {
  createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS,
} from "../holon/task-log.js";
import { buildHypergraph, relevantHypergraphNeighborhood } from "../hypergraph/index.js";

const CLOSED = new Set(["resolved", "closed", "superseded", "retracted"]);

export function createReadingTaskState(log = null) {
  return log ?? createTaskLog();
}

export function taskForObligation(obligation, { sequence = 0 } = {}) {
  if (!obligation?.id || CLOSED.has(obligation.status)) return null;
  return Object.freeze({
    kind: ENTRY_KINDS.PROPOSE,
    task_id: `task:obligation:${obligation.id}`,
    description: `Clarify unresolved distinction: ${String(obligation.distinction ?? obligation.id)}`,
    obligation_id: obligation.id,
    grounds: Object.freeze([...(obligation.grounds ?? [])]),
    targets: Object.freeze([obligation.id, ...(obligation.grounds ?? []), ...(obligation.alternatives ?? [])]),
    consequences: Object.freeze([...(obligation.consequences ?? [])]),
    persistence: obligation.persistence ?? 0,
    scope: Object.freeze({ seenThrough: sequence, futureAllowed: false }),
    strategy: "clarify",
    successCondition: "new witnessed evidence changes the addressed unresolved structure",
    failureCondition: "available witnessed history leaves the distinction unresolved",
    wake: Object.freeze({ refs: Object.freeze([obligation.id, ...(obligation.grounds ?? []), ...(obligation.alternatives ?? [])]) }),
    depends_on: [],
    evidence: Object.freeze([...(obligation.grounds ?? [])]),
    status: "open",
  });
}

export function reconcileObligationTasks(log, fold) {
  let next = log;
  const byObligation = new Map((fold?.obligations ?? []).map((o) => [o.id, o]));
  for (const task of projectTasks(next)) {
    if (!task?.obligation_id) continue;
    const obligation = byObligation.get(task.obligation_id);
    if (!obligation || !CLOSED.has(obligation.status)) continue;
    next = append(next, {
      kind: ENTRY_KINDS.RETRACT,
      task_id: task.task_id,
      description: `Underlying obligation ${task.obligation_id} is ${obligation.status}`,
      evidence: [...(obligation.resolutionRefs ?? [])],
    });
  }
  return next;
}

export function proposeObligationTasks(log, fold) {
  let next = reconcileObligationTasks(log, fold);
  const active = new Set(projectTasks(next).filter((t) => !CLOSED.has(t.status)).map((t) => t.task_id));
  const proposed = [];
  for (const obligation of fold?.obligations ?? []) {
    const entry = taskForObligation(obligation, { sequence: fold?.sequence ?? 0 });
    if (!entry || active.has(entry.task_id)) continue;
    next = append(next, entry);
    active.add(entry.task_id);
    proposed.push(entry.task_id);
  }
  return Object.freeze({ log: next, proposed: Object.freeze(proposed), tasks: Object.freeze(projectTasks(next)) });
}

const refsOf = (value, out = new Set()) => {
  if (value == null) return out;
  if (typeof value === "string") {
    if (/^(ref|surface|obs|edge|expectation|obligation|frame|pattern|delta|op|gap|task-evidence):/.test(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) { for (const v of value) refsOf(v, out); return out; }
  if (typeof value === "object") for (const v of Object.values(value)) refsOf(v, out);
  return out;
};

export function wakeTasks(tasks = [], observations = []) {
  const encountered = refsOf(observations);
  return Object.freeze(tasks.filter((task) => {
    if (CLOSED.has(task.status)) return false;
    const refs = task?.wake?.refs ?? task?.targets ?? [];
    return refs.some((ref) => encountered.has(ref));
  }));
}

export async function executeClarificationTask({ task, fold, observations = [], maxHops = null } = {}) {
  if (!task?.task_id) throw new TypeError("executeClarificationTask requires a task");
  const graph = buildHypergraph([
    ...(fold?.graphEntries ?? []),
    ...observations.flatMap((o) => [o, ...(o?.hyperedges ?? []), ...(o?.graphEntries ?? [])]),
  ]);
  const consequence = (task.consequences ?? []).length;
  const persistence = task.persistence ?? 0;
  const hops = maxHops ?? (consequence > 1 || persistence > 3 ? 4 : 3);
  const neighborhood = relevantHypergraphNeighborhood(graph, [...(task.targets ?? []), ...observations], { maxHops: hops });
  const candidates = neighborhood.entries.filter((entry) => entry?.id && !CLOSED.has(entry?.status));
  const evidence = candidates
    .filter((entry) => ["Observation@1", "EOHyperedge@1", "EOOperation@1", "EOExpectation@1", "EOObligation@1"].includes(entry.schema))
    .map((entry) => entry.id);
  return Object.freeze({
    disposition: evidence.length ? "evidence_found" : "unresolved",
    evidence: Object.freeze([...new Set(evidence)]),
    candidates: Object.freeze(candidates),
    detail: evidence.length
      ? `reopened ${candidates.length} graph objects within ${hops} structural hops; EO interrogation must decide consequence`
      : `no additional witnessed graph structure found within ${hops} structural hops`,
  });
}

export function appendTaskResult(log, task, result = {}) {
  if (!task?.task_id) throw new TypeError("appendTaskResult requires a task");
  const evidence = [...(result.evidence ?? [])];
  const disposition = result.disposition ?? "unresolved";
  let next = log;
  if (evidence.length) {
    next = append(next, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: task.task_id,
      evidence,
      description: task.description,
    });
  }
  next = append(next, {
    kind: ENTRY_KINDS.RESULT,
    task_id: task.task_id,
    status: "open",
    result: Object.freeze({
      disposition,
      evidence: Object.freeze(evidence),
      candidates: Object.freeze([...(result.candidates ?? [])]),
      detail: result.detail ?? null,
    }),
    evidence,
    description: task.description,
  });
  return next;
}

export function typeTask(log, task, { operator, grain, evidence = [], description = null } = {}) {
  return append(log, {
    kind: ENTRY_KINDS.EVIDENCE,
    task_id: task.task_id,
    operator,
    operator_basis: OPERATOR_BASIS.DERIVED,
    grain,
    evidence,
    description: description ?? task.description,
  });
}
