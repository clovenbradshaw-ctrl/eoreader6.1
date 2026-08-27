// eoreader6 · packages/host/hyperlexicon — a word's live definition: the
// company it currently keeps in this session's belief graph, and whichever
// kind (a received prior, or one induced) that company places it in.
//
// Thin composition, host tier, same standing as host/graph.js: wires organs
// that already existed and had never been pointed at each other. NO NEW
// NODE KIND, no new measurement — graph.js's own header already invites
// this ("feed it raw surfaces and it builds a surface graph"), and
// emergence/jati.js's understand() already asks "prior, or invent" of any
// population handed to deriveBeingRecords. This file is the caller a WORD
// never had: everywhere else understand() is aimed at a population of
// beings, this aims the identical act at a population of graph nodes and
// asks where one particular word landed.
//
// LIVE BY CONSTRUCTION, NOT BY RECOMPUTATION. wordCompany reads
// session.graph.edges directly — current decayed weights, current tick —
// so it is correct at whatever point the session has read to, with nothing
// cached to go stale. wordKind is NOT cheap the same way: induceKinds's two
// Born gates plus its search null are the expensive act
// scripts/induction-live-priors.mjs measured at several minutes for a
// single ~154KB book (see that script's own header) — that cost does not
// go away just because this is called from a session instead of a batch
// script. wordKind runs the WHOLE population through understand() on every
// call; a caller driving a live UI should call it on demand (a lookup),
// never on a keystroke. What makes repeat lookups cheap is a received
// KindVocabulary@1 prior — checked first, by understand() itself — so the
// expensive half only ever runs for a population nothing has certified yet.

import { deriveBeingRecords, understand } from "../engine/emergence/jati.js";
import { classifyWord, dominantClass, THRAX_META, POS_PRIOR_META } from "../engine/perceiver/text/wordclass.js";
import { sessionRelations, sessionReferents } from "./corpus.js";
import { referentLookup } from "./graph.js";
import { createLog, tick as tickLog } from "../../event_log/index.js";
import { gap } from "../../nul/index.js";

export const CELL = Object.freeze({ op: "EVA", grain: "Figure" });

// Same parsing emergence/jati.js's own (private) endpointsOf/negatedEdge use
// against graph.js's edgeKey/structuralKey formats (`subject|[!]verb|object`
// or the structural `subject|[!]|object`) — duplicated here rather than
// exported from jati.js because it is graph.js's key FORMAT being read, not
// a jati.js measurement; graph.js is where this belongs if it ever needs a
// second caller beyond this file and jati.js.
const endpointsOf = (key) => {
  const i = key.indexOf("|");
  const j = key.lastIndexOf("|");
  return { s: key.slice(0, i), o: key.slice(j + 1) };
};
const midOf = (key) => {
  const i = key.indexOf("|");
  const j = key.lastIndexOf("|");
  return key.slice(i + 1, j);
};
const negatedEdge = (key) => midOf(key).startsWith("!");
const verbOf = (key) => {
  const mid = midOf(key);
  return mid.startsWith("!") ? mid.slice(1) : mid;
};

