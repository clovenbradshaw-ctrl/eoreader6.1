import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecursiveReader, createCausalTextPerceiver, textEncounters,
  buildHypergraph, relevantHypergraphNeighborhood, deltaFold,
} from "../packages/engine/index.js";

test("real text perceiver carries witnessed hyperedges into Fold graph", async () => {
  const text = [
    "Today Alice greeted Bob.",
    "Later Carol greeted Alice.",
    "Again Alice greeted Carol.",
    "Then Bob greeted Alice.",
    "Soon Carol greeted Bob.",
    "Finally Alice greeted Bob.",
  ].join(" ");
  const reader = createRecursiveReader({
    perceivers: [createCausalTextPerceiver({ minRelationSurfaces: 1, refreshEvery: 1 })],
    adapters: {
      retrieve: () => ({}),
      interrogate: async () => [],
      revise: async () => deltaFold([]),
    },
  });
  const out = await reader.read(textEncounters(text, { source: "fixture" }));
  const graph = buildHypergraph(out.fold.graphEntries);
  const edges = graph.entries.filter((entry) => entry.schema === "EOHyperedge@1");
  assert.ok(edges.length > 0, "expected relation hyperedges from real text");
  assert.ok(out.fold.witnessed.some((obs) => (obs.hyperedges ?? []).length > 0), "witness must preserve hyperedges");
});

test("graph-native neighborhood reaches relations through participant identity", () => {
  const entries = [
    { schema: "EOReferent@1", id: "ref:alice", surfaces: ["Alice"] },
    { schema: "EOHyperedge@1", id: "edge:1", relation: "greets", participants: [{ role: "subject", ref: "ref:alice" }, { role: "object", ref: "surface:traveler" }] },
    { schema: "EOObligation@1", id: "obligation:1", distinction: "response owed", grounds: ["edge:1"], alternatives: [], consequences: [], status: "open" },
  ];
  const graph = buildHypergraph(entries);
  const hood = relevantHypergraphNeighborhood(graph, ["ref:alice"], { maxHops: 3 });
  assert.ok(hood.ids.includes("edge:1"));
  assert.ok(hood.ids.includes("obligation:1"));
});
