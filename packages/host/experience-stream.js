// Constitutive adversarial reading: one canonical stateful pipeline.
//
// ExperienceStream -> Surf(t) -> prior Fold(t-1) -> tentative experience
// -> adversarial perturbation -> witnessed admission -> Fold(t) -> surprise.
//
// There is intentionally no second production reader. Temporal blindness is
// tested by changing/appending future events and proving earlier snapshots do
// not change.

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

export const EXPERIENCE_TRAJECTORY_SCHEMA = 'EOExperienceTrajectory@4';

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

// SURF perception is intentionally earlier and weaker than referent admission.
// It answers only: what candidate forms did THIS event make available to the
// reader? It does not say that a candidate is a being, nor that two surfaces
// name one being. Those are later, defeasible Fold questions.
const perceiveEvent = event => {
  const sentences = splitSentences(event.value);
  const surfaces = extractSurfaces(sentences);
  return freeze({
    sentences: freeze(sentences.map(s => freeze({ text:s.text, offset:s.offset, order:s.order }))),
    candidates: freeze(surfaces.map((s, i) => freeze({
      id: `surf:${i}:${diaNorm(s.surface)}`,
      display: s.surface,
      surfaces: freeze([s.surface]),
      mentions: s.mentions,
      sentenceOrders: freeze([...(s.sentences ?? [])]),
      standing: 'candidate',
      giver: 'event-local-perception',
    }))),
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
    }));
  }
  return freeze(out);
};

const admitExperienceCandidates = (entityReading, surf, event) => {
  arrive(entityReading, tokenize(event.value));
  // Witness what the present Surf actually exposed, independent of whether
  // document-scale cast discovery has enough evidence to project a referent.
  for (const c of surf.candidates ?? []) {
    for (const surface of c.surfaces ?? []) witnessArrival(entityReading, norm(surface));
  }
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

    // 1. SURF: perceive the arriving event before it is allowed to alter any
    // document-scale referent projection. This is candidate evidence only.
    const surfPerception = perceiveEvent(event);

    // 2. Material becomes available at the information horizon.
    admitChunked(horizon, { sourceId, text: event.value });
    prefixBytes += bytes(event.value);
    horizon._cast?.delete(sourceId);
    horizon._surfaces?.delete(sourceId);

    // 3. The accumulated horizon may propose referents/relations, but those
    // proposals do not themselves earn beinghood.
    const tentative = adversariallyResolveAssertions(horizon, { sourceId, priors });

    // 4. Witness the CURRENT Surf's candidate arrivals causally, then run the
    // entity birth/lapse gate over state that contains no future material.
    const changes = admitExperienceCandidates(entityReading, surfPerception, event);
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
