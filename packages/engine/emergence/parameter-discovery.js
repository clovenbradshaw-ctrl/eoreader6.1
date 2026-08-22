// Anonymous parameter discovery from distinctions that make a difference.
//
// This module contains NO vocabulary of meaningful parameters. It receives an
// ordered history of already-earned distinctions and later transformation
// outcomes. A distinction becomes a provisional parameter only when its
// presence partitions later outcomes more strongly than exchangeable shuffled
// labels do. Naming, interpretation, and domain semantics are downstream.

const freeze = x => Object.freeze(x);
const stable = x => typeof x === 'string' ? x : JSON.stringify(x);

export const PARAMETER_DISCOVERY_SCHEMA = 'EOParameterDiscovery@1';

const lcg = seed => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

const distribution = rows => {
  const counts = new Map();
  let total = 0;
  for (const row of rows) {
    for (const outcome of row.outcomes ?? []) {
      const key = stable(outcome);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
  }
  return { counts, total };
};

const jsDivergence = (aRows, bRows) => {
  const A = distribution(aRows), B = distribution(bRows);
  if (!A.total || !B.total) return 0;
  const keys = new Set([...A.counts.keys(), ...B.counts.keys()]);
  let klA = 0, klB = 0;
  for (const key of keys) {
    const p = (A.counts.get(key) ?? 0) / A.total;
    const q = (B.counts.get(key) ?? 0) / B.total;
    const m = (p + q) / 2;
    if (p > 0) klA += p * Math.log2(p / m);
    if (q > 0) klB += q * Math.log2(q / m);
  }
  return (klA + klB) / 2;
};

const splitBy = (rows, distinction) => {
  const yes = [], no = [];
  for (const row of rows) {
    const has = new Set((row.distinctions ?? []).map(stable)).has(stable(distinction));
    (has ? yes : no).push(row);
  }
  return { yes, no };
};

const shuffledStatistic = (rows, yesCount, rand) => {
  const idx = rows.map((_, i) => i);
  for (let i = 0; i < yesCount; i++) {
    const j = i + Math.floor(rand() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const yesSet = new Set(idx.slice(0, yesCount));
  const yes = [], no = [];
  rows.forEach((row, i) => (yesSet.has(i) ? yes : no).push(row));
  return jsDivergence(yes, no);
};

/**
 * Discover provisional anonymous dimensions from an ordered experience log.
 *
 * rows[i].distinctions: structural distinctions present at time i.
 * rows[i].outcomes: transformations observed AFTER that state (normally i+1).
 *
 * A distinction is retained only when:
 * - it occurs both present and absent often enough to compare;
 * - conditioning on it changes the empirical distribution of later outcomes;
 * - that change exceeds the same statistic under shuffled membership.
 *
 * The 95th-percentile null is generated from this material, matching the
 * project's existing conditional-null discipline. No named parameter list and
 * no domain-specific formula is supplied.
 */
export function discoverParameters(rows = [], { reseeds = 200, seed = 0x6e6f6465 } = {}) {
  const material = rows.map((row, i) => ({
    index: i,
    distinctions: [...(row.distinctions ?? [])],
    outcomes: [...(row.outcomes ?? [])],
    provenance: row.provenance ?? null,
  }));
  const universe = [...new Map(material.flatMap(r => r.distinctions).map(x => [stable(x), x])).values()];
  const candidates = [];

  for (const distinction of universe) {
    const { yes, no } = splitBy(material, distinction);
    if (yes.length < 2 || no.length < 2) continue;
    const observed = jsDivergence(yes, no);
    const rand = lcg(seed ^ stable(distinction).split('').reduce((h, c) => ((h * 33) ^ c.charCodeAt(0)) >>> 0, 5381));
    const nulls = [];
    for (let r = 0; r < reseeds; r++) nulls.push(shuffledStatistic(material, yes.length, rand));
    nulls.sort((a, b) => a - b);
    const threshold = nulls[Math.floor(nulls.length * 0.95)] ?? Infinity;
    if (!(observed > threshold)) continue;

    const witnesses = material
      .filter(row => new Set(row.distinctions.map(stable)).has(stable(distinction)))
      .map(row => freeze({ index: row.index, provenance: row.provenance }));
    candidates.push(freeze({
      id: null, // assigned after sorting so ids encode no semantic name
      standing: 'provisional_parameter',
      sourceDistinction: distinction,
      observed,
      null95: threshold,
      presentCount: yes.length,
      absentCount: no.length,
      witnesses: freeze(witnesses),
    }));
  }

  candidates.sort((a, b) => b.observed - a.observed || stable(a.sourceDistinction).localeCompare(stable(b.sourceDistinction)));
  const parameters = candidates.map((candidate, i) => freeze({ ...candidate, id: `p${i}` }));
  return freeze({
    schema: PARAMETER_DISCOVERY_SCHEMA,
    parameters: freeze(parameters),
    testedDistinctions: universe.length,
    rows: material.length,
  });
}
