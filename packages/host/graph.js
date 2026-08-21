// eoreader6 · packages/host/graph — the host face of the belief graph.
//
// Wires two organs that already existed but had never been connected:
// corpus.js's per-document (subject, verb, object) triples (sessionRelations,
// itself discoveredCast's own `relations` — measured for the individuation
// classifier's `agency` signal and now exposed for this too), and
// emergence/graph.js's decaying Network, which has taken triples since it
// was written but had no caller anywhere in this repo. A session now carries
// one graph across every document it admits, so a relation restated in a
// later document still moves the same belief a first document formed.
//
// IDENTITY, CANONICALISED THROUGH THE CAST — emergence/graph.js's own header
// invites this ("feed it raw surfaces and it builds a surface graph; feed it
// resolved referent ids and it builds a referent graph"): a triple's
// subject/object is rewritten to the document's resolved referent id when
// exactly one of sessionReferents' surfaces occurs in the phrase, so "to
// Alice" and "Alice" accumulate as one being rather than two surface nodes.
// Ambiguous phrases naming more than one referent, and sides with no match,
// remain surfaces rather than receiving a guessed identity.
//
// NO NEW NODE KIND. This organ instantiates emergence/graph.js's own SYN ·
// Pattern · Composing cell at host tier (parallel to how host/corpus.js's
// admitChunked instantiates INS · Ground at host tier) — it is wiring, not a
// new measurement.

import { createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey } from "../engine/emergence/graph.js";
import { sessionRelations, sessionReferents } from "./corpus.js";
import { diaNorm } from "../engine/perceiver/text/surfaces.js";
import { isFirstPerson, narratorAt, resolveAllNarratorSpans } from "../engine/perceiver/text/narrator.js";

export { createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey };

// The cell this host organ occupies on the operator grid (engine/operators.js):
// SYN · Pattern · Composing — the same cell emergence/graph.js declares;
// admitGraph is that organ's host-tier caller. Declared, checked by
// conformance.
export const CELL = Object.freeze({ op: "SYN", grain: "Pattern" });

// gamma/pruneBelow are declared, never defaulted, inside emergence/graph.js
// itself (createGraph throws without them) — these two numbers are this
// host's OWN declared starting point for a chat-scale session (a handful of
// uploaded documents plus a running conversation, not a corpus-scale read),
// the same standing corpus.js's own CHUNK_SIZE already holds: an engineering
// starting point, not yet validated against a retrieval-quality golden.
const DEFAULT_GAMMA = 0.85;
const DEFAULT_PRUNE_BELOW = 0.05;

export function attachGraph(session, { gamma = DEFAULT_GAMMA, pruneBelow = DEFAULT_PRUNE_BELOW } = {}) {
  if (!session.graph) session.graph = createGraph({ gamma, pruneBelow });
  return session.graph;
}

// One document's received+discovered cast, as a surface -> referent id
// lookup, longest surface first so "Victor Frankenstein" claims a mention
// before "Frankenstein" alone gets the chance to. Exported since the staged
// admission in host/terrains.js needs the SAME canonicalisation per batch —
// a second copy of this logic would drift (SEED.md #5: two grounds built to
// different specs were never comparable).
export function referentLookup(session, sourceId, { priors = [] } = {}) {
  const { referents } = sessionReferents(session, { sourceId, priors, limit: Infinity });
  const entries = [];
  for (const r of referents) {
    const surfaces = r.surfaces
      .map((surface) => typeof surface === "string" ? surface : surface?.surface)
      .filter(Boolean);
    for (const surface of surfaces) entries.push({ surface: diaNorm(surface), referentId: r.id });
  }
  entries.sort((a, b) => b.surface.length - a.surface.length);

  const doc = session.documents.get(sourceId);
  const body = doc?.text || doc?.chunks?.map((chunk) => chunk.text).join("\n") || "";
  const { resolved: narratorSpans, unresolved: narratorGaps } = resolveAllNarratorSpans(body, priors);
  const priorIds = new Set(priors.map((prior) => prior.id).filter(Boolean));
  const lookup = new Map(entries.map((entry) => [entry.surface, entry.referentId]));
  lookup.entriesSorted = entries;
  lookup.narratorSpans = narratorSpans;
  lookup.narratorGaps = narratorGaps;
  lookup.priorIds = priorIds;
  lookup.resolve = (side, offset) => canonicalize(side, offset, lookup);
  return lookup;
}

