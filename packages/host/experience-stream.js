// Constitutive adversarial reading: one canonical stateful pipeline.
//
// ExperienceStream -> Surf(t) -> prior Fold(t-1) -> provisional ontology
// -> recursive adversarial reasoning -> witnessed admission -> Fold(t)
// -> structural surprise.
//
// Perception, provisional standing, and settled beinghood remain distinct.

import { createSession } from './corpus.js';
import { admitExperienceEvent } from './experience-admission.js';
import { adversariallyResolveAssertions } from './assertion-resolution.js';
import { createRecursiveOntology, advanceRecursiveOntology } from './recursive-ontology.js';
import { tokenize } from '../engine/perceiver/text/material.js';
import { splitSentences } from '../engine/perceiver/text/spans.js';
import { extractSurfaces } from '../engine/perceiver/text/surfaces.js';
import {
  openReading,
  arrive,
  witnessArrival,
  offerCandidates,
  reviewEntities,
  carryEntities,
  refusals,
  lapsedEntities,
} from '../engine/referents/entity.js';
import { isGap } from '../../nul/index.js';

const freeze = x => Object.freeze(x);
const utf8 = new TextEncoder();
const bytes = s => utf8.encode(String(s ?? '')).length;
const stable = x => JSON.stringify(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE_WORD = /^\p{Lu}[\p{L}\p{M}'’]*$/u;

export const EXPERIENCE_TRAJECTORY_SCHEMA = 'EOExperienceTrajectory@8';
export const EXPERIENCE_READING_STATE_SCHEMA = 'EOExperienceReadingState@1';

export function textExperienceStream(text, { unit = 'paragraph' } = {}) {
  const source = String(text ?? '');
  if (unit !== 'paragraph') throw new TypeError(`textExperienceStream: unsupported declared unit ${unit}`);
  const out = [];
  const re = /(?:[^\n]|\n(?!\s*\n))+/g;
  let m;
  while ((m = re.exec(source))) {
    const value = m[0];
    if (!value.trim()) continue;
    out.push(freeze({
      kind: 'text',
      unit,
      start: bytes(source.slice(0, m.index)),
      end: bytes(source.slice(0, m.index + value.length)),
      value,
    }));
  }
  return freeze(out);
}

const structuralKeys = state => {
  const out = new Set();
  if (!state) return out;
  for (const x of state.perturbation?.cast ?? []) out.add(`E:${x.referent}:${x.disposition}`);
  for (const x of state.perturbation?.links ?? []) out.add(`L:${stable(x.assertion)}:${x.disposition}`);
  for (const x of state.recursive?.identityAlternatives ?? []) out.add(`I:${x.id}:${x.standing}`);
  for (const x of state.recursive?.provisionalEntities ?? []) out.add(`P:${x.id}:${x.standing}`);
  for (const x of state.recursive?.provisionalLinks ?? []) {
    out.add(`R:${x.id}:${stable(x.subjectAlternatives)}:${x.predicate}:${x.object}:${x.polarity}`);
  }
  return out;
};

const structuralDelta = (before, after) => {
  const A = structuralKeys(before);
  const B = structuralKeys(after);
  const admittedKeys = [];
  const withdrawnKeys = [];
  for (const x of B) if (!A.has(x)) admittedKeys.push(x);
  for (const x of A) if (!B.has(x)) withdrawnKeys.push(x);
  const reorganized = admittedKeys.length + withdrawnKeys.length;
  const denominator = Math.max(1, A.size + B.size);
  return freeze({
    admitted: admittedKeys.length,
    withdrawn: withdrawnKeys.length,
    reorganized,
    surprise: reorganized / denominator,
    admittedKeys: freeze(admittedKeys),
    withdrawnKeys: freeze(withdrawnKeys),
  });
};

const lexicalSpans = sentence => {
  const words = [...sentence.text.matchAll(WORD)].map(m => m[0]);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const surface = words.slice(i, i + n).join(' ');
      if (surface.length >= 2) out.push(surface);
    }
  }
  return out;
};

