// Point the working reader at real text, using eoreader6's own real
// text-to-numeric perceiver (perceiver/text/material.js), live. Checks
// whether re-zero events land near real Book boundaries the reader was
// never told about.
import fs from "node:fs";
import { tokenize, chunkWords, causalSurprisalSeries } from "../../../eoreader6/packages/engine/perceiver/text/material.js";
import { stripContainer } from "../../../eoreader6/packages/engine/perceiver/text/spans.js";
import { ground, difference, reZero, isGap, windowMean } from "../../../eoreader6/nul/index.js";

const CHUNK_SIZE = 60;
const raw = fs.readFileSync("../eoreader6/odyssey-greek.txt", "utf8");
const { text } = stripContainer(raw);
const words = tokenize(text);
const chunks = chunkWords(words, CHUNK_SIZE);
const series = causalSurprisalSeries(chunks); // real, live-computed - eoreader6's own function

// Locate each real "BOOK N" marker's approximate chunk index, for
// comparison only - never fed to the reader.
const bookWordIndex = [];
let wordCount = 0;
for (const line of raw.split("\n")) {
  if (/^BOOK [IVXLC]+\s*$/.test(line.trim())) bookWordIndex.push(wordCount);
  wordCount += tokenize(line).length;
}
const bookChunkIndex = bookWordIndex.map((w) => Math.round(w / CHUNK_SIZE));

// The reader, run directly over the real series (windowMean/shuffle grain,
// same as kernel/reader.mjs, inlined here since chunks are already the
// unit - no further windowing needed at the word level).
const SPEC = { draws: 200, window: 4, perturbation: "shuffle", statistic: "windowMean" };
const received = series.slice(0, SPEC.window * 6);
let material = [...received];
let g = ground({ ...SPEC, material, seed: 0 });
if (isGap(g)) { console.log("could not form origin ground:", g); process.exit(1); }
let rezeros = 0;
const rezeroChunks = [];

for (let i = SPEC.window * 6; i + SPEC.window <= series.length; i += SPEC.window) {
  const window = series.slice(i, i + SPEC.window);
  material = [...material, ...window];
  const observed = windowMean(window, { window: SPEC.window });
  const d = difference(observed, g);
  if (isGap(d) && d.gap === "exceeds_witness" && d.direction === "above") {
    const fresh = reZero(g, { material, seed: rezeros + 1 });
    if (!isGap(fresh)) { g = fresh; rezeros += 1; rezeroChunks.push(i); }
  }
}

console.log("total chunks:", series.length, "| total re-zeros:", rezeros);
console.log("real Book-boundary chunk indices:", bookChunkIndex.join(", "));
console.log("re-zero chunk indices:           ", rezeroChunks.join(", "));

// How close is each re-zero to the nearest real Book boundary?
const nearest = rezeroChunks.map((r) => Math.min(...bookChunkIndex.map((b) => Math.abs(b - r))));
console.log("distance (chunks) from each re-zero to nearest Book boundary:", nearest.join(", "));
console.log("median distance:", nearest.length ? nearest.sort((a,b)=>a-b)[Math.floor(nearest.length/2)] : "n/a");

fs.writeFileSync("kernel/evidence/read-odyssey-results.json", JSON.stringify({
  totalChunks: series.length, rezeros, bookChunkIndex, rezeroChunks, nearest,
}, null, 2));
