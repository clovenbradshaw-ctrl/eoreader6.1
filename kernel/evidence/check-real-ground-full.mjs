import { ground, difference, isGap, STATISTICS, LICENSED } from "../eoreader6/nul/index.js";
import { readFileSync } from "node:fs";

const outlier = JSON.parse(readFileSync("./kernel/data/signal-c-outlier.json", "utf8")).values;
const control = JSON.parse(readFileSync("./kernel/data/noise-control.json", "utf8")).values;

const pairs = Object.keys(LICENSED).map((k) => k.split("/"));

for (const [statistic, perturbation] of pairs) {
  const stat = STATISTICS[statistic];
  const window = 4;
  for (const [name, series] of [["outlier", outlier], ["control", control]]) {
    const g = ground({ material: series, draws: 200, window, perturbation, statistic, seed: 7 });
    if (isGap(g)) { console.log(`${statistic}/${perturbation} on ${name}: ground gapped (${g.gap})`); continue; }
    const observed = stat(series, { window });
    if (!Number.isFinite(observed)) { console.log(`${statistic}/${perturbation} on ${name}: statistic NaN`); continue; }
    const d = difference(observed, g);
    const flag = isGap(d) ? `GAP:${d.gap}${d.direction ? "("+d.direction+")" : ""}` : `rank=${d.rank.toFixed(3)}`;
    console.log(`${statistic}/${perturbation} on ${name}: observed=${observed.toFixed(4)} -> ${flag}`);
  }
}
