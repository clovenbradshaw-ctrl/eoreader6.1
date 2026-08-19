// Scale the corrected (non-circular) 1-hop incidence test across every real
// word with enough occurrences to be testable. position:a/position:b (which
// end of the Link this word occupies) are stripped from the attribute set
// before induction (last turn's fix) — a certified split has to come from
// partner or label identity, never from the field the population was built
// from.

import { readFileSync } from "node:fs";
import { stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { createSession, admitChunked, sessionRelations } from "../packages/host/corpus.js";
import { admitGraph } from "../packages/host/graph.js";
import { wordOccurrences } from "../packages/host/dictionary.js";
import { understand } from "../packages/engine/emergence/jati.js";

const wrapped = readFileSync("./adversarial/fixtures/pg84-frankenstein.txt", "utf8").replace(/\r\n/g, "\n");
const { text: stripped } = stripContainer(wrapped);
const raw = stripped.slice(0, 160_000);

const t0 = Date.now();
const session = createSession();
admitChunked(session, { text: raw, sourceId: "s" });
admitGraph(session, { sourceId: "s" });

const { relations } = sessionRelations(session, { sourceId: "s" });

const counts = new Map();
for (const t of relations) {
  for (const side of [t.subject, t.object]) {
    const w = String(side).toLowerCase();
    if (w.length < 2) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
}

const SENSE_OPTS = { minPrevalence: 0.25, minKindSize: 2, permutations: 100, quantile: 0.95, seed: 1, reseeds: 2 };
const MIN_OCC = 4; // below this, no non-degenerate null a 2-cluster split could even clear

const candidates = [...counts.entries()].filter(([, n]) => n >= MIN_OCC).sort((a, b) => b[1] - a[1]);
console.log(`[${Date.now() - t0}ms] ${candidates.length} words with >=${MIN_OCC} incidence occurrences (of ${counts.size} total)`);

const results = { above2plus: [], unstable: [], single: [], none: [], tooSmallPostStrip: [] };

for (const [word, n] of candidates) {
  const occ = wordOccurrences(session, word, { sourceId: "s" });
  const noRole = occ.map((r) => ({ id: r.id, attributes: r.attributes.filter((a) => !a.field_id.startsWith("position:")) }));
  if (noRole.length < SENSE_OPTS.minKindSize) { results.tooSmallPostStrip.push({ word, n }); continue; }

  const result = understand(noRole, { priors: [], population: `scale:${word}`, readerVersion: "eo-2026-08-19", ...SENSE_OPTS });
  const kinds = result.kinds ?? [];
  const above = kinds.filter((k) => k.height === "above");
  const entry = { word, occurrences: n, kinds: kinds.length, above: above.length, cores: kinds.map((k) => k.core?.field_id) };

  if (above.length >= 2) results.above2plus.push(entry);
  else if (kinds.some((k) => k.height === "unstable")) results.unstable.push(entry);
  else if (kinds.length === 1) results.single.push(entry);
  else results.none.push(entry);
}

console.log(`[${Date.now() - t0}ms] done`);
console.log(`\n=== ${results.above2plus.length} words: 2+ INDEPENDENTLY CERTIFIED clusters (the real claim) ===`);
for (const e of results.above2plus) console.log(` ${e.word} (n=${e.occurrences}): ${e.above}/${e.kinds} above, cores=${e.cores.join(",")}`);

console.log(`\n=== ${results.unstable.length} words: real cohesion found, not certified (unstable) ===`);
for (const e of results.unstable.slice(0, 15)) console.log(` ${e.word} (n=${e.occurrences}): kinds=${e.kinds}, cores=${e.cores.join(",")}`);
if (results.unstable.length > 15) console.log(` ...and ${results.unstable.length - 15} more`);

console.log(`\n=== ${results.single.length} words: exactly one cluster (no competing split found) ===`);
console.log(` ${results.single.map((e) => e.word).join(", ")}`);

console.log(`\n=== ${results.none.length} words: zero clusters (SIG floor or no structure) ===`);
console.log(` sample: ${results.none.slice(0, 20).map((e) => e.word).join(", ")}${results.none.length > 20 ? " ..." : ""}`);

console.log(`\n=== ${results.tooSmallPostStrip.length} words: too few occurrences after stripping role ===`);