// ── earned vocabulary vs. declared overlay ──────────────────────────────────
//
// engine/operators.js's own Structure row is { Ground: Field, Figure: Link,
// Pattern: Network } — nodes are Entity, edges are Link, and a Link is
// nothing more than two ends and a label. THAT is what graph.edges actually
// holds. "Subject," "object," and "verb" are not in that table anywhere —
// they are English-grammar-tradition names (Dionysius Thrax's eight parts of
// speech, carried through Donatus and Priscian into the SVO convention
// English speakers expect) laid over "first end / label / second end," and
// perceiver/text/relations.js never verifies the label position is
// grammatically a verb — it is a positional heuristic. Measured: the top of
// this fixture's own label-slot values were `is, by, from, at, were, she,
// would, could, are, will` — prepositions and a pronoun sitting where "verb"
// was claimed. `at` is not a malformed verb; it is proof the name was never
// earned, since a real classifier fix would still be curating borrowed
// authority rather than removing the claim.
//
// So every company entry below carries the earned fact — `position` (which
// end/label slot this word occupies in ONE Link, plus the Link's other two
// slots, plainly) — as what it actually is, and the grammatical gloss as a
// clearly separate, named overlay a caller may ignore.
//
// RECEIVED FIRST, HEURISTIC ONLY AS FALLBACK — the same "prior, or invent"
// discipline understand()/checkKindPrior already hold. perceiver/text/
// wordclass.js (landed 2026-08-19, PR #4) answers CLASS from real evidence:
// classifyWord() reads a POSPrior@1 built from Universal Dependencies'
// UD_English-EWT treebank (scripts/build-pos-prior.mjs; real annotation,
// ambiguity preserved, never collapsed to one tag) and THRAX_MAP translates
// UD's tagset to Dionysius Thrax's own eight ancient categories, every
// entry naming exactly where the two schemes do and do not agree. When a
// caller supplies that prior, `at`'s classification is measured (98.6% ADP
// -> "preposition" in this build) rather than guessed from which Link slot
// it happened to occupy — and it cross-validates the position tally rather
// than replacing it: `at` sitting at 0 end-A/0 end-B/90 label occupancies
// (measured, this fixture) and 98.6% ADP (measured, the treebank) are two
// independent measurements agreeing, not one overlay asserting the other.
//
// wordclass.js answers CLASS only, never SLOT — position above stays the
// earned structural fact regardless of which grammar path fires below.
// dominantClass's own minShare is declared, never defaulted (its own
// contract): 0.5, a literal majority of attested tags, is the smallest bar
// that means "more than everything else combined" rather than a curve fit
// to any one word.
const WORDCLASS_MIN_SHARE = 0.5;
const POSITION_GIVER = "perceiver/text/relations.js SVO-positional heuristic — a slot-order guess, never grammatically verified (fallback: no posPrior supplied, or this form is not in it)";
const positionGloss = (position) =>
  Object.freeze({ source: "position-heuristic", reading: position === "a" ? "subject" : position === "b" ? "object" : "verb", giver: POSITION_GIVER });

// TWO SEPARATE GIVERS, NEVER BLENDED INTO ONE. `giver` names who NAMED the
// eight-way category scheme (Thrax); `evidenceGiver` names who PRODUCED the
// counts that put THIS word in one of those categories (Universal
// Dependencies' UD_English-EWT treebank — POS_PRIOR_META, already defined
// in wordclass.js, previously computed but never actually attached here).
// A reader seeing "preposition" next to a word was seeing Thrax's category
// NAME with no visible sign the number behind it came from an external,
// finite, 16,654-word annotated sample rather than this corpus itself or
// the engine's own judgment — exactly the "received, never invented"
// distinction genre-seed.js already holds elsewhere in this codebase, made
// explicit here instead of left implicit in a field nothing read.
//
// `form` is the EXACT treebank key this classification is FOR — classifyWord
// lowercases internally and looks up ONE literal surface string; "afforded"
// and "afford" and "affords" are three separate keys with independently
// attested (and potentially contradictory) distributions, never
// interchangeable. Stated here so no caller has to re-derive or assume it.
export function grammarGloss(word, position, posPrior) {
  if (!posPrior) return positionGloss(position);
  const classification = classifyWord(word, { posPrior });
  if (!classification.found) return positionGloss(position);
  const top = dominantClass(classification, { minShare: WORDCLASS_MIN_SHARE });
  return Object.freeze({
    source: "wordclass",
    form: word.toLowerCase(),
    giver: THRAX_META.giver,
    evidenceGiver: POS_PRIOR_META.giver,
    candidates: classification.candidates.map((c) => Object.freeze({ upos: c.upos, count: c.count, share: c.share, thraxClass: c.thraxClass })),
    dominant: top ? Object.freeze({ upos: top.upos, thraxClass: top.thraxClass, share: top.share }) : null,
    // no candidate cleared minShare (e.g. "that": SCONJ 994 vs PRON 851 in
    // this build) is disclosed as null, never forced to a guess — exactly
    // the case wordclass.js's own header names as roles.js's, not this
    // organ's, to resolve.
  });
}

