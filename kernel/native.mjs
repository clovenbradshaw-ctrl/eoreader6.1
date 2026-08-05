const GAP = Symbol.for("eoreader6.gap");

export const GAP_TYPES = Object.freeze([
  "no_ground", "kept_ground", "unreceived_origin", "degenerate_ground", "undeclared",
  "unknown_spec", "empty_material", "exceeds_witness", "made_no_difference", "unstable",
  "incommensurate_extent", "missing_kind_prior", "slack_ground", "anchor_ground",
  "no_candidate", "self_referential", "paradigm_unraveled", "empty_paradigm",
  "no_rezero_trigger", "not_earned", "empty_field", "byte_mismatch", "overlapping_parts",
  "gap_between_parts", "undeclared_organ", "undeclared_cell", "payoff_not_confirmed",
  "model_unreachable",
]);

export const gap = (type, detail = {}) => {
  if (!GAP_TYPES.includes(type)) throw new TypeError(`unknown gap type: ${type}`);
  return Object.freeze({ [GAP]: true, gap: type, ...detail });
};

export const isGap = (x) => Boolean(x && x[GAP] === true);

const rng = (seed) => {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const fft2 = (re, im, inverse) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((2 * Math.PI) / len) * (inverse ? 1 : -1);
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len >> 1; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const xr = re[i + k + (len >> 1)];
        const xi = im[i + k + (len >> 1)];
        const vr = xr * cr - xi * ci;
        const vi = xr * ci + xi * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + (len >> 1)] = ur - vr;
        im[i + k + (len >> 1)] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
};

const dft = (inRe, inIm, inverse = false) => {
  const n = inRe.length;
  const re = Float64Array.from(inRe);
  const im = inIm ? Float64Array.from(inIm) : new Float64Array(n);
  if ((n & (n - 1)) === 0) {
    fft2(re, im, inverse);
    return { re, im };
  }
  let m = 1;
  while (m < 2 * n + 1) m <<= 1;
  const sign = inverse ? 1 : -1;
  const [cosT, sinT] = [new Float64Array(n), new Float64Array(n)];
  for (let i = 0; i < n; i++) {
    const a = (sign * Math.PI * ((i * i) % (2 * n))) / n;
    cosT[i] = Math.cos(a);
    sinT[i] = Math.sin(a);
  }
  const ar = new Float64Array(m);
  const ai = new Float64Array(m);
  for (let i = 0; i < n; i++) {
    ar[i] = re[i] * cosT[i] - im[i] * sinT[i];
    ai[i] = re[i] * sinT[i] + im[i] * cosT[i];
  }
  const br = new Float64Array(m);
  const bi = new Float64Array(m);
  br[0] = cosT[0];
  bi[0] = -sinT[0];
  for (let i = 1; i < n; i++) {
    br[i] = br[m - i] = cosT[i];
    bi[i] = bi[m - i] = -sinT[i];
  }
  fft2(ar, ai, false);
  fft2(br, bi, false);
  for (let i = 0; i < m; i++) {
    const r = ar[i] * br[i] - ai[i] * bi[i];
    ai[i] = ar[i] * bi[i] + ai[i] * br[i];
    ar[i] = r;
  }
  fft2(ar, ai, true);
  for (let i = 0; i < n; i++) {
    re[i] = ar[i] * cosT[i] - ai[i] * sinT[i];
    im[i] = ar[i] * sinT[i] + ai[i] * cosT[i];
    if (inverse) { re[i] /= n; im[i] /= n; }
  }
  return { re, im };
};

export const PERTURBATIONS = Object.freeze({
  shuffle: (material, seed) => {
    const next = rng(seed);
    const out = material.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  },
  resample: (material, seed) => {
    const next = rng(seed);
    return material.map(() => material[Math.floor(next() * material.length)]);
  },
  phase: (material, seed) => {
    const n = material.length;
    if (n < 4) return material.slice();
    const next = rng(seed);
    const { re, im } = dft(material, null, false);
    const half = n >> 1;
    for (let k = 1; k < (n + 1) >> 1; k++) {
      const mag = Math.hypot(re[k], im[k]);
      const ph = next() * 2 * Math.PI;
      re[k] = mag * Math.cos(ph);
      im[k] = mag * Math.sin(ph);
      re[n - k] = re[k];
      im[n - k] = -im[k];
    }
    if ((n & 1) === 0) im[half] = 0;
    const back = dft(re, im, true);
    return Array.from(back.re);
  },
});

