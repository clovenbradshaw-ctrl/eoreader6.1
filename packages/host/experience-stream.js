// Constitutive adversarial reading: the atomic unit is an experience event.
//
// Two implementations live here deliberately:
//   1. readExperienceStream — the slow prefix oracle. Every Fold(t) is rebuilt
//      from exactly the material available through t, making future leakage
//      mechanically impossible.
//   2. readExperienceStreamIncremental — the operational reader. It keeps one
//      growing horizon session and admits one experience event at a time.
//
// The incremental implementation is acceptable only while trajectory tests
// prove it equivalent to the prefix oracle. Optimization is subordinate to
// blindness.

import { createSession, admitChunked } from './corpus.js';
import { adversariallyResolveAssertions } from './assertion-resolution.js';

const freeze = x => Object.freeze(x);
const utf8 = new TextEncoder();
const bytes = s => utf8.encode(String(s ?? '')).length;
const key = x => JSON.stringify(x);

export const EXPERIENCE_TRAJECTORY_SCHEMA = 'EOExperienceTrajectory@1';

// Text is only the first modality. This is intentionally a policy seam: a
// caller may provide events from scene/turn/chapter, row/column, phrase,
// transition, etc. The reader never silently claims that 2k characters is the
// temporal grammar of every material.
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

const foldFrom = (perturbation, i, byteEnd) => freeze({
  cursor: freeze({ event: i, byteEnd }),
  cast: perturbation.cast,
  links: perturbation.links,
  unresolved: freeze([
    ...perturbation.cast.filter(x => String(x.disposition).startsWith('unresolved') || String(x.disposition).startsWith('needs_')),
    ...perturbation.links.filter(x => x.disposition !== 'survives' && x.disposition !== 'survives_scoped'),
  ]),
});

const trajectoryStep = ({ event, i, prefixBytes, perturbation, priorFold }) => {
  const delta = structuralDelta(priorFold, perturbation);
  const fold = foldFrom(perturbation, i, event.end ?? prefixBytes);
  return freeze({
    event: i,
    surf: freeze({ ...event, horizonByteEnd: prefixBytes }),
    perturbation,
    fold,
    delta,
  });
};

const validate = ({ sourceId, events }) => {
  if (!sourceId) throw new TypeError('readExperienceStream: sourceId is required');
  if (!Array.isArray(events)) throw new TypeError('readExperienceStream: events must be an ordered array');
  for (let i = 0; i < events.length; i++) {
    if (!events[i] || events[i].kind !== 'text') throw new TypeError(`readExperienceStream: event ${i} is not a supported text experience`);
  }
};

/**
 * Reference blind reader. Every horizon is rebuilt from its prefix.
 *
 * Transition:
 *   Surf(t) -> tentative horizon -> perturb -> Fold(t) -> surprise delta.
 *
 * This is intentionally expensive. It is the oracle against which any
 * incremental implementation must prove trajectory equivalence.
 */
export function readExperienceStream({ sourceId, events, priors = [] } = {}) {
  validate({ sourceId, events });
  const trajectory = [];
  let prefix = '';
  let priorFold = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    prefix += event.value;

    // SURF: encounter only the prefix currently available.
    const horizon = createSession();
    admitChunked(horizon, { sourceId, text: prefix });

    // PERTURB BEFORE FOLD: parser output is tentative. The adversarial attack
    // library gets only the horizon session; its resolved state, not the raw
    // parser assertion set, becomes this event's Fold.
    const perturbation = adversariallyResolveAssertions(horizon, { sourceId, priors });
    const step = trajectoryStep({ event, i, prefixBytes: bytes(prefix), perturbation, priorFold });
    trajectory.push(step);
    priorFold = perturbation;
  }

  return freeze({ schema: EXPERIENCE_TRAJECTORY_SCHEMA, implementation: 'prefix-oracle', sourceId, eventCount: events.length, trajectory: freeze(trajectory) });
}

/**
 * Operational blind reader. One session survives across the trajectory and
 * receives exactly one new experience event per transition.
 *
 * This is not allowed to become a second semantics. Its contract is equality
 * with readExperienceStream() at every Fold boundary. The document-derived
 * cast/surface caches are explicitly invalidated after each event because an
 * experience smaller than corpus.js's storage chunk floor can still change
 * the material a reader has encountered; cache invalidation follows temporal
 * exposure, never storage chunk count.
 */
export function readExperienceStreamIncremental({ sourceId, events, priors = [] } = {}) {
  validate({ sourceId, events });
  const trajectory = [];
  const horizon = createSession();
  let priorFold = null;
  let prefixBytes = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    admitChunked(horizon, { sourceId, text: event.value });
    prefixBytes += bytes(event.value);

    // corpus.js memoises these projections by admitted chunk count. Temporal
    // grammar is finer than storage chunking, so an event is itself the
    // invalidation boundary even when it is too small to mint a stored chunk.
    horizon._cast?.delete(sourceId);
    horizon._surfaces?.delete(sourceId);

    const perturbation = adversariallyResolveAssertions(horizon, { sourceId, priors });
    const step = trajectoryStep({ event, i, prefixBytes, perturbation, priorFold });
    trajectory.push(step);
    priorFold = perturbation;
  }

  return freeze({ schema: EXPERIENCE_TRAJECTORY_SCHEMA, implementation: 'incremental', sourceId, eventCount: events.length, trajectory: freeze(trajectory) });
}
