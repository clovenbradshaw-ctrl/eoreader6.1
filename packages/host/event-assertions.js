// Event-local assertion projection for constitutive reading.
//
// Normal reading appends observations. The Fold decides what those observations
// do to the accumulated world. This module therefore projects ONLY the current
// event's witnessed forms and role relations into the compatibility assertion
// surface needed by the frontier/witness gate. It never scans the accumulated
// document and never performs a second extraction pass.

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const EVENT_ASSERTION_SCHEMA = 'EOEventAssertions@1';

export function eventAssertions({ sourceId, surf, observations } = {}) {
  const cast = [];
  const seen = new Set();
  for (const candidate of surf?.candidates ?? []) {
    if (!candidate.witnessable) continue;
    const surfaces = candidate.surfaces ?? (candidate.display ? [candidate.display] : []);
    const face = norm(surfaces[0] ?? candidate.display);
    if (!face || seen.has(face)) continue;
    seen.add(face);
    cast.push(freeze({
      kind: 'Entity',
      referent: face,
      display: candidate.display ?? surfaces[0] ?? face,
      surfaces: freeze([...surfaces]),
      disposition: 'survives',
      attacks: freeze([]),
      provenance: freeze({ sourceId, giver: candidate.giver, eventLocal: true }),
    }));
  }

  const links = [];
  for (const relation of observations?.relations ?? []) {
    const actor = (relation.participants ?? []).find(p => p.role === 'actor');
    const undergoer = (relation.participants ?? []).find(p => p.role === 'undergoer');
    if (!actor || !undergoer) continue;
    links.push(freeze({
      kind: 'Link',
      assertion: freeze({
        subject: actor.value,
        predicate: relation.relation,
        verb: relation.relation,
        object: undergoer.value,
        polarity: relation.polarity ?? 1,
        scope: relation.scope ?? null,
        witness: relation.witness ?? null,
      }),
      disposition: 'survives',
      perturbations: freeze({ oppositePolarity: freeze([]), competingObject: freeze([]), scopeSplit: false }),
      provenance: freeze({ sourceId, relationId: relation.id, eventLocal: true }),
    }));
  }

  return freeze({
    schema: EVENT_ASSERTION_SCHEMA,
    sourceId,
    cast: freeze(cast),
    links: freeze(links),
  });
}
