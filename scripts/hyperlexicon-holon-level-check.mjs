import { readFileSync } from "node:fs";
import { splitSentences } from "../packages/engine/perceiver/text/spans.js";
import { extractOccurrences } from "../induction/candidates.js";
import { toAttributeRecords } from "../induction/attributes.js";
import { sig, con } from "../packages/engine/emergence/kinds.js";
import { valuedSimilarity, readsValues, fieldScales } from "../packages/engine/emergence/values.js";
import { parameterProfiles } from "../packages/engine/emergence/kinds.js";

const raw = readFileSync("./adversarial/fixtures/pg84-frankenstein.txt", "utf8").replace(/\r\n/g, "\n").slice(0, 160_000);
const sentences = splitSentences(raw).map((s) => s.text);
const occResult = extractOccurrences(sentences, { minAnchorFrequency: 5, maxAnchorFrequency: 150, maxRunLength: 4, foldCase: (t) => t.toLowerCase() });
const records = toAttributeRecords(occResult.occurrences, { minOccurrences: 10 });

const OPTS = { minPrevalence: 0.3, minKindSize: 3, permutations: 100, quantile: 0.95, seed: 1 };

const sideOf = (rec) => rec.attributes.find((a) => a.field_id === "side")?.value;
const before = records.filter((r) => sideOf(r) === "before");
const after = records.filter((r) => sideOf(r) === "after");
console.log(`cheap partition (read side directly, no search): before=${before.length}, after=${after.length}`);

const conOn = (subset, label) => {
  const t0 = Date.now();
  const params = sig(subset, OPTS);
  const { profiles, keys } = parameterProfiles(subset, params);
  const scales = fieldScales(subset);
  const valued = readsValues(keys, scales);
  const { sim, idxOf } = valuedSimilarity(profiles, subset, keys, scales);
  const result = con(profiles, sim, idxOf, { minKindSize: OPTS.minKindSize, permutations: OPTS.permutations, quantile: OPTS.quantile, seed: OPTS.seed });
  console.log(`  con(${label}, n=${subset.length}): ${Date.now() - t0}ms, clusters: ${result.clusters?.length ?? (result.gap ? `gap:${result.gap}` : 0)}`);
};

console.log("running con() WITHIN each cheap pre-partition (this is the claim under test):");
conOn(before, "before");
conOn(after, "after");

console.log("\nfor comparison, con() flat over the full undifferentiated population:");
conOn(records, "all");
