// eoreader6 · perceiver/text/posContext — a word's part of speech from
// POSITION, not identity. The third tier under wordclass.js's exact-form
// classifyWord: real per-form treebank evidence still leads when it
// exists; this only ever runs for a form the treebank never attested.
//
// WHY THIS EXISTS. classifyWord's own POSPrior@1 is a real, giver-cited,
// exact-form lookup — but a 16,654-form treebank sample is finite and
// English is not. Measured on Frankenstein's own 1,125 candidate words:
// 167 (14.8%) are simply absent from the sample, with nothing inside an
// exact-form lookup that can close that gap without inventing evidence for
// a word the treebank never saw. What DOES generalize is POSITION: "the
// ___" predicts a noun or adjective follows regardless of which specific
// noun, and that regularity needs no knowledge of the target word's own
// identity at all — which is exactly what lets it classify a word this
// reading has never met before, including one invented for the first time
// in the material being read.
//
// scripts/build-pos-context-prior.mjs walks the SAME UD_English-EWT
// treebank BACKWARDS to certify which positional associations are real:
// permutation significance (nul/index.js's own ground/difference,
// shuffle-the-tag-labels, keep only "exceeds_witness, direction: above" —
// the identical criterion this codebase already uses everywhere else for
// "real, not noise," never a hand-picked threshold) over prevUpos/nextUpos
// bigram context. This file is the FORWARD half: given a word's own
// occurrences in THIS reading, each carrying its immediate neighbors'
// ALREADY-RESOLVED tags (from classifyWord, on THOSE words' real forms),
// score which tag the certified context associations point to.
//
// SLOT is not CLASS, restated at a different grain than roles.js's own
// header states it: an occurrence's NEIGHBORS are a structural fact about
// where it sits, not a claim about what kind of thing it is — this file
// only ever reports a CLASS reading, built from many occurrences' worth of
// positional evidence, never a single occurrence's role.

import { THRAX_MAP } from "./wordclass.js";

export const POS_CONTEXT_META = Object.freeze({
  giver: "Universal Dependencies UD_English-EWT, CC BY-SA 4.0, positional association certified via permutation significance (scripts/build-pos-context-prior.mjs)",
  scope: "lang/en",
});

// BUG FOUND AND FIXED 2026-08-19, second half of the fix (first half is in
// scripts/hyperlexicon-definitions-data.mjs::occurrenceContextsFor's own
// header — that half stopped nextUpos=SENT_END from ever being asserted
// for a word that merely ends a sentence). This half is about how MULTIPLE
// matched (context, tag) pairs get combined into one word-level score.
//
// Summing the raw (observedRate - baselineRate) — this file's original
// weight — structurally favors whichever TAG has the biggest baseline
// prevalence, independent of how DISCRIMINATING any one context actually
// is for THIS word. Measured on Frankenstein's "horrid" (an adjective,
// zero SENT_END occurrences, so unrelated to the bug above): its 3
// prevUpos=DET occurrences and 2 nextUpos=NOUN occurrences are exactly the
// "DET ADJ NOUN" pattern that should favor ADJ — but prevUpos=DET's own
// raw excess for NOUN (0.424) dwarfs its excess for ADJ (0.170) simply
// because NOUN is ~2.6x more prevalent overall (baseline 17.0% vs 6.4%),
// not because DET-then-NOUN is a tighter, more reliable signal than
// DET-then-ADJ. Summed raw, NOUN wins (1.27 vs 0.78) and "horrid" comes
// out classified as a noun.
//
// Fix: weight each match by a z-score against the null proportion —
// (observedRate - baselineRate) / sqrt(baselineRate*(1-baselineRate)/contextCount)
// — the standard normal approximation to a one-proportion significance
// test (Wald), not a hand-picked formula: it answers "how many standard
// errors above chance does this context's own tag rate sit," which
// correctly treats a tight, well-supported association for a RARE tag
// (ADJ) as comparably strong to a looser one for a COMMON tag (NOUN),
// rather than letting the common tag win purely on baseline scale.
// Computable entirely from fields already persisted in bin/priors/
// pos-context/en.json (observedRate, baselineRate, contextCount); no
// prior rebuild needed. Re-ranks "horrid" ADJ over NOUN, and — combined
// with the SENT_END fix above — leaves zero of Frankenstein's 15
// spot-checked words (chamber, alas, aloud, horrid, conception, endure,
// instruments, peasant, trace, visions, incidents, cottage, bestowed,
// afforded, agitation) confidently misclassified: every word that used to
// win a >=POSITION_MIN_SHARE majority under the wrong tag now either wins
// under the RIGHT tag or honestly falls to no-majority. A few
// previously-"confident" but evidence-thin words (5-18 occurrences:
// conception, endure, peasant, trace, incidents) drop from an inflated
// majority to no-majority under the corrected statistic — not a
// regression: that inflation was the SAME raw-diff bias that broke
// "horrid," just not large enough to flip THEIR top pick. Their top
// candidate stays the correct tag throughout; only the overstated
// confidence is what the fix removes.
function contextZScore(m) {
  const se = Math.sqrt((m.baselineRate * (1 - m.baselineRate)) / m.contextCount);
  return se > 0 ? (m.observedRate - m.baselineRate) / se : 0;
}

