// Constitutive adversarial reading: one canonical stateful pipeline.
//
// ExperienceStream -> Surf(t) -> prior Fold(t-1) -> tentative experience
// -> adversarial perturbation -> witnessed admission -> Fold(t) -> surprise.
//
// Surf perception is intentionally permissive: perceiving a form is not the
// same act as admitting a being. Admission remains causal and witnessed.

import { createSession, admitChunked } from './corpus.js';
import { adversariallyResolveAssertions } from './assertion-resolution.js';
import { tokenize } from '../engine/perceiver/text/material.js';
import { splitSentences } from '../engine/perceiver/text/spans.js';
import { extractSurfaces, diaNorm } from '../engine/perceiver/text/surfaces.js';
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
const key = x => JSON.stringify(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE_WORD = /^\p{Lu}[\p{L}\p{M}'’]*$/u;

export const EXPERIENCE_TRAJECTORY_SCHEMA = 'EOExperienceTrajectory@6';

export function textExperienceStream(text, { unit = 'paragraph' } = {}) {
  const source = String(text ?? '');
  if (unit !== 'paragraph') throw new TypeError(`textExperienceStream: unsupported declared unit ${unit}`);
  const out = [];
  const re = /(?:[^\n]|\n(?!\s*\n))+/g;
  let m;
  while ((m = re.exec(source))) {
    const value = m[0];
    if (!value.trim()) continue;
    out.push(freeze({ kind: 'text', unit, start: bytes(source.slice(0, m.index)), end: bytes(source.slice(0, m.index + value.length)), value }));
  }
  return freeze(out);
}

const assertionKeys = resolution => new Set([
  ...(resolution.cast ?? []).map(x => `E:${x.referent}:${x.disposition}`),
  ...(resolution.links ?? []).map(x => `L:${key(x.assertion)}:${x.disposition}`),
]);

const structuralDelta = (before, after) => {
  const A = before ? assertionKeys(before) : new Set();
  const B = assertionKeys(after);
  let admitted = 0, withdrawn = 0;
  for (const x of B) if (!A.has(x)) admitted++;
  for (const x of A) if (!B.has(x)) withdrawn++;
  const denominator = Math.max(1, A.size + B.size);
  return freeze({ admitted, withdrawn, reorganized: admitted + withdrawn, surprise: (admitted + withdrawn) / denominator });
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
  // Sentence-initial capitalisation alone is grammatical evidence. It remains
  // perceptible through lexicalSpans; another occurrence in this event can
  // still make the same form witnessable when the candidate records merge.
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
    sentences: freeze(sentences.map(s => freeze({ text:s.text, offset:s.offset, order:s.order }))),
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

  // Entity existence is measured over the lexical stream in causal order.
  // The outer passage and its sentences remain Surf boundaries; each token is
  // the Figure organ's reach-unit, so `window: 8` means an eight-token present
  // rather than eight paragraphs or eight whole sentences.
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

  return freeze({ schema: 'WitnessGatedAssertionResolution@1', sourceId: proposed.sourceId, cast: freeze(cast), links: freeze(links) });
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

const foldFrom = (perturbation, i, byteEnd) => freeze({
  cursor: freeze({ event: i, byteEnd }),
  cast: perturbation.cast,
  links: perturbation.links,
  unresolved: freeze([
    ...perturbation.cast.filter(x => String(x.disposition).startsWith('unresolved') || String(x.disposition).startsWith('needs_')),
    ...perturbation.links.filter(x => x.disposition !== 'survives' && x.disposition !== 'survives_scoped'),
  ]),
});

const validate = ({ sourceId, events, entitySpec }) => {
  if (!sourceId) throw new TypeError('readExperienceStream: sourceId is required');
  if (!Array.isArray(events)) throw new TypeError('readExperienceStream: events must be an ordered array');
  if (!entitySpec) throw new TypeError('readExperienceStream: entitySpec is declared, never defaulted');
  const probe = openReading(entitySpec);
  if (isGap(probe)) throw new TypeError(`readExperienceStream: invalid entitySpec (${probe.gap}:${probe.what ?? probe.reason ?? 'unknown'})`);
  for (let i = 0; i < events.length; i++) {
    if (!events[i] || events[i].kind !== 'text') throw new TypeError(`readExperienceStream: event ${i} is not a supported text experience`);
  }
};

export function readExperienceStream({ sourceId, events, priors = [], entitySpec } = {}) {
  validate({ sourceId, events, entitySpec });
  const horizon = createSession();
  const entityReading = openReading(entitySpec);
  const trajectory = [];
  let priorFold = null;
  let prefixBytes = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const surfPerception = perceiveEvent(event);
    admitChunked(horizon, { sourceId, text: event.value });
    prefixBytes += bytes(event.value);
    horizon._cast?.delete(sourceId);
    horizon._surfaces?.delete(sourceId);
    const tentative = adversariallyResolveAssertions(horizon, { sourceId, priors });
    const changes = admitExperienceCandidates(entityReading, surfPerception);
    const perturbation = gateThroughWitnessedBeings(tentative, entityReading);
    const admission = admissionSnapshot(entityReading, surfPerception, tentative, changes);
    const fold = foldFrom(perturbation, i, event.end ?? prefixBytes);
    const delta = structuralDelta(priorFold, perturbation);

    trajectory.push(freeze({
      event: i,
      surf: freeze({ ...event, horizonByteEnd: prefixBytes, perception: surfPerception }),
      tentative,
      admission,
      perturbation,
      fold,
      delta,
    }));
    priorFold = perturbation;
  }

  return freeze({ schema: EXPERIENCE_TRAJECTORY_SCHEMA, sourceId, eventCount: events.length, trajectory: freeze(trajectory) });
}
