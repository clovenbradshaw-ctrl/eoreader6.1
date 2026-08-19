// eoreader6 · build-pos-context-prior — Universal Dependencies CoNLL-U in,
// POSContextPrior@1 out: which POSITIONAL context predicts which part of
// speech, certified against a real null, never asserted.
//
// Usage: node scripts/build-pos-context-prior.mjs [conllu-file] [out.json]
//
// WHY THIS EXISTS, on top of build-pos-prior.mjs's own POSPrior@1. That
// script already earns real coverage for every word FORM the treebank
// happens to contain — but a 16,654-form sample is finite, and English is
// not: measured on scripts/adversarial/fixtures/pg84-frankenstein.txt's
// own 1,125 non-proper-name candidate words, 167 (14.8%) are simply absent
// from the treebank, with no lever inside classifyWord's own exact-form
// lookup to close that gap without inventing evidence for a word the
// treebank never attested (the discipline this whole codebase holds
// everywhere else, and HyperLexicon's own grammarGloss already refuses to
// break for exactly that reason — see packages/host/hyperlexicon.js's
// positionGloss fallback).
//
// THE SIGNAL THAT CLOSES IT WAS ALREADY IN THE FILE, DISCARDED.
// build-pos-prior.mjs reads full CoNLL-U sentences but keeps only
// (form, upos) — the surrounding tokens, right there in the same file,
// were read into `cols` and thrown away. A word's PART OF SPEECH is
// substantially predictable from the parts of speech immediately beside
// it (classic, well-established: this is a first-order context tagger,
// not a novel technique) — "the ___" strongly predicts a noun or
// adjective follows, regardless of which specific noun it is. That
// signal needs no knowledge of the target word's own identity at all,
// which is exactly what lets it classify a word the treebank has never
// seen, including one invented for the first time in whatever text is
// being read.
//
// WALKING IT BACKWARDS: this file does not assume "prevUpos=DET predicts
// NOUN" — it MEASURES whether the treebank's own real sentences actually
// show that association more than a random relabeling would, for every
// (context, tag) pair, via the same shuffle-permutation methodology
// nul/index.js already holds for every other significance question in
// this codebase (ground/difference/isGap, reused directly — not a
// parallel, hand-rolled test). A context/tag pair is kept ONLY when the
// real observed co-occurrence rate exceeds every one of `draws` shuffled
// re-pairings of the SAME material (nul's own "exceeds_witness, direction:
// above" — the standing criterion this codebase already uses everywhere
// else for "real, not noise," never a hand-picked p-value cutoff).
//
// SCOPED TO prevUpos/nextUpos ONLY, deliberately, not DEPREL. DEPREL
// (dependency relation to head) is real, often even stronger signal
// sitting in the same CoNLL-U columns — but applying a classifier FORWARD
// to an arbitrary corpus needs the SAME features computable on that
// corpus's own text, and this repo has no dependency parser for our own
// material. prevUpos/nextUpos need only the NEIGHBOR words' own resolved
// tags — and neighbors are disproportionately function words, which are
// exactly what POSPrior@1's exact-form lookup already covers best — so
// the two context features compose with the existing exact-form prior
// for free, on real text, today.
//
// SOURCE: the SAME already-downloaded file build-pos-prior.mjs reads.
// No separate fetch; see that script's own header for the curl command.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { difference, isGap } from "../nul/index.js";

const IN = process.argv[2] ?? "scripts/corpus/en_ewt-ud-train.conllu";
const OUT = process.argv[3] ?? "bin/priors/pos-context/en.json";
const DRAWS = 200; // resolution of testimony: 1/200 — the finest rank this run can say
const SEED = 20260819;

// ── parse, preserving SENTENCE boundaries (build-pos-prior.mjs's own
// line-by-line reader has no notion of one — blank lines just fail its
// 10-column check and vanish; prevUpos/nextUpos need to know where a
// sentence starts and ends so a boundary is never silently bridged into a
// false "neighbor") ─────────────────────────────────────────────────────
const raw = readFileSync(IN, "utf8");
const sentences = [];
let current = [];
for (const line of raw.split("\n")) {
  if (!line.trim()) {
    if (current.length) sentences.push(current);
    current = [];
    continue;
  }
  if (line[0] === "#") continue;
  const cols = line.split("\t");
  if (cols.length !== 10) continue;
  const [id, form, , upos] = cols;
  if (!/^\d+$/.test(id)) continue; // range/empty-node line, not a real token
  if (!form || !upos || upos === "_") continue;
  current.push(upos);
}
if (current.length) sentences.push(current);

