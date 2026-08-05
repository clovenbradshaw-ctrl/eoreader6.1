import { PERTURBATIONS, difference, admissible, isGap, level, ground, burstiness } from "./native.mjs";

const fingerprint = (m) =>
  `n${m.length}:${m.reduce((h, v) => (Math.imul(h ^ Math.round(v * 1e6), 16777619) | 0), 2166136261) >>> 0}`;

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const i = (s.length - 1) / 2;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
};

const maxAbsDeviationFromMedian = (series) => {
  const m = median(series);
  return Math.max(...series.map((x) => Math.abs(x - m)));
};

function magnitudeGround(material, draws = 200, seed = 11) {
  const samples = [];
  for (let d = 0; d < draws; d++) samples.push(maxAbsDeviationFromMedian(PERTURBATIONS.resample(material, seed + d)));
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return { gap: "degenerate_ground" };
  return Object.freeze({
    spec: Object.freeze({ perturbation: "resample", statistic: "maxAbsDeviationFromMedian", seed, draws }),
    from: fingerprint(material),
    extent: material.length,
    samples: Object.freeze(sorted),
    kept: false,
  });
}

export function classify(series, index) {
  const candidate = series[index];
  if (candidate === null || candidate === undefined) return { site: index, sign: "absent" };

  const rest = series.filter((_, i) => i !== index);
  const ground = magnitudeGround(rest);
  if (ground.gap) return { site: index, sign: "present", magnitude: "unknown", reason: ground.gap };

  const bad = admissible(ground);
  if (bad) return { site: index, sign: "present", magnitude: "unknown", reason: bad.gap };

  const deviation = Math.abs(candidate - median(rest));
  const d = difference(deviation, ground);
  if (isGap(d)) {
    return { site: index, sign: "present", magnitude: d.direction === "above" ? "anomalous" : "ordinary", deviation, rank: null, gap: d.gap, direction: d.direction, reZero: d.reZero ?? false };
  }
  return { site: index, sign: "present", magnitude: "ordinary", deviation, rank: d.rank };
}

export function compare(seriesA, seriesB, { draws = 200, window = 4, reseeds = 12, seed = 7 } = {}) {
  const groundA = ground({ material: seriesA, draws, window, perturbation: "shuffle", statistic: "burstiness", seed });
  const groundB = ground({ material: seriesB, draws, window, perturbation: "shuffle", statistic: "burstiness", seed: seed + 1000 });
  if (isGap(groundA)) return groundA;
  if (isGap(groundB)) return groundB;

  const observed = burstiness(seriesA, { window });
  const result = level(observed, groundA, groundB, { material: seriesA, reseeds });
  if (isGap(result)) return result;
  return { relationship: result.relationship, displacement: result.displacement, threshold: result.threshold, rank: result.rank, cross: result.cross };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const material = JSON.parse(process.argv[2]);
  const index = Number(process.argv[3]);
  console.log(JSON.stringify(classify(material, index)));
}
