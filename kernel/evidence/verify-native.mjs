import * as real from "../../../eoreader6/nul/index.js";
import * as native from "../native.mjs";
import { tokenize, chunkWords, causalSurprisalSeries } from "../../../eoreader6/packages/engine/perceiver/text/material.js";
import { stripContainer } from "../../../eoreader6/packages/engine/perceiver/text/spans.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const failures = [];
const check = (name, a, b) => {
  const sa = JSON.stringify(a, Object.getOwnPropertyNames(a ?? {}).sort());
  const sb = JSON.stringify(b, Object.getOwnPropertyNames(b ?? {}).sort());
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (ok) { pass++; } else { fail++; failures.push({ name, real: a, native: b }); }
  console.log(ok ? "OK  " : "FAIL", name);
};

const raw = fs.readFileSync("../eoreader6/odyssey-greek.txt", "utf8");
const { text } = stripContainer(raw);
const words = tokenize(text);
const chunks = chunkWords(words, 60);
const series = causalSurprisalSeries(chunks);
const early = series.slice(0, 60);
const later = series.slice(0, 72);
const window = 4;

check("GAP_TYPES", real.GAP_TYPES, native.GAP_TYPES);
check("gap(x)", real.gap("empty_material"), native.gap("empty_material"));
check("isGap true", real.isGap(real.gap("empty_material")), native.isGap(native.gap("empty_material")));

for (const seed of [1, 7, 42]) {
  check(`shuffle seed=${seed}`, real.PERTURBATIONS.shuffle(early, seed), native.PERTURBATIONS.shuffle(early, seed));
  check(`resample seed=${seed}`, real.PERTURBATIONS.resample(early, seed), native.PERTURBATIONS.resample(early, seed));
  check(`phase seed=${seed}`, real.PERTURBATIONS.phase(early, seed), native.PERTURBATIONS.phase(early, seed));
}

check("burstiness", real.burstiness(early, { window }), native.burstiness(early, { window }));
check("windowMean", real.windowMean(early, { window }), native.windowMean(early, { window }));
check("permutationEntropy", real.permutationEntropy(early, { window }), native.permutationEntropy(early, { window }));
check("irreversibility", real.irreversibility(early, { window }), native.irreversibility(early, { window }));

check("licensed(burstiness,shuffle)", real.licensed("burstiness", "shuffle"), native.licensed("burstiness", "shuffle"));
check("licensed(burstiness,phase)", real.licensed("burstiness", "phase"), native.licensed("burstiness", "phase"));
check("preserves(phase,spectrum)", real.preserves("phase", "spectrum"), native.preserves("phase", "spectrum"));

const groundSpec = { material: early, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3 };
const realGround = real.ground(groundSpec);
const nativeGround = native.ground(groundSpec);
check("ground()", realGround, nativeGround);
check("cites(ground, early)", real.cites(realGround, early), native.cites(nativeGround, early));

check("extremeGround n=1", real.extremeGround({ ...groundSpec, n: 1, direction: "above" }), native.extremeGround({ ...groundSpec, n: 1, direction: "above" }));
check("extremeGround n=5", real.extremeGround({ ...groundSpec, n: 5, direction: "above" }), native.extremeGround({ ...groundSpec, n: 5, direction: "above" }));

check("received", real.received({ samples: [1, 2, 3, 4, 5], provenance: "g" }), native.received({ samples: [1, 2, 3, 4, 5], provenance: "g" }));
check("admissible(ground)", real.admissible(realGround), native.admissible(nativeGround));
check("keep", real.keep(realGround), native.keep(nativeGround));
check("anchor", real.anchor(realGround), native.anchor(nativeGround));

const realRezero = real.reZero(realGround, { material: later, seed: 999 });
const nativeRezero = native.reZero(nativeGround, { material: later, seed: 999 });
check("reZero", realRezero, nativeRezero);

check("volume", real.volume(realGround), native.volume(nativeGround));
check("tailSpan", real.tailSpan(realGround), native.tailSpan(nativeGround));

const observed = real.burstiness(early, { window });
check("difference", real.difference(observed, realGround), native.difference(observed, nativeGround));

const realAfter = real.ground({ material: later, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3 });
const nativeAfter = native.ground({ material: later, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3 });
const realPattern = real.pattern({ before: realGround, after: realAfter, material: early, reseeds: 12 });
const nativePattern = native.pattern({ before: nativeGround, after: nativeAfter, material: early, reseeds: 12 });
check("pattern", realPattern, nativePattern);

check("level", real.level(observed, realGround, realAfter, { material: early, reseeds: 12 }), native.level(observed, nativeGround, nativeAfter, { material: early, reseeds: 12 }));

const realDiffs = [real.difference(observed, realGround), real.difference(real.burstiness(series.slice(200, 260), { window }), realGround)];
const nativeDiffs = [native.difference(observed, nativeGround), native.difference(native.burstiness(series.slice(200, 260), { window }), nativeGround)];
check("disagreement", real.disagreement(realDiffs), native.disagreement(nativeDiffs));

const realFigure = real.difference(real.burstiness(early, { window }), realGround);
const nativeFigure = native.difference(native.burstiness(early, { window }), nativeGround);
const realWitness = real.witness({ ground: real.keep(realGround), figure: realFigure, pattern: realPattern });
const nativeWitness = native.witness({ ground: native.keep(nativeGround), figure: nativeFigure, pattern: nativePattern });
check("witness (success path)", realWitness, nativeWitness);

check("objectify", real.objectify(realWitness), native.objectify(nativeWitness));
check("nexus", real.nexus([realWitness]), native.nexus([nativeWitness]));

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  fs.writeFileSync("kernel/evidence/verify-native-failures.json", JSON.stringify(failures, null, 2));
  console.log("failures written to kernel/evidence/verify-native-failures.json");
}
process.exit(fail > 0 ? 1 : 0);
