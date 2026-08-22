// Convert a modality-neutral loops/surf ride into open-structure dynamics.
//
// A `broke` horizon means the prior continuation could not contain the new
// arrival. The FIRST break opens one integration obligation. Further broke or
// flat steps carry that same obligation; they do not mint one obligation per
// frame. The first later `met` means the growing ground can again place an
// arrival and closes the episode. This is intentionally weaker than tonal or
// narrative semantics and therefore valid for any scalar experiential series.

import { createOpenFrontier, advanceFrontier } from './frontier.js';
import { isGap } from '../../nul/index.js';

const freeze = x => Object.freeze(x);

export function frontierFromSurf(reading, { terrain = 'Field', kind = 'continuation_break' } = {}) {
  if (isGap(reading)) return reading;
  if (!Array.isArray(reading?.horizon)) throw new TypeError('frontierFromSurf: a loops/surf reading is required');

  const frontier = createOpenFrontier();
  let active = null;
  let episode = 0;
  const trace = [];

  for (let i = 0; i < reading.horizon.length; i++) {
    const h = reading.horizon[i];

    if (h.outcome === 'broke') {
      if (!active) {
        active = {
          id: `surf-break:${episode++}:${h.anticipated.at}`,
          terrain,
          kind,
          subject: { openedAt: h.anticipated.at },
          standing: 'open',
          expectation: {
            reach: h.anticipated.reach,
            room: h.anticipated.room,
          },
          provenance: [{ giver: 'loops/surf', at: h.anticipated.at, outcome: 'broke' }],
          // One episode, one structural obligation. Persistence is already
          // accounted for by frontier age; room supplies only the event's
          // directly measured structural pressure floor.
          pressure: Math.max(1, Number(h.anticipated.room) || 1),
        };
      } else {
        // Carry the same episode and append evidence. Replace rather than
        // mutate so previously committed frontier snapshots cannot change.
        active = {
          ...active,
          expectation: {
            reach: h.anticipated.reach,
            room: h.anticipated.room,
          },
          provenance: [
            ...(active.provenance ?? []),
            { giver: 'loops/surf', at: h.anticipated.at, outcome: 'broke' },
          ],
          pressure: Math.max(active.pressure ?? 1, Math.max(1, Number(h.anticipated.room) || 1)),
        };
      }
    } else if (h.outcome === 'met' && active) {
      // `met` closes the current integration episode. We do not claim WHAT
      // musical/narrative resolution occurred, only that the same causal
      // horizon can place experience again.
      active = null;
    }
    // `flat` neither opens nor closes. If an episode is active it remains
    // outstanding and therefore continues to accumulate tension by age.

    const state = advanceFrontier(frontier, {
      eventIndex: h.anticipated.at,
      recursive: { identityAlternatives: [] },
      perturbation: { links: [] },
      obligations: active ? [active] : [],
    });
    trace.push(freeze({
      at: h.anticipated.at,
      outcome: h.outcome,
      frontier: state,
    }));
  }

  return freeze({
    schema: 'EOSurfFrontier@2',
    trace: freeze(trace),
    final: trace.at(-1)?.frontier ?? null,
  });
}