export const burstiness = (series, { window }) => {
  if (!Number.isInteger(window) || window < 2 || window > series.length) return NaN;
  let best = -Infinity;
  for (let i = 0; i + window <= series.length; i++) {
    let s = 0;
    for (let j = i; j < i + window; j++) s += series[j];
    best = Math.max(best, s / window);
  }
  return best;
};

export const windowMean = (series, { window }) => {
  if (!Number.isInteger(window) || window < 2 || window > series.length) return NaN;
  let s = 0;
  for (let j = 0; j < window; j++) s += series[j];
  return s / window;
};

const ordinalKey = (series, t, d) => {
  const idx = Array.from({ length: d }, (_, i) => i);
  idx.sort((a, b) => series[t + a] - series[t + b] || a - b);
  return idx.join(",");
};

const reversedKey = (key, d) => key.split(",").map((p) => d - 1 - Number(p)).join(",");

const patternCounts = (series, d) => {
  const counts = new Map();
  const slots = series.length - d + 1;
  for (let t = 0; t < slots; t++) {
    const k = ordinalKey(series, t, d);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return { counts, slots };
};

const factorial = (n) => {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
};

const patternSpaceAdmissible = (series, d) =>
  Number.isInteger(d) && d >= 2 && d <= 8 && series.length - d + 1 >= factorial(d);

export const permutationEntropy = (series, { window }) => {
  if (!patternSpaceAdmissible(series, window)) return NaN;
  const { counts, slots } = patternCounts(series, window);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / slots;
    h -= p * Math.log(p);
  }
  return h / Math.log(factorial(window));
};

export const irreversibility = (series, { window }) => {
  if (!patternSpaceAdmissible(series, window)) return NaN;
  const { counts, slots } = patternCounts(series, window);
  const keys = new Set(counts.keys());
  for (const k of [...keys]) keys.add(reversedKey(k, window));

  let js = 0;
  for (const k of keys) {
    const p = (counts.get(k) ?? 0) / slots;
    const q = (counts.get(reversedKey(k, window)) ?? 0) / slots;
    const m = (p + q) / 2;
    if (p > 0) js += 0.5 * p * Math.log(p / m);
    if (q > 0) js += 0.5 * q * Math.log(q / m);
  }
  return js / Math.log(2);
};

export const STATISTICS = Object.freeze({ burstiness, windowMean, permutationEntropy, irreversibility });

export const LICENSED = Object.freeze({
  "burstiness/shuffle": Object.freeze({ where: "conformance/temporality.test.js" }),
  "windowMean/shuffle": Object.freeze({ where: "scripts/predictive-competency.mjs" }),
  "permutationEntropy/shuffle": Object.freeze({ where: "conformance/temporality.test.js" }),
  "irreversibility/shuffle": Object.freeze({ where: "conformance/temporality.test.js" }),
  "irreversibility/phase": Object.freeze({ where: "scripts/turbulence-growth-rule.mjs" }),
});

export const licensed = (statistic, perturbation) => `${statistic}/${perturbation}` in LICENSED;

export const PRESERVES = Object.freeze({
  phase: Object.freeze(["spectrum", "mean", "variance", "autocorrelation"]),
});

export const preserves = (perturbation, what) => (PRESERVES[perturbation] ?? []).includes(what);

const sameSpec = (a, b) =>
  a.perturbation === b.perturbation && a.statistic === b.statistic &&
  a.draws === b.draws && a.window === b.window && a.n === b.n && a.direction === b.direction;

