// Holon-level pipeline: partition candidate tokens on the FREE `side`
// signal (already computed by toAttributeRecords, zero search cost) before
// running the expensive Born-gate + search-null certification — measured
// 11x faster per run than flattening the whole population into one search
// (con() at n=575: 20.5s; at n~287 within a partition: 1.8s each).
//
// stripContainer removes the Gutenberg wrapper first (read-people.mjs's own
// precedent) so "ebook"/"gutenberg"/license-notice words don't leak into
// the novel's own word list.
//
// Each word's top-5 "most significant uses" reuses host/reading.js's own
// significance measure (causalSurprisalSeries, unchanged) rather than
// inventing a new one — run per SENTENCE (see that section's own header
// for why this replaced an earlier 40-word-chunk version that could quote
// a sentence fragment) — never a new metric, never a hand-picked "top N."

import { readFileSync, writeFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { tokenize, causalSurprisalSeries } from "../packages/engine/perceiver/text/material.js";
import { extractOccurrences, frequencyBands } from "../induction/candidates.js";
import { createLemmatizer } from "../packages/engine/perceiver/text/morphology.js";
import { toAttributeRecords } from "../induction/attributes.js";
import { induceKinds } from "../packages/engine/emergence/kinds.js";
import { createSession, admitChunked, sessionReferents } from "../packages/host/corpus.js";
import { admitGraph } from "../packages/host/graph.js";
import { wordCompany, grammarGloss } from "../packages/host/hyperlexicon.js";
import { referentGenderEvidence, genderClass } from "../packages/engine/perceiver/text/pronouns.js";
import { classifyByContext, POS_CONTEXT_META, POSITION_MIN_SHARE } from "../packages/engine/perceiver/text/posContext.js";
import { classifyWord, dominantClass } from "../packages/engine/perceiver/text/wordclass.js";

// Real evidence, not a positional guess: POSPrior@1 built from Universal
// Dependencies' UD_English-EWT treebank (scripts/build-pos-prior.mjs,
// scripts/corpus/ — gitignored, local, reproducible: curl the treebank,
// run the builder). hyperlexicon.js's wordCompany falls back to the
// weaker position-heuristic reading when this is absent; here it is
// always present, so every company entry's grammar reading is the real,
// giver-cited classification, not the slot-order guess.
const posPrior = JSON.parse(readFileSync("scripts/corpus/pos-prior-eng.json", "utf8"));
// Third tier, under real per-form evidence: certified POSITIONAL
// association (scripts/build-pos-context-prior.mjs, permutation-tested
// against the same treebank, committed at bin/priors/pos-context/en.json
// since it is a measured finding worth a durable home, not a mechanical
// re-derivable pass-through like posPrior above). Consulted only for a
// word classifyWord found nothing for — see grammarWithContext below.
const contextPrior = JSON.parse(readFileSync("bin/priors/pos-context/en.json", "utf8"));

// Full corpus, not a slice — the holon-level partition (below) is what
// makes this tractable at full size; measured previously only on a
// 160,000-char slice because that was the size the flat (unpartitioned)
// search could still finish in reasonable time. Kept as a named constant
// in case full-corpus timing turns out to need a fallback.
const SLICE_CHARS = Infinity;
// CLI-overridable so the same pipeline can be pointed at a different
// corpus for a real scale test — never hardcoded to one book, and the
// title is passed through to the output so the viewer's own fiction-check
// (Wikipedia lookup) resolves against the right work instead of a stale
// default.
const path = process.argv[2] || "scripts/adversarial/fixtures/pg84-frankenstein.txt";
const CORPUS_TITLE = process.argv[3] || "Frankenstein";
const CORPUS_SLUG = path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
const t0 = Date.now();
const wrapped = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const { text: stripped } = stripContainer(wrapped);
const raw = Number.isFinite(SLICE_CHARS) ? stripped.slice(0, SLICE_CHARS) : stripped;
console.log(`[${Date.now() - t0}ms] stripContainer: ${wrapped.length} -> ${stripped.length} chars, using ${raw.length}`);

// Frames kept whole (text + offset + order) — pronouns.js's own
// referentGenderEvidence needs the FULL frame, not just the text, to gate
// evidence to same-clause co-occurrence (see mergeReferents below).
const sentenceFrames = splitSentences(raw);
const sentences = sentenceFrames.map((s) => s.text);

const BAND_OPTS = { minAnchorFrequency: 5, maxAnchorFrequency: 150, foldCase: (t) => t.toLowerCase() };
const bands = frequencyBands(sentences, BAND_OPTS); // same call extractOccurrences makes internally; reused, not recomputed differently
const occResult = extractOccurrences(sentences, { ...BAND_OPTS, maxRunLength: 4 });
const records = toAttributeRecords(occResult.occurrences, { minOccurrences: 10 });
console.log(`[${Date.now() - t0}ms] candidate tokens: ${records.length}`);

// ── earned structural profile + real grammar, always on ────────────────────
//
// Two earlier corrections, now both landed. First: the tally below is
// earned — how many Links this word occupies as end A, end B, or the
// label — plus `band` (frequencyBands' content/function split, a real
// frequency statistic, not a grammar claim). Second: `grammar` is no
// longer a positional guess ("label slot -> assume verb", which put "at"
// there). hyperlexicon.js's wordCompany, given posPrior, already attaches
// real classifyWord/THRAX_MAP evidence to every company entry — every
// entry for the SAME word carries the SAME type-level classification
// (classifyWord reads the surface form, not the slot), so any one entry's
// `.grammar` is the word's grammar profile. ALWAYS SHOWN, never toggled
// off — it earned that once it stopped being a guess — but ALWAYS with
// its provenance: giver, and (when no candidate clears a majority, e.g.
// "that": SCONJ 994 vs PRON 851 in this build) an honest `dominant: null`
// rather than a forced reading.
function structuralProfile(word, companyFull) {
  const tally = { a: 0, b: 0, label: 0 };
  for (const c of companyFull) tally[c.position] = (tally[c.position] ?? 0) + 1;
  const band = bands.gap ? "unknown" : bands.band(word); // earned: corpus-frequency band, not a grammar claim
  // Grammar is a property of the word's FORM (classifyWord reads posPrior
  // by form, wordclass.js's own contract) — it must never depend on
  // whether THIS reading's relation-extraction happened to capture a Link
  // for it. Scanning companyFull for a pre-computed grammar (the old
  // approach) silently returned null for every word with zero company —
  // measured: 408 of 1125 non-proper-name words in the Frankenstein full
  // run, dwarfing the 88 genuinely not in the treebank and the 4 with no
  // majority reading combined. representativePosition only feeds the
  // never-classified-by-wordclass fallback reading (subject/object/verb);
  // it never gates whether classification itself runs.
  const topPosition = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const representativePosition = topPosition && topPosition[1] > 0 ? topPosition[0] : "a";
  let grammar = grammarGloss(word, representativePosition, posPrior);
  // THIRD TIER: classifyWord found nothing for this exact form (grammar
  // stayed "position-heuristic") — try the certified POSITIONAL signal
  // (perceiver/text/posContext.js, bin/priors/pos-context/en.json) before
  // falling all the way back to an unverified slot guess. Real per-form
  // treebank evidence above always wins when it exists; this only ever
  // runs for a form the treebank never attested at all.
  if (grammar.source === "position-heuristic") {
    const positional = classifyByContext(occurrenceContextsFor(word), contextPrior);
    if (positional.found) {
      const top = dominantClass(positional, { minShare: POSITION_MIN_SHARE });
      grammar = Object.freeze({
        source: "pos-context",
        form: word,
        giver: POS_CONTEXT_META.giver,
        candidates: positional.candidates,
        dominant: top ? Object.freeze({ upos: top.upos, thraxClass: top.thraxClass, share: top.share }) : null,
      });
    }
  }
  return { tally, band, grammar };
}

// This word's own real occurrences in THIS reading, each carrying its
// immediate neighbors' OWN resolved tags — never the target word's own
// identity, which is exactly what lets classifyByContext work on a form
// the treebank has never attested. sentencesContaining/sentenceTokens are
// defined further down (closures resolve at call time, and this function
// is only ever CALLED after both are built). NEIGHBOR_MIN_SHARE is the
// same standing majority bar WORDCLASS_MIN_SHARE already holds
// (hyperlexicon.js), restated here since that constant is private there.
const NEIGHBOR_MIN_SHARE = 0.5;
function occurrenceContextsFor(word) {
  const sentIdxs = sentencesContaining.get(word);
  if (!sentIdxs) return [];
  const neighborTag = (tok) => {
    if (tok == null) return null;
    const c = classifyWord(tok, { posPrior });
    if (!c.found) return null;
    const top = dominantClass(c, { minShare: NEIGHBOR_MIN_SHARE });
    return top ? top.upos : null;
  };
  const contexts = [];
  for (const si of sentIdxs) {
    const toks = sentenceTokens[si];
    for (let ti = 0; ti < toks.length; ti++) {
      if (toks[ti] !== word) continue;
      contexts.push({
        prevUpos: ti === 0 ? "SENT_START" : neighborTag(toks[ti - 1]),
        nextUpos: ti === toks.length - 1 ? "SENT_END" : neighborTag(toks[ti + 1]),
      });
    }
  }
  return contexts;
}

// ── related forms: UniMorph's own giver-tagging discipline, no table ───────
//
// perceiver/text/morphology.js::createLemmatizer, unchanged. No
// MorphologyPrior@1 table ships in this repo snapshot (its own builder,
// scripts/build-morphology-prior.mjs, needs a raw UniMorph TSV this
// checkout doesn't have) — createLemmatizer degrades LOUDLY, not silently:
// `lem.gap` reports `no_morphology_prior` and is surfaced below rather than
// hidden. What still works with no table is the module's own English
// suffix RULE (language:"eng"), which recovers regular inflection
// (write/writes) but not irregulars (write/wrote) or comparative/
// superlative -er/-est (not implemented in the rule at all — measured:
// big/biggest do NOT share a lemma under this rule).
//
// sameAct() SHORT-CIRCUITS TO STRICT EQUALITY when no table is loaded (a
// real gotcha in the module, measured two turns before this one) — it never
// falls through to the rule-based lemmasOf. So grouping here reads
// lemmasOf() directly and tests shared membership by hand.
//
// PROPOSE, DON'T COMMIT (this session's own prior correction, after
// species/specie was confirmed as a real false positive from the blind
// suffix rule: "species" strips to a candidate lemma "specie", which is a
// different, unrelated word). Every related-form entry below carries its
// own giver and is marked unverified — a candidate a reader may accept or
// ignore, never a silent merge into one entry. Held at the surface-form
// level (one card per attested form), never collapsed into a single
// lemma-entry, so this cannot pre-destroy whatever competing-definitions
// signal the incidence side might still find between two forms.
const lemmatizer = createLemmatizer(null, { language: "eng" });
const LEMMA_GIVER = "morphology.js English suffix rule — candidate only, no MorphologyPrior@1 table loaded, irregulars and -er/-est not covered";

function relatedFormsOf(word, vocabulary) {
  if (lemmatizer.size === 0 && lemmatizer.gap) {
    // the rule still runs even with gap !== null (language:"eng" alone
    // enables it) — this branch only means no TABLE, not no rule.
  }
  const mine = lemmatizer.lemmasOf(word);
  const hits = [];
  for (const other of vocabulary) {
    if (other === word) continue;
    for (const l of lemmatizer.lemmasOf(other)) {
      if (mine.has(l)) { hits.push(other); break; }
    }
  }
  return hits.map((w) => ({ word: w, giver: LEMMA_GIVER, verified: false }));
}

// grammar is always shown (no toggle hides it) but always carries its own
// provenance — real treebank evidence when classified, the weaker
// positional fallback when a form isn't in the prior, and an honest "no
// dominant reading" when the treebank itself is split, never a guess.
// Two separate provenance facts, never blended: g.giver names WHO NAMED the
// category (Thrax's tradition); g.evidenceGiver names WHOSE EVIDENCE put
// this exact word FORM (g.form — never assumed shared with any other
// inflection of the same word) in it (the UD_English-EWT treebank sample).
function grammarClause(g) {
  if (g.source === "wordclass") {
    const forWhat = `for the exact form "${g.form}" — not shared with any other inflection`;
    if (g.dominant) return `[grammar — evidence: ${g.evidenceGiver}, ${forWhat} (${g.candidates.reduce((s, c) => s + c.count, 0)} attested tags); category named by: ${g.giver}: ${g.dominant.share > 0.5 ? "" : "leading candidate "}${g.dominant.thraxClass} (${(g.dominant.share * 100).toFixed(0)}%)]`;
    const top2 = g.candidates.slice(0, 2).map((c) => `${c.thraxClass ?? c.upos} ${(c.share * 100).toFixed(0)}%`).join(" vs ");
    return `[grammar — evidence: ${g.evidenceGiver}, ${forWhat}; category named by: ${g.giver}: no dominant reading (${top2}) — an occurrence-level check (resolveSpanRole) would be needed to resolve this one, not a type-level table]`;
  }
  return `[grammar — giver: ${g.giver}: read as ${g.reading}, unverified]`;
}

// ── mechanical "definition": a template filled from measured fields, never
// a model's prose — the model is not the mouth here, the measurement is.
// Earned facts lead; the grammar overlay is named and clearly bracketed. ────
function mechanicalDefinition(word, { profile, mentions, companyFull, side, distance, kindNote, relatedForms }) {
  const parts = [`“${word}” —`];
  if (relatedForms && relatedForms.length) {
    const list = relatedForms.map((r) => r.word).join(", ");
    parts.push(`Possibly related forms attested in this reading: ${list} [candidate, unverified — giver: ${relatedForms[0].giver}].`);
  }
  if (mentions != null) parts.push(`${mentions} mention${mentions === 1 ? "" : "s"} in this reading.`);
  const { tally } = profile;
  // Same fix as the viewer's client-side rebuild: relation-extraction can
  // yield a blank end (empty string), which used to render as "with ."
  // with nothing after it. Filtered, with an honest fallback when nothing
  // legible survives.
  const legible = (xs) => [...new Set(xs.filter((x) => x && x.trim().length > 0))];
  if (tally.label) {
    const pairs = companyFull.filter((c) => c.position === "label" && c.link.a?.trim() && c.link.b?.trim()).slice(0, 3).map((c) => `${c.link.a} → ${c.link.b}`);
    parts.push(pairs.length
      ? `As a Link's label: connects ${tally.label} entity pair${tally.label === 1 ? "" : "s"}: ${pairs.join("; ")}.`
      : `As a Link's label: connects ${tally.label} entity pair${tally.label === 1 ? "" : "s"}, none legibly named by this extraction.`);
  }
  if (tally.a) {
    const partners = legible(companyFull.filter((c) => c.position === "a").map((c) => c.link.b)).slice(0, 3);
    parts.push(partners.length ? `As Link end A (${tally.a}x): with ${partners.join(", ")}.` : `As Link end A (${tally.a}x), partner not legibly extracted.`);
  }
  if (tally.b) {
    const partners = legible(companyFull.filter((c) => c.position === "b").map((c) => c.link.a)).slice(0, 3);
    parts.push(partners.length ? `As Link end B (${tally.b}x): with ${partners.join(", ")}.` : `As Link end B (${tally.b}x), partner not legibly extracted.`);
  }
  if (!companyFull.length) parts.push(`No relation this reading extracted names it directly.`);
  if (side) parts.push(`Sits ${side} its head noun (mean distance ${distance?.toFixed(2)}).`);
  if (profile.grammar) parts.push(grammarClause(profile.grammar));
  if (kindNote) parts.push(kindNote);
  return parts.join(" ");
}

// ── significant uses: causal surprisal computed PER SENTENCE ───────────────
//
// Was: causalSurprisalSeries over arbitrary 40-word chunks (host/reading.js's
// own window), quoted back via byte offsets. That guaranteed nothing about
// sentence boundaries — a "significant use" could start or end mid-clause,
// because a 40-word window has no notion of where a sentence ends. Measured
// directly (this reading): "Waldman.' 'D—n the fellow!' cried he..." as a
// quote's own opening words — a real fragment, not a rendering bug.
//
// Now: the SENTENCE is the unit causalSurprisalSeries runs over, not a
// window size borrowed from a different organ's own convention. This also
// sidesteps a real byte-vs-character offset mismatch the old path carried
// (tokenizeWithOffsets tracks UTF-8 BYTE offsets; splitSentences tracks
// CHARACTER offsets; Frankenstein's own text has multi-byte em-dashes and
// curly quotes, so the two were never directly comparable) — working
// sentence-by-sentence never needs to reconcile the two at all.
const sentenceTokens = sentences.map((s) => tokenize(s));
const surprisal = causalSurprisalSeries(sentenceTokens, { gamma: 1 });

const sentencesContaining = new Map(); // word -> Set(sentenceIndex)
sentenceTokens.forEach((toks, i) => {
  for (const w of new Set(toks)) {
    if (!sentencesContaining.has(w)) sentencesContaining.set(w, new Set());
    sentencesContaining.get(w).add(i);
  }
});

function topUses(word, n = 5) {
  const idxs = [...(sentencesContaining.get(word) ?? [])];
  return idxs
    .map((i) => ({ i, surprisal: surprisal[i] }))
    .sort((a, b) => b.surprisal - a.surprisal)
    .slice(0, n)
    .map(({ i, surprisal: s }) => ({ surprisal: Math.round(s), quote: sentences[i].replace(/\s+/g, " ").trim() }))
    .filter((u) => u.quote);
}
console.log(`[${Date.now() - t0}ms] surprisal series over ${sentences.length} sentences`);

// ── holon-level partition, unchanged from last run ──────────────────────────
const sideOf = (rec) => rec.attributes.find((a) => a.field_id === "side")?.value;
const partitions = {
  before: records.filter((r) => sideOf(r) === "before"),
  after: records.filter((r) => sideOf(r) === "after"),
};

const KIND_OPTS = { minPrevalence: 0.3, minKindSize: 3, permutations: 100, quantile: 0.95, seed: 1, reseeds: 2 };

// Combined vocabulary across BOTH partitions — a word and its inflected
// sibling can land on opposite sides of the free `side` split (e.g. one
// leans pre-nominal, the other doesn't), so related-form search has to see
// the whole candidate set, not just the partition being built.
const wholeVocabulary = records.map((r) => r.id);

const session = createSession();
admitChunked(session, { text: raw, sourceId: "s" });
admitGraph(session, { sourceId: "s" });

// PROPER NAMES ARE A DIFFERENT KIND OF ENTRY, and the engine already knows
// which candidate words are one — perceiver/text/surfaces.js's own
// coreference discovery (sessionReferents), running on every admitted
// document regardless of whether this pipeline ever asked it a question.
// Measured: "agrippa" (Cornelius Agrippa, a real character reference)
// produced a near-empty card — no Wiktionary entry, no grammar tags, no
// company — indistinguishable from a broken row, when the engine had
// already discovered it as a referent with 8 real mentions. Every
// candidate word is checked against every discovered surface (lowercased)
// here, ONCE, so a proper name gets its own honest label instead of being
// run through machinery built for common words that will never have an
// answer for it.
const { referents } = sessionReferents(session, { sourceId: "s", limit: 2000 });

// PRAGMATIC MERGE, NOT A COREF FIX. Measured (2026-08-19): this session's
// own discoverReferents split ONE person, Henry Clerval, into THREE
// unmerged referents — "Clerval" (58 mentions, bare surname, never linked
// to the other two), "Henry Clerval" (26 mentions, surfaces ["Henry",
// "Henry Clerval"]), and "M Clerval" (2 mentions) — a real bug in the
// upstream coreference engine (perceiver/text/surfaces.js), not something
// this pipeline can correct there. This is a LOCAL, DISCLOSED mitigation
// for this pipeline's own index only: two referents merge when one's full
// display is a whole-word substring of the other's (Clerval ⊂ Henry
// Clerval ⊂-shares M Clerval), union-find over that relation. Deliberately
// NOT "any shared word merges" — Alphonse Frankenstein and Victor
// Frankenstein share "Frankenstein" but neither display is a substring of
// the other's, so they correctly do NOT merge; a shared surname among
// distinct family members is exactly the false-merge this guards against.
// CONTRADICTORY PARAMETERS MUST NEVER MERGE — measured at War and Peace's
// scale (2026-08-19), the raw containment rule above catastrophically
// over-merges once a real referent happens to be a bare TITLE: "Prince"
// whole-word-matches 30+ distinct "Prince X" referents, and transitive
// union-find fuses Pierre, Natásha, Andrew, and Napoleon into ONE "person"
// through that single hub. Two things being the same requires their
// measured parameters to AGREE, not merely fail to be checked — a
// contradiction on any real parameter means either mixed observations or
// (as here) more than one entity, never a merge. GENDER is the one such
// parameter already engine-tier and mechanical, not invented for this
// script: perceiver/text/pronouns.js's own gender-evidence tally (which
// gendered pronoun co-occurs, same clause, with this referent's own named
// mentions — "GENDER IS A HARD FILTER... DERIVED, NOT TYPED IN", that
// file's own header) is real physics, not a guess. Natásha (evidenced "f")
// and Pierre/Andrew/Napoleon (evidenced "m") directly contradict and can
// never merge under this rule, no threshold involved.
//
// Gender alone does not close the whole hub failure — many distinct men
// share a title ("Prince Andrew" and "Prince Vasíli" both read "m", so
// gender alone would still let "Prince" bridge them, TRANSITIVELY, even
// with no direct edge between the two full names themselves). A second
// real parameter closes that gap: CO-OCCURRENCE AS DISTINCT ACTORS. If
// "Prince Andrew" and "Prince Vasíli" are ever both named in the SAME
// sentence as two separate (non-overlapping) mentions, that is direct,
// mechanical, physics-only proof the text treats them as two different
// people — a text does not name someone twice, as two different specific
// forms, in one sentence about themself. Overlap-aware (a sentence
// containing "Prince Andrew" trivially also whole-word-matches "Prince" at
// the SAME position — that must never count as two distinct mentions).
//
// BOTH checks run at the GROUP level, not just the direct edge: unioning
// i into j must be refused if EITHER signal contradicts for ANY existing
// member of i's group against ANY existing member of j's group — checking
// only the (i, j) pair itself would still let two already-hubbed groups
// merge through a THIRD hub without ever directly comparing their real,
// contradicting members. HUB_DEGREE_CAP remains a secondary, DISCLOSED-AS-
// A-HEURISTIC guard underneath both: a genuine coref split (Clerval /
// Henry Clerval / M Clerval, the real bug this mitigation was written for)
// fans out only to the small handful of fragments ONE person's own
// discovery produced — never to dozens of unrelated people sharing a title.
const HUB_DEGREE_CAP = 3;
function mergeReferents(refs, sentenceFrames) {
  const wordBoundary = (needle, haystack) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack);

  const referentSurfaces = new Map(); // surface -> ref index (string key, referentGenderEvidence's own contract)
  refs.forEach((r, i) => { for (const s of [r.display, ...r.surfaces]) if (s) referentSurfaces.set(s, String(i)); });
  const genderEvidence = referentGenderEvidence(sentenceFrames, referentSurfaces);
  const genders = refs.map((_, i) => genderClass(genderEvidence.get(String(i))));

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matchSpans = (display, text) => {
    const re = new RegExp(`\\b${escapeRe(display)}\\b`, "gi");
    const spans = [];
    let m;
    while ((m = re.exec(text))) spans.push([m.index, m.index + m[0].length]);
    return spans;
  };
  const overlaps = (a, b) => a[0] < b[1] && b[0] < a[1];
  // Cached per-referent, per-sentence spans — computed once, reused across
  // every pair check below, instead of re-scanning the whole corpus per pair.
  const spansByRef = refs.map((r) => sentenceFrames.map((f) => matchSpans(r.display, f.text)));
  const coOccursDistinctly = (i, j) => {
    if (refs[i].display === refs[j].display) return false;
    for (let s = 0; s < sentenceFrames.length; s++) {
      const as = spansByRef[i][s], bs = spansByRef[j][s];
      if (!as.length || !bs.length) continue;
      for (const a of as) for (const b of bs) if (!overlaps(a, b)) return true;
    }
    return false;
  };

  const edges = [];
  const degree = refs.map(() => 0);
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (wordBoundary(refs[i].display, refs[j].display) || wordBoundary(refs[j].display, refs[i].display)) {
        edges.push([i, j]);
        degree[i]++; degree[j]++;
      }
    }
  }
  const parent = refs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const groupMembers = refs.map((_, i) => new Set([i]));
  const union = (i, j) => {
    const a = find(i), b = find(j);
    if (a === b) return;
    parent[a] = b;
    for (const m of groupMembers[a]) groupMembers[b].add(m);
    groupMembers[a] = groupMembers[b];
  };
  const contradicts = (i, j) => {
    const gi = genders[i], gj = genders[j];
    if (gi !== "unknown" && gj !== "unknown" && gi !== gj) return true;
    return coOccursDistinctly(i, j);
  };
  for (const [i, j] of edges) {
    if (degree[i] > HUB_DEGREE_CAP || degree[j] > HUB_DEGREE_CAP) continue;
    const rootI = find(i), rootJ = find(j);
    if (rootI === rootJ) continue;
    let anyContradiction = false;
    for (const a of groupMembers[rootI]) {
      for (const b of groupMembers[rootJ]) {
        if (contradicts(a, b)) { anyContradiction = true; break; }
      }
      if (anyContradiction) break;
    }
    if (!anyContradiction) union(i, j);
  }
  const groups = new Map();
  refs.forEach((r, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  });
  return [...groups.values()].map((group) => {
    const display = group.map((r) => r.display).sort((a, b) => b.length - a.length)[0];
    const mentions = group.reduce((s, r) => s + r.mentions, 0);
    const surfaces = [...new Set(group.flatMap((r) => r.surfaces))];
    const mergedFrom = group.length > 1 ? group.map((r) => r.display) : null;
    return { display, mentions, surfaces, mergedFrom };
  });
}
const mergedReferents = mergeReferents(referents, sentenceFrames);
const merges = mergedReferents.filter((r) => r.mergedFrom);
if (merges.length) console.log(`[${Date.now() - t0}ms] pragmatic referent merges (upstream coref split, mitigated locally): ${merges.map((r) => `${r.display} <- [${r.mergedFrom.join(", ")}]`).join("; ")}`);