const titlecaseRuns = sentence => {
  const words = [...sentence.text.matchAll(WORD)].map(m => m[0]);
  const out = [];
  let i = 1;
  while (i < words.length) {
    if (!TITLE_WORD.test(words[i])) { i++; continue; }
    let j = i;
    while (j < words.length && TITLE_WORD.test(words[j])) j++;
    const run = words.slice(i, j);
    for (let n = 1; n <= Math.min(4, run.length); n++) out.push(run.slice(0, n).join(' '));
    i = j;
  }
  return out;
};

const perceiveEvent = event => {
  const sentences = splitSentences(event.value);
  const strictNames = extractSurfaces(sentences);
  const candidates = new Map();

  const add = (surface, detail = {}) => {
    const k = norm(surface);
    if (!k) return;
    const current = candidates.get(k);
    candidates.set(k, freeze({
      id: current?.id ?? `surf:${candidates.size}:${k}`,
      display: current?.display ?? surface,
      surfaces: freeze([current?.display ?? surface]),
      standing: 'candidate',
      witnessable: Boolean(current?.witnessable || detail.witnessable),
      giver: current?.giver === 'event-local-name-surface' || detail.giver === 'event-local-name-surface'
        ? 'event-local-name-surface'
        : detail.giver ?? current?.giver ?? 'event-local-lexical-form',
      mentions: Math.max(current?.mentions ?? 0, detail.mentions ?? 0),
      sentenceCount: Math.max(current?.sentenceCount ?? 0, detail.sentenceCount ?? 0),
    }));
  };

  for (const s of strictNames) add(s.surface, {
    witnessable: true,
    giver: 'event-local-name-surface',
    mentions: s.mentions,
    sentenceCount: s.sentences,
  });
  for (const sentence of sentences) {
    for (const surface of titlecaseRuns(sentence)) add(surface, {
      witnessable: true,
      giver: 'event-local-name-surface',
      mentions: 1,
      sentenceCount: 1,
    });
    for (const surface of lexicalSpans(sentence)) add(surface, {
      witnessable: false,
      giver: 'event-local-lexical-form',
    });
  }

  return freeze({
    sentences: freeze(sentences.map(s => freeze({ text: s.text, offset: s.offset, order: s.order }))),
    candidates: freeze([...candidates.values()]),
  });
};

const candidateSnapshot = (surf, proposed) => {
  const out = [];
  const seen = new Set();
  for (const c of [...(surf.candidates ?? []), ...(proposed.cast ?? [])]) {
    const surfaces = c.surfaces ?? (c.display ? [c.display] : []);
    const k = surfaces.map(norm).sort().join('|');
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(freeze({
      referent: c.referent ?? null,
      display: c.display ?? surfaces[0] ?? null,
      surfaces: freeze([...surfaces]),
      disposition: c.disposition ?? c.standing ?? 'candidate',
      giver: c.giver ?? 'document-referent-projection',
      witnessable: c.witnessable ?? null,
    }));
  }
  return freeze(out);
};

const suffixMatches = (tokens, at, surfaceTokens) => {
  if (!surfaceTokens.length || at + 1 < surfaceTokens.length) return false;
  const start = at + 1 - surfaceTokens.length;
  for (let i = 0; i < surfaceTokens.length; i++) {
    if (tokens[start + i] !== surfaceTokens[i]) return false;
  }
  return true;
};

const admitExperienceCandidates = (entityReading, surf) => {
  const witnessables = (surf.candidates ?? [])
    .filter(c => c.witnessable)
    .map(c => ({
      surface: norm(c.surfaces?.[0] ?? c.display),
      tokens: tokenize(c.surfaces?.[0] ?? c.display),
    }))
    .filter(c => c.surface && c.tokens.length);

  for (const sentence of surf.sentences) {
    const tokens = tokenize(sentence.text);
    for (let at = 0; at < tokens.length; at++) {
      arrive(entityReading, [tokens[at]]);
      for (const candidate of witnessables) {
        if (suffixMatches(tokens, at, candidate.tokens)) witnessArrival(entityReading, candidate.surface);
      }
    }
  }

  const lapsed = reviewEntities(entityReading);
  const born = offerCandidates(entityReading);
  return { born, lapsed, unit: 'token' };
};

