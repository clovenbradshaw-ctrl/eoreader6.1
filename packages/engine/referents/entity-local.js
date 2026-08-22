// Local entity admission/review for causal proposition reading.
//
// A normal observation should touch only the beings/candidates whose evidence
// changed. Full-register review is an explicit assertion/audit operation.
// Book reading may set `state.deferAssertions = true`: arrivals are still
// appended exactly as witnessed, but no beinghood claim is repeatedly proved
// while evidence is merely accumulating.

import { admitEntity, admitFromArrivals } from './entity.js';

const unique = xs => [...new Set((xs ?? []).filter(Boolean))];

export function reviewTouchedEntities(state, surfaces = []) {
  if (state?.deferAssertions) return 0;
  let lapsedCount = 0;
  for (const surface of unique(surfaces)) {
    const entity = state.entities.get(surface);
    if (!entity) continue;
    const result = admitFromArrivals(state, state.arrivals.get(surface));
    if (result.admitted) continue;
    if (!state.lapsed) state.lapsed = new Map();
    if (!state.lapsed.has(surface)) state.lapsed.set(surface, []);
    state.lapsed.get(surface).push({ at: state.unit, was: entity, why: result.why });
    state.entities.delete(surface);
    lapsedCount++;
  }
  return lapsedCount;
}

export function offerTouchedCandidates(state, surfaces = []) {
  if (state?.deferAssertions) return 0;
  let born = 0;
  for (const surface of unique(surfaces)) {
    const at = state.arrivals.get(surface);
    if (!at || state.entities.has(surface) || at.length < state.spec.minArrivals) continue;
    const r = admitEntity(state, surface);
    if (r.admitted) {
      born++;
      state.refused.delete(surface);
    } else state.refused.set(surface, r.why);
  }
  return born;
}