/**
 * The word's current direct incidence in the session graph — every Link it
 * sits on right now, as end A, end B, or the label itself, with weight and
 * polarity. Reads live graph state; nothing here is derived, nothing here
 * is cached, and gamma's own decay is already baked into `weight` because
 * this reads graph.edges directly rather than a snapshot.
 *
 * graph.js's own nodes are Entity-only (its header: "who is present and
 * what they do to whom") — a Link's label never becomes a node, only ever
 * an edge's middle slot. Checking end A/end B alone (this function's own
 * earlier shape) silently treats every word as if it might be cast: a word
 * that is only ever a label ("is", 108 edges in one fixture slice) came
 * back `present: false` even though it is exactly as graph-resident as any
 * Entity, just resident in a different slot. A word's position here is a
 * fact about ONE Link, not about the word — the same word can occupy end A
 * on one edge and the label on another (rare, but the graph does not
 * forbid it), so `position` is per company-entry, never per word.
 *
 * `posPrior` is optional and injected, never loaded from disk here (the
 * cast.js pattern wordclass.js itself follows) — a POSPrior@1-shaped object
 * from scripts/build-pos-prior.mjs's own output. Omitted, every company
 * entry's `grammar` falls back to the position-heuristic reading, exactly
 * this function's pre-wordclass.js behaviour.
 */
export function wordCompany(session, word, { posPrior } = {}) {
  const graph = session?.graph;
  const id = String(word).toLowerCase();
  if (!graph) return { word: id, present: false, company: [] };

  // ONE RELATION CAN OWN TWO EDGE KEYS, NOT TWO RELATIONS. host/graph.js's
  // admitGraph passes `structural: true` unconditionally (graph.js's own A5:
  // "the structural key runs alongside the verb-inclusive key so that both
  // text-derived and binding-derived relations coexist"), so a single SVO
  // triple writes both `a|label|b` and its label-free structural twin
  // `a||b` into graph.edges. Scanning edges naively (this function's own
  // earlier shape) reported that as two independent company entries — the
  // same relation, double-counted, for every Link-having word in the whole
  // graph. Grouped below by (position, other end): the labeled key's label
  // wins when one exists, and the structural twin's own weight is kept
  // (not summed — two independent decay channels, not one quantity) as
  // corroboration, never a second fact.
  const groups = new Map(); // "position|otherEnd" -> merged entry
  for (const [k, w] of graph.edges) {
    const { s, o } = endpointsOf(k);
    const v = verbOf(k);
    const negated = negatedEdge(k);
    const link = Object.freeze({ a: s, label: v || null, b: o });
    const add = (position, other) => {
      const gk = `${position}|${other}`;
      const existing = groups.get(gk);
      if (!existing) { groups.set(gk, { position, link, weight: w, structuralWeight: null, negated, grammar: grammarGloss(id, position, posPrior) }); return; }
      // Prefer the labeled key's link (more informative); fold the other
      // edge's weight in as corroboration rather than a second entry.
      if (link.label && !existing.link.label) { existing.link = link; existing.structuralWeight = existing.weight; existing.weight = w; }
      else if (!link.label && existing.link.label) { existing.structuralWeight = w; }
      else { existing.weight = Math.max(existing.weight, w); }
      existing.negated = existing.negated || negated;
    };
    if (s === id) add("a", o);
    if (o === id) add("b", s);
    // The structural key (binding-derived, no label — graph.js's own A5) has
    // an empty label slot, which must never match a real word here.
    if (v === id && v !== "") add("label", `${s} → ${o}`);
  }
  const company = [...groups.values()].sort((a, b) => b.weight - a.weight);

  const node = graph.nodes.get(id);
  return {
    word: id,
    present: company.length > 0 || Boolean(node),
    mentions: node?.mentions ?? null,
    firstSeen: node?.firstSeen ?? null,
    lastSeen: node?.lastSeen ?? null,
    company,
  };
}

/**
 * The word's kind: a received KindVocabulary@1 prior if one covers this
 * population, else induced from the graph's own structure — understand()
 * unchanged, aimed at deriveBeingRecords(graph) instead of a hand-curated
 * being list. EXPENSIVE when no prior covers the population; see this
 * module's header before calling this from anything that fires on every
 * keystroke.
 *
 * population/readerVersion/permutations/etc. are declared, never defaulted
 * — the same discipline understand()/induceKinds() already enforce, so this
 * throws rather than silently picking a number for you.
 */
