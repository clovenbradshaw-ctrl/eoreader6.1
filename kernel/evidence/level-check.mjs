// Task #7: run eoreader6's real level() for the first time in this kernel.
// Before that, check what perturbation this new statistic can even form a
// ground with - a real question, not assumed.
import { PERTURBATIONS, difference, isGap, admissible, level } from "../../../eoreader6/nul/index.js";
import { readFileSync, writeFileSync } from "node:fs";
import { maxAbsDeviationFromMedian } from "./maxdev-ground.mjs";

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
function fingerprint(material) {
  return `len:${material.length}:sum:${material.reduce((a, b) => a + b, 0).toFixed(6)}`;
}
function groundWith(perturbation, material, draws, seed) {
  const perturb = PERTURBATIONS[perturbation];
  const samples = [];
  for (let d = 0; d < draws; d++) samples.push(maxAbsDeviationFromMedian(perturb(material, seed + d)));
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return { gap: "degenerate_ground", perturbation, allSame: sorted[0] };
  return Object.freeze({
    spec: Object.freeze({ perturbation, statistic: "maxAbsDeviationFromMedian", seed, draws }),
    from: fingerprint(material),
    extent: material.length,
    samples: Object.freeze(sorted),
    kept: false,
  });
}

const outlier = JSON.parse(readFileSync("./kernel/data/signal-c-outlier.json", "utf8")).values;
const rest = outlier.filter((_, i) => i !== 16);

const results = {};
for (const p of ["shuffle", "resample", "phase"]) {
  const g = groundWith(p, rest, 200, 11);
  results[p] = g.gap ? { gap: g.gap, allSame: g.allSame } : { width: g.samples[g.samples.length - 1] - g.samples[0] };
  console.log(p, ":", JSON.stringify(results[p]));
}

// level() needs two ADMISSIBLE grounds. shuffle is expected to be degenerate
// (order-invariant statistic) - check that directly rather than assume it,
// then run level() with the two that actually form: resample as "own",
// phase as the comparison "core", same statistic, same material.
const own = groundWith("resample", rest, 200, 11);
const core = groundWith("phase", rest, 200, 11);
const observed = maxAbsDeviationFromMedian(outlier); // the FULL series, candidate included - the real observation

let levelResult;
if (!own.gap && !core.gap) {
  levelResult = level(observed, own, core, { material: rest, reseeds: 12 });
  console.log("level(resample vs phase):", JSON.stringify(levelResult));
} else {
  levelResult = { gap: "could_not_run", own: own.gap, core: core.gap };
  console.log("could not run level:", JSON.stringify(levelResult));
}

writeFileSync("kernel/evidence/level-check-results.json", JSON.stringify({ perturbation_check: results, observed, level: levelResult }, null, 2));
