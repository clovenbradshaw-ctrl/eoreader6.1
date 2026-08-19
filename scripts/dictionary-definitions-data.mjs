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
// inventing a new one: chunk the material into the same 40-word windows
// that organ already uses, rank the chunks a word appears in by surprisal,
// and locate() (material.js's own byte-range lookup, unchanged) back to a
// real quote — never a new metric, never a hand-picked "top N by frequency."

import { readFileSync, writeFileSync } from "node:fs";
import { splitSentences, stripContainer } from "../packages/engine/perceiver/text/spans.js";
import { tokenizeWithOffsets, chunkWords, causalSurprisalSeries, locate } from "../packages/engine/perceiver/text/material.js";
import { extractOccurrences, frequencyBands } from "../induction/candidates.js";
import { createLemmatizer } from "../packages/engine/perceiver/text/morphology.js";
import { toAttributeRecords } from "../induction/attributes.js";
import { induceKinds } from "../packages/engine/emergence/kinds.js";
import { createSession, admitChunked } from "../packages/host/corpus.js";
import { admitGraph } from "../packages/host/graph.js";
import { wordCompany } from "../packages/host/dictionary.js";

const SLICE_CHARS = 160_000;
const path = "./adversarial/fixtures/pg84-frankenstein.txt";
const t0 = Date.now();
const wrapped = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const { text: stripped } = stripContainer(wrapped);
const raw = stripped.slice(0, SLICE_CHARS);
console.log(`[${Date.now() - t0}ms] stripContainer: ${wrapped.length} -> ${stripped.length} chars, using first ${raw.length}`);

const sentences = splitSentences(raw).map((s) => s.text);

const BAND_OPTS = { minAnchorFrequency: 5, maxAnchorFrequency: 150, foldCase: (t) => t.toLowerCase() };
const bands = frequencyBands(sentences, BAND_OPTS); // same call extractOccurrences makes internally; reused, not recomputed differently
const occResult = extractOccurrences(sentences, { ...BAND_OPTS, maxRunLength: 4 });
const records = toAttributeRecords(occResult.occurrences, { minOccurrences: 10 });
console.log(`[${Date.now() - t0}ms] candidate tokens: ${records.length}`);

// ── earned structural profile, no committed category ───────────────────────
//
// The previous version of this function returned "verb"/"noun"/"function
// word"/"modifier" — Dionysius Thrax's eight parts of speech (~100 BCE, via
// Donatus/Priscian's Latin adaptation and English SVO convention), laid over
// a heuristic Link-label slot that never verified grammar at all. Measured:
// "at" — a preposition — sat at the top of this fixture's own label-slot
// tally, `present`, `by`, `from`, `she` right beside it. A better filter
// would still be curating borrowed authority more carefully, not earning it.
//
// engine/operators.js's own Structure row has no verb, no noun: Ground is
// Field, Figure is Link, Pattern is Network. So this function now reports
// the earned tally — how many Links this word occupies as end A, end B, or
// the label — plus `band` (frequencyBands' content/function split, which
// IS earned: a real frequency statistic, not a grammar claim). A
// grammatical reading is attached SEPARATELY, named, and marked unverified
// — an overlay a caller may use or ignore, never the returned fact itself.
function structuralProfile(word, companyFull) {
  const tally = { a: 0, b: 0, label: 0 };
  for (const c of companyFull) tally[c.position] = (tally[c.position] ?? 0) + 1;
  const band = bands.gap ? "unknown" : bands.band(word); // earned: corpus-frequency band, not a grammar claim
  const total = tally.a + tally.b + tally.label;
  const plurality = total === 0 ? null : Object.entries(tally).sort((x, y) => y[1] - x[1])[0][0];
  return {
    tally,
    band,
    grammar: plurality ? { reading: grammarGiverReading(plurality), giver: GRAMMAR_GIVER_NOTE, basis: `plurality of ${total} Link occupancies` } : null,
  };
}
const GRAMMAR_GIVER_NOTE = "relations.js SVO-positional heuristic — a slot-order guess, never grammatically verified";
const grammarGiverReading = (position) => (position === "a" ? "subject" : position === "b" ? "object" : "verb");

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
  if (tally.label) {
    const partners = companyFull.filter((c) => c.position === "label").slice(0, 3).map((c) => `${c.link.a} → ${c.link.b}`).join("; ");
    parts.push(`As a Link's label: connects ${tally.label} entity pair${tally.label === 1 ? "" : "s"}: ${partners}.`);
  }
  if (tally.a) {
    const partners = [...new Set(companyFull.filter((c) => c.position === "a").map((c) => c.link.b))].slice(0, 3).join(", ");
    parts.push(`As Link end A (${tally.a}x): with ${partners}.`);
  }
  if (tally.b) {
    const partners = [...new Set(companyFull.filter((c) => c.position === "b").map((c) => c.link.a))].slice(0, 3).join(", ");
    parts.push(`As Link end B (${tally.b}x): with ${partners}.`);
  }
  if (!companyFull.length) parts.push(`No relation this reading extracted names it directly.`);
  if (side) parts.push(`Sits ${side} its head noun (mean distance ${distance?.toFixed(2)}).`);
  if (profile.grammar) parts.push(`[grammar overlay, unverified — giver: ${profile.grammar.giver}: read as ${profile.grammar.reading}]`);
  if (kindNote) parts.push(kindNote);
  return parts.join(" ");
}