export function wordKind(session, word, { priors = [], population, readerVersion, ...kindOpts }) {
  const graph = session?.graph;
  const id = String(word).toLowerCase();
  if (!graph) return { word: id, understanding: "no_graph" };

  const records = deriveBeingRecords(graph, { population });
  const result = understand(records, { priors, population, readerVersion, ...kindOpts });

  if (result.understanding === "prior") {
    return { word: id, understanding: "prior", giver: result.giver, kind: result.prior_kind };
  }

  const memberOf = result.kinds.find((k) => k.members?.includes(id)) ?? null;
  return {
    word: id,
    understanding: "invented",
    inGraph: graph.nodes.has(id),
    kind: memberOf,
    certifiedKinds: result.kinds.length,
    priorGap: result.prior, // the missing_kind_prior gap understand() already produced, kept as provenance
  };
}

/**
 * Both halves in one call: live company, plus whichever kind currently
 * places this word — a HyperLexicon entry. kindArgs is optional and left
 * out of the default path on purpose: pass it only when the expensive half
 * is actually wanted for this lookup (see wordKind's header).
 *
 * Every definition act is WITNESSED into the session's append-only
 * HyperLexicon log (see the HyperLexicon@1 section below) — reading a word
 * is an event in this system, not a pure function call. The RETURN SHAPE is
 * unchanged from before the log existed ({...company, kind}), derived from
 * the same standard entry the log records, so existing callers neither
 * break nor silently stop feeding the lexicon.
 */
export function defineWord(session, word, kindArgs = null) {
  const entry = buildEntry(session, word, { kindArgs });
  witnessDefinition(session, entry);
  return legacyShape(entry);
}

// wordCompany's own merged-present semantics (`company.length > 0 ||
// Boolean(node)`), derived from the standard entry instead of recomputed —
// one definition of "witnessed", two projections of it.
const legacyShape = (entry) => ({
  word: entry.word,
  present: entry.status === "witnessed",
  mentions: entry.entity.mentions,
  firstSeen: entry.entity.firstSeen,
  lastSeen: entry.entity.lastSeen,
  company: entry.links,
  kind: entry.kind,
});

// ── wordSenses · competing definitions off ONE word's own occurrences ──────
//
// wordKind asks "what kind of entity is this word, among every node in the
// graph" — a population of thousands, aggregated to one profile per node.
// That is a different question from "does THIS word's own usage split into
// more than one thing" — the question this section actually answers, and
// the one the graph's decayed edges cannot: graph.js sums restatements into
// a single weight per edge key, so a word's individual OCCURRENCES — which
// is the population competing definitions have to be clusters OF — have to
// be read from sessionRelations' raw per-document triples, before they are
// folded into the graph at all.

const asId = (s, lookup) => String(lookup.get(String(s).toLowerCase()) ?? s).toLowerCase();

/**
 * One record per occurrence of `word` as a Link's end A or end B, across the
 * named document(s) — presence-coded attributes (which partner, which
 * label, which end, negated or not), the same shape sessionKinds/
 * induction-live-priors already use for presence-only populations.
 * Canonicalises through the same per-document referent lookup admitGraph
 * uses, so "Victor" and "Frankenstein" occurrences of the same being are
 * not silently split by spelling.
 *
 * Field names are earned (`position:a`/`position:b`, `label:X`), not
 * grammatical (`role:subject`, `verb:X`) — see wordCompany's header. This
 * matters beyond naming hygiene: induceKinds finding a certified split on
 * `label:are` vs `label:will` (measured, on "you", in this fixture) is a
 * claim about which LABEL recurs, nothing about tense or mood — a reader
 * who wants that reading applies it themselves, named and citable, never
 * baked into the field the statistic ran over.
 */