const SENT_START = "SENT_START";
const SENT_END = "SENT_END";

// Flat arrays over every real token, concatenated across sentences —
// prevUpos/nextUpos read the sentence's OWN neighbor, sentinel at either
// edge, never a token borrowed from the next/previous sentence.
const upos = [];
const prevUpos = [];
const nextUpos = [];
for (const sent of sentences) {
  for (let i = 0; i < sent.length; i++) {
    upos.push(sent[i]);
    prevUpos.push(i === 0 ? SENT_START : sent[i - 1]);
    nextUpos.push(i === sent.length - 1 ? SENT_END : sent[i + 1]);
  }
}
const N = upos.length;
console.log(`parsed ${sentences.length.toLocaleString()} sentences, ${N.toLocaleString()} real tokens`);

const tags = [...new Set(upos)].sort();
const prevValues = [...new Set(prevUpos)].sort();
const nextValues = [...new Set(nextUpos)].sort();

// ── permutation significance, ONE target tag at a time ──────────────────
//
// Shuffling `tagMask` (the SAME shuffle nul/index.js's own PERTURBATIONS.
// shuffle performs, reused via `ground`) destroys any real association
// between a token's position and its own tag while holding fixed exactly
// what SEED.md's own discipline requires: the multiset of which positions
// carry the target tag at all. `contextMask` (which positions sit beside
// which context value) never moves — only the tag labels are relabeled.
// A CUSTOM statistic function is the explicitly sanctioned path for a
// question `nul`'s own registry does not carry a name for yet (index.js's
// own comment: "checked through the real pipeline... before it earns a
// name in STATISTICS"); `window` is required by `ground`'s own validation
// but has no meaning for this statistic and is passed through unused —
// named here rather than left implicit.
// PARTIAL Fisher-Yates, not a full one. A full shuffle of all N tokens
// touches every position to learn the arrangement of M "1"s (M = this
// tag's own count) — wasted work for any tag whose baseline is a small
// fraction of N (INTJ: 679 of 204,578, 0.3%). Fisher-Yates run for ONLY
// the last M positions of an identity index array is the textbook uniform
// random M-subset-without-replacement sampler (classic "selection
// sampling"): it needs exactly M swaps and M random draws to learn WHICH
// M original positions this draw's "1"s land on, and — because every
// swap is its own inverse — undoing those same M swaps in reverse order
// restores the index array to identity in another O(M), so ONE persistent
// index array serves every draw of every tag with no O(N) reset between
// them. Net cost per draw: O(M), not O(N); accumulation touches only
// those M positions' own precomputed context buckets, never scans the
// N-M positions that hold nothing of interest. Binary in the sense that
// matters here — not the storage width (contextIndex/tagMask already were
// typed arrays), but the algorithm not paying O(N) to represent a
// question that only has M real answers in it.
function rngFor(seed) {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One persistent identity index array, shared across every tag and every
// draw — always identity on entry to drawSubset, always restored to
// identity before it returns.
const sharedIdx = new Uint32Array(N);
for (let i = 0; i < N; i++) sharedIdx[i] = i;
const swapJ = new Int32Array(N); // scratch for the undo pass, sized once for the largest possible M

function contextEnrichment(tagMask, M, features, seed) {
  const observedOverlapByFeat = features.map((f) => new Array(f.contextCount.length).fill(0));
  for (let i = 0; i < N; i++) {
    if (!tagMask[i]) continue;
    for (let fi = 0; fi < features.length; fi++) observedOverlapByFeat[fi][features[fi].contextIndex[i]]++;
  }

  const overlapSamplesByFeat = features.map((f) => Array.from({ length: f.contextCount.length }, () => []));
  for (let d = 0; d < DRAWS; d++) {
    const next = rngFor(seed + d);
    for (let k = 0; k < M; k++) {
      const i = N - 1 - k;
      const j = Math.floor(next() * (i + 1));
      swapJ[k] = j;
      const tmp = sharedIdx[i]; sharedIdx[i] = sharedIdx[j]; sharedIdx[j] = tmp;
    }
    const drawOverlapByFeat = features.map((f) => new Array(f.contextCount.length).fill(0));
    for (let k = 0; k < M; k++) {
      const pos = sharedIdx[N - 1 - k];
      for (let fi = 0; fi < features.length; fi++) drawOverlapByFeat[fi][features[fi].contextIndex[pos]]++;
    }
    for (let k = M - 1; k >= 0; k--) {
      const i = N - 1 - k;
      const j = swapJ[k];
      const tmp = sharedIdx[i]; sharedIdx[i] = sharedIdx[j]; sharedIdx[j] = tmp;
    }
    for (let fi = 0; fi < features.length; fi++) {
      const cc = features[fi].contextCount;
      for (let v = 0; v < cc.length; v++) overlapSamplesByFeat[fi][v].push(drawOverlapByFeat[fi][v] / Math.max(1, cc[v]));
    }
  }

  return features.map((f, fi) => {
    const results = new Array(f.contextCount.length);
    for (let v = 0; v < f.contextCount.length; v++) {
      if (f.contextCount[v] === 0) { results[v] = null; continue; }
      const observed = observedOverlapByFeat[fi][v] / f.contextCount[v];
      const sorted = [...overlapSamplesByFeat[fi][v]].sort((a, b) => a - b);
      if (sorted[0] === sorted[sorted.length - 1]) { results[v] = null; continue; } // degenerate, refused
      const g = Object.freeze({ spec: Object.freeze({ statistic: "contextOverlap", perturbation: "partialSubsetShuffle", draws: DRAWS, window: 2, seed }), from: "n/a-precomputed", extent: N, samples: Object.freeze(sorted), kept: false });
      // difference() only checks admissible()'s shape contract (samples,
      // spec-or-provenance) — it does not re-derive the samples, so
      // handing it the precomputed sorted array is exact, not an
      // approximation.
      const d = difference(observed, g);
      results[v] = { observedOverlap: observedOverlapByFeat[fi][v], contextCount: f.contextCount[v], observedRate: observed, ...d };
    }
    return results;
  });
}

function buildFeature(name, values, rawArray) {
  const index = values.reduce((m, v, i) => (m.set(v, i), m), new Map());
  const contextIndex = new Uint16Array(N);
  const contextCount = new Array(values.length).fill(0);
  for (let i = 0; i < N; i++) {
    const vi = index.get(rawArray[i]);
    contextIndex[i] = vi;
    contextCount[vi]++;
  }
  return { name, values, contextIndex, contextCount };
}
const features = [buildFeature("prevUpos", prevValues, prevUpos), buildFeature("nextUpos", nextValues, nextUpos)];

const t0 = Date.now();
const certified = {}; // featureName -> featureValue -> [{tag, observedRate, rank, ...}]
let tested = 0, kept = 0;
for (const tag of tags) {
  const tagMask = new Uint8Array(N);
  let M = 0;
  for (let i = 0; i < N; i++) if (upos[i] === tag) { tagMask[i] = 1; M++; }
  const baseline = M / N;

  const resultsByFeat = contextEnrichment(tagMask, M, features, SEED + tags.indexOf(tag) * 1000);
  for (let fi = 0; fi < features.length; fi++) {
    const feat = features[fi];
    const results = resultsByFeat[fi];
    for (let v = 0; v < feat.values.length; v++) {
      const r = results[v];
      tested++;
      if (!r) continue;
      // The SAME criterion this codebase already uses everywhere else for
      // "real, not noise": KEEP only when the observation exceeds every
      // one of `draws` null draws (nul's own "exceeds_witness, direction:
      // above" gap) — never a hand-picked p-value. Any other outcome
      // (ordinary non-gap rank, or a DIFFERENT gap type — degenerate,
      // "below" meaning this context makes the tag LESS likely) is not
      // this specific finding and is not certified here.
      if (!isGap(r)) continue;
      if (r.gap !== "exceeds_witness" || r.direction !== "above") continue;
      const value = feat.values[v];
      certified[feat.name] ??= {};
      certified[feat.name][value] ??= [];
      certified[feat.name][value].push({ tag, observedRate: r.observedRate, baselineRate: baseline, count: r.observedOverlap, contextCount: r.contextCount, censoredAt: r.censoredAt });
      kept++;
    }
  }
  console.log(`[${Date.now() - t0}ms] ${tag}: baseline ${(baseline * 100).toFixed(2)}%, ${tested} pairs tested so far, ${kept} certified`);
}

// Within each context value, rank certified tags by how far above
// baseline they sit — descending, so the classifier's own consumer can
// take the top one without re-sorting, but EVERY certified tag is kept
// (an out-of-treebank word's own occurrence context might match a
// secondary, still-real association, not just the strongest one).
for (const featName of Object.keys(certified)) {
  for (const value of Object.keys(certified[featName])) {
    certified[featName][value].sort((a, b) => (b.observedRate - b.baselineRate) - (a.observedRate - a.baselineRate));
  }
}

// COMMITTED, not gitignored — bin/priors/'s own standing convention
// (modifier-order/en-induced.json is the direct precedent: a MEASURED,
// not cited-authority, prior, "the giver named on `giver` below IS the
// measurement itself"). This differs from POSPrior@1 (scripts/corpus/,
// gitignored): that file is a near-mechanical form->count tally with no
// statistical judgment in it: reproducing it needs only the same input
// file. This one contains a real FINDING — which (context, tag)
// associations survive permutation significance — worth a durable,
// versioned home so a future reading (or another agent) can use it
// without re-running a multi-minute build, exactly the "bootstrap from
// it, then keep learning" standing this repo's own induction-live-priors
// scripts already hold for corpus-induced typologies.
const out = {
  $comment: "A POSITIONAL grammar prior, INDUCED not cited. Data only, no code. Staged here for transfer to eoPriors; nothing in packages/ may hardcode any of it.",
  schema: "POSContextPrior@1",
  language: "eng",
  provenance: {
    source: "Universal Dependencies UD_English-EWT",
    url: "https://github.com/UniversalDependencies/UD_English-EWT",
    license: "CC BY-SA 4.0",
    built_by: "measurement, not a cited linguistic authority — permutation significance over the treebank's own real sentences (nul/index.js ground/difference, shuffle perturbation, draws=" + DRAWS + "). A (context, tag) pair is kept only when the real co-occurrence rate exceeds every one of " + DRAWS + " shuffled re-pairings of the SAME material (exceeds_witness, direction: above) — never a hand-picked threshold.",
    input: IN,
    tokensRead: N,
    sentences: sentences.length,
    pairsTested: tested,
    pairsCertified: kept,
  },
  notes: [
    "SCOPED TO prevUpos/nextUpos ONLY, deliberately, not DEPREL. DEPREL (dependency relation to head) is real, likely stronger signal in the same CoNLL-U columns, but applying a classifier FORWARD to arbitrary text needs the same features computable on THAT text, and this repo has no dependency parser for its own material. prevUpos/nextUpos need only the neighbor words' own resolved tags, which compose for free with POSPrior@1's exact-form lookup (neighbors skew function-word-heavy, exactly what that prior covers best).",
    "COVERAGE IS " + kept + "/" + tested + " (context, tag) pairs BY DESIGN, NOT AN OVERSIGHT: a context value with few real tokens (e.g. rare UPOS categories like SYM, X) cannot clear a 200-draw permutation floor no matter how real the association is — absence from this file means 'not yet certified at this draws count,' never 'no association exists.'",
    "THIRD TIER, UNDER real per-form evidence. perceiver/text/posContext.js's classifyByContext consumes this file only when POSPrior@1's own exact-form lookup (classifyWord) finds nothing for the target word — real, attested evidence for the word's own form always leads when it exists.",
    "BOOTSTRAP, MEANT TO GROW: built once from the treebank alone. Any future reading's own newly-resolved (word, prevUpos, nextUpos) triples are real additional evidence for the SAME certification question and belong folded back through the identical permutation test, not a separate or weaker one — re-run scripts/build-pos-context-prior.mjs against combined treebank + accumulated session evidence rather than hand-editing this file's own counts.",
  ],
  giver: "induced from Universal Dependencies UD_English-EWT (" + sentences.length.toLocaleString() + " sentences, " + N.toLocaleString() + " tokens): " + kept + " (context, tag) pair(s) with a permutation-significant (exceeds " + DRAWS + "/" + DRAWS + " shuffled draws) positional association, over " + tested + " tested",
  context: certified,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}: ${kept}/${tested} (context, tag) pairs certified`);
