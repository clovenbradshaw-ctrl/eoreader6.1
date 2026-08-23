import test from "node:test";
import assert from "node:assert/strict";

import {
  hyperedge,
  buildHypergraph,
  relevantHypergraphNeighborhood,
  receivedGround,
  applyObservation,
  applyDelta,
  deltaFold,
  obligation,
  openObligation,
  expectation,
  expectationTransition,
  relevantNeighborhood,
  discoverPatternCandidates,
  deriveGraphStructuralDelta,
  deriveTension,
} from "../packages/engine/index.js";

test("n-ary hyperedges are first-class and traversable by participant", () => {
  const create = hyperedge({
    id: "edge:create:1",
    relation: "create",
    participants: [
      { role: "agent", ref: "ref:victor" },
      { role: "generated", ref: "ref:creature" },
    ],
    witness: "obs:create:1",
  });
  const graph = buildHypergraph([create]);
  const hood = relevantHypergraphNeighborhood(graph, ["ref:creature"]);
  assert.deepEqual(hood.ids, ["edge:create:1"]);
});

test("relations can ground obligations and later EO transformations", () => {
  const create = hyperedge({
    id: "edge:create:1",
    relation: "create",
    participants: [
      { role: "agent", ref: "ref:victor" },
      { role: "generated", ref: "ref:creature" },
    ],
    witness: "obs:create:1",
  });
  const obs = {
    schema: "Observation@1",
    id: "obs:create:1",
    witness: "animation",
    anchor: { start: 0, end: 9 },
    distinctions: [{ ref: "ref:creature" }],
    provenance: {},
    hyperedges: [create],
  };
  let fold = applyObservation(receivedGround(), obs);
  const creatorDuty = obligation({
    id: "obligation:creator-care",
    distinction: "what obligations follow from generation?",
    grounds: ["edge:create:1"],
    consequences: ["ref:creature"],
  });
  fold = applyDelta(fold, deltaFold([openObligation(creatorDuty, { witness: "obs:create:1" })], { id: "delta:open-duty" }));
  const graph = buildHypergraph(fold.graphEntries);
  const hood = relevantHypergraphNeighborhood(graph, ["ref:creature"]);
  assert.ok(hood.ids.includes("edge:create:1"));
  assert.ok(hood.ids.includes("obligation:creator-care"));
  assert.ok(fold.transformationObjects.some((op) => op.outputs.includes("obligation:creator-care")));
});

test("expectation evaluation remains linked to the expectation object", () => {
  const e = expectation({ id: "expectation:sympathy", hypothesis: "recognition is possible", giver: "experience", grounds: ["edge:observe:de-lacey"] });
  const op = expectationTransition(e, "violated", { witness: "obs:rejection" });
  assert.equal(op.operator, "EVA");
  assert.deepEqual(op.inputs, ["expectation:sympathy"]);
  assert.deepEqual(op.outputs, ["expectation:sympathy"]);
});

test("Fold relevant neighborhood uses graph structure without lexical overlap", () => {
  const edge = hyperedge({
    id: "edge:create:1",
    relation: "create",
    participants: [
      { role: "agent", ref: "ref:victor" },
      { role: "generated", ref: "ref:creature" },
    ],
    witness: "obs:create:1",
  });
  const duty = obligation({ id: "obligation:creator-care", distinction: "duty", grounds: ["edge:create:1"], consequences: ["ref:creature"] });
  const fold = receivedGround({ graphEntries: [edge, duty], obligations: [duty] });
  const observations = [{ schema: "Observation@1", id: "obs:new", distinctions: [{ ref: "ref:creature" }] }];
  const hood = relevantNeighborhood(fold, observations);
  assert.ok(hood.graph.ids.includes("edge:create:1"));
  assert.ok(hood.graph.ids.includes("obligation:creator-care"));
});

test("ambiguous graph participant opens an explicit identity obligation", () => {
  const edge = hyperedge({
    id: "edge:ambiguous:1",
    relation: "saw",
    participants: [
      { role: "subject", ref: "occ:1:0:subject", standing: "unresolved_surface", candidateReferents: ["ref:a", "ref:b"] },
      { role: "object", ref: "ref:c", standing: "referent" },
    ],
    witness: "text:1:2",
  });
  const obs = { schema: "Observation@1", id: "obs:1", distinctions: [], hyperedges: [edge] };
  const delta = deriveGraphStructuralDelta(receivedGround(), [obs], { id: "delta:1" });
  const op = delta.operations.find((item) => item.payload?.action === "obligation");
  assert.ok(op);
  assert.equal(op.operator, "DEF");
  assert.deepEqual(op.payload.value.alternatives, ["ref:a", "ref:b"]);
});

test("witnessed repeated relation structure becomes a stable SYN pattern", () => {
  const edges = [1, 2, 3].map((n) => hyperedge({
    id: `edge:saw:${n}`,
    relation: "saw",
    participants: [
      { role: "subject", ref: `occ:${n}:s`, standing: "unresolved_surface" },
      { role: "object", ref: `occ:${n}:o`, standing: "unresolved_surface" },
    ],
    witness: `obs:${n}`,
  }));
  const patterns = discoverPatternCandidates(edges, { minInstances: 3 });
  assert.equal(patterns.length, 1);
  const fold = receivedGround({ graphEntries: edges.slice(0, 2) });
  const obs = { schema: "Observation@1", id: "obs:3", distinctions: [], hyperedges: [edges[2]] };
  const delta = deriveGraphStructuralDelta(fold, [obs], { id: "delta:3", minPatternInstances: 3 });
  const syn = delta.operations.find((op) => op.operator === "SYN");
  assert.ok(syn);
  assert.equal(syn.grain, "Pattern");
  assert.equal(syn.payload.value.id, patterns[0].id);
  assert.equal(syn.payload.value.support, 3);
});

test("tension persistence is derived from sequence rather than silent mutation", () => {
  const duty = obligation({ id: "obligation:persist", distinction: "unresolved", openedAt: 2, persistence: 0 });
  const fold = receivedGround({ sequence: 7, obligations: [duty] });
  const tension = deriveTension(fold);
  assert.equal(tension.persistence[0].value, 6);
  assert.equal(fold.obligations[0].persistence, 0);
});