const fingerprint = (m) =>
  `n${m.length}:${m.reduce((h, v) => (Math.imul(h ^ Math.round(v * 1e6), 16777619) | 0), 2166136261) >>> 0}`;

export const cites = (g, material) =>
  Boolean(g && g.from != null && Array.isArray(material) && g.from === fingerprint(material));

const quantile = (sorted, q) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

export const ground = ({ material, draws, window, perturbation = "shuffle", statistic = "burstiness", seed = 0, via }) => {
  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
  if (!Number.isInteger(draws) || draws < 2) return gap("undeclared", { what: "draws" });
  if (!Number.isInteger(window) || window < 2) return gap("undeclared", { what: "window" });
  const perturb = PERTURBATIONS[perturbation];
  const stat = STATISTICS[statistic];
  if (!perturb) return gap("unknown_spec", { perturbation });
  if (!stat) return gap("unknown_spec", { statistic });

  const samples = [];
  for (let d = 0; d < draws; d++) samples.push(stat(perturb(material, seed + d), { window }));
  if (samples.some((v) => !Number.isFinite(v))) return gap("unknown_spec", { statistic, window });
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return gap("degenerate_ground", { statistic, perturbation });

  return Object.freeze({
    spec: Object.freeze({ perturbation, statistic, seed, draws, window, ...(via ? { via } : {}) }),
    from: fingerprint(material),
    extent: material.length,
    samples: Object.freeze(sorted),
    kept: false,
  });
};

