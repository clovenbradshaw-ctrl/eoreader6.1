// Exercise every export of eoreader6/nul/index.js against real data, live.
// Not a reimplementation-check - a usage-check: does each function behave
// the way its own docstring says, on material this kernel actually has.
import * as nul from "../../../eoreader6/nul/index.js";
import { tokenize, chunkWords, causalSurprisalSeries } from "../../../eoreader6/packages/engine/perceiver/text/material.js";
import { stripContainer } from "../../../eoreader6/packages/engine/perceiver/text/spans.js";
import fs from "node:fs";

const results = {};
const record = (name, value) => { results[name] = value; console.log(name, "->", JSON.stringify(value)); };

// Real material: the Odyssey's causal surprisal series (already used for reading).
const raw = fs.readFileSync("../eoreader6/odyssey-greek.txt", "utf8");
const { text } = stripContainer(raw);
const words = tokenize(text);
const chunks = chunkWords(words, 60);
const series = causalSurprisalSeries(chunks);
const early = series.slice(0, 60); // a stable stretch, well before any Book boundary in range

// --- 1. gap / isGap / GAP_TYPES ---
const g1 = nul.gap("empty_material", { note: "smoke test" });
record("gap+isGap", { isGap: nul.isGap(g1), typesCount: nul.GAP_TYPES.length });

// --- 2. PERTURBATIONS: all three ---
record("shuffle preserves length", nul.PERTURBATIONS.shuffle(early, 1).length === early.length);
record("resample preserves length", nul.PERTURBATIONS.resample(early, 1).length === early.length);
record("phase preserves length", nul.PERTURBATIONS.phase(early, 1).length === early.length);

// --- 3. STATISTICS: all four ---
const window = 4;
record("burstiness", nul.burstiness(early, { window }));
record("windowMean", nul.windowMean(early, { window }));
record("permutationEntropy", nul.permutationEntropy(early, { window }));
record("irreversibility", nul.irreversibility(early, { window }));

// --- 4. licensed / preserves / cites ---
record("licensed(burstiness,shuffle)", nul.licensed("burstiness", "shuffle"));
record("licensed(burstiness,phase)", nul.licensed("burstiness", "phase"));
record("preserves(phase,spectrum)", nul.preserves("phase", "spectrum"));

// --- 5. ground + cites ---
const own = nul.ground({ material: early, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3 });
record("ground admissible", !nul.isGap(own));
record("cites(own, early)", nul.cites(own, early));
record("cites(own, wrong material)", nul.cites(own, series.slice(60, 120)));

// --- 6. extremeGround (best-of-n) ---
const ext1 = nul.extremeGround({ material: early, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3, n: 1, direction: "above" });
const ext5 = nul.extremeGround({ material: early, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3, n: 5, direction: "above" });
record("extremeGround n=1 matches ground()", JSON.stringify(ext1.samples) === JSON.stringify(own.samples));
record("extremeGround n=5 support", nul.isGap(ext5) ? ext5 : [ext5.samples[0], ext5.samples[ext5.samples.length - 1]]);

// --- 7. received / admissible ---
const rec = nul.received({ samples: [1, 2, 3, 4, 5], provenance: "smoke-test-giver" });
record("received admissible", !nul.isGap(rec) && !nul.admissible(rec));
record("received without provenance gaps", nul.isGap(nul.received({ samples: [1, 2, 3] })));

// --- 8. keep / anchor ---
const kept = nul.keep(own);
record("keep sets kept:true", kept.kept === true);
const anchored = nul.anchor(own);
record("anchor sets anchor:true", anchored.anchor === true);

// --- 9. reZero ---
const later = series.slice(0, 60 + window * 3); // grown material
const rz = nul.reZero(own, { material: later, seed: 999 });
record("reZero admissible, tagged via:reZero", !nul.isGap(rz) && rz.spec.via === "reZero");

// --- 10. volume / tailSpan ---
record("volume(own)", nul.volume(own));
record("tailSpan(own)", nul.tailSpan(own));

// --- 11. difference (already used, confirm on this material) ---
const observed = nul.burstiness(early, { window });
const diff = nul.difference(observed, own);
record("difference on own material's own statistic", diff);

// --- 12. pattern (direct call, not via level) ---
const before = own;
const after = nul.ground({ material: later, draws: 200, window, perturbation: "shuffle", statistic: "burstiness", seed: 3 });
const pat = nul.pattern({ before, after, material: early, reseeds: 12 });
record("pattern(before,after)", nul.isGap(pat) ? pat : { moved: pat.moved, displacement: pat.displacement, opened: pat.opened });

// --- 13. level (already used via compare(); confirm directly here too) ---
const lvl = nul.level(observed, before, after, { material: early, reseeds: 12 });
record("level(observed,before,after)", nul.isGap(lvl) ? lvl : { relationship: lvl.relationship, displacement: lvl.displacement });

// --- 14. disagreement ---
const diffs = [
  nul.difference(nul.burstiness(early, { window }), own),
  nul.difference(nul.burstiness(series.slice(200, 260), { window }), own),
];
record("disagreement", nul.disagreement(diffs));

// --- 15. witness (the full gate) - first the failure path, honestly ---
const mismatchedFigure = nul.difference(nul.burstiness(later.slice(-60), { window }), before);
const witnessFail = nul.witness({ ground: nul.keep(before), figure: mismatchedFigure, pattern: pat });
record("witness with mismatched figure (expect gap)", nul.isGap(witnessFail) ? witnessFail.gap : "SUCCEEDED");

// ...then a genuine success: the figure must actually fit `before`'s own support.
const validFigure = nul.difference(nul.burstiness(early, { window }), before);
const witnessOk = nul.witness({ ground: nul.keep(before), figure: validFigure, pattern: pat });
record("witness with valid figure + moved pattern (expect success)", nul.isGap(witnessOk) ? witnessOk.gap : "SUCCEEDED");

// --- 16. objectify / nexus - on the genuine success ---
const obj = nul.objectify(witnessOk);
record("objectify(successful witness)", nul.isGap(obj) ? obj.gap : obj);

// nexus() objectifies each member internally, so it needs real witnessed
// records (ground+figure+pattern), not arbitrary values - the one genuine
// success above is real material for it.
const nexusResult = nul.nexus([witnessOk]);
record("nexus([witnessOk])", nul.isGap(nexusResult) ? nexusResult.gap : nexusResult);

fs.writeFileSync("kernel/evidence/full-api-test-results.json", JSON.stringify(results, null, 2));
console.log("\n--- done:", Object.keys(results).length, "checks recorded ---");
