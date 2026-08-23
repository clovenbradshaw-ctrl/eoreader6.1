import { readFile } from "node:fs/promises";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import {
  createRecursiveReader, createCausalTextPerceiver, textEncounters,
  buildHypergraph, relevantHypergraphNeighborhood, deltaFold,
} from "../packages/engine/index.js";

const SOURCES = [
  "https://www.gutenberg.org/cache/epub/84/pg84.txt",
  "https://raw.githubusercontent.com/aibolem/Frankenstein_84/master/84.txt",
];
const posPrior = JSON.parse(await readFile(new URL("../bin/priors/pos/en-ud-ewt.json", import.meta.url), "utf8"));
let source = null;
let raw = null;
const failures = [];
for (const url of SOURCES) {
  try {
    const response = await fetch(url);
    if (!response.ok) { failures.push(`${url} -> ${response.status}`); continue; }
    const candidate = await response.text();
    const probe = stripContainer(candidate);
    if (!probe.looks_like_material) { failures.push(`${url} -> response did not look like material`); continue; }
    source = url; raw = candidate; break;
  } catch (error) { failures.push(`${url} -> ${error?.message ?? error}`); }
}
if (!raw) throw new Error(`failed to fetch Frankenstein from all sources: ${failures.join("; ")}`);

const work = stripContainer(raw);
const encounters = textEncounters(work.text, { source: "gutenberg:84", offset: work.offset });
const reader = createRecursiveReader({
  perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 2, refreshEvery: 25, posPrior })],
  adapters: { retrieve: () => ({}), interrogate: async () => [], revise: async () => deltaFold([]) },
});
for (const item of encounters) await reader.step(item);
const fold = reader.getFold();
const graph = buildHypergraph(fold.graphEntries);
const referents = graph.entries.filter((entry) => entry.schema === "EOReferent@1");
const mentions = graph.entries.filter((entry) => entry.schema === "EOMention@1");
const lexicalOccurrences = graph.entries.filter((entry) => entry.schema === "EOLexicalOccurrence@1");
const edges = graph.entries.filter((entry) => entry.schema === "EOHyperedge@1");
const gaps = graph.entries.filter((entry) => entry.schema === "EOReferentGap@1");

const relationIncidentCount = (id) => edges.filter((edge) => (edge.participants ?? []).some((p) => p.ref === id)).length;
const mentionCounts = new Map();
for (const mention of mentions) mentionCounts.set(mention.referent, (mentionCounts.get(mention.referent) ?? 0) + 1);
const referentRanking = referents
  .map((ref) => ({ id: ref.id, surfaces: ref.surfaces, mentions: mentionCounts.get(ref.id) ?? 0, semanticEdges: relationIncidentCount(ref.id) }))
  .sort((a, b) => b.mentions - a.mentions || b.semanticEdges - a.semanticEdges || a.id.localeCompare(b.id))
  .slice(0, 30);

const descriptorTerms = ["creature", "monster", "daemon", "demon", "wretch", "fiend"];
const descriptorKeys = descriptorTerms.map((term) => `surface:${term}`).filter((key) => (graph.incident.get(key)?.size ?? 0) > 0);
const descriptorOccurrences = lexicalOccurrences
  .filter((occ) => descriptorKeys.includes(occ.surfaceKey))
  .map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, encounterRef: occ.encounterRef, offset: occ.offset }));
const creatureNeighborhood = relevantHypergraphNeighborhood(graph, descriptorKeys, { maxHops: 3 });
const creatureEdges = creatureNeighborhood.entries
  .filter((entry) => entry.schema === "EOHyperedge@1")
  .slice(0, 80)
  .map((edge) => ({ id: edge.id, relation: edge.relation, participants: edge.participants, scope: edge.scope, polarity: edge.meta?.polarity ?? null }));
const creatureMentions = creatureNeighborhood.entries
  .filter((entry) => entry.schema === "EOMention@1")
  .slice(0, 80)
  .map((mention) => ({ id: mention.id, referent: mention.referent, encounterRef: mention.encounterRef }));

const relationCounts = new Map();
for (const edge of edges) relationCounts.set(edge.relation, (relationCounts.get(edge.relation) ?? 0) + 1);
const topRelations = [...relationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([relation, count]) => ({ relation, count }));
const unresolvedI = edges.filter((edge) => (edge.participants ?? []).some((p) => p.surfaceKey === "surface:i")).length;
const participants = edges.flatMap((edge) => edge.participants ?? []);
const boundParticipants = participants.filter((p) => p.standing === "referent").length;
const unresolvedParticipants = participants.filter((p) => p.standing === "unresolved_surface").length;

const report = {
  source,
  sourceFailures: failures,
  priors: [{ schema: posPrior.schema, giver: posPrior.provenance?.source }],
  sentences: encounters.length,
  observations: fold.witnessed.length,
  graphEntries: graph.entries.length,
  referents: referents.length,
  mentions: mentions.length,
  lexicalOccurrences: lexicalOccurrences.length,
  hyperedges: edges.length,
  referentGaps: gaps.length,
  participantBinding: { bound: boundParticipants, unresolved: unresolvedParticipants },
  unresolvedFirstPersonEdges: unresolvedI,
  topRelations,
  referentRanking,
  creature: {
    descriptorKeys,
    occurrenceCount: descriptorOccurrences.length,
    occurrences: descriptorOccurrences,
    neighborhoodEntries: creatureNeighborhood.entries.length,
    contextualSemanticEdges: creatureEdges,
    contextualNamedMentions: creatureMentions,
    note: "descriptor occurrences remain occurrence-local; encounter context retrieves co-present witnessed structure without asserting descriptor coreference",
  },
};

console.log("FRANKENSTEIN_HYPERGRAPH_REPORT_START");
console.log(JSON.stringify(report, null, 2));
console.log("FRANKENSTEIN_HYPERGRAPH_REPORT_END");