// The one permitted convenience, same standing wordclass.js's own
// dominantClass already holds: collapse to a single class only when the
// top candidate clears a CALLER-DECLARED share of the accumulated
// evidence weight — never defaulted. A SEPARATE constant from
// WORDCLASS_MIN_SHARE (hyperlexicon.js), not a shared one: positional
// "share" is a fraction of accumulated enrichment-magnitude across
// possibly many occurrences, a different quantity from an exact form's
// real attested tag-count share, and coupling the two constants would
// let a change meant for one silently move the other.
export const POSITION_MIN_SHARE = 0.5;

/**
 * Classify a word by the certified positional associations its own
 * occurrences' neighbors carry — never by the word's own identity.
 *
 * @param {Array<{prevUpos: string|null, nextUpos: string|null}>} occurrenceContexts
 *   one entry per real occurrence of the target word in THIS reading;
 *   prevUpos/nextUpos are the neighboring words' OWN already-resolved
 *   UPOS tags (via classifyWord on their real forms), "SENT_START" at a
 *   sentence's own first word (a real value — no previous token exists at
 *   all), "PUNCT" at a sentence's own last word (real trailing punctuation
 *   was stripped by tokenization but is confirmed present in the source
 *   text — see occurrenceContextsFor's own header for why this is NOT
 *   "SENT_END"), or null when a neighbor has no resolved tag at all
 *   (unattested in the treebank, or a sentence-final word with no real
 *   trailing punctuation to confirm).
 * @param {object} contextPrior POSContextPrior@1 (build-pos-context-prior.mjs)
 * @returns {{found: boolean, total: number, candidates: Array}} the same
 *   shape classifyWord returns, so wordclass.js's own dominantClass works
 *   unchanged on either.
 */
export function classifyByContext(occurrenceContexts, contextPrior) {
  const scores = new Map(); // upos -> accumulated z-score (see BUG note below)
  const contexts = contextPrior?.context ?? {};
  for (const occ of occurrenceContexts ?? []) {
    for (const [feature, value] of [["prevUpos", occ.prevUpos], ["nextUpos", occ.nextUpos]]) {
      if (!value) continue;
      const matches = contexts[feature]?.[value];
      if (!matches) continue;
      for (const m of matches) scores.set(m.tag, (scores.get(m.tag) ?? 0) + contextZScore(m));
    }
  }
  if (!scores.size) return { found: false, total: 0, candidates: [] };
  const total = [...scores.values()].reduce((a, b) => a + b, 0);
  const candidates = [...scores.entries()]
    .map(([upos, weight]) => ({ upos, count: weight, share: total > 0 ? weight / total : 0, thraxClass: THRAX_MAP[upos] ?? null }))
    .sort((a, b) => b.count - a.count);
  return { found: true, total, candidates };
}
