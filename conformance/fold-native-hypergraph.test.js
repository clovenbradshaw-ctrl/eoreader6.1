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