export function wordOccurrences(session, word, { sourceId } = {}) {
  const id = String(word).toLowerCase();
  const targets = sourceId ? [sourceId] : Array.from(session?.documents?.keys() ?? []);
  const records = [];
  let n = 0;
  for (const docId of targets) {
    const { relations } = sessionRelations(session, { sourceId: docId });
    const lookup = referentLookup(session, docId);
    for (const t of relations) {
      const s = asId(t.subject, lookup);
      const o = asId(t.object, lookup);
      if (s !== id && o !== id) continue;
      const position = s === id ? "a" : "b";
      const partner = s === id ? o : s;
      const attributes = [
        { field_id: `position:${position}`, value_type: "present" },
        { field_id: `partner:${partner}`, value_type: "present" },
      ];
      if (t.verb) attributes.push({ field_id: `label:${t.verb}`, value_type: "present" });
      if (t.polarity === "−" || t.polarity === "-") attributes.push({ field_id: "negated", value_type: "present" });
      records.push(Object.freeze({ id: `occ${n++}:${docId}`, attributes: Object.freeze(attributes) }));
    }
  }
  return Object.freeze(records);
}

/**
 * The one-hop separation test: does `word`'s own occurrence population
 * split into more than one cluster that clears BOTH Born gates plus the
 * search null — competing definitions, or does it hold together (or fail
 * to clear at all, honestly reported as a gap rather than forced)?
 *
 * Declared, never defaulted, same as wordKind/understand/induceKinds — a
 * single word's occurrence count inside one document is usually tens, not
 * the hundreds+ induceKinds was measured against, so minKindSize/reseeds
 * should be set with that scale in mind, not copied blind from a
 * population-of-beings run.
 */
export function wordSenses(session, word, { sourceId, priors = [], population, readerVersion, ...kindOpts } = {}) {
  const records = wordOccurrences(session, word, { sourceId });
  if (records.length === 0) return { word: String(word).toLowerCase(), occurrences: 0, understanding: "no_occurrences" };

  const result = understand(records, { priors, population, readerVersion, ...kindOpts });
  if (result.understanding === "prior") {
    return { word: String(word).toLowerCase(), occurrences: records.length, understanding: "prior", giver: result.giver, kind: result.prior_kind };
  }
  return {
    word: String(word).toLowerCase(),
    occurrences: records.length,
    understanding: "invented",
    senses: result.kinds, // more than one surviving cluster IS the competing-definitions claim
    priorGap: result.prior,
  };
}

// ── HyperLexicon@1 · the standard projection, append-only and folded ────────
//
// Everything above this line is ORGANS — wordCompany, wordKind, defineWord,
// wordSenses — each answering one question about one word, with shapes that
// grew per caller. This section is the STANDARD format those organs project
// into: a versioned, frozen, deterministic collection a caller can hold,
// serialise, and diff against another reading point without knowing which
// organ produced which field.
//
// A word's meaning here is a WITNESSED TERRAIN CONSTELLATION, never a
// natural-language gloss: Entity standing (is there a node, how often has it
// been mentioned), live Links (every edge it sits on right now, decayed
// weights and all), and an optional earned Kind (received prior or induced —
// never run unless explicitly requested; see nonGreedy below). The three are
// kept as SEPARATE blocks on purpose: wordCompany's own merged `present`
// boolean is deliberately NOT reused at this tier, because a word that is
// only ever a Link label ("is", 108 edges in one fixture slice — see
// wordCompany's header) is graph-resident in the Link terrain while having
// no Entity standing at all. Collapsing both into one boolean is exactly the
// terrain-flattening this projection exists to refuse.
//
// APPEND-ONLY LOG, FOLDED — never a store that gets rewritten. Every
// definition act (defineWord, hyperlexiconEntry, hyperlexicon) appends one
// frozen event to the session's log (event_log/index.js's own tick(), the
// same append-only discipline every other producer already follows), and
// foldHyperlexicon() reduces that log to the current HyperLexicon@1
// collection. Nothing is ever mutated or deleted; a word whose standing
// changed between two readings shows BOTH witnesses in the log and the
// latest one in the fold, with the drill-down path (witness event ids)
// carried on the folded entry — the lossless-fold law's (a)-and-(b),
// satisfied rather than cited.
//
// UNRESOLVED IS A RESULT, NOT AN ERROR (P4): a vocabulary surface nothing
// witnessed still gets its entry — status "unresolved", empty terrains — so
// a caller comparing two readings sees the absence move, not vanish.

