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
 *   UPOS tags (via classifyWord on their real forms), or null when that
 *   neighbor itself has no resolved tag (unattested in the treebank,
 *   sentence boundary already reads as "SENT_START"/"SENT_END" — a real
 *   value, not null).
 * @param {object} contextPrior POSContextPrior@1 (build-pos-context-prior.mjs)
 * @returns {{found: boolean, total: number, candidates: Array}} the same
 *   shape classifyWord returns, so wordclass.js's own dominantClass works
 *   unchanged on either.
 */
export function classifyByContext(occurrenceContexts, contextPrior) {
  const scores = new Map(); // upos -> accumulated (observedRate - baselineRate)
  const contexts = contextPrior?.context ?? {};
  for (const occ of occurrenceContexts ?? []) {
    for (const [feature, value] of [["prevUpos", occ.prevUpos], ["nextUpos", occ.nextUpos]]) {
      if (!value) continue;
      const matches = contexts[feature]?.[value];
      if (!matches) continue;
      for (const m of matches) scores.set(m.tag, (scores.get(m.tag) ?? 0) + (m.observedRate - m.baselineRate));
    }
  }
  if (!scores.size) return { found: false, total: 0, candidates: [] };
  const total = [...scores.values()].reduce((a, b) => a + b, 0);
  const candidates = [...scores.entries()]
    .map(([upos, weight]) => ({ upos, count: weight, share: total > 0 ? weight / total : 0, thraxClass: THRAX_MAP[upos] ?? null }))
    .sort((a, b) => b.count - a.count);
  return { found: true, total, candidates };
}