const gateThroughWitnessedBeings = (proposed, entityReading) => {
  const entities = carryEntities(entityReading);
  const admittedSurfaces = new Set(entities.flatMap(e => e.surfaces ?? []).map(norm));
  const admittedReferents = new Set();

  const cast = (proposed.cast ?? []).filter(c => {
    const admitted = (c.surfaces ?? []).some(s => admittedSurfaces.has(norm(s)));
    if (admitted) admittedReferents.add(String(c.referent));
    return admitted;
  });

  const links = (proposed.links ?? []).filter(l => {
    const subject = String(l.assertion?.subject ?? '');
    if (admittedReferents.has(subject)) return true;
    return [...admittedSurfaces].some(s => norm(subject) === s);
  });

  return freeze({
    schema: 'WitnessGatedAssertionResolution@1',
    sourceId: proposed.sourceId,
    cast: freeze(cast),
    links: freeze(links),
  });
};

const admissionSnapshot = (entityReading, surf, proposed, changes) => freeze({
  candidates: candidateSnapshot(surf, proposed),
  beings: freeze(carryEntities(entityReading).map(e => freeze({ ...e, surfaces: freeze([...(e.surfaces ?? [])]) }))),
  refusals: freeze(refusals(entityReading).map(x => freeze({ ...x }))),
  lapsed: freeze(lapsedEntities(entityReading).map(x => freeze({ ...x }))),
  bornThisEvent: changes.born,
  lapsedThisEvent: changes.lapsed,
  unit: changes.unit,
});

const foldFrom = (perturbation, recursive, i, byteEnd) => freeze({
  cursor: freeze({ event: i, byteEnd }),
  cast: perturbation.cast,
  links: perturbation.links,
  identityAlternatives: recursive.identityAlternatives,
  provisional: freeze({
    entities: recursive.provisionalEntities,
    links: recursive.provisionalLinks,
  }),
  unresolved: freeze([
    ...perturbation.cast.filter(x => String(x.disposition).startsWith('unresolved') || String(x.disposition).startsWith('needs_')),
    ...perturbation.links.filter(x => x.disposition !== 'survives' && x.disposition !== 'survives_scoped'),
    ...recursive.identityAlternatives.filter(x => x.standing !== 'distinct'),
  ]),
});

const transformationSurprise = ({ recursive, admission, delta }) => {
  const births = admission.bornThisEvent > 0
    ? admission.beings.slice(-admission.bornThisEvent).map(x => ({ id: x.id, surfaces: x.surfaces }))
    : [];
  const lapses = admission.lapsedThisEvent > 0
    ? admission.lapsed.slice(-admission.lapsedThisEvent).map(x => ({ surface: x.surface, at: x.at }))
    : [];
  const transformations = freeze({
    ...recursive.transformations,
    entityBirths: freeze(births.map(freeze)),
    entityLapses: freeze(lapses.map(freeze)),
    settledAdmissions: delta.admittedKeys,
    settledWithdrawals: delta.withdrawnKeys,
  });
  return freeze({
    transformations,
    admitted: delta.admitted,
    withdrawn: delta.withdrawn,
    reorganized: delta.reorganized,
    score: delta.surprise,
  });
};

const validateEvent = (event, index = '?') => {
  if (!event || event.kind !== 'text') {
    throw new TypeError(`advanceReading: event ${index} is not a supported text experience`);
  }
};

