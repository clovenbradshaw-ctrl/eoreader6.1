#!/usr/bin/env node
// First RDF-programme measurement: capture the host belief graph and a
// commensurable order-perturbed null through the identical admission path.
// This does not manufacture RDF when the received snapshot is unavailable.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createSession, admitChunked } from "../../packages/host/corpus.js";
import { admitGraph, sessionGraphSnapshot } from "../../packages/host/graph.js";
import { splitSentences, stripContainer } from "../../packages/engine/perceiver/text/spans.js";

const materialPath = process.argv[2] ?? "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const outputPath = process.argv[3] ?? "goldens/rdf/results/rdf-belief-frankenstein.json";
const raw = readFileSync(materialPath, "utf8").replace(/\r\n?/g, "\n");
const { text: material } = stripContainer(raw);

const digest = (value) => createHash("sha256").update(value).digest("hex");

function read(text, sourceId) {
  const session = createSession({ engineVersion: "eo-2026-07" });
  const corpus = admitChunked(session, { text, sourceId, language: "en" });
  const admission = admitGraph(session, { sourceId });
  const graph = sessionGraphSnapshot(session, { limit: 25 });
  const keys = [...admission.graph.edges.keys()];
  return {
    chunks: corpus.chunks,
    admission: admission.admitted[0],
    graph,
    edge_shape: {
      verb_typed: keys.filter((key) => key.split("|")[1].replace(/^!/, "").length > 0).length,
      structural: keys.filter((key) => key.split("|")[1].replace(/^!/, "").length === 0).length,
      negative: keys.filter((key) => key.split("|")[1].startsWith("!")).length,
    },
  };
}

// Reversing sentence order preserves the same sentence bytes and uses the
// same host pipeline. It perturbs discourse/order rather than substituting a
// hand-built scoring procedure. The transformation and digest are recorded.
const sentences = splitSentences(material).map((sentence) => sentence.text);
const nullMaterial = [...sentences].reverse().join(" ");
const observed = read(material, "project-gutenberg:pg84:observed");
const orderNull = read(nullMaterial, "project-gutenberg:pg84:sentence-reversal-null");

const rdfShape = (reading) => ({
  entity_nodes: reading.graph.nodeCount,
  live_edges: reading.graph.edgeCount,
  predicates_present: reading.edge_shape.verb_typed,
  directional_edges: reading.graph.edgeCount,
  negative_edges: reading.edge_shape.negative,
  stable_external_ids: 0,
  rdf_correspondences_confirmed: 0,
});

const artifact = {
  schema: "RDFBeliefAssessment@1",
  standing: {
    graph_shape: "measured",
    rdf_quality: "refused",
  },
  measured_at: new Date().toISOString(),
  subject: "host-assembled engine belief graph at the admission cursor",
  material: {
    path: materialPath,
    giver: "Project Gutenberg (fixture already admitted by this repository)",
    sha256: digest(material),
    bytes: Buffer.byteLength(material),
    sentences: sentences.length,
  },
  received_rdf: {
    status: "gap",
    triples: 0,
    reason: "No giver-named RDF snapshot is mounted; network acquisition returned HTTP 403 and was not replaced with ambient model knowledge.",
  },
  observed: { ...rdfShape(observed), ...observed },
  null: {
    perturbation: "reverse the order of all split sentences",
    sha256: digest(nullMaterial),
    ...rdfShape(orderNull),
    ...orderNull,
  },
  verdict: {
    rdf_quality: "refused",
    reason: "Entity and relation overlap cannot be scored without received RDF rows and confirmed correspondences.",
    assessable_now: "graph shape and order sensitivity only",
  },
};

writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`${outputPath}: ${observed.graph.nodeCount} nodes/${observed.graph.edgeCount} edges; null ${orderNull.graph.nodeCount}/${orderNull.graph.edgeCount}; RDF ${artifact.received_rdf.status}`);
