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
import { wordCompany } from "../packages/host/hyperlexicon.js";

// Real evidence, not a positional guess: POSPrior@1 built from Universal
// Dependencies' UD_English-EWT treebank (scripts/build-pos-prior.mjs,
// scripts/corpus/ — gitignored, local, reproducible: curl the treebank,
// run the builder). hyperlexicon.js's wordCompany falls back to the
// weaker position-heuristic reading when this is absent; here it is
// always present, so every company entry's grammar reading is the real,
// giver-cited classification, not the slot-order guess.
const posPrior = JSON.parse(readFileSync("./corpus/pos-prior-eng.json", "utf8"));

// Full corpus, not a slice — the holon-level partition (below) is what
// makes this tractable at full size; measured previously only on a
// 160,000-char slice because that was the size the flat (unpartitioned)
// search could still finish in reasonable time. Kept as a named constant
// in case full-corpus timing turns out to need a fallback.
const SLICE_CHARS = Infinity;
const path = "./adversarial/fixtures/pg84-frankenstein.txt";
const t0 = Date.now();
const wrapped = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const { text: stripped } = stripContainer(wrapped);
const raw = Number.isFinite(SLICE_CHARS) ? stripped.slice(0, SLICE_CHARS) : stripped;
console.log(`[${Date.now() - t0}ms] stripContainer: ${wrapped.length} -> ${stripped.length} chars, using ${raw.length}`);

const sentences = splitSentences(raw).map((s) => s.text);

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
  const grammar = companyFull.find((c) => c.grammar?.source === "wordclass")?.grammar
    ?? companyFull[0]?.grammar
    ?? null;
  return { tally, band, grammar };
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
function grammarClause(g) {
  if (g.source === "wordclass") {
    if (g.dominant) return `[grammar — giver: ${g.giver}: ${g.dominant.share > 0.5 ? "" : "leading candidate "}${g.dominant.thraxClass} (${(g.dominant.share * 100).toFixed(0)}% of ${g.candidates.reduce((s, c) => s + c.count, 0)} attested tags)]`;
    const top2 = g.candidates.slice(0, 2).map((c) => `${c.thraxClass ?? c.upos} ${(c.share * 100).toFixed(0)}%`).join(" vs ");
    return `[grammar — giver: ${g.giver}: no dominant reading (${top2}) — an occurrence-level check (resolveSpanRole) would be needed to resolve this one, not a type-level table]`;
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
function mergeReferents(refs) {
  const parent = refs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[a] = b; };
  const wordBoundary = (needle, haystack) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack);
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (wordBoundary(refs[i].display, refs[j].display) || wordBoundary(refs[j].display, refs[i].display)) union(i, j);
    }
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
const mergedReferents = mergeReferents(referents);
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
  const kinds = induceKinds(subset, { population: `pg84:${holon}`, ...KIND_OPTS });
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

writeFileSync("./hyperlexicon-definitions-data.json", JSON.stringify(out, null, 2));
console.log(`[${Date.now() - t0}ms] wrote hyperlexicon-definitions-data.json`);
