// Constitutive adversarial reading: the atomic unit is an experience event.
//
// This module deliberately enforces the information horizon by constructing
// each tentative experience from the prefix available at t. A later event is
// therefore incapable of changing an earlier snapshot. The existing
// assertion resolver is used as a library of attacks INSIDE the transition;
// only the perturbed result is admitted to the experiential Fold.

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

/**
 * Read an already ordered ExperienceStream blindly.
 *
 * Transition:
 *   Surf(t) -> tentative horizon -> perturb -> Fold(t) -> surprise delta.
 *
 * A fresh horizon session is intentional in this first canonical form. It is
 * slower than an incremental cache, but it makes the temporal invariant
 * mechanically strong: Fold(t) is a pure function of events <= t. An
 * optimized implementation may reuse state only if trajectory conformance
 * proves byte-for-byte equivalent horizons.
 */
export function readExperienceStream({ sourceId, events, priors = [] } = {}) {
  if (!sourceId) throw new TypeError('readExperienceStream: sourceId is required');
  if (!Array.isArray(events)) throw new TypeError('readExperienceStream: events must be an ordered array');

  const trajectory = [];
  let prefix = '';
  let priorFold = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || event.kind !== 'text') throw new TypeError(`readExperienceStream: event ${i} is not a supported text experience`);
    prefix += event.value;

    // SURF: encounter only the prefix currently available.
    const horizon = createSession();
    admitChunked(horizon, { sourceId, text: prefix });

    // PERTURB BEFORE FOLD: parser output is tentative. The adversarial attack
    // library gets only the horizon session; its resolved state, not the raw
    // parser assertion set, becomes this event's Fold.
    const perturbation = adversariallyResolveAssertions(horizon, { sourceId, priors });
    const delta = structuralDelta(priorFold, perturbation);

    const fold = freeze({
      cursor: freeze({ event: i, byteEnd: event.end ?? bytes(prefix) }),
      cast: perturbation.cast,
      links: perturbation.links,
      unresolved: freeze([
        ...perturbation.cast.filter(x => String(x.disposition).startsWith('unresolved') || String(x.disposition).startsWith('needs_')),
        ...perturbation.links.filter(x => x.disposition !== 'survives' && x.disposition !== 'survives_scoped'),
      ]),
    });

    trajectory.push(freeze({
      event: i,
      surf: freeze({ ...event, horizonByteEnd: bytes(prefix) }),
      perturbation,
      fold,
      delta,
    }));
    priorFold = perturbation;
  }

  return freeze({ schema: EXPERIENCE_TRAJECTORY_SCHEMA, sourceId, eventCount: events.length, trajectory: freeze(trajectory) });
}
