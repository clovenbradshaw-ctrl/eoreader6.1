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
import { tokenize } from '../engine/perceiver/text/material.js';
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

export const EXPERIENCE_TRAJECTORY_SCHEMA = 'EOExperienceTrajectory@2';

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

const surfacePresent = (text, surface) => {
  const needle = norm(surface);
  if (!needle) return false;
  const hay = ` ${norm(text)} `;
  return hay.includes(` ${needle} `);
};

const candidateSnapshot = proposed => freeze((proposed.cast ?? []).map(x => freeze({
  referent: x.referent,
  display: x.display,
  surfaces: freeze([...(x.surfaces ?? [])]),
  disposition: x.disposition,
})));

const admitExperienceCandidates = (entityReading, proposed, event) => {
  // ③ INS · Figure's ground arrives before this unit's candidates are offered.
  // Surprisal is therefore measured against the lexicon as it stood BEFORE
  // this event, exactly as entity.js requires.
  arrive(entityReading, tokenize(event.value));

  // Perception can propose many surfaces from the prefix. Only a surface
  // actually present in THIS Surf earns an arrival at THIS reading unit. No
  // later discovery may backfill an earlier arrival.
  for (const c of proposed.cast ?? []) {
    for (const surface of c.surfaces ?? []) {
      if (surfacePresent(event.value, surface)) witnessArrival(entityReading, norm(surface));
    }
  }

  // Existing beliefs are re-tested against the grown reading before new births
  // are offered. A lapse is a real Fold withdrawal; a refusal stays a gap.
  const lapsed = reviewEntities(entityReading);
  const born = offerCandidates(entityReading);
  return { born, lapsed };
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

  // A relation may point from an admitted being to a non-being (a door, a
  // place, a value). Requiring both ends to be admitted entities would erase
  // ordinary meaning. The subject, however, must be an admitted being rather
  // than a surface candidate masquerading as one.
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

const admissionSnapshot = (entityReading, proposed, changes) => freeze({
  candidates: candidateSnapshot(proposed),
  beings: freeze(carryEntities(entityReading).map(e => freeze({ ...e, surfaces: freeze([...(e.surfaces ?? [])]) }))),
  refusals: freeze(refusals(entityReading).map(x => freeze({ ...x }))),
  lapsed: freeze(lapsedEntities(entityReading).map(x => freeze({ ...x }))),
  bornThisEvent: changes.born,
  lapsedThisEvent: changes.lapsed,
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

const trajectoryStep = ({ event, i, prefixBytes, proposed, perturbation, admission, priorFold }) => {
  const delta = structuralDelta(priorFold, perturbation);
  const fold = foldFrom(perturbation, i, event.end ?? prefixBytes);
  return freeze({
    event: i,
    surf: freeze({ ...event, horizonByteEnd: prefixBytes }),
    tentative: proposed,
    admission,
    perturbation,
    fold,
    delta,
  });
};

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

const runCausalPrefix = ({ sourceId, events, priors, entitySpec }) => {
  const horizon = createSession();
  const entityReading = openReading(entitySpec);
  const trajectory = [];
  let priorFold = null;
  let prefixBytes = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    admitChunked(horizon, { sourceId, text: event.value });
    prefixBytes += bytes(event.value);
    horizon._cast?.delete(sourceId);
    horizon._surfaces?.delete(sourceId);

    const proposed = adversariallyResolveAssertions(horizon, { sourceId, priors });
    const changes = admitExperienceCandidates(entityReading, proposed, event);
    const perturbation = gateThroughWitnessedBeings(proposed, entityReading);
    const admission = admissionSnapshot(entityReading, proposed, changes);
    const step = trajectoryStep({ event, i, prefixBytes, proposed, perturbation, admission, priorFold });
    trajectory.push(step);
    priorFold = perturbation;
  }
  return trajectory;
};

/**
 * Reference blind reader. Every requested Fold(t) is obtained by replaying
 * exactly the prefix through the causal admission assembly. This is expensive
 * on purpose: future material is mechanically unable to influence the state.
 */
export function readExperienceStream({ sourceId, events, priors = [], entitySpec } = {}) {
  validate({ sourceId, events, entitySpec });
  const trajectory = [];
  for (let i = 0; i < events.length; i++) {
    const prefix = runCausalPrefix({ sourceId, events: events.slice(0, i + 1), priors, entitySpec });
    trajectory.push(prefix.at(-1));
  }
  return freeze({ schema: EXPERIENCE_TRAJECTORY_SCHEMA, implementation: 'prefix-oracle', sourceId, eventCount: events.length, trajectory: freeze(trajectory) });
}

/**
 * Operational blind reader. One corpus horizon and one witnessed entity
 * reading survive across the trajectory. Its semantics are allowed only while
 * conformance proves equality with the prefix oracle at every Fold boundary.
 */
export function readExperienceStreamIncremental({ sourceId, events, priors = [], entitySpec } = {}) {
  validate({ sourceId, events, entitySpec });
  const trajectory = runCausalPrefix({ sourceId, events, priors, entitySpec });
  return freeze({ schema: EXPERIENCE_TRAJECTORY_SCHEMA, implementation: 'incremental', sourceId, eventCount: events.length, trajectory: freeze(trajectory) });
}