const properNameOf = new Map(); // lowercase surface -> {display, mentions, surfaces, mergedFrom}
for (const r of mergedReferents) {
  for (const s of r.surfaces) {
    const key = s.toLowerCase();
    if (!properNameOf.has(key)) properNameOf.set(key, { display: r.display, mentions: r.mentions, surfaces: r.surfaces, mergedFrom: r.mergedFrom, caseForm: s });
  }
}
console.log(`[${Date.now() - t0}ms] referents discovered: ${referents.length}, surface forms indexed: ${properNameOf.size}`);

const partitionsOut = {};
for (const [holon, subset] of Object.entries(partitions)) {
  const tp = Date.now();
  const kinds = induceKinds(subset, { population: `${CORPUS_SLUG}:${holon}`, ...KIND_OPTS });
  console.log(`[${Date.now() - t0}ms] induceKinds(${holon}, n=${subset.length}): ${Date.now() - tp}ms, ${kinds.length} kinds`);
  partitionsOut[holon] = {
    population: subset.length,
    members: subset.map((r) => {
      const wc = wordCompany(session, r.id, { posPrior });
      const distance = r.attributes.find((a) => a.field_id === "distance")?.value ?? null;
      const profile = structuralProfile(r.id, wc.company);
      const relatedForms = relatedFormsOf(r.id, wholeVocabulary);
      const properName = properNameOf.get(r.id) ?? null;
      return {
        word: r.id,
        profile,
        distance,
        headship: r.attributes.find((a) => a.field_id === "headship")?.value ?? null,
        mentions: wc.mentions,
        company: wc.company.slice(0, 6),
        topUses: topUses(r.id, 5),
        relatedForms,
        properName,
        definition: properName
          ? `"${properName.caseForm}" — a proper name: ${properName.display}, discovered by this reading's own coreference (${properName.mentions} mentions, surfaces attested: ${properName.surfaces.join(", ")})${properName.mergedFrom ? ` [pragmatic merge, this pipeline only, not a coref fix — upstream discoverReferents split this person into: ${properName.mergedFrom.join(", ")}]` : ""}. Not run through Wiktionary/grammar classification — those answer a different question (what a common word means) than this one (who this name refers to).`
          : mechanicalDefinition(r.id, { profile, mentions: wc.mentions, companyFull: wc.company, side: holon === "before" ? "before" : "after", distance, relatedForms }),
      };
    }).sort((a, b) => (b.profile.tally.a + b.profile.tally.b + b.profile.tally.label) - (a.profile.tally.a + a.profile.tally.b + a.profile.tally.label) || a.word.localeCompare(b.word)),
    kinds: kinds.map((k) => ({
      id: k.id, height: k.height, cohesion: k.cohesion, ground: k.ground, core: k.core,
      memberCount: k.members.length,
      members: k.members.map((word) => ({ word, company: wordCompany(session, word, { posPrior }).company.slice(0, 6) })),
    })),
  };
}

