import fs from "node:fs";
import { tokenize, chunkWords } from "../../../eoreader6/packages/engine/perceiver/text/material.js";
import { stripContainer } from "../../../eoreader6/packages/engine/perceiver/text/spans.js";
import { readForward, seriesOf } from "../../../eoreader6/packages/engine/emergence/activation.js";

const raw = fs.readFileSync("../eoreader6/odyssey-greek.txt", "utf8");
const { text } = stripContainer(raw);
const words = tokenize(text);
const CHUNK = 60;
const chunks = chunkWords(words, CHUNK);
const frames = chunks.map((ws, i) => ({ order: i, offset: i * CHUNK, words: ws }));

const K = 400;
const partial = readForward(frames.slice(0, K));
const full = readForward(frames);

let identical = true;
let firstDiffAt = null;
for (let i = 0; i < K; i++) {
  const a = JSON.stringify(partial.records[i]);
  const b = JSON.stringify(full.records[i]);
  if (a !== b) { identical = false; if (firstDiffAt === null) firstDiffAt = i; }
}
console.log("causality invariant (first", K, "records identical between partial and full read):", identical);
if (!identical) console.log("first divergence at frame", firstDiffAt);

const activationSeries = seriesOf(full.records, "activation", { missing: 0 });
const reachSeries = seriesOf(full.records, "reach", { missing: -1 });
const novelty = seriesOf(full.records, "novelty", { missing: null });

const topActivations = full.records
  .map((r, i) => ({ i, ...r }))
  .filter((r) => r.activation > 0)
  .sort((a, b) => b.activation - a.activation)
  .slice(0, 10);

console.log("\ntotal frames:", frames.length);
console.log("frames with any activation:", full.records.filter((r) => r.activation > 0).length);
console.log("frames with zero activation (nothing recalled anything):", full.records.filter((r) => r.activation === 0).length);
console.log("\ntop 10 loudest activations:");
for (const r of topActivations) {
  console.log(`  frame ${r.order} (word ~${r.offset}): activation=${r.activation.toFixed(4)} reach=${r.reach} recalled=${r.recalled} novelty=${r.novelty?.toFixed(3)}`);
  console.log(`    text: "${chunks[r.order].slice(0, 12).join(" ")}..."`);
}

fs.writeFileSync("kernel/evidence/activation-results.json", JSON.stringify({
  causalityInvariantHolds: identical,
  firstDiffAt,
  totalFrames: frames.length,
  framesWithActivation: full.records.filter((r) => r.activation > 0).length,
  topActivations: topActivations.map((r) => ({ order: r.order, offset: r.offset, activation: r.activation, reach: r.reach, recalled: r.recalled })),
}, null, 2));