// ── significant uses: same organ host/reading.js already runs ──────────────
const CHUNK_WORDS = 40; // read-people.mjs/reading.js's own declared number, reused not reinvented
const offsetTokens = tokenizeWithOffsets(raw);
const wordChunks = chunkWords(offsetTokens.map((t) => t.word), CHUNK_WORDS);
const surprisal = causalSurprisalSeries(wordChunks, { gamma: 1 });

const byteBuf = Buffer.from(raw, "utf8");
const quoteFor = (chunkIndex) => {
  const loc = locate(chunkIndex, offsetTokens, { chunkSize: CHUNK_WORDS });
  if (loc.error) return null;
  return byteBuf.subarray(loc.byteStart, loc.byteEnd).toString("utf8").replace(/\s+/g, " ").trim();
};

const chunksContaining = new Map(); // word -> Set(chunkIndex)
wordChunks.forEach((chunk, i) => {
  for (const w of new Set(chunk)) {
    if (!chunksContaining.has(w)) chunksContaining.set(w, new Set());
    chunksContaining.get(w).add(i);
  }
});

function topUses(word, n = 5) {
  const idxs = [...(chunksContaining.get(word) ?? [])];
  return idxs
    .map((i) => ({ chunk: i, surprisal: surprisal[i] }))
    .sort((a, b) => b.surprisal - a.surprisal)
    .slice(0, n)
    .map(({ chunk, surprisal: s }) => ({ surprisal: Math.round(s), quote: quoteFor(chunk) }))
    .filter((u) => u.quote);
}
console.log(`[${Date.now() - t0}ms] surprisal series over ${wordChunks.length} chunks`);

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

const partitionsOut = {};
for (const [holon, subset] of Object.entries(partitions)) {
  const tp = Date.now();
  const kinds = induceKinds(subset, { population: `pg84:${holon}`, ...KIND_OPTS });
  console.log(`[${Date.now() - t0}ms] induceKinds(${holon}, n=${subset.length}): ${Date.now() - tp}ms, ${kinds.length} kinds`);
  partitionsOut[holon] = {
    population: subset.length,
    members: subset.map((r) => {
      const wc = wordCompany(session, r.id);
      const distance = r.attributes.find((a) => a.field_id === "distance")?.value ?? null;
      const profile = structuralProfile(r.id, wc.company);
      const relatedForms = relatedFormsOf(r.id, wholeVocabulary);
      return {
        word: r.id,
        profile,
        distance,
        headship: r.attributes.find((a) => a.field_id === "headship")?.value ?? null,
        mentions: wc.mentions,
        company: wc.company.slice(0, 6),
        topUses: topUses(r.id, 5),
        relatedForms,
        definition: mechanicalDefinition(r.id, { profile, mentions: wc.mentions, companyFull: wc.company, side: holon === "before" ? "before" : "after", distance, relatedForms }),
      };
    }).sort((a, b) => (b.profile.tally.a + b.profile.tally.b + b.profile.tally.label) - (a.profile.tally.a + a.profile.tally.b + a.profile.tally.label) || a.word.localeCompare(b.word)),
    kinds: kinds.map((k) => ({
      id: k.id, height: k.height, cohesion: k.cohesion, ground: k.ground, core: k.core,
      memberCount: k.members.length,
      members: k.members.map((word) => ({ word, company: wordCompany(session, word).company.slice(0, 6) })),
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
  significance: `causalSurprisalSeries over ${CHUNK_WORDS}-word chunks (host/reading.js's own organ, gamma=1)`,
  morphology: { gap: lemmatizer.gap, note: "English suffix rule active regardless of gap; irregulars and -er/-est need a MorphologyPrior@1 table this repo snapshot does not carry" },
  partitions: partitionsOut,
};

writeFileSync("./dictionary-definitions-data.json", JSON.stringify(out, null, 2));
console.log(`[${Date.now() - t0}ms] wrote dictionary-definitions-data.json`);