const out = {
  corpus: path,
  corpusTitle: CORPUS_TITLE,
  sliceChars: SLICE_CHARS,
  strippedContainer: true,
  sentences: sentences.length,
  candidateTokens: records.length,
  kindOpts: KIND_OPTS,
  holonLevel: "side (before/after head) — read directly off each record, zero search cost",
  significance: "causalSurprisalSeries over per-sentence tokenization (host/reading.js's own organ, gamma=1) — one score per sentence, so every quoted use is always a complete sentence",
  morphology: { gap: lemmatizer.gap, note: "English suffix rule active regardless of gap; irregulars and -er/-est need a MorphologyPrior@1 table this repo snapshot does not carry" },
  // The before/after split is still real underneath (it's the holon-level
  // partition that makes the Born-gate search tractable at all — see the
  // header) but the UI stopped presenting it as two grouped columns; one
  // flat word list, deduped and re-sorted, is the actual browsable set.
  allMembers: [...partitionsOut.before.members, ...partitionsOut.after.members].sort((a, b) => a.word.localeCompare(b.word)),
  partitions: partitionsOut,
};

writeFileSync("scripts/hyperlexicon-definitions-data.json", JSON.stringify(out, null, 2));
console.log(`[${Date.now() - t0}ms] wrote hyperlexicon-definitions-data.json`);