export const HYPERLEXICON_SCHEMA = "HyperLexicon@1";
export const HYPERLEXICON_ENTRY_SCHEMA = "HyperLexiconEntry@1";
export const HYPERLEXICON_EVENT = "HL.definition";
export const LEXICON_PRIOR_SCHEMA = "LexiconPrior@1";

// ── received resolution knowledge ────────────────────────────────────────────
//
// An unresolved entry is a measurement gap, and P3 already names the only
// thing that may close such a gap without fabrication: a RECEIVED prior,
// giver-named, injected never derived. LexiconPrior@1 is that prior for the
// lexicon's own two gap classes:
//
//   aliases — which surfaces predicate one being ("henry" with "henry
//             clerval"), the model-tier judgment surfaces.js declares the
//             engine must not derive (P2 stage 4 / P3 type-2);
//   types   — what an unwitnessed word IS ("chamounix" -> place), closing
//             the "is this a person we failed on, or a river?" question by
//             declaration instead of a guess.
//
// The discipline is checkKindPrior's, unchanged: a missing giver throws (a
// prior without provenance is indistinguishable from a fabrication); a
// wrong-schema or malformed prior is REFUSED with a reason, never thrown —
// one bad gift must not silence the rest. And a prior never competes with
// witness: direct graph evidence answers first; the prior fires only on
// absence, and its provenance rides on the entry it resolved.
const validateLexiconPriors = (priors) => {
  if (!Array.isArray(priors))
    throw new TypeError("lexicon priors must be an array — an empty list is a claim, a missing one is not");
  const accepted = { aliases: [], types: [], refused: [] };
  for (const p of priors) {
    if (!p || typeof p !== "object") {
      accepted.refused.push({ giver: "(malformed)", reason: "not an object" });
      continue;
    }
    if (!p.giver) throw new TypeError(`a lexicon prior must name its giver — a prior without one is indistinguishable from a fabrication`);
    if (p.schema !== LEXICON_PRIOR_SCHEMA) {
      accepted.refused.push({ giver: p.giver, reason: "unsupported_schema", schema: p.schema ?? null });
      continue;
    }
    for (const a of p.aliases ?? []) {
      if (!a || typeof a.canonical !== "string" || !Array.isArray(a.surfaces) || a.surfaces.some((s) => typeof s !== "string")) {
        accepted.refused.push({ giver: p.giver, reason: "malformed_alias" });
        continue;
      }
      accepted.aliases.push({ canonical: a.canonical.trim().toLowerCase(), surfaces: a.surfaces.map((s) => s.trim().toLowerCase()), giver: p.giver });
    }
    for (const t of p.types ?? []) {
      if (!t || typeof t.word !== "string" || typeof t.type !== "string") {
        accepted.refused.push({ giver: p.giver, reason: "malformed_type" });
        continue;
      }
      accepted.types.push({ word: t.word.trim().toLowerCase(), type: t.type, giver: p.giver });
    }
  }
  return accepted;
};

// Deterministic key normalization — TRIM + LOWERCASE, nothing else. This is
// deliberately IDENTICAL to wordCompany's own keying (`String(word)
// .toLowerCase()`), not the session's wider fold (P7.1): a projection must
// never normalize differently from the organ it projects over, or the two
// disagree about what a word is — the exact two-organs-disagreeing failure
// P7 names. A wider fold here would be a new claim needing its own fixture;
// lowercase matching is the claim wordCompany already makes.
export function normalizeVocabulary(vocabulary) {
  if (!Array.isArray(vocabulary))
    throw new TypeError("normalizeVocabulary: vocabulary is declared, never defaulted — pass an explicit array of surfaces (an empty array is a claim: that you want no words)");
  const seen = new Set();
  for (const surface of vocabulary) {
    if (typeof surface !== "string" || surface.trim().length === 0)
      throw new TypeError(`normalizeVocabulary: every vocabulary entry must be a non-empty string, got ${JSON.stringify(surface ?? null)}`);
    seen.add(surface.trim().toLowerCase());
  }
  return Object.freeze([...seen].sort());
}

const freezeDeep = (value) => {
  if (!value || typeof value !== "object") return value;
  // Freeze HERE, but never let an already-frozen container stop the walk —
  // wordCompany freezes each Link's {a,label,b} while leaving the merged
  // company groups unfrozen, so a container's own seal says nothing about
  // its children's.
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
};

