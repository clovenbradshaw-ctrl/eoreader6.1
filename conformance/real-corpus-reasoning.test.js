import test from "node:test";
import assert from "node:assert/strict";

import { createSession, admitChunked } from "../packages/host/corpus.js";
import { reasonSession } from "../packages/host/reasoning.js";

// Acceptance test for novel structural reasoning. The input is ordinary prose,
// not hand-authored EOT. The reader must perceive the relations first. The
// reasoner may then say something new about their graph, but may not invent a
// semantic transitive edge.
test("raw prose can yield a novel auditable bridge proposition without semantic transitivity", () => {
  const text = [
    "Ada mentored Babbage.",
    "Babbage influenced Turing.",
    "Ada mentored Babbage again.",
    "Babbage influenced Turing again.",
  ].join(" ");

  const session = createSession();
  admitChunked(session, { sourceId: "acceptance:raw-prose", text });
  const result = reasonSession(session, { sourceId: "acceptance:raw-prose" });

  const incoming = result.eot.find((t) => t.subject === "Ada" && t.object === "Babbage");
  const outgoing = result.eot.find((t) => t.subject === "Babbage" && t.object === "Turing");
  assert.ok(incoming, "reader must independently extract Ada -> Babbage from raw prose");
  assert.ok(outgoing, "reader must independently extract Babbage -> Turing from raw prose");

  const bridge = result.derived.find((t) =>
    t.subject === "Babbage"
    && t.predicate === "occupies_bridge_between"
    && t.object?.from === "Ada"
    && t.object?.to === "Turing"
  );
  assert.ok(bridge, "reasoner must derive Babbage's bridge position from the two observed witnesses");
  assert.deepEqual(new Set(bridge.dependsOn), new Set([incoming.id, outgoing.id]));
  assert.equal(bridge.meta.derived, true);
  assert.equal(bridge.meta.structural, true);

  // Novel means the proposition is neither a source sentence nor an extracted
  // source tuple. It is licensed only by the organization of multiple tuples.
  assert.equal(text.includes("occupies_bridge_between"), false);
  assert.equal(result.eot.some((t) => t.predicate === "occupies_bridge_between"), false);

  // Crucial veto: graph composition is not semantic relation transitivity.
  assert.equal(result.eot.some((t) => t.subject === "Ada" && t.object === "Turing"), false);
  assert.equal(result.derived.some((t) => t.subject === "Ada" && t.object === "Turing"), false);

  // The derived proposition itself receives a terrain-aware falsification
  // envelope, so novelty remains challengeable rather than becoming doctrine.
  const envelope = result.falsification.find((x) => x.tupleId === bridge.id);
  assert.ok(envelope, "derived bridge proposition must be falsifiable");
});
