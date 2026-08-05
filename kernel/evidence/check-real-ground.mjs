import { ground, difference, isGap, burstiness } from "../eoreader6/nul/index.js";
import { readFileSync } from "node:fs";

const outlier = JSON.parse(readFileSync("./kernel/data/signal-c-outlier.json", "utf8")).values;
const control = JSON.parse(readFileSync("./kernel/data/noise-control.json", "utf8")).values;

for (const [name, series] of [["outlier-series", outlier], ["control-series", control]]) {
  const g = ground({ material: series, draws: 200, window: 4, perturbation: "shuffle", statistic: "burstiness", seed: 7 });
  if (isGap(g)) { console.log(name, "ground gapped:", JSON.stringify(g)); continue; }
  const observed = burstiness(series, { window: 4 });
  const d = difference(observed, g);
  console.log(name, "observed burstiness:", observed.toFixed(3), "-> difference:", JSON.stringify(d));
}
