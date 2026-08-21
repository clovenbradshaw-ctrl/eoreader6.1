// eoreader6 · tracking/arrival — one replayable before → arrival → revision
// → consequence record.
//
// This is orchestration, not a new perceiver.  The caller supplies the
// already-extracted triples and declares the act performed.  Terrain and
// stance are then derived from the operator algebra; prose is never classified
// into a terrain here.

import { canonicalHashSync } from "../../spec/canonical-json/index.js";
import { tick } from "../../../event_log/index.js";
import { cellOf } from "../operators.js";
import { revise, commit } from "../emergence/revision.js";
import { foldThrough } from "../emergence/tiers.js";
import { revealAndScore } from "../prediction/commitments.js";

export const CELL = Object.freeze({ op: "EVA", grain: "Pattern" });

const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
};

const graphEnvelope = (graph) => ({
  tick: graph.tick,
  gamma: graph.gamma,
  edgeTotal: graph.edgeTotal,
  nodes: [...graph.nodes.keys()].sort(),
  edges: [...graph.edges].sort(([a], [b]) => a.localeCompare(b)),
});

const tierEnvelope = (tiers) => tiers.map((tier) => ({
  name: tier.name,
  total: tier.total,
  observations: tier.observations,
  prior: [...tier.prior].sort(([a], [b]) => a.localeCompare(b)),
}));

// `foldThrough().top` names the highest tier ATTEMPTED.  A failed Paradigm
// observation is not a Paradigm reconstruction, so navigation and REC must
// name the highest tier whose own gate actually passed instead.
const highestPassedTier = (folded) => {
  const passed = folded?.results?.filter((result) => result.passed) ?? [];
  return passed[passed.length - 1]?.tier ?? null;
};

/**
 * Construct the stateful tracker.  Statistical degrees of freedom remain
 * declared at construction; no arrival may silently choose its own ground.
 */
export const createArrivalTracker = ({ graph, tiers, log, draws, seed, alpha = 1 }) => {
  if (!graph || !(graph.edges instanceof Map)) throw new TypeError("createArrivalTracker: graph is required");
  if (!Array.isArray(tiers) || tiers.length === 0) throw new TypeError("createArrivalTracker: a non-empty tier stack is required");
  if (!log || !Array.isArray(log.events)) throw new TypeError("createArrivalTracker: event log is required");
  if (!Number.isInteger(draws) || draws < 2) throw new TypeError("createArrivalTracker: draws is declared and must be >= 2");
  if (!Number.isInteger(seed)) throw new TypeError("createArrivalTracker: seed is declared");
  return { graph, tiers, log, draws, seed, alpha };
};

/**
 * A conservative cast view over committed belief.  This is deliberately an
 * importance VECTOR, never a leaderboard: recurrence, structural movement,
 * and standing revisions answer different questions and must not be collapsed
 * into a charismatic but unjustified score.  Unstable arrivals are surfaced
 * as unresolved evidence, but cannot add weight to the believed cast.
 */
export const castBelief = (log) => {
  if (!log || !Array.isArray(log.events)) throw new TypeError("castBelief: event log is required");
  const cast = new Map();
  const get = (referent) => {
    if (!cast.has(referent)) cast.set(referent, {
      referent, committedArrivals: 0, standpointChanges: 0, beliefMovement: 0,
      standingRevisions: [], unresolvedArrivals: 0,
    });
    return cast.get(referent);
  };

  for (const event of log.events.filter((entry) => entry.type === "EVA.arrival")) {
    if (event.status !== "committed") {
      for (const referent of event.scope?.referents ?? []) get(referent).unresolvedArrivals++;
      continue;
    }
    for (const referent of new Set(event.scope?.referents ?? [])) get(referent).committedArrivals++;
    for (const standpoint of event.measurement?.standpoints ?? []) {
      const record = get(standpoint.node);
      record.standpointChanges++;
      record.beliefMovement += standpoint.moved;
    }
    for (const revision of event.consequence?.standingRevisions ?? [])
      get(revision.referent ?? revision.node).standingRevisions.push({ ...revision, eventId: event.event_id });
  }

  return Object.freeze([...cast.values()].map((record) => freeze({
    ...record,
    // "Important" here means worth attention, not ontologically settled.
    needsAttention: record.unresolvedArrivals > 0 || record.standingRevisions.length > 0,
  })));
};

/**
 * Admit one already-perceived arrival.  All validation and prediction scoring
 * happens before belief is advanced.  The immutable event is appended only
 * after graph and tier measurements succeed, so the log never contains a
 * half-written arrival.
 */
