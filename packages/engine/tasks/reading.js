import {
  createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS,
} from "../holon/task-log.js";

const CLOSED = new Set(["resolved", "closed", "superseded"]);

export function createReadingTaskState(log = null) {
  return log ?? createTaskLog();
}

/**
 * An obligation may propose a clarification task; the task is not a fact and
 * carries no operator until an actual structural act has been earned.
 */
export function taskForObligation(obligation, { sequence = 0 } = {}) {
  if (!obligation?.id || CLOSED.has(obligation.status)) return null;
  return Object.freeze({
    kind: ENTRY_KINDS.PROPOSE,
    task_id: `task:obligation:${obligation.id}`,
    description: `Clarify unresolved distinction: ${String(obligation.distinction ?? obligation.id)}`,
    obligation_id: obligation.id,
    grounds: Object.freeze([...(obligation.grounds ?? [])]),
    targets: Object.freeze([
      obligation.id,
      ...(obligation.grounds ?? []),
      ...(obligation.alternatives ?? []),
    ]),
    consequences: Object.freeze([...(obligation.consequences ?? [])]),
    scope: Object.freeze({ seenThrough: sequence, futureAllowed: false }),
    strategy: "clarify",
    successCondition: "new witnessed evidence changes the addressed unresolved structure",
    failureCondition: "available witnessed history leaves the distinction unresolved",
    wake: Object.freeze({ refs: Object.freeze([
      obligation.id,
      ...(obligation.grounds ?? []),
      ...(obligation.alternatives ?? []),
    ]) }),
    depends_on: [],
    evidence: Object.freeze([...(obligation.grounds ?? [])]),
  });
}

/** Add tasks only for open obligations that do not already have a live task. */
export function proposeObligationTasks(log, fold) {
  let next = log;
  const live = new Set(projectTasks(next).map((t) => t.task_id));
  const proposed = [];
  for (const obligation of fold?.obligations ?? []) {
    const entry = taskForObligation(obligation, { sequence: fold?.sequence ?? 0 });
    if (!entry || live.has(entry.task_id)) continue;
    next = append(next, entry);
    live.add(entry.task_id);
    proposed.push(entry.task_id);
  }
  return Object.freeze({ log: next, proposed: Object.freeze(proposed), tasks: Object.freeze(projectTasks(next)) });
}

const refsOf = (value, out = new Set()) => {
  if (value == null) return out;
  if (typeof value === "string") {
    if (/^(ref|surface|obs|edge|expectation|obligation|frame|pattern|delta|op|gap):/.test(value)) out.add(value);
    return out;
  }
  if (Array.isArray(value)) { for (const v of value) refsOf(v, out); return out; }
  if (typeof value === "object") for (const v of Object.values(value)) refsOf(v, out);
  return out;
};

/**
 * Wake tasks by graph reference, never by prose similarity. A task can cause
 * inspection of a relevant encounter; it cannot admit an observation.
 */
export function wakeTasks(tasks = [], observations = []) {
  const encountered = refsOf(observations);
  return Object.freeze(tasks.filter((task) => {
    const refs = task?.wake?.refs ?? task?.targets ?? [];
    return refs.some((ref) => encountered.has(ref));
  }));
}

/**
 * Append task evidence/results. The result remains evidence for subsequent EO
 * interrogation; it never mutates Fold state by itself.
 */
export function appendTaskResult(log, task, result = {}) {
  if (!task?.task_id) throw new TypeError("appendTaskResult requires a task");
  const evidence = [...(result.evidence ?? [])];
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
    result: Object.freeze({
      disposition: result.disposition ?? "unresolved",
      evidence: Object.freeze(evidence),
      candidates: Object.freeze([...(result.candidates ?? [])]),
      detail: result.detail ?? null,
    }),
    evidence,
    description: task.description,
  });
  return next;
}

/** Explicitly type a task only when an EO act has actually been earned. */
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
