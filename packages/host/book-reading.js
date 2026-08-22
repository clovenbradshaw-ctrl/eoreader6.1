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
import { offerCandidates, reviewEntities, carryEntities, refusals, lapsedEntities } from '../engine/referents/entity.js';

const freeze = x => Object.freeze(x);
const textOf = value => {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(textOf);
  if (typeof value === 'object') return Object.values(value).flatMap(textOf);
  return [];
};

export const BOOK_READING_SCHEMA = 'EOBookReading@3';

const taskQueryText = task => {
  const words = [...textOf(task.query ?? task.target)]
    .flatMap(x => x.split(/[^\p{L}\p{N}'’]+/u))
    .map(x => x.trim())
    .filter(x => x.length > 1);
  return [...new Set(words)].slice(0, 8).join(' ');
};

const compactEventRecord = (transition, taskState, candidates, withheld, executed) => freeze({
  event: transition.event,
  byteStart: transition.surf?.admission?.byteStart ?? null,
  byteEnd: transition.surf?.admission?.byteEnd ?? transition.surf?.horizonByteEnd ?? null,
  unit: transition.surf?.unit ?? null,
  section: transition.surf?.section ?? null,
  sectionLabel: transition.surf?.sectionLabel ?? null,
  proposition: transition.surf?.proposition ?? null,
  delta: transition.delta,
  surprise: freeze({
    score: transition.surprise?.score ?? null,
    tension: transition.surprise?.tension ?? null,
    release: transition.surprise?.release ?? null,
  }),
  transformations: transition.surprise?.transformations ?? null,
  observationGaps: transition.observations?.gaps ?? freeze([]),
  taskDelta: taskState.delta,
  hyperlexiconCandidates: freeze(candidates.map(x => freeze({
    left: x.left, right: x.right, standing: x.standing,
    witnessCount: x.witnesses?.length ?? 0,
  }))),
  withheldCount: withheld.length,
  executedTaskIds: freeze(executed.map(x => x.taskId)),
});

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
  reader.entityReading.deferAssertions = true;
  reader.ontology.compact = true;
  return {
    schema: BOOK_READING_SCHEMA,
    reader,
    tasks: createReadingTaskLedger(),
    hyperlexicon: hyperlexicon ?? createHyperlexicon(),
    taskRuns: [],
    eventLog: [],
    castAssertion: null,
    lastTransition: null,
  };
}

export function assertBookCast(state) {
  if (!state || state.schema !== BOOK_READING_SCHEMA) throw new TypeError('assertBookCast: openBookReading state is required');
  const register = state.reader.entityReading;
  register.deferAssertions = false;
  const born = offerCandidates(register);
  const lapsed = reviewEntities(register);
  const beings = carryEntities(register).map(x => freeze({ ...x, surfaces: freeze([...(x.surfaces ?? [])]) }));
  const result = freeze({
    schema: 'EOBookCastAssertion@1',
    born,
    lapsed,
    beings: freeze(beings),
    refusals: freeze(refusals(register).map(x => freeze({ ...x }))),
    lapsedEntities: freeze(lapsedEntities(register).map(x => freeze({ ...x }))),
  });
  state.castAssertion = result;
  register.deferAssertions = true;
  return result;
}

export function advanceBookReading(state, event, { executeTopTasks = 0 } = {}) {
  if (!state || state.schema !== BOOK_READING_SCHEMA) throw new TypeError('advanceBookReading: openBookReading state is required');
  const transition = advanceReading(state.reader, event);
  const lastIteration = transition.iterations?.at(-1);
  const eot = lastIteration?.eot ?? [];
  const derived = deriveEotInsights(eot, {}, { hyperlexicon: state.hyperlexicon });
  const candidates = derived.candidates ?? [];
  const withheld = derived.withheld ?? [];
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
    withheldCompositions: withheld,
  });

  const executed = [];
  const justOpened = taskState.delta?.opened ?? [];
  for (const task of justOpened.slice(0, Math.max(0, executeTopTasks))) {
    const liveTask = taskState.open.find(x => x.id === task.id) ?? task;
    const run = executeReadingTask(state.reader, liveTask);
    state.taskRuns.push(run);
    executed.push(run);
  }

  const record = compactEventRecord(transition, taskState, candidates, withheld, executed);
  state.eventLog.push(record);
  state.lastTransition = transition;

  // The canonical small reader keeps rich snapshots for audit goldens. The
  // book wrapper has already converted this event into its append-only delta,
  // so retaining the same rich transition again would recursively duplicate
  // the current Fold. Frontier history is likewise redundant with eventLog.
  state.reader.trajectory.length = 0;
  if (state.reader.frontier?.history) state.reader.frontier.history.length = 0;

  return freeze({ record, transition, tasks: taskState, executed: freeze(executed) });
}

const parameterRows = eventLog => {
  const rows = [];
  for (let i = 0; i + 1 < eventLog.length; i++) {
    const here = eventLog[i];
    const next = eventLog[i + 1];
    rows.push({
      distinctions: [
        ...(here?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
        ...(here?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
      ],
      outcomes: [
        ...(next?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
        ...(next?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
      ],
      provenance: { event: here.event, byteStart: here.byteStart, byteEnd: here.byteEnd },
    });
  }
  return rows;
};

export function readBook({ sourceId, text, events, priors = [], entitySpec, language, hyperlexicon = null, executeTopTasks = 0 } = {}) {
  const stream = events ?? textExperienceStream(text ?? '', { unit: 'paragraph' });
  const state = openBookReading({ sourceId, priors, entitySpec, language, hyperlexicon });
  for (const event of stream) advanceBookReading(state, event, { executeTopTasks });

  const castAssertion = assertBookCast(state);
  const projected = sessionReferents(state.reader.horizon, { sourceId, priors, limit: Infinity });
  const parameterDiscovery = discoverParameters(parameterRows(state.eventLog));

  return freeze({
    schema: BOOK_READING_SCHEMA,
    sourceId,
    eventCount: stream.length,
    trajectory: freeze([...state.eventLog]),
    cast: castAssertion,
    projectedCast: freeze({
      referents: freeze([...(projected.referents ?? [])].map(x => freeze({ ...x }))),
      gaps: freeze([...(projected.gaps ?? [])]),
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