// The one internal builder — no witnessing, no side effects. Both the legacy
// defineWord shape and the standard entry derive from THIS, so the two
// projections cannot drift apart.
const buildEntry = (session, word, { posPrior, kindArgs, priors = [] } = {}) => {
  const id = String(word).trim().toLowerCase();
  const company = wordCompany(session, id, { posPrior });

  // Entity terrain read straight off the node map — NOT wordCompany's merged
  // `present`, which folds Link incidence in (see section header).
  const node = session?.graph?.nodes.get(id);
  const entity = Object.freeze({
    present: Boolean(node),
    mentions: node?.mentions ?? null,
    firstSeen: node?.firstSeen ?? null,
    lastSeen: node?.lastSeen ?? null,
  });
  const links = Object.freeze(company.company);
  const kind = kindArgs ? wordKind(session, id, kindArgs) : null;

  const entry = {
    schema: HYPERLEXICON_ENTRY_SCHEMA,
    word: id,
    status: entity.present || links.length > 0 ? "witnessed" : "unresolved",
    entity,
    links,
    kind,
  };

  // Witness first, prior only on absence — received knowledge closes gaps,
  // it never competes with the graph's own evidence.
  if (entry.status === "unresolved" && priors.length > 0) {
    const given = validateLexiconPriors(priors);
    if (given.refused.length > 0) entry.refusedPriors = given.refused;

    const alias = given.aliases.find((a) => a.surfaces.includes(id));
    if (alias && alias.canonical !== id) {
      const target = session?.graph?.nodes.get(alias.canonical);
      if (target || wordCompany(session, alias.canonical).company.length > 0) {
        const resolved = buildEntry(session, alias.canonical, { posPrior, kindArgs });
        return freezeDeep({
          ...resolved,
          word: id, // what was asked, kept — the constellation is the canonical's
          askedFor: alias.canonical,
          alias: Object.freeze({ canonical: alias.canonical, giver: alias.giver }),
        });
      }
      entry.priorGap = gap("alias_target_unwitnessed", { canonical: alias.canonical, giver: alias.giver });
      return freezeDeep(entry);
    }

    const typed = given.types.find((t) => t.word === id);
    if (typed) entry.typed = { type: typed.type, giver: typed.giver };
  }

  return freezeDeep(entry);
};

// Idempotent, the same contract attachGraph holds: one log per session,
// created on first definition act, never replaced.
export function attachHyperlexicon(session) {
  if (!session.hyperlexicon) session.hyperlexicon = createLog();
  return session.hyperlexicon;
}

const witnessDefinition = (session, entry) => {
  const log = attachHyperlexicon(session);
  return tickLog(log, {
    type: HYPERLEXICON_EVENT,
    word: entry.word,
    status: entry.status,
    entityPresent: entry.entity.present,
    linkCount: entry.links.length,
    kindUnderstanding: entry.kind ? entry.kind.understanding : null,
    entry, // the full standard record — the log is the lossless trail
  });
};

/**
 * One word's HyperLexiconEntry@1, witnessed into the session log. Kind ONLY
 * when kindArgs is passed (wordKind's contract and cost, unchanged; see this
 * module's header on why induction is never a default). Frozen all the way
 * down.
 */
export function hyperlexiconEntry(session, word, { posPrior, kindArgs, priors = [] } = {}) {
  const entry = buildEntry(session, word, { posPrior, kindArgs, priors });
  witnessDefinition(session, entry);
  return entry;
}

/**
 * The collection: every vocabulary surface, one entry each, deterministic.
 *
 * VOCABULARY IS EXPLICIT (P4): missing or non-array throws; an EMPTY array
 * is honoured as the explicit claim "no words" and returns an empty
 * collection, the same distinction checkKindPrior already draws for priors.
 * Surfaces are normalized (normalizeVocabulary), deduplicated, sorted —
 * the same set passed in any order yields deep-equal output.
 *
 * KINDS ARE NON-GREEDY: kindArgs omitted means kind is null everywhere and
 * understand() never runs — provable, because understand() throws on
 * undeclared population/readerVersion, so a silent default would be a
 * crash, not a hidden cost. Pass kindArgs only when the expensive half is
 * actually wanted for every entry (see this module's header before doing
 * that at interactive scale).
 *
 * Each lookup is witnessed (append-only), then the returned collection is
 * built from the SAME entries the log now holds.
 */
