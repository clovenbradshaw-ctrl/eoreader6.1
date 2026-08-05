// A new (statistic, perturbation) pair, built to eoreader6's own ground()
// shape exactly, so their real difference()/admissible() accept it
// unmodified. Not a new mechanism grafted alongside theirs - the same one,
// with a statistic their STATISTICS object doesn't have, because it
// answers a question none of theirs were built to ask (Amendment I: a
// pair is licensed by being checked, never assumed).
import { PERTURBATIONS, difference, isGap, admissible } from "../../../eoreader6/nul/index.js";
import { readFileSync, writeFileSync } from "node:fs";

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return quantile(s, 0.5);
}

// The statistic: max absolute deviation from the material's own median.
// Sensitive to exactly one thing - a single point sitting far from the
// bulk - and resample-sensitive because resample only ever draws from the
// values actually present, so it cannot manufacture a deviation the
// material never had.
export const maxAbsDeviationFromMedian = (series) => {
  const m = median(series);
  return Math.max(...series.map((x) => Math.abs(x - m)));
};

function fingerprint(material) {
  // Same shape eoreader6's own fingerprint() produces (a stable digest of
  // the material), reimplemented minimally rather than imported since it
  // isn't exported - checked to be a plain string, which is all admissible()
  // and difference() actually require of `from`.
  return `len:${material.length}:sum:${material.reduce((a, b) => a + b, 0).toFixed(6)}`;
}

export function ownGround({ material, draws, seed = 0 }) {
  const samples = [];
  for (let d = 0; d < draws; d++) {
    samples.push(maxAbsDeviationFromMedian(PERTURBATIONS.resample(material, seed + d)));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) {
    return { gap: "degenerate_ground", reason: "zero width" };
  }
  return Object.freeze({
    spec: Object.freeze({ perturbation: "resample", statistic: "maxAbsDeviationFromMedian", seed, draws }),
    from: fingerprint(material),
    extent: material.length,
    samples: Object.freeze(sorted),
    kept: false,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outlier = JSON.parse(readFileSync("./kernel/data/signal-c-outlier.json", "utf8")).values;
  const outlier2 = JSON.parse(readFileSync("./kernel/data/signal-d-outlier.json", "utf8")).values;
  const control = JSON.parse(readFileSync("./kernel/data/noise-control.json", "utf8")).values;
  const siteRole = 16;

  const results = {};
  for (const [name, series] of [["signal-c-outlier", outlier], ["signal-d-outlier", outlier2], ["noise-control", control]]) {
    const rest = series.filter((_, i) => i !== siteRole);
    const g = ownGround({ material: rest, draws: 200, seed: 11 });
    if (g.gap) { console.log(name, "ground gapped:", g); continue; }
    const bad = admissible(g);
    if (bad) { console.log(name, "not admissible:", bad); continue; }
    const candidate = series[siteRole];
    const deviation = Math.abs(candidate - median(rest));
    const d = difference(deviation, g);
    results[name] = { candidate, deviation, result: isGap(d) ? d : { rank: d.rank, support: d.support } };
    console.log(name, "candidate:", candidate, "deviation:", deviation.toFixed(3), "->", JSON.stringify(isGap(d) ? d : { rank: d.rank, support: d.support }));
  }
  writeFileSync("kernel/evidence/maxdev-ground-results.json", JSON.stringify(results, null, 2));
}