const includesSurface = (phrase, surface) => {
  let at = phrase.indexOf(surface);
  while (at !== -1) {
    const before = at === 0 ? "" : phrase[at - 1];
    const after = at + surface.length === phrase.length ? "" : phrase[at + surface.length];
    if ((!before || !/[\p{L}\p{N}]/u.test(before)) && (!after || !/[\p{L}\p{N}]/u.test(after))) return true;
    at = phrase.indexOf(surface, at + 1);
  }
  return false;
};

const canonicalize = (side, offset, resolver) => {
  const phrase = diaNorm(side);
  if (isFirstPerson(phrase)) {
    const narrator = narratorAt(offset, resolver.narratorSpans);
    if (narrator.referentId) {
      const raw = narrator.referentId.replace(/^ref:narrator:/, "");
      return resolver.priorIds.has(raw) ? raw : narrator.referentId;
    }
  }

  const matches = new Set();
  for (const entry of resolver.entriesSorted) if (includesSurface(phrase, entry.surface)) matches.add(entry.referentId);
  return matches.size === 1 ? [...matches][0] : side;
};

/** Resolve relation sides to beings before they enter Network. */
export function resolveRelations(session, { sourceId, priors = [] } = {}) {
  const { relations, gaps } = sessionRelations(session, { sourceId });
  const resolver = referentLookup(session, sourceId, { priors });
  return {
    relations: relations.map((relation) => ({
      subject: resolver.resolve(relation.subject, relation.subjectOffset ?? relation.offset),
      verb: relation.verb,
      object: resolver.resolve(relation.object, relation.objectOffset ?? relation.offset),
      polarity: relation.polarity,
      offset: relation.offset,
    })),
    gaps: [...gaps, ...resolver.narratorGaps],
  };
}

/**
 * Read one (or every) admitted document's relations into the session's
 * graph. Idempotent per call is NOT claimed here — readTriples advances the
 * graph's belief on every call, by design (a relation restated is evidence,
 * not a duplicate) — so a caller that must not double-count a document it
 * has already admitted (eowebllm's chat store, admitting once per document
 * version) tracks that itself, the same discipline admitChunked's own
 * content-addressed dedup guard already keeps at the corpus tier, one layer
 * down.
 */
export function admitGraph(session, { sourceId, gamma, pruneBelow, alpha = 1, priors = [] } = {}) {
  const graph = attachGraph(session, { gamma, pruneBelow });
  const targets = sourceId ? [sourceId] : Array.from(session.documents.keys());
  const results = [];
  for (const id of targets) {
    const { relations, gaps } = resolveRelations(session, { sourceId: id, priors });
    if (!relations.length) {
      results.push({ sourceId: id, stated: 0, newEdges: 0, newNodes: 0, gaps });
      continue;
    }
    const movement = readTriples(graph, relations, { alpha, structural: true });
    results.push({ sourceId: id, ...movement, gaps });
  }
  return { graph, admitted: results };
}

/** A plain-data view of the current graph, for a caller that must not hold a live Map (serialization, a UI list, a background-model prompt). */
export function sessionGraphSnapshot(session, { limit = 25 } = {}) {
  const graph = session.graph;
  if (!graph) return { nodes: [], edges: [], tick: 0, edgeTotal: 0, nodeCount: 0, edgeCount: 0 };
  return {
    nodes: [...graph.nodes.values()]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, limit)
      .map((n) => ({ ...n })),
    edges: strongestEdges(graph, limit),
    tick: graph.tick,
    edgeTotal: graph.edgeTotal,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.size,
  };
}