export const extremeGround = ({ material, draws, window, perturbation = "shuffle", statistic = "burstiness", seed = 0, n, direction }) => {
  if (!Number.isInteger(n) || n < 1) return gap("undeclared", { what: "n" });
  if (direction !== "above" && direction !== "below") return gap("undeclared", { what: "direction" });
  if (n === 1) return ground({ material, draws, window, perturbation, statistic, seed });

  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
  if (!Number.isInteger(draws) || draws < 2) return gap("undeclared", { what: "draws" });
  if (!Number.isInteger(window) || window < 2) return gap("undeclared", { what: "window" });
  const perturb = PERTURBATIONS[perturbation];
  const stat = STATISTICS[statistic];
  if (!perturb) return gap("unknown_spec", { perturbation });
  if (!stat) return gap("unknown_spec", { statistic });

  const samples = [];
  for (let d = 0; d < draws; d++) {
    let best = null;
    for (let k = 0; k < n; k++) {
      const v = stat(perturb(material, seed + d * n + k), { window });
      if (!Number.isFinite(v)) return gap("unknown_spec", { statistic, window });
      if (best === null) best = v;
      else best = direction === "above" ? Math.max(best, v) : Math.min(best, v);
    }
    samples.push(best);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return gap("degenerate_ground", { statistic, perturbation, n });

  return Object.freeze({
    spec: Object.freeze({ perturbation, statistic, seed, draws, window, n, direction }),
    from: fingerprint(material),
    extent: material.length,
    samples: Object.freeze(sorted),
    kept: false,
  });
};

export const received = ({ samples, provenance }) => {
  if (!Array.isArray(samples) || samples.length < 2) return gap("no_ground", {});
  if (!provenance) return gap("unreceived_origin", {});
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return gap("degenerate_ground", { provenance });
  return Object.freeze({ provenance, samples: Object.freeze(sorted), kept: false });
};

export const admissible = (g) => {
  if (!g || typeof g !== "object" || !Array.isArray(g.samples) || g.samples.length < 2) return gap("no_ground", {});
  if (!g.spec && !g.provenance) return gap("unreceived_origin", {});
  if (g.spec && g.from == null) return gap("unreceived_origin", {});
  return null;
};

export const keep = (g) => Object.freeze({ ...g, kept: true });
export const anchor = (g) => Object.freeze({ ...g, anchor: true });

export const reZero = (g, { material, seed }) =>
  ground({ ...g.spec, material, seed: seed ?? g.spec.seed + g.spec.draws, via: "reZero" });

export const volume = (g) => (g?.samples?.length ? quantile(g.samples, 0.75) - quantile(g.samples, 0.25) : 0);
export const tailSpan = (g) => (g?.samples?.length ? quantile(g.samples, 0.95) - quantile(g.samples, 0.05) : 0);

export const difference = (observed, g) => {
  const bad = admissible(g);
  if (bad) return bad;
  if (g.kept) return gap("kept_ground", {});
  if (g.anchor) return gap("anchor_ground", {});
  if (!Number.isFinite(observed)) return gap("empty_material", { observed });

  const s = g.samples;
  const [lo, hi] = [s[0], s[s.length - 1]];
  const censoredAt = 1 / s.length;
  if (observed > hi) return gap("exceeds_witness", { observed, support: [lo, hi], direction: "above", censoredAt, reZero: true });
  if (observed < lo) return gap("exceeds_witness", { observed, support: [lo, hi], direction: "below", censoredAt });
  return Object.freeze({
    observed,
    support: Object.freeze([lo, hi]),
    rank: s.filter((v) => v >= observed).length / s.length,
    volume: volume(g),
  });
};

const continueBy = (material, k, seed) => {
  const next = rng(seed);
  const out = material.slice();
  for (let i = 0; i < k; i++) out.push(material[Math.floor(next() * material.length)]);
  return out;
};

export const pattern = ({ before, after, material, reseeds }) => {
  for (const g of [before, after]) {
    const bad = admissible(g);
    if (bad) return bad;
  }
  if (!Number.isInteger(reseeds) || reseeds < 2) return gap("undeclared", { what: "reseeds" });
  if (!before.spec || !after.spec) return gap("unreceived_origin", {});
  if (!sameSpec(before.spec, after.spec)) return gap("unknown_spec", {});
  if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});

  if (material.length !== before.extent)
    return gap("incommensurate_extent", { given: material.length, before: before.extent, after: after.extent });
  if (!cites(before, material)) return gap("unreceived_origin", {});
  if (after.extent < before.extent)
    return gap("incommensurate_extent", { before: before.extent, after: after.extent });

  const displacement = (a, b) => {
    const grid = [0.1, 0.25, 0.5, 0.75, 0.9];
    return grid.reduce((s, q) => s + Math.abs(quantile(a.samples, q) - quantile(b.samples, q)), 0) / grid.length;
  };

  const grewBy = after.extent - before.extent;
  const moved_by = displacement(after, before);
  const volumeBefore = volume(before);
  const nullSamples = [];
  let volumeNull = 0;
  for (let r = 1; r <= reseeds; r++) {
    const seed = before.spec.seed + r * before.spec.draws;
    const nullMaterial = grewBy === 0 ? material : continueBy(material, grewBy, seed);
    const g = reZero(before, { material: nullMaterial, seed });
    if (isGap(g)) return g;
    nullSamples.push(displacement(g, before));
    volumeNull = Math.max(volumeNull, Math.abs(volume(g) - volumeBefore));
  }

  const nullMean = nullSamples.reduce((s, v) => s + v, 0) / nullSamples.length;
  const nullVariance = nullSamples.reduce((s, v) => s + (v - nullMean) ** 2, 0) / Math.max(1, nullSamples.length - 1);
  const nullMax = nullMean + 3 * Math.sqrt(nullVariance);
  if (nullMax === 0) return gap("degenerate_ground", { reseeds });

  const volumeDelta = volume(after) - volumeBefore;
  const opened = volumeNull === 0 || Math.abs(volumeDelta) <= volumeNull ? null : volumeDelta > 0;

  return Object.freeze({
    moved: moved_by > nullMax,
    displacement: moved_by,
    reseedNull: nullMax,
    grewBy,
    censoredAt: 1 / reseeds,
    opened,
    volumeDelta,
    volumeNull,
  });
};

