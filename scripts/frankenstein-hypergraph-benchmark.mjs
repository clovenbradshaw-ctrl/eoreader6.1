import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import {
  createRecursiveReader, createCausalTextPerceiver, textEncounters,
  buildHypergraph, relevantHypergraphNeighborhood, deltaFold,
} from "../packages/engine/index.js";

const SOURCES = [
  "https://www.gutenberg.org/cache/epub/84/pg84.txt",
  "https://raw.githubusercontent.com/aibolem/Frankenstein_84/master/84.txt",
];

let source = null;
let raw = null;
const failures = [];
for (const url of SOURCES) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      failures.push(`${url} -> ${response.status}`);
      continue;
    }
    const candidate = await response.text();
    const probe = stripContainer(candidate);
    if (!probe.looks_like_material) {
      failures.push(`${url} -> response did not look like material`);
      continue;
    }
    source = url;
    raw = candidate;
    break;
  } catch (error) {
    failures.push(`${url} -> ${error?.message ?? error}`);
  }
}
if (!raw) throw new Error(`failed to fetch Frankenstein from all sources: ${failures.join("; ")}`);

const work = stripContainer(raw);
const encounters = textEncounters(work.text, { source: "gutenberg:84", offset: work.offset });
const reader = createRecursiveReader({
  perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25 })],
  adapters: {
    retrieve: () => ({}),
    interrogate: async () => [],
    revise: async () => deltaFold([]),
  },
});

// Stream the authored-order encounters. reader.read() intentionally retains
// each Turn for callers that need a full trace; a novel benchmark only needs
// the append-only reader state and final Fold. Retaining every historical Fold
// array makes memory grow quadratically with book length and tests snapshot
// retention rather than reading.
for (const item of encounters) await reader.step(item);
const fold = reader.getFold();

const graph = buildHypergraph(fold.graphEntries);
const referents = graph.entries.filter((entry) => entry.schema === "EOReferent@1");
const edges = graph.entries.filter((entry) => entry.schema === "EOHyperedge@1");
const gaps = graph.entries.filter((entry) => entry.schema === "EOReferentGap@1");

const incidentCount = (id) => graph.incident.get(id)?.size ?? 0;
const cast = referents
  .map((ref) => ({ id: ref.id, surfaces: ref.surfaces, incidentEdges: incidentCount(ref.id) }))
  .sort((a, b) => b.incidentEdges - a.incidentEdges || a.id.localeCompare(b.id))
  .slice(0, 30);

const descriptorTerms = ["creature", "monster", "daemon", "demon", "wretch", "being"];
const descriptorRefs = new Set();
for (const edge of edges) {
  for (const participant of edge.participants ?? []) {
    if (participant.standing !== "unresolved_surface") continue;
    const surface = String(participant.surface ?? "").toLowerCase();
    if (descriptorTerms.some((term) => surface.includes(term))) descriptorRefs.add(participant.ref);
  }
}
const creatureFragments = [...descriptorRefs]
  .map((id) => ({ id, incidentEdges: incidentCount(id) }))
  .sort((a, b) => b.incidentEdges - a.incidentEdges);
const creatureNeighborhood = relevantHypergraphNeighborhood(graph, [...descriptorRefs], { maxHops: 2 });
const creatureEdges = creatureNeighborhood.entries
  .filter((entry) => entry.schema === "EOHyperedge@1")
  .slice(0, 80)
  .map((edge) => ({
    id: edge.id,
    relation: edge.relation,
    participants: edge.participants,
    scope: edge.scope,
    polarity: edge.meta?.polarity ?? null,
  }));

const report = {
  source,
  sourceFailures: failures,
  sentences: encounters.length,
  observations: fold.witnessed.length,
  graphEntries: graph.entries.length,
  referents: referents.length,
  hyperedges: edges.length,
  referentGaps: gaps.length,
  cast,
  creature: {
    fragmentCount: creatureFragments.length,
    fragments: creatureFragments,
    neighborhoodEntries: creatureNeighborhood.entries.length,
    sampleEdges: creatureEdges,
    note: "descriptor fragments are surface nodes, not asserted coreferent referents; fragmentation is a measured gap",
  },
};

console.log("FRANKENSTEIN_HYPERGRAPH_REPORT_START");
console.log(JSON.stringify(report, null, 2));
console.log("FRANKENSTEIN_HYPERGRAPH_REPORT_END");
