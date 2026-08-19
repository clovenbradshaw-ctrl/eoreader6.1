import { readFileSync } from "node:fs";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { admitGraph } from "../packages/host/graph.js";
import { wordCompany, wordKind, defineWord, wordOccurrences, wordSenses } from "../packages/host/hyperlexicon.js";

const text = readFileSync("./adversarial/fixtures/pg84-frankenstein.txt", "utf8").replace(/\r\n/g, "\n");

const session = createSession();
admitChunked(session, { text, sourceId: "s" });
const { graph, admitted } = admitGraph(session, { sourceId: "s" });
console.log("admitted:", admitted[0].stated, "triples ->", graph.nodes.size, "nodes,", graph.edges.size, "edges");

for (const word of ["victor", "creature", "elizabeth", "monster", "father"]) {
  const c = wordCompany(session, word);
  console.log(`\n=== "${word}" ===`);
  console.log("present:", c.present, "mentions:", c.mentions);
  console.log("company (top 5):", c.company.slice(0, 5));
}

console.log("\n=== the one-hop separation test: does ONE word's own occurrences split? ===");
// Same declared numbers scripts/read-people.mjs and conformance/kinds.test.js
// already use for this organ, not invented for this run. minKindSize=2 is
// kinds.test.js's own precedent for a tiny population (line 179), and a
// single word's occurrence count inside one book is tiny by construction.
const SENSE_OPTS = { minPrevalence: 0.25, minKindSize: 2, permutations: 200, quantile: 0.95, seed: 42, reseeds: 24 };
for (const word of ["elizabeth", "father", "monster", "creature", "he", "said"]) {
  const occ = wordOccurrences(session, word, { sourceId: "s" });
  const t0 = Date.now();
  let out;
  try {
    out = wordSenses(session, word, { sourceId: "s", population: `word:${word}`, readerVersion: "eo-2026-08-19", ...SENSE_OPTS });
  } catch (e) {
    out = { threw: e.message };
  }
  console.log(`\n"${word}": ${occ.length} occurrences, ${Date.now() - t0}ms`);
  console.log(JSON.stringify(out, null, 2));
}