const validateOptions = ({ sourceId, events, entitySpec }) => {
  if (!sourceId) throw new TypeError('readExperienceStream: sourceId is required');
  if (events !== undefined && !Array.isArray(events)) throw new TypeError('readExperienceStream: events must be an ordered array');
  if (!entitySpec) throw new TypeError('readExperienceStream: entitySpec is declared, never defaulted');
  const probe = openReading(entitySpec);
  if (isGap(probe)) {
    throw new TypeError(`readExperienceStream: invalid entitySpec (${probe.gap}:${probe.what ?? probe.reason ?? 'unknown'})`);
  }
  for (let i = 0; i < (events ?? []).length; i++) validateEvent(events[i], i);
};

export function openExperienceReading({ sourceId, priors = [], entitySpec, language } = {}) {
  validateOptions({ sourceId, entitySpec });
  return {
    schema: EXPERIENCE_READING_STATE_SCHEMA,
    sourceId,
    priors: freeze([...priors]),
    language: language ?? null,
    horizon: createSession(),
    entityReading: openReading(entitySpec),
    ontology: createRecursiveOntology(),
    trajectory: [],
    priorState: null,
    prefixBytes: 0,
    eventIndex: 0,
  };
}

/**
 * Advance the one canonical reader by exactly one experience event.
 * The supplied state is intentionally persistent and mutable; the returned
 * transition is immutable. No future event is available to this function.
 */
export function advanceReading(state, event) {
  if (!state || state.schema !== EXPERIENCE_READING_STATE_SCHEMA) {
    throw new TypeError('advanceReading: openExperienceReading state is required');
  }
  const i = state.eventIndex;
  validateEvent(event, i);

  const surfPerception = perceiveEvent(event);
  const admittedEvent = admitExperienceEvent(state.horizon, {
    sourceId: state.sourceId,
    text: event.value,
    eventId: i,
    language: state.language,
  });
  state.prefixBytes = admittedEvent.byteEnd;

  // These are derived document projections. An arriving event changes their
  // source material even when no storage chunk boundary was crossed.
  state.horizon._cast?.delete(state.sourceId);
  state.horizon._surfaces?.delete(state.sourceId);

  const tentative = adversariallyResolveAssertions(state.horizon, {
    sourceId: state.sourceId,
    priors: state.priors,
  });
  const recursive = advanceRecursiveOntology(state.ontology, {
    eventIndex: i,
    surf: surfPerception,
    text: event.value,
    tentative,
  });
  const changes = admitExperienceCandidates(state.entityReading, surfPerception);
  const perturbation = gateThroughWitnessedBeings(tentative, state.entityReading);
  const admission = admissionSnapshot(state.entityReading, surfPerception, tentative, changes);
  const currentState = { perturbation, recursive };
  const delta = structuralDelta(state.priorState, currentState);
  const fold = foldFrom(perturbation, recursive, i, event.end ?? state.prefixBytes);
  const surprise = transformationSurprise({ recursive, admission, delta });

  const transition = freeze({
    event: i,
    surf: freeze({
      ...event,
      horizonByteEnd: state.prefixBytes,
      admission: freeze({
        eventId: admittedEvent.eventId,
        byteStart: admittedEvent.byteStart,
        byteEnd: admittedEvent.byteEnd,
        chunks: admittedEvent.chunks,
      }),
      perception: surfPerception,
    }),
    tentative,
    admission,
    iterations: recursive.iterations,
    perturbation,
    fold,
    delta,
    surprise,
  });

  state.trajectory.push(transition);
  state.priorState = currentState;
  state.eventIndex += 1;
  return transition;
}

export function readExperienceStream({ sourceId, events, priors = [], entitySpec, language } = {}) {
  validateOptions({ sourceId, events, entitySpec });
  const state = openExperienceReading({ sourceId, priors, entitySpec, language });
  for (const event of events) advanceReading(state, event);
  return freeze({
    schema: EXPERIENCE_TRAJECTORY_SCHEMA,
    sourceId,
    language: state.language,
    eventCount: events.length,
    trajectory: freeze([...state.trajectory]),
  });
}
