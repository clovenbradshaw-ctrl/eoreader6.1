// eoreader6 · perceiver/text/case-relations — relations read from CASE
// MARKING, underneath word order.
//
// extractRelations reads SVO POSITION: subject before the verb, object
// after. That is one family's word-order convention (and goldens/
// EXTERNAL-BENCHMARKS.md pre-registered exactly where it would break:
// "Link yield should swing by an order of magnitude across genre ... those
// are exactly the terrains the SVO word-order prior hits hardest" —
// measured live on a Japanese research paper: 16 sentences, 0 relations,
// every cast member unresolved). This organ is the layer UNDERNEATH: many
// languages mark grammatical role with a particle attached to the phrase
// itself (Japanese は/が nominative, を accusative), making role readable
// WITHOUT order — arguably stronger evidence than position, which English
// only implies and these languages state.
//
// The particle inventories are RECEIVED knowledge (AbbreviationPrior@3's
// `relation_case_markers`), never hardcoded here — the same division every
// other language-carrying module in this package draws. With no prior the
// organ is INERT (empty array, like extractRelations with an empty verb
// vocabulary): it cannot misread a language it was given no rules for.
//
// Honest limitation, disclosed rather than hidden: an object marker can sit
// at the end of a long EMBEDDED clause ("...寄与することを示した"), so the
// object span runs from the nearest preceding boundary to the marker and
// may be phrasal rather than a clean noun. Downstream referent matching
// simply fails to match such spans — harmless garbage outvoted by clean
// triples, the same standing extractRelations' own imperfect captures
// already hold. `clauseBreakers` (received: 、) keeps spans from crossing
// enumeration boundaries, which measurably tightens them.

import { splitSentences } from "./spans.js";

const SENTENCE_TAIL = /[。．！？…\s]+$/u;
const SPAN_EDGE = /^[、。．！？…「」『』（）\s]+|[、。．！？…「」『』（）\s]+$/gu;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * @param {string} text raw document text
 * @param {object} [options]
 * @param {{subject?: string[], object?: string[], clauseBreakers?: string[]}|null}
 *   [options.caseMarkers] received role markers. Missing, empty, or
 *   marker-free input yields [] — the organ states nothing without a giver.
 * @param {Iterable<string>|null} [options.sentenceTerminators] received
 *   sentence marks (AbbreviationPrior@3), threaded through to
 *   splitSentences — WITHOUT them a 。-terminated document is one giant
 *   "sentence" per paragraph and spans cross real sentence boundaries
 *   (measured: "示した。本研究" read as one subject).
 * @param {Iterable<string>|null} [options.closingQuoteChars] same channel.
 * @param {number} [options.limit]
 * @returns {Array<{subject: string, verb: string, object: string, polarity: string}>}
 *   the SAME shape extractRelations emits, so sessionRelations/readTriples
 *   consume both unchanged.
 */
export const extractCaseRelations = (text, { caseMarkers = null, sentenceTerminators = null, closingQuoteChars = null, limit = Infinity } = {}) => {
  const subjectMarkers = caseMarkers?.subject ?? [];
  const objectMarkers = caseMarkers?.object ?? [];
  const breakers = caseMarkers?.clauseBreakers ?? [];
  if (!subjectMarkers.length && !objectMarkers.length) return [];

  const all = [
    ...[...subjectMarkers].map((m) => ({ m, role: "subject" })),
    ...[...objectMarkers].map((m) => ({ m, role: "object" })),
  ];
  const markerRe = new RegExp(all.map(({ m }) => escapeRe(m)).join("|"), "gu");
  const breakerRe = breakers.length ? new RegExp(breakers.map(escapeRe).join("|"), "gu") : null;

  const rels = [];
  const seen = new Set();
  for (const sent of splitSentences(text, { sentenceTerminators, closingQuoteChars })) {
    const s = sent.text;
    // Every marker occurrence in this sentence, in reading order, each
    // tagged with its received role.
    markerRe.lastIndex = 0;
    const hits = [];
    let hm;
    while ((hm = markerRe.exec(s)) !== null) {
      const role = subjectMarkers.includes(hm[0]) ? "subject" : "object";
      hits.push({ role, start: hm.index, end: hm.index + hm[0].length });
      markerRe.lastIndex = hm.index + hm[0].length; // multi-char safety
    }
    if (!hits.length) continue;

    // Breaker positions, for bounding spans below.
    const breakerEnds = [];
    if (breakerRe) {
      breakerRe.lastIndex = 0;
      let bm;
      while ((bm = breakerRe.exec(s)) !== null) {
        breakerEnds.push(bm.index + bm[0].length);
        breakerRe.lastIndex = bm.index + bm[0].length;
      }
    }

    // The predicate lives AFTER the LAST object marker in the sentence —
    // verb-final is not assumed per-clause; whatever follows the final
    // object marker up to the terminator IS the measured tail. Sentences
    // whose final marker is a subject marker produce no predicate here and
    // are skipped honestly rather than guessed at.
    const lastObject = [...hits].reverse().find((h) => h.role === "object");
    if (!lastObject) continue;
    // The predicate is the tail AFTER the final object marker, bounded by
    // the next clause breaker if one follows — without this bound a
    // two-clause sentence ("...を提案したが、...は...であった") would read
    // the SECOND clause's text into the FIRST relation's label.
    let predicateEnd = s.length;
    if (breakerRe) {
      breakerRe.lastIndex = lastObject.end;
      const pm = breakerRe.exec(s);
      if (pm) predicateEnd = pm.index;
    }
    const predicate = s.slice(lastObject.end, predicateEnd).replace(SENTENCE_TAIL, "").trim();
    if (!predicate) continue;

    let previousBoundary = 0;
    for (const hit of hits) {
      const spanStart = Math.max(previousBoundary, ...breakerEnds.filter((e) => e <= hit.start), 0);
      const span = s.slice(spanStart, hit.start).replace(SPAN_EDGE, "").trim();
      previousBoundary = hit.end;
      if (!span) continue;
      if (hit.role === "subject") {
        // A subject candidate alone proves nothing until an object marker
        // follows it in THIS sentence's marker sequence — recorded by
        // simply carrying the boundary forward; the triple is emitted from
        // the object side below.
        continue;
      }
      // Object hit: its span is the object; the most recent SUBJECT span
      // before it (this loop has been recording them via previousBoundary)
      // needs recovering — recompute it from the hits before this one.
      const priorSubjects = hits.filter((h) => h.role === "subject" && h.end <= hit.start);
      if (!priorSubjects.length) continue;
      const subjHit = priorSubjects[priorSubjects.length - 1];
      const subjStart = Math.max(
        0,
        ...breakerEnds.filter((e) => e <= subjHit.start),
        ...(hits.filter((h) => h.end <= subjHit.start).map((h) => h.end)),
      );
      const subject = s.slice(subjStart, subjHit.start).replace(SPAN_EDGE, "").trim();
      if (!subject) continue;
      const key = `${subject}|${predicate}|${span}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // via: the case-marking convention, disclosed per-triple — the
      // sibling of extractRelations' own "svo-position" tag. Two
      // conventions reading one document is steered by evidence
      // downstream (same edgeKey accumulates; the graph's own decay and
      // Bayesian surprise weight what the material keeps restating), never
      // by privileging either template here.
      rels.push({ subject, verb: predicate.toLowerCase(), object: span, polarity: "+", via: "case-marker" });
      if (rels.length >= limit) return rels;
    }
  }
  return rels;
};
