// Book-scale recursive reading assembly.
//
// The canonical reader advances one experience at a time. This host assembly
// keeps that causal discipline while adding long-horizon work: Hyperlexicon
// accumulation, consequence-gated deeper-reading tasks, byte-anchored
// re-reading, and anonymous parameter discovery from the trajectory itself.

import { openExperienceReading, advanceReading, textExperienceStream } from './experience-stream.js';
import { searchSpans, readSpan, sessionReferents } from './corpus.js';
import { createReadingTaskLedger, advanceReadingTasks } from './reading-tasks.js';
import { createHyperlexicon, admitHyperlexiconCandidates } from '../engine/reasoning/hyperlexicon.js';
import { deriveEotInsights } from '../engine/reasoning/derivation.js';
import { discoverParameters } from '../engine/emergence/parameter-discovery.js';

const freeze = x => Object.freeze(x);
const textOf = value => {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(textOf);
  if (typeof value === 'object') return Object.values(value).flatMap(textOf);
  return [];
};

export const BOOK_READING_SCHEMA = 'EOBookReading@2';

const taskQueryText = task => {
  const words = [...textOf(task.query ?? task.target)]
    .flatMap(x => x.split(/[^\p{L}\p{N}'’]+/u))
    .map(x => x.trim())
    .filter(x => x.length > 1);
  return [...new Set(words)].slice(0, 8).join(' ');
};

export function executeReadingTask(state, task, { limit = 8, maxBytes = 4000 } = {}) {
  if (!task || task.status !== 'open') return freeze({ taskId: task?.id ?? null, evidence: freeze([]), gap: 'task_not_open' });
  const query = taskQueryText(task);
  if (!query) return freeze({ taskId: task.id, evidence: freeze([]), gap: 'no_lexical_address_for_task' });

  const found = searchSpans(state.horizon, { query, limit });
  const evidence = (found.spans ?? []).map(span => {
    const read = readSpan(state.horizon, { spanId: span.span_id, maxBytes });
    return freeze({
      spanId: span.span_id,
      sourceId: span.source_id,
      byteStart: span.byte_start,
      byteEnd: span.byte_end,
      score: span.score ?? span.coverage ?? null,
      phraseScore: span.phrase_score ?? null,
      text: read.text,
    });
  });
  return freeze({
    taskId: task.id,
    kind: task.kind,
    query,
    evidence: freeze(evidence),
    gap: evidence.length ? null : 'no_addressed_evidence_in_current_horizon',
  });
}

export function openBookReading({ sourceId, priors = [], entitySpec, language, hyperlexicon = null } = {}) {
  const reader = openExperienceReading({ sourceId, priors, entitySpec, language });
  return {
    schema: BOOK_READING_SCHEMA,
    reader,
    tasks: createReadingTaskLedger(),
    hyperlexicon: hyperlexicon ?? createHyperlexicon(),
    taskRuns: [],
    chapters: [],
  };
}

export function advanceBookReading(state, event, { executeTopTasks = 0 } = {}) {
  if (!state || state.schema !== BOOK_READING_SCHEMA) throw new TypeError('advanceBookReading: openBookReading state is required');
  const transition = advanceReading(state.reader, event);
  const lastIteration = transition.iterations?.at(-1);
  const eot = lastIteration?.eot ?? [];
  const derived = deriveEotInsights(eot, {}, { hyperlexicon: state.hyperlexicon });
  const candidates = derived.candidates ?? [];
  state.hyperlexicon = admitHyperlexiconCandidates(state.hyperlexicon, candidates);

  const taskState = advanceReadingTasks(state.tasks, {
    eventIndex: transition.event,
    byteStart: transition.surf?.admission?.byteStart ?? null,
    byteEnd: transition.surf?.admission?.byteEnd ?? transition.surf?.horizonByteEnd ?? null,
    recursive: {
      identityAlternatives: transition.fold?.identityAlternatives ?? [],
      provisionalLinks: transition.fold?.provisional?.links ?? [],
    },
    frontier: transition.frontier,
    hyperlexiconCandidates: candidates,
    withheldCompositions: derived.withheld ?? [],
  });

  // Deeper reading is an escalation caused by a newly earned consequential
  // assertion/obligation. An unresolved task that merely persists does not
  // trigger another horizon search on every proposition. It can be retriggered
  // later by an explicit policy if materially new evidence changes its target.
  const executed = [];
  const justOpened = taskState.delta?.opened ?? [];
  for (const task of justOpened.slice(0, Math.max(0, executeTopTasks))) {
    const liveTask = taskState.open.find(x => x.id === task.id) ?? task;
    const run = executeReadingTask(state.reader, liveTask);
    state.taskRuns.push(run);
    executed.push(run);
  }

  return freeze({
    transition,
    hyperlexiconCandidates: freeze([...candidates]),
    withheldCompositions: freeze([...(derived.withheld ?? [])]),
    tasks: taskState,
    executed: freeze(executed),
  });
}

const parameterRows = trajectory => {
  const rows = [];
  for (let i = 0; i + 1 < trajectory.length; i++) {
    const here = trajectory[i]?.transition;
    const next = trajectory[i + 1]?.transition;
    const distinctions = [
      ...(here?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
      ...(here?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
    ];
    const outcomes = [
      ...(next?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
      ...(next?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
    ];
    rows.push({
      distinctions,
      outcomes,
      provenance: {
        event: here?.event ?? i,
        byteStart: here?.surf?.admission?.byteStart ?? null,
        byteEnd: here?.surf?.admission?.byteEnd ?? null,
      },
    });
  }
  return rows;
};

export function readBook({ sourceId, text, events, priors = [], entitySpec, language, hyperlexicon = null, executeTopTasks = 0 } = {}) {
  const stream = events ?? textExperienceStream(text ?? '', { unit: 'paragraph' });
  const state = openBookReading({ sourceId, priors, entitySpec, language, hyperlexicon });
  const trajectory = [];
  for (const event of stream) trajectory.push(advanceBookReading(state, event, { executeTopTasks }));

  const cast = sessionReferents(state.reader.horizon, { sourceId, priors, limit: Infinity });
  const parameterDiscovery = discoverParameters(parameterRows(trajectory));

  return freeze({
    schema: BOOK_READING_SCHEMA,
    sourceId,
    eventCount: stream.length,
    trajectory: freeze(trajectory),
    cast: freeze({
      referents: freeze([...(cast.referents ?? [])].map(x => freeze({ ...x }))),
      gaps: freeze([...(cast.gaps ?? [])]),
    }),
    hyperlexicon: state.hyperlexicon,
    parameterDiscovery,
    tasks: freeze([...state.tasks.tasks.values()].map(x => freeze({
      ...x,
      triggers: freeze([...(x.triggers ?? [])]),
      witnesses: freeze([...(x.witnesses ?? [])]),
      consequences: freeze([...(x.consequences ?? [])]),
    }))),
    taskRuns: freeze([...state.taskRuns]),
    _reader: state.reader,
  });
}