export const level = (observed, ownGround, targetGround, { material, reseeds } = {}) => {
  const own = admissible(ownGround);
  if (own && isGap(own)) return own;
  const tgt = admissible(targetGround);
  if (tgt && isGap(tgt)) return tgt;
  if (ownGround.kept) return gap("kept_ground", {});
  if (targetGround.kept) return gap("kept_ground", {});

  const fig = difference(observed, ownGround);
  if (isGap(fig)) return fig;

  const cross = difference(observed, targetGround);
  if (isGap(cross)) return gap("unstable", { detail: cross });

  const displacement = cross.rank - fig.rank;
  const floor = 2 / ownGround.samples.length;

  let reseedNull = null;
  if (material !== undefined || reseeds !== undefined) {
    if (!Number.isInteger(reseeds) || reseeds < 2) return gap("undeclared", { what: "reseeds" });
    if (!Array.isArray(material) || material.length === 0) return gap("empty_material", {});
    if (!ownGround.spec) return gap("unreceived_origin", {});
    if (material.length !== ownGround.extent) return gap("incommensurate_extent", { given: material.length, own: ownGround.extent });
    if (!cites(ownGround, material)) return gap("unreceived_origin", {});

    reseedNull = 0;
    for (let r = 1; r <= reseeds; r++) {
      const g = reZero(ownGround, { material, seed: ownGround.spec.seed + r * ownGround.spec.draws });
      if (isGap(g)) return g;
      const d = difference(observed, g);
      if (isGap(d)) return gap("unstable", { detail: d });
      reseedNull = Math.max(reseedNull, Math.abs(d.rank - fig.rank));
    }
  }

  const threshold = Math.max(floor, reseedNull ?? 0);

  let relationship;
  if (Math.abs(displacement) <= threshold) relationship = "peer";
  else if (displacement > 0) relationship = "above";
  else relationship = "below";

  return Object.freeze({
    relationship, displacement, threshold, floor, reseedNull,
    nulled: reseedNull !== null, rank: fig.rank, cross: cross.rank,
  });
};

export const disagreement = (differences) => {
  const censored = differences.filter((d) => isGap(d) && d.gap === "exceeds_witness").length;
  const ranks = differences.filter((d) => !isGap(d)).map((d) => d.rank);
  if (differences.length < 2) return gap("no_ground", {});
  return Object.freeze({
    n: differences.length,
    censored,
    split: censored > 0 && ranks.length > 0,
    spread: ranks.length > 1 ? Math.max(...ranks) - Math.min(...ranks) : null,
  });
};

export const objectify = (record) => {
  if (isGap(record)) return record;
  if (!record || !record.ground || !record.figure || !record.pattern) return gap("no_ground", {});
  if (record.ground.kept !== true) return gap("no_ground", {});
  if (record.pattern.moved !== true) return gap("made_no_difference", {});
  if (!(record.pattern.reseedNull > 0)) return gap("degenerate_ground", {});

  const giver = record.ground.provenance ?? record.ground.from;
  if (giver == null) return gap("unreceived_origin", {});

  return Object.freeze({
    value: record.pattern.displacement / record.pattern.reseedNull,
    rank: record.figure.rank ?? null,
    opened: record.pattern.opened,
    provenance: giver,
  });
};

export const nexus = (records) => {
  if (!Array.isArray(records) || records.length === 0) return gap("empty_material", {});
  const members = records.map(objectify);
  const bad = members.find(isGap);
  if (bad) return bad;
  return Object.freeze({
    material: Object.freeze(members.map((m) => m.value)),
    givers: Object.freeze(members.map((m) => m.provenance)),
    n: members.length,
  });
};

export const witness = ({ ground: g, figure, pattern: p }) => {
  const bad = admissible(g);
  if (bad) return bad;
  if (!g.kept) return gap("no_ground", {});
  if (isGap(figure)) return figure;
  if (!figure || !Number.isFinite(figure.observed)) return gap("no_ground", {});
  if (!p || typeof p.moved !== "boolean") return gap("made_no_difference", {});
  if (!p.moved) return gap("made_no_difference", { displacement: p.displacement, reseedNull: p.reseedNull });
  return Object.freeze({ ground: g, figure, pattern: p });
};