export const trackArrival = (tracker, arrival) => {
  if (!tracker || typeof tracker !== "object") throw new TypeError("trackArrival: tracker is required");
  if (!arrival || typeof arrival !== "object") throw new TypeError("trackArrival: arrival is required");
  if (!arrival.source || typeof arrival.source.sourceId !== "string")
    throw new TypeError("trackArrival: source.sourceId is required");
  if (!Number.isInteger(arrival.source.cursor) || arrival.source.cursor < 0)
    throw new TypeError("trackArrival: source.cursor is a declared non-negative integer");
  if (!Array.isArray(arrival.triples) || arrival.triples.length === 0)
    throw new TypeError("trackArrival: non-empty triples are required");
  if (!arrival.act || typeof arrival.act.op !== "string" || typeof arrival.act.grain !== "string")
    throw new TypeError("trackArrival: act { op, grain } must be declared by the performing organ");

  const phasepost = cellOf(arrival.act.op, arrival.act.grain);
  if (phasepost.gap) throw new TypeError(`trackArrival: invalid phasepost: ${phasepost.reason}`);

  const before = {
    graphHash: canonicalHashSync(graphEnvelope(tracker.graph)),
    terrainStateHash: canonicalHashSync(tierEnvelope(tracker.tiers)),
    activePriorHashes: [...(arrival.activePriorHashes ?? [])],
  };

  // Predictions are sealed elsewhere, before this reveal.  This layer only
  // joins their proper scores to the arrival at its explicitly named cursor.
  const prediction = (arrival.predictions ?? []).map(({ commitment, observed, scoringRule, settled }) =>
    revealAndScore({
      commitment,
      observed,
      revealed_at_step: arrival.source.cursor,
      scoring_rule: scoringRule,
      settled,
    }));

  const revision = revise(tracker.graph, arrival.triples, {
    draws: tracker.draws,
    seed: tracker.seed + arrival.source.cursor,
    alpha: tracker.alpha,
  });
  if (revision.gap) return revision;

  // High movement under unresolved identity/frame evidence is a request for
  // more reading, not permission to rewrite belief.  Keep the counterfactual
  // revision in the trail, but do not mutate the graph or the interpretive
  // tiers until the caller returns with the ambiguity resolved.
  const ambiguities = [...(arrival.ambiguities ?? [])];
  if (ambiguities.length > 0) {
    return tick(tracker.log, freeze({
      type: "EVA.arrival",
      schema: "TerrainArrival@1",
      source: { ...arrival.source },
      scope: {
        referents: [...(arrival.scope?.referents ?? [])],
        frame: arrival.scope?.frame ?? null,
        horizon: arrival.scope?.horizon ?? null,
      },
      phasepost,
      before,
      arrival: {
        surfaces: [...(arrival.surfaces ?? [])],
        triples: arrival.triples.map((triple) => ({ ...triple })),
        absences: [...(arrival.absences ?? [])],
        witnesses: [...(arrival.witnesses ?? [])],
      },
      measurement: {
        prediction,
        operatorVector: { ...revision.counts, REC: 0 },
        revision,
        graphBreadth: revision.breadth,
        standpoints: revision.standpoints,
        tierReached: null,
        tierFold: null,
      },
      clarification: {
        ambiguities,
        action: "surf_more",
        reason: "surprise under unresolved identity or frame evidence is a cue to inspect, not a license to commit",
      },
      consequence: { status: "not_yet_measured", needs: "resolved ambiguity and a later arrival" },
      status: "unstable",
    }));
  }

  const operatorArrival = new Map(Object.entries(revision.counts).filter(([, count]) => count > 0));
  const tiers = operatorArrival.size ? foldThrough(tracker.tiers, operatorArrival, { alpha: tracker.alpha }) : null;
  const tierReached = highestPassedTier(tiers);
  const committedRevision = commit(tracker.graph, revision, { alpha: tracker.alpha });

  const body = freeze({
    type: "EVA.arrival",
    schema: "TerrainArrival@1",
    source: { ...arrival.source },
    scope: {
      referents: [...(arrival.scope?.referents ?? [])],
      frame: arrival.scope?.frame ?? null,
      horizon: arrival.scope?.horizon ?? null,
    },
    phasepost,
    before,
    arrival: {
      surfaces: [...(arrival.surfaces ?? [])],
      triples: arrival.triples.map((triple) => ({ ...triple })),
      absences: [...(arrival.absences ?? [])],
      witnesses: [...(arrival.witnesses ?? [])],
    },
    measurement: {
      prediction,
      operatorVector: { ...revision.counts, REC: tierReached?.toLowerCase() === "paradigm" ? 1 : 0 },
      revision: committedRevision,
      graphBreadth: revision.breadth,
      standpoints: revision.standpoints,
      tierReached,
      tierFold: tiers,
    },
    consequence: arrival.consequence ?? { status: "not_yet_measured" },
    status: "committed",
  });

  return tick(tracker.log, body);
};