export function hyperlexicon(session, { vocabulary, posPrior, kindArgs, priors = [] } = {}) {
  const words = normalizeVocabulary(vocabulary);
  const graph = session?.graph;
  const entries = words.map((w) => hyperlexiconEntry(session, w, { posPrior, kindArgs, priors }));
  const unresolved = entries.filter((e) => e.status === "unresolved").map((e) => e.word);
  return freezeDeep({
    schema: HYPERLEXICON_SCHEMA,
    readAt: graph
      ? Object.freeze({ tick: graph.tick, nodeCount: graph.nodes.size, edgeCount: graph.edges.size })
      : null, // definitions are responsive to the live graph; this names the exact reading point
    vocabulary: words,
    entries: Object.freeze(entries),
    unresolved: Object.freeze(unresolved),
  });
}

/**
 * The fold: the append-only log reduced to the current HyperLexicon@1
 * collection. Pure reduction of event_log order — deterministic for a given
 * log, frozen all the way down. Per word: the LATEST witness's terrains are
 * the current definition; the witness trail (count, first/last ticks, event
 * ids) rides along as the drill-down path back into the log, so the fold
 * loses resolution without losing addressability.
 */
export function foldHyperlexicon(session) {
  const log = session?.hyperlexicon;
  if (!log) return freezeDeep({ schema: HYPERLEXICON_SCHEMA, foldedAt: Object.freeze({ tick: 0, events: 0 }), vocabulary: Object.freeze([]), entries: Object.freeze([]), unresolved: Object.freeze([]) });

  const byWord = new Map();
  for (const event of log.events) {
    if (event.type !== HYPERLEXICON_EVENT) continue;
    const acc = byWord.get(event.word) ?? { entry: null, count: 0, firstTick: null, lastTick: null, eventIds: [] };
    acc.entry = event.entry; // latest wins; earlier witnesses stay in the log
    acc.count += 1;
    acc.firstTick ??= event.tick;
    acc.lastTick = event.tick;
    acc.eventIds.push(event.event_id);
    byWord.set(event.word, acc);
  }

  const words = [...byWord.keys()].sort();
  const entries = words.map((word) => {
    const acc = byWord.get(word);
    return freezeDeep({
      ...acc.entry,
      witnesses: Object.freeze({ count: acc.count, firstTick: acc.firstTick, lastTick: acc.lastTick, eventIds: Object.freeze([...acc.eventIds]) }),
    });
  });
  return freezeDeep({
    schema: HYPERLEXICON_SCHEMA,
    foldedAt: Object.freeze({ tick: log.tick, events: log.events.length }),
    vocabulary: Object.freeze(words),
    entries: Object.freeze(entries),
    unresolved: Object.freeze(entries.filter((e) => e.status === "unresolved").map((e) => e.word)),
  });
}

/**
 * A reading's developed cast, witnessed into the lexicon — the wiring that
 * makes reading itself operate through the HyperLexicon (READING-POLICY P2
 * stage 9): after a session has read material, its discovered referents'
 * canonical displays are defined exactly the way any other lookup is
 * (defineWord's path, append-only), and the accumulated log is folded.
 *
 * Vocabulary here is the cast the READING developed — not caller-chosen, but
 * also not silently unbounded: `limit` is declared (sessionReferents' own
 * contract) and the witnessed/unresolved split is returned, never implied.
 */
export function witnessCast(session, { sourceId, limit = 500 } = {}) {
  const { referents } = sessionReferents(session, { sourceId, limit });
  if (!referents?.length) {
    return { witnessed: 0, unresolved: [], folded: foldHyperlexicon(session), cast: [] };
  }
  let witnessed = 0;
  const unresolved = [];
  for (const r of referents) {
    const entry = hyperlexiconEntry(session, r.display);
    if (entry.status === "witnessed") witnessed += 1;
    else unresolved.push(entry.word);
  }
  return { witnessed, unresolved, folded: foldHyperlexicon(session), cast: referents.map((r) => r.display) };
}
