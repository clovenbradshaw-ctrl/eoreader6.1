// Convert a modality-neutral loops/surf ride into open-structure dynamics.
//
// A `broke` horizon means the prior continuation could not contain the new
// arrival. That opens an integration obligation. The first later `met` means
// the growing ground can again place an arrival; the outstanding break has
// been integrated and is released. `flat` is regularity and neither opens nor
// closes an obligation. This is intentionally weaker than tonal/narrative
// semantics and therefore valid for any scalar experiential series.

import { createOpenFrontier, advanceFrontier } from './frontier.js';
import { isGap } from '../../nul/index.js';

const freeze = x => Object.freeze(x);

export function frontierFromSurf(reading, { terrain = 'Field', kind = 'continuation_break' } = {}) {
  if (isGap(reading)) return reading;
  if (!Array.isArray(reading?.horizon)) throw new TypeError('frontierFromSurf: a loops/surf reading is required');

  const frontier = createOpenFrontier();
  const active = new Map();
  const trace = [];

  for (let i = 0; i < reading.horizon.length; i++) {
    const h = reading.horizon[i];
    if (h.outcome === 'broke') {
      const id = `surf-break:${h.anticipated.at}`;
      active.set(id, {
        id,
        terrain,
        kind,
        subject: { at: h.anticipated.at },
        standing: 'open',
        expectation: {
          reach: h.anticipated.reach,
          room: h.anticipated.room,
        },
        provenance: [{ giver: 'loops/surf', at: h.anticipated.at }],
        pressure: Math.max(1, Number(h.anticipated.room) || 1),
      });
    } else if (h.outcome === 'met' && active.size) {
      // The growing causal ground can place experience again. We do not claim
      // what musical/narrative resolution occurred; only that the outstanding
      // structural break has been integrated by the reader's own horizon.
      active.clear();
    }

    const state = advanceFrontier(frontier, {
      eventIndex: h.anticipated.at,
      recursive: { identityAlternatives: [] },
      perturbation: { links: [] },
      obligations: [...active.values()],
    });
    trace.push(freeze({
      at: h.anticipated.at,
      outcome: h.outcome,
      frontier: state,
    }));
  }

  return freeze({
    schema: 'EOSurfFrontier@1',
    trace: freeze(trace),
    final: trace.at(-1)?.frontier ?? null,
  });
}
