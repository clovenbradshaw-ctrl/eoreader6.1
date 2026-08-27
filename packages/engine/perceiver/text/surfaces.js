// eoreader6 · perceiver/text/surfaces — candidate referent surfaces, and the
// structural (engine-tier) coreference between them. No word sets anywhere:
// every filter here is derived from the text's own statistics.
//
// SCOPE (Constitution II.13, script earning test): diaNorm below folds only
// the five Latin vowels' acute/grave/circumflex/umlaut diacritics (á/à/â/ä
// ... ú/ù/û/ü). It is disclosed-narrow, not script-agnostic: it does NOT
// fold ñ/ç/ø/å/æ/ß/š/ž/ł or any non-Latin-vowel diacritic, and it does not
// touch combining marks in scripts where they carry phonemic/grammatical
// content rather than accent decoration (Vietnamese tone marks, Hebrew
// niqqud, Arabic tashkil, Devanagari matras) — a blanket Unicode
// combining-mark strip was tried and reverted for exactly this reason: it
// silently claimed cross-script generality with no invariance fixture to
// back it, which II.13 names as the more severe failure than a disclosed
// narrow scope ("the silence is the more severe failure than the scope").
// Extending coverage requires a giver (II.2) for each script's own folding
// rule and a fixture proving it, not an algorithmic generalization.
//
// TIER DISCIPLINE — the load-bearing part, and the reason this file is small:
//   ENGINE tier (derivable, built here): NAME-variant coreference.
//     "Victor Frankenstein" ≈ "Frankenstein" ≈ "Victor" by containment or
//     shared final token. Structural, no witness needed.
//   MODEL tier (NOT derivable, reported as a typed gap): descriptor synonymy
//     ("the creature" ≈ "the wretch") and PRONOUN binding ("he" -> whom).
//     eoreader5's dead-ends log records distributional coref failing twice
//     (frame-level lift, sentence-level complementary distribution). It is not
//     retried here. A missing prior produces a gap, never a guessed number.
//
// Ported rather than reinvented (CLAUDE.md names each of these a
// consistently-reinvented wheel): diaNorm, namesCorefer, the cap/lower
// physics filter, and whole-word counting all come from eoreader5's
// presence.js / entity-fold.js.

const DIA_RE = /[áàâäéèêëíìîïóòôöúùûü]/g;
const DIA_TO = { á:"a",à:"a",â:"a",ä:"a",é:"e",è:"e",ê:"e",ë:"e",í:"i",ì:"i",î:"i",ï:"i",ó:"o",ò:"o",ô:"o",ö:"o",ú:"u",ù:"u",û:"u",ü:"u" };

export const diaNorm = (t) => String(t ?? "").toLowerCase().trim().replace(DIA_RE, (c) => DIA_TO[c]);

// The cell this organ occupies on the operator grid (engine/operators.js):
// SIG · Void · Tending — candidate referent surfaces, from the text's own
// statistics. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SIG", grain: "Ground" });

const tokensOf = (id) => diaNorm(id).split(/\s+/).filter((t) => t.length > 2);

/** Two NAMES corefer: containment, or a shared final token (surname). */
export const namesCorefer = (a, b) => {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (!ta.length || !tb.length) return false;
  const setA = new Set(ta);
  const setB = new Set(tb);
  const subset = ta.every((t) => setB.has(t)) || tb.every((t) => setA.has(t));
  return subset || ta[ta.length - 1] === tb[tb.length - 1];
};

// A capitalised RUN: consecutive capitalised tokens, which is what a
// multi-word name looks like from the outside. Sentence-initial position is
// recorded because a token there is capitalised by grammar, not by being a
// name — the ratio filter below needs to know the difference.
const CAP_TOKEN = /^[\p{Lu}][\p{L}'’]*$/u;
const LOWER_TOKEN = /^[\p{Ll}][\p{L}'’]*$/u;

// A one-sided 95% significance resolution — declared, the same standing as
// this codebase's other Born-gate quantiles (e.g. nul-adjacent 0.95
// thresholds elsewhere): a stated resolution for a statistical test, not a
// hand-picked bridge between unrelated scales (SEED.md's actual complaint).
const CAP_SIG_Z = 1.645;

/**
 * Is this candidate's non-initial capitalisation rate significant against
 * the null that capitalisation is a fair coin flip (p=0.5) unrelated to
 * namehood — normal approximation to the binomial, evaluated at THIS
 * candidate's own (cap, lower) counts. Replaces a single fixed ratio band
 * shared by every word (formerly [0.8, 2.0], applied uniformly regardless
 * of how much evidence a given candidate actually carried) with a bound
 * that widens for a word seen only a handful of times and tightens for one
 * seen thousands: two occurrences split evenly can never clear it (not
 * enough evidence either way), where the same split at high volume would.
 */
const capitalisationIsSignificant = (cap, lower) => {
  const n = cap + lower;
  const pHat = cap / n;
  const bound = 0.5 + CAP_SIG_Z * Math.sqrt(0.25 / n);
  return pHat > bound;
};

// ---------------------------------------------------------------------------
// ORTHOGRAPHIC NORMALISATION AND REJECTION.
//
// Four facts about writing, not four facts about English. Each states the
// glyph-level property it reads and the measurement that made it necessary,
// because a filter without a measurement is a preference.
//
// All four are about the SAME thing the ratio filter above is about: which
// capitalisations are evidence of namehood and which are produced by the
// writing system for some other reason. Sentence-initial position was already
// excluded on exactly this ground; these are the remaining cases the same
// argument covers.
// ---------------------------------------------------------------------------

// 1. THE APOSTROPHE CLITIC. "Locke's" and "Locke" are one name written twice;
//    the apostrophe is a mark of inflection, not a different referent. Left
//    unmerged this splits every possessed name in a scholarly text — measured
//    on Process and Reality: Locke 68 + Locke's 45, Hume 66 + Hume's 40,
//    Descartes 48 + Descartes' 27, and the same again for God, Kant, Newton
//    and Whitehead. Seven of the book's principal referents appeared twice
//    each, at roughly half strength.
//    This reads the apostrophe glyph. It does not know what a possessive is,
//    and a script without the clitic simply never matches.
const POSSESSIVE = /['’]s?$/i;
export const stripPossessive = (token) => token.replace(POSSESSIVE, "");

// 2. ROMAN NUMERALS ARE NUMBERS. A number is not a name, in any language that
//    writes numbers. Measured: II, III, IV, V and VI entered the cast of
//    Process and Reality with 28, 26, 22, 17 and 10 mentions — five of the top
//    twenty referents were section numbers.
//    Guarded two ways so a real name cannot be caught: the form must be
//    ALL-UPPERCASE as written (a name is Title Case — "Mill" is not "MILL"),
//    and it must parse as a well-formed numeral, so "MILL" and "DID" are
//    rejected by the grammar rather than by a list.
const ROMAN = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
export const isRomanNumeral = (token) =>
  token.length > 0 && token === token.toUpperCase() && ROMAN.test(token);

// 3. ALL-CAPS IS TYPOGRAPHY. In a run where every token is capitalised because
//    the whole run is set in capitals — a heading, a running head, an
//    emphasised phrase — capitalisation carries no more naming evidence than
//    it does at the start of a sentence, and is excluded for the same reason.
//    Measured: "ORDER OF NATURE" (13), "AND FORM" (10) and "EXTENSIVE
//    CONTINUUM" (10) are Process and Reality's part titles, lifted out of the
//    table of contents by the PDF extractor.
//    Restricted to runs of TWO OR MORE tokens. A lone all-caps token is
//    routinely a name shouted by the typesetter ("DESCARTES" at the head of a
//    section) and diaNorm already folds it into the Title Case form.
const isAllCaps = (token) => {
  const letters = token.replace(/[^\p{L}]/gu, "");
  return letters.length > 0 && letters === letters.toUpperCase();
};

// 4. A NUMERAL SUFFIX INDEXES A NAME, it does not make a new one. "Part I" and
//    "Part IV" are the same word plus a divider. Folding them onto the stem is
//    the same move as folding the possessive: it merges, never deletes, so a
//    genuinely numbered name ("Henry V") joins "Henry" rather than vanishing —
//    which is what coreference should do with it anyway.
const stripNumeralIndex = (tokens) => {
  const out = tokens.slice();
  while (out.length > 1 && isRomanNumeral(out[out.length - 1])) out.pop();
  return out;
};

/**
 * The orthographic form under which two spellings of one name are the same
 * candidate. Exported so a host counting mentions can normalise the text the
 * same way this normalised the candidates — otherwise the merged surface has
 * a count that belongs to only one of its spellings.
 */
export const normaliseSurface = (surface) =>
  stripNumeralIndex(String(surface).split(/\s+/).map(stripPossessive)).join(" ");

/**
 * @param {Array<{text: string, order: number}>} sentences
 * @param {object} [options]
 * @param {Set<string>|null} [options.functionWords] closed class derived from
 *   this text's own frequency distribution (material.js::functionWordSet).
 * @param {Iterable<string>|null} [options.abbreviations] tokens this text
 *   always writes with a trailing period (spans.js::deriveAbbreviations).
 *   "Cf", "Sect", "Fig", "Bk" are capitalised and recurrent and are not
 *   names; the set is derived from the text, so no abbreviation list is
 *   asserted here.
 * @param {number} [options.minGlyphs] shortest surface that can be a name,
 *   counted in letters and digits. A single capitalised glyph is an initial,
 *   an axis label or a maths variable — measured on a quantum-computing paper,
 *   M, L, S, J, C and W took six of the top ten places.
 * @param {Iterable<string>|null} [options.lexicon] RECEIVED candidate
 *   vocabulary (AbbreviationPrior@3's surface_lexicon; a gazetteer, a
 *   document's own front matter, a previous reading's cast). Matched
 *   whole-form against each sentence and admitted directly — the giver's
 *   assertion IS the namehood evidence, the same standing every other
 *   channel here ultimately rests on.
 *
 *   This is not a fallback bolted beside capitalisation; it is the same
 *   lesson the audio perceiver already teaches (perceiver/audio reads the
 *   medium's own spectrum, never staff notation): CAPITALISATION IS ONE
 *   SCRIPT'S CONVENTION, NOT THE PRIMARY CHANNEL. It happens to be the
 *   strongest signal Latin prose carries for free, so this organ grew up
 *   reading it — but an unspaced, caseless script (Japanese はがを between
 *   kanji names) carries no such glyph evidence at all, and a source that
 *   arrives with its vocabulary declared should never have been unreadable
 *   just because it doesn't capitalise. Received forms work for EVERY
 *   script; the capitalisation scan remains what it is for the scripts
 *   that have it.
 */
// RUN-BREAKING MARKS, as a CATEGORY rather than an enumeration.
//
// This started as `[,;:]`, gained `|` in 2026-08-20 for search-result
// titles, and that fix's own note said the quiet part out loud: the pipe
// was "a run-breaking mark this file had a category for and simply never
// listed." Brackets were the next one, found the same way — by running
// real material this organ had never been checked against. Measured live
// 2026-08-26 on Hannibal Hamlin's own Wikipedia lead:
//
//   "Hannibal Hamlin (August 27, 1809 - July 4, 1891) was an American..."
//
// produced surfaces ["Hamlin", "Hamlin August", "July", ...] — "Hannibal
// Hamlin" never formed at all, "Hamlin August" was glued straight across
// the parenthesis, and the only relation the sentence yielded was
// "an American -politician-> ...". The subject of the sentence was lost,
// so the fact that Hamlin was a vice president could not be read out of
// the one sentence that states it plainly.
//
// Listed one character at a time this never ends — the same trap this
// repo already refused for succession boxes and for site-specific title
// conventions. Unicode already carries the category: \p{Ps} is every
// opening punctuation mark in every script and \p{Pe} every closing one,
// so ( [ { （ 「 【 and their partners are covered without a list, and a
// script this codebase has never been run against is covered in advance
// rather than after the next incident.
//
// Deliberately NOT widened to all of \p{Po}: that would sweep in the
// apostrophe, and a raw chunk ending in one would then break a run no
// reader would say is broken.
const RUN_BREAK = /[,;:|\p{Ps}\p{Pe}]/u;
const RUN_BREAK_ENDS = /[,;:|\p{Ps}\p{Pe}]\s*$/u;
const RUN_BREAK_OPENS = /^[\p{Ps}\p{Pe}]/u;

export const extractSurfaces = (sentences, { functionWords = null, abbreviations = null, minGlyphs = 2, lexicon = null } = {}) => {
  const capCounts = new Map();   // surface -> times seen capitalised, NOT sentence-initial
  const lowerCounts = new Map(); // lowercased form -> times seen lowercase anywhere
  const sentenceIndex = new Map(); // surface -> Set(sentence order)

  const abbrev = abbreviations ? new Set(abbreviations) : null;

  // Received vocabulary: longest-form-first LITERAL matching over the raw
  // sentence text. No boundary assertions — word boundaries are themselves a
  // script convention, and an unspaced script writes its particles hard
  // against the name (田中太郎らは: the name never ends at a "boundary").
  // Measured failing with \\b-style guards: every form came back NOT FOUND.
  // A giver declares full canonical forms; overlap between a short and long
  // received form resolves by length order, and double-counting a substring
  // the giver ALSO declared is the giver's own declaration to fix.
  let receivedRx = null;
  if (lexicon) {
    const forms = [...new Set([...lexicon].map((s) => String(s).trim()).filter(Boolean))]
      .sort((a, b) => b.length - a.length);
    if (forms.length) {
      const esc = forms.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      receivedRx = new RegExp(esc, "gu");
    }
  }

  for (const sent of sentences) {
    // Two facts must survive stripping, not just the letters: which token
    // each raw chunk stripped down to, AND whether a run-breaking mark
    // (comma/semicolon/colon/pipe) sat between it and the token before it.
    // Both are read off the SAME raw split, in one pass, so they can never
    // drift out of alignment with each other.
    //
    // Pipe added 2026-08-20, the identical fix class as the comma incident
    // this file's own header already documents ("Bilíbin, Prince Andrew's
    // host" — a comma that used to not break a run) — found the same way,
    // by running real material this organ had never been checked against: a
    // web search result's own title convention, "Topic | Section | Site
    // Name" (measured live: "Hannibal Hamlin | Abraham Lincoln, Maine,
    // Civil War | Britannica"), glued "Hamlin" and "Abraham Lincoln" into
    // one spurious "Hamlin Abraham Lincoln" surface and "Civil War" into
    // "Civil War Britannica" — a run-breaking mark this file had a category
    // for and simply never listed. Book prose (this organ's original proving
    // ground) essentially never uses a bare pipe as punctuation, so the gap
    // was invisible until material shaped like a search-results page reached
    // it. `stripped` already reduces a lone "|" token to "" (line 195's own
    // branch runs), so the fix is exactly the one line each of these two
    // checks already reserved for this: the pipe joins the class.
    const rawToks = sent.text.split(/\s+/);
    const toks = [];
    const brokenBefore = [];
    let pendingBreak = false;
    for (const raw of rawToks) {
      const stripped = raw.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "");
      if (!stripped) {
        // A whitespace-delimited chunk that is punctuation alone (a bare
        // "," between two words that themselves had no adjoining space)
        // still carries the break forward — it contributes no token, but
        // must not let the break it marks go unnoticed.
        if (RUN_BREAK.test(raw)) pendingBreak = true;
        continue;
      }
      toks.push(stripped);
      // TWO SIDES, because a bracket is not a comma. A comma trails the
      // token before it, so the previous raw chunk's ending marks the
      // break; an opening bracket LEADS the token after it, and checking
      // only the previous chunk's tail cannot see it. Both read off the
      // same raw chunk, so neither can drift from the other.
      brokenBefore.push(pendingBreak || RUN_BREAK_OPENS.test(raw));
      pendingBreak = RUN_BREAK_ENDS.test(raw);
    }
    // A unit set entirely in capitals is a heading or a running head, and every
    // token in it is capitalised by typography. Reading capitalisation as
    // evidence here is the sentence-initial mistake at unit scale — on Process
    // and Reality it put the table of contents into the cast. Skipped for
    // capitalisation evidence; its lowercase counts are moot, there are none.
    if (toks.length > 1 && toks.every(isAllCaps)) continue;
    // Received forms first — a giver-declared surface counts wherever it
    // sits in the sentence, in any script.
    if (receivedRx) {
      receivedRx.lastIndex = 0;
      let rm;
      while ((rm = receivedRx.exec(sent.text))) {
        const surface = normaliseSurface(rm[0]);
        if (!surface) continue;
        capCounts.set(surface, (capCounts.get(surface) ?? 0) + 1);
        if (!sentenceIndex.has(surface)) sentenceIndex.set(surface, new Set());
        sentenceIndex.get(surface).add(sent.order);
      }
    }
    for (let i = 0; i < toks.length; i++) {
      if (LOWER_TOKEN.test(toks[i])) {
        const k = diaNorm(toks[i]);
        lowerCounts.set(k, (lowerCounts.get(k) ?? 0) + 1);
      }
    }
    // capitalised runs, skipping the sentence-initial token: it is capitalised
    // by position and carries no evidence of namehood on its own
    let i = 1;
    while (i < toks.length) {
      if (!CAP_TOKEN.test(toks[i])) { i++; continue; }
      // A run may always START at a capitalised token regardless of what
      // preceded it (a name following a comma — "the general, Kutúzov,
      // said" — must still begin its own run) but may only EXTEND across a
      // token with no break immediately before it. Without this, two
      // different people's names separated only by a comma ("Bilíbin,
      // Prince Andrew's host") read as one continuous run and manufacture
      // a name neither of them has — measured on War and Peace: the token
      // sequence for "Bilíbin, Prince Andrew" recurred as its own spurious
      // candidate 52 times, entangling two distinct referents' coreference.
      let j = i + 1;
      while (j < toks.length && CAP_TOKEN.test(toks[j]) && !brokenBefore[j]) j++;
      const run = toks.slice(i, j);
      // An all-caps run inside an otherwise mixed-case unit is the same
      // typography as an all-caps unit — a part title quoted mid-paragraph.
      if (run.length > 1 && run.every(isAllCaps)) { i = j; continue; }
      // every prefix-run up to 4 tokens is a candidate ("Victor",
      // "Victor Frankenstein"); >4 tokens is a heading, not a name
      for (let len = 1; len <= Math.min(run.length, 4); len++) {
        // Normalised at the point of counting, so the two spellings of one
        // name accumulate into one candidate with one count rather than
        // being merged later with counts that have to be added back up.
        const surface = normaliseSurface(run.slice(0, len).join(" "));
        if (!surface) continue;
        capCounts.set(surface, (capCounts.get(surface) ?? 0) + 1);
        if (!sentenceIndex.has(surface)) sentenceIndex.set(surface, new Set());
        sentenceIndex.get(surface).add(sent.order);
      }
      i = j;
    }
  }

  // The physics filter (eoreader5, measured): a NAME essentially never appears
  // lowercased, while a sentence/dialogue opener ("Well", "Why") constantly
  // does. A pronoun that is capitalised by orthographic convention rather
  // than by namehood ("I" in English) survives this filter regardless,
  // because it has no lowercase form to compare against — it was the single
  // largest false positive here (2152 "mentions" in Frankenstein). The fix
  // reuses the Zipf-derived closed-class detector from material.js rather
  // than naming any language's pronouns: `functionWords` is a Set the
  // caller derives from this same text's own frequency distribution.
  // Optional — omit it and the filter simply doesn't run.
  //
  // Multi-word runs skip this filter (a lowercase form of "Victor
  // Frankenstein" does not occur to compare against), and so does any
  // single word never seen lowercase at all (lower === 0) — the strongest
  // possible evidence for namehood, nothing left to test against.
  //
  // What remains is genuinely ambiguous: a word seen written BOTH ways.
  // capitalisationIsSignificant asks a binomial question of it — is this
  // word's own capitalised share (cap / (cap + lower)) further above a fair
  // coin than chance alone would produce AT THIS WORD'S OWN SAMPLE SIZE —
  // derived per candidate from its own two counts, not a fixed shared band.
  const surfaces = [];
  const receivedSurfaces = new Set();
  if (receivedRx) {
    // Recompute which counted candidates arrived by reception, so the
    // capitalisation filters below cannot silently veto a giver's assertion
    // — those filters read evidence THIS channel never claimed to have.
    for (const form of [...new Set([...lexicon].map((s) => String(s).trim()).filter(Boolean))]) {
      receivedSurfaces.add(normaliseSurface(form));
    }
  }
  for (const [surface, cap] of capCounts) {
    const words = surface.split(/\s+/);
    // Numbers and single glyphs, per the two orthographic facts above.
    if (words.every(isRomanNumeral)) continue;
    if (surface.replace(/[^\p{L}\p{N}]/gu, "").length < minGlyphs) continue;
    if (words.length === 1 && !receivedSurfaces.has(surface)) {
      if (abbrev && abbrev.has(surface)) continue;
      if (functionWords && functionWords.has(diaNorm(surface))) continue;
      const lower = lowerCounts.get(diaNorm(surface)) ?? 0;
      if (lower > 0 && !capitalisationIsSignificant(cap, lower)) continue;
    }
    surfaces.push({ surface, mentions: cap, sentences: sentenceIndex.get(surface).size });
  }
  return surfaces.sort((a, b) => b.mentions - a.mentions);
};

/**
 * Sentence-INITIAL capitalized runs only — the mirror image of
 * `extractSurfaces`'s own main scan, which deliberately starts at token
 * index 1 of every sentence ("capitalised runs, skipping the sentence-
 * initial token: it is capitalised by position and carries no evidence of
 * namehood on its own"). That exclusion is correct for CAPITALIZATION
 * EVIDENCE — a sentence-initial token proves nothing about namehood by
 * itself — but it has a real, disclosed cost: a name written out ONLY at
 * the head of a sentence (encyclopedia-lede style — "Hannibal Hamlin was
 * ..." followed only by "He...") never becomes a candidate AT ALL,
 * anywhere, because `extractSurfaces` never looks at position 0 for
 * ANY surface. This function looks ONLY at position 0 — the mirror gap —
 * so a caller with independent, convergent evidence a leading run is a
 * real name (never this function alone) has something to test that
 * evidence against.
 *
 * DELIBERATELY NOT A DECISION ABOUT NAMEHOOD, and evidence-free in a way
 * `extractSurfaces` is not: that function's `lower === 0` shortcut is
 * itself real evidence ("the strongest possible evidence for namehood,
 * nothing left to test against") — a word NEVER seen lowercase anywhere.
 * Here, there is no non-initial occurrence to compare against BY
 * CONSTRUCTION, so `capitalisationIsSignificant` cannot run and does not
 * run. Every candidate returned is exactly as uncertain as "a capitalized
 * word opened this sentence" — which is why `discoverReferents` must never
 * be pointed at this function's raw output the way it is pointed at
 * `extractSurfaces`'s own: nothing here has cleared, or could clear, ANY
 * recurrence bar on its own. A caller is responsible for treating every
 * result as PROVISIONAL, confirming a candidate through independent
 * mechanical evidence before admitting it alongside a real referent
 * `discoverReferents` established on its own merits.
 *
 * Same orthographic guards as `extractSurfaces` (roman numerals, minGlyphs,
 * all-caps units/runs, the abbreviation/function-word closed classes) —
 * reused, not re-derived, so a leading run that would have been rejected
 * as a candidate had it appeared mid-sentence is rejected exactly as
 * consistently here. The ONE guard that cannot transfer is
 * `capitalisationIsSignificant` itself, for the reason stated above.
 *
 * @param {Array<{text: string, order: number}>} sentences
 * @param {object} [options]
 * @param {Set<string>|null} [options.functionWords] same closed class
 *   `extractSurfaces` takes — "The", "He", "But", "When" open sentences
 *   constantly and carry zero naming evidence; without this, EVERY common
 *   sentence-opener would nominate itself as a candidate.
 * @param {Iterable<string>|null} [options.abbreviations] forwarded,
 *   unchanged in meaning, to the same guard `extractSurfaces` applies.
 * @param {number} [options.minGlyphs] ditto.
 * @returns {Array<{surface, mentions, sentences}>} shaped exactly like
 *   `extractSurfaces`'s own return value — a caller can hand either
 *   straight to `discoverReferents`. `sentences` here counts how many
 *   sentences this exact surface OPENED — never conflated with
 *   `extractSurfaces`'s own `sentences` count (a fundamentally different,
 *   weaker kind of evidence: position, not recurrence) — a caller must not
 *   silently sum the two.
 */
export const extractLeadingSurfaces = (sentences, { functionWords = null, abbreviations = null, minGlyphs = 2 } = {}) => {
  const capCounts = new Map();
  const sentenceIndex = new Map();
  const abbrev = abbreviations ? new Set(abbreviations) : null;

  for (const sent of sentences) {
    // The identical tokenize-and-track-breaks pass extractSurfaces runs —
    // see that function's own comment for why both facts (the stripped
    // token, and whether a run-breaking mark preceded it) must come off
    // the SAME raw split in one pass.
    const rawToks = sent.text.split(/\s+/);
    const toks = [];
    const brokenBefore = [];
    let pendingBreak = false;
    for (const raw of rawToks) {
      const stripped = raw.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "");
      if (!stripped) {
        if (RUN_BREAK.test(raw)) pendingBreak = true;
        continue;
      }
      toks.push(stripped);
      // TWO SIDES, because a bracket is not a comma. A comma trails the
      // token before it, so the previous raw chunk's ending marks the
      // break; an opening bracket LEADS the token after it, and checking
      // only the previous chunk's tail cannot see it. Both read off the
      // same raw chunk, so neither can drift from the other.
      brokenBefore.push(pendingBreak || RUN_BREAK_OPENS.test(raw));
      pendingBreak = RUN_BREAK_ENDS.test(raw);
    }
    if (!toks.length || !CAP_TOKEN.test(toks[0])) continue;
    // An all-caps UNIT (a heading, a running head) is typography, not a
    // name, sentence-initial exactly as much as mid-sentence.
    if (toks.length > 1 && toks.every(isAllCaps)) continue;

    // The run starting AT index 0 — extractSurfaces's own extension rule,
    // just anchored one token earlier (that function starts scanning FOR a
    // run at i=1; this one already knows toks[0] qualifies and extends
    // from there).
    let j = 1;
    while (j < toks.length && CAP_TOKEN.test(toks[j]) && !brokenBefore[j]) j++;
    const run = toks.slice(0, j);
    if (run.length > 1 && run.every(isAllCaps)) continue;

    for (let len = 1; len <= Math.min(run.length, 4); len++) {
      const surface = normaliseSurface(run.slice(0, len).join(" "));
      if (!surface) continue;
      capCounts.set(surface, (capCounts.get(surface) ?? 0) + 1);
      if (!sentenceIndex.has(surface)) sentenceIndex.set(surface, new Set());
      sentenceIndex.get(surface).add(sent.order);
    }
  }

  const surfaces = [];
  for (const [surface, cap] of capCounts) {
    const words = surface.split(/\s+/);
    if (words.every(isRomanNumeral)) continue;
    if (surface.replace(/[^\p{L}\p{N}]/gu, "").length < minGlyphs) continue;
    if (words.length === 1) {
      if (abbrev && abbrev.has(surface)) continue;
      if (functionWords && functionWords.has(diaNorm(surface))) continue;
    }
    surfaces.push({ surface, mentions: cap, sentences: sentenceIndex.get(surface).size });
  }
  return surfaces.sort((a, b) => b.mentions - a.mentions);
};

/**
 * Cluster candidate surfaces into referents by NAME-variant coreference only.
 * Emits DEF.admit events for referents/index.js::projectReferents — the
 * canonical path, not a parallel string-matching substitute.
 *
 * Returns { events, gaps }. `gaps` is not decoration: every referent
 * discovered this way is name-only, so its pronoun and descriptor mentions
 * are known-missing and are reported as such.
 */
/**
 * Tokens that individuate vs tokens that classify. A token combining with
 * many DIFFERENT other tokens across the corpus ("Princess" before Mary,
 * Hélène, Anna, Drubetskáya; "Rostóv" after Nicholas, Ilyá, Pétya) is a
 * title or a family name — it groups people, it does not pick one out.
 * A token appearing in only one or two surfaces ("Frankenstein", only ever
 * after "Victor") individuates.
 *
 * Derived from this text's own combinatorics — no title list, no honorific
 * table, nothing language-specific. Necessary because `namesCorefer` is a
 * PAIRWISE test against one known seed; used transitively for clustering it
 * over-merges exactly here, which eoreader5's relationship-graph notes
 * record as measured ("a multi-word seed must strip single-word
 * nameSurfaces first, or it absorbs every OTHER prince's bare 'Prince'").
 */
const quantileOf = (sorted, q) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/**
 * A partner-count fence derived from THIS document's own co-occurrence
 * structure, not a fixed absolute count. The interquartile range is already
 * this codebase's own measure of a distribution's ordinary spread (nul's
 * `volume`, "aperture") — a token whose partner-set size sits more than one
 * IQR above the 75th percentile of this document's own partner-count
 * distribution is exceeding what ordinary co-occurrence breadth looks like
 * HERE, a Tukey-style upper fence rather than a percentile chosen by hand.
 * Degrades safely rather than gapping: too little multi-word structure to
 * have a fence at all (empty or uniform partner counts, IQR 0) means nothing
 * exceeds it, so `genericTokens` correctly finds nothing generic — the right
 * answer when the material can't support the distinction, not a special case.
 */
const deriveMinPartners = (partners) => {
  const counts = [...partners.values()].map((s) => s.size).sort((a, b) => a - b);
  if (counts.length === 0) return Infinity;
  const q1 = quantileOf(counts, 0.25);
  const q3 = quantileOf(counts, 0.75);
  return q3 + (q3 - q1);
};

/**
 * @param {object} [options.minPartners] override the derived fence — omit to
 *   derive it from `surfaces`'s own co-occurrence structure (see
 *   `deriveMinPartners`). Compares by EXCEEDS (`>`), matching the derived
 *   fence's own "outside the ordinary spread" convention.
 */
export const genericTokens = (surfaces, { minPartners } = {}) => {
  const partners = new Map(); // token -> Set(other tokens it co-occurs with in a surface)
  for (const { surface } of surfaces) {
    const toks = diaNorm(surface).split(/\s+/).filter((t) => t.length > 2);
    if (toks.length < 2) continue;
    for (const t of toks) {
      if (!partners.has(t)) partners.set(t, new Set());
      for (const u of toks) if (u !== t) partners.get(t).add(u);
    }
  }
  const fence = minPartners ?? deriveMinPartners(partners);
  const generic = new Set();
  for (const [tok, set] of partners) if (set.size > fence) generic.add(tok);
  return generic;
};

/**
 * A recurrence floor derived from THIS document's own candidate-surface
 * pool: a candidate must recur across MORE distinct sentences than the
 * bottom quarter of the pool does. Most candidate surfaces in any real text
 * are Zipfian one-off capitalisations (the 25th percentile is often exactly
 * 1), so this weeds out that long tail while scaling with how
 * recurrence-rich the material actually is, rather than a fixed absolute
 * sentence count.
 *
 * The 25th percentile, not the median: a TINY or heavily-tied pool (a short
 * document, or one dominated by a couple of names) can put the median AT
 * the pool's own maximum, and "exceeds the median" then rejects everything,
 * including the most-recurring candidates — measured, on a 3-candidate
 * pool tied 4/4/2, where a median-based floor of 4 admitted nothing. The
 * 25th percentile targets the LOW tail specifically and does not collide
 * with the top the same way.
 *
 * Degrades safely rather than rejecting everyone: a pool small or uniform
 * enough that its OWN 25th percentile sits at or above every member's own
 * count (a single surviving candidate is the extreme case — its own
 * percentile always equals itself) means the pool cannot support the
 * distinction, so nothing is filtered — the same "the material can't
 * support it, so don't fabricate an answer" standing `deriveMinPartners`
 * already takes above, not a special case.
 */
const deriveMinSentences = (surfaces) => {
  const counts = surfaces.map((s) => s.sentences).sort((a, b) => a - b);
  if (counts.length === 0) return 0;
  const floor = quantileOf(counts, 0.25);
  return counts.every((c) => c <= floor) ? 0 : floor;
};

/**
 * @param {object} [options.minSentences] override the derived recurrence
 *   floor — omit to derive it from `surfaces` (see `deriveMinSentences`).
 *   Compares by EXCEEDS (`>`), matching `minPartners`'s convention.
 * @param {object} [options.minPartners] forwarded to `genericTokens`.
 * @param {object} [options.groups] surface-arrays this pooled `surfaces` list
 *   was assembled from (each a document's own candidates, in the same order
 *   they were concatenated into `surfaces`) — omit for the single-document
 *   case, where `surfaces` IS the one group and nothing changes.
 *
 *   WHY THIS EXISTS: `genericTokens`'s fence is an IQR statistic over
 *   WHATEVER pool it is handed — correct for one document, where the pool
 *   IS the material whose ordinary co-occurrence breadth is in question.
 *   Pool two OR MORE documents' candidates flat and hand them to
 *   `genericTokens` unchanged, and every unrelated document's own one-off
 *   proper nouns (each a fresh partner-count-1 token) dilutes the SAME
 *   quartile fence a real name-and-title pair inside ONE of the documents
 *   is measured against — the fence keeps falling as more documents join,
 *   until it wrongly brands an ordinary name individuating-token as generic
 *   PURELY because other, unrelated documents were also in the batch.
 *   Measured live on the challenge-25 fixture: "kade" (correctly generic
 *   within source A alone, by A's own co-occurrence structure — it is A's
 *   title, not A's individuating evidence) additionally took "marcus" and
 *   "aurelius" down with it the moment source C's candidates joined the
 *   pool, because C's own one-off proper nouns (unrelated to Kade) pushed
 *   the POOLED fence to 1 — collapsing a within-document merge
 *   ("Marcus Aurelius" / "Marcus Aurelius Kade") that succeeds standalone.
 *   `groups`, when given, derives the generic set PER GROUP and unions the
 *   results — each document's own candidates are still judged against
 *   their OWN co-occurrence breadth, exactly as the single-document case
 *   already does; pooling more documents can only ADD generic tokens found
 *   within some document's own material, never dilute another document's
 *   fence with material foreign to it.
 *
 *   `deriveMinSentences`'s recurrence floor has the EXACT same compositional
 *   flaw and gets the same treatment: pooled flat, a richly-recurring
 *   document (many candidates recurring across many sentences) raises the
 *   25th-percentile floor past what a SHORT, sparser document's own
 *   candidates can ever clear — a name that individuates fine standalone
 *   drops out entirely the moment it is pooled with a longer document,
 *   never merging (there's no DEF.admit event to merge) rather than
 *   over-merging. `groups` derives the floor per group too, so each
 *   document's own candidates are judged against their own recurrence
 *   floor, exactly as `minSentences` already promises for the
 *   single-document case.
 */
export const discoverReferents = (surfaces, { minSentences, minPartners, groups } = {}) => {
  const events = [];
  const generic = groups
    ? groups.reduce((out, g) => {
        for (const t of genericTokens(g, { minPartners })) out.add(t);
        return out;
      }, new Set())
    : genericTokens(surfaces, { minPartners });
  // One sentences-floor per group when grouped, looked up by the surface
  // OBJECT's identity (not its string, which two different documents' own
  // candidates could coincidentally share) — a Map keyed on object identity
  // is exactly what surfaces' own array elements give for free.
  const sentencesFloorOf = groups
    ? (() => {
        const byGroup = groups.map((g) => minSentences ?? deriveMinSentences(g));
        const lookup = new Map();
        groups.forEach((g, gi) => { for (const s of g) lookup.set(s, byGroup[gi]); });
        return (s) => lookup.get(s);
      })()
    : (() => {
        const floor = minSentences ?? deriveMinSentences(surfaces);
        return () => floor;
      })();

  // Two surfaces corefer only on evidence a GENERIC token didn't supply:
  // strip titles/family names from both and require the remainder to still
  // corefer. "Princess Mary" vs "Princess Hélène" -> mary vs helene -> no.
  // "Victor Frankenstein" vs "Frankenstein" -> victor vs (empty) -> falls
  // back to the unstripped test, which containment answers correctly.
  const individuating = (surface) =>
    diaNorm(surface).split(/\s+/).filter((t) => t.length > 2 && !generic.has(t));

  const corefersIndividuated = (a, b) => {
    const ia = individuating(a);
    const ib = individuating(b);
    if (ia.length && ib.length) return namesCorefer(ia.join(" "), ib.join(" "));
    // No individuating evidence on one side means no evidence FOR merging —
    // not licence to fall back on the generic tokens just judged unreliable.
    // That inverted fallback kept every Princess in one referent: both
    // "Princess Mary" and "Princess Hélène" strip to nothing, and the
    // fallback then merged them on the shared title alone.
    return diaNorm(a) === diaNorm(b);
  };

  // UNION-FIND, NOT GREEDY FIRST-MATCH. corefersIndividuated is not
  // transitive: "Henry" ⊂ "Henry Clerval" and "Clerval" ⊂ "Henry Clerval"
  // both hold, but "Henry" and "Clerval" do not directly corefer with each
  // other (no containment, no shared final token). The first cut of this
  // loop joined a surface to the FIRST already-admitted surface it matched
  // and stopped there — correct only when the connecting surface ("Henry
  // Clerval") happens to be admitted before BOTH of the surfaces it
  // connects, and silently order-dependent otherwise: whichever of "Henry"
  // /"Clerval" is admitted first claims "Henry Clerval" when it arrives,
  // and the other is left in its own, separate, un-merged referent — with
  // no error, no gap, just a quietly worse cast. `admitted` is processed in
  // `surfaces`' own mentions-descending order, so this depended on relative
  // mention counts that any change elsewhere in the pool can perturb.
  // Union-find closes this properly: every corefering pair still comes from
  // exactly the same `corefersIndividuated` judgment, unchanged, but the
  // GROUPING is now the transitive closure of that relation regardless of
  // admission order — the same fix `scripts/hyperlexicon-definitions-data.mjs
  // ::mergeReferents` already proved out for the analogous hub-fusion
  // problem, applied here to the relation this file itself computes.
  const parent = new Map();
  const find = (s) => {
    let root = s;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = s;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const admitted = [];
  for (const entry of surfaces) {
    const { surface, sentences } = entry;
    if (sentences <= sentencesFloorOf(entry)) continue;
    parent.set(surface, surface);
    for (const existing of admitted) {
      if (corefersIndividuated(surface, existing)) union(surface, existing);
    }
    admitted.push(surface);
  }

  // Referent ids are named from the FIRST-ADMITTED surface of each group
  // (mentions-descending order, same as before) so a run against the same
  // corpus always yields the same ids — deterministic, not dependent on
  // Map/Set iteration order.
  const idForRoot = new Map();
  for (const surface of admitted) {
    const root = find(surface);
    if (!idForRoot.has(root)) idForRoot.set(root, `ref:auto:${diaNorm(surface).replace(/\s+/g, "_")}`);
    const referentId = idForRoot.get(root);
    events.push({
      type: "DEF.admit",
      referent_id: referentId,
      surface,
      provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis: "name-variant coreference" },
    });
  }

  const referentIds = new Set(events.map((e) => e.referent_id));
  const gaps = [...referentIds].map((id) => ({
    reason: "pronoun_and_descriptor_mentions_unresolved",
    referent: id,
    tier: "model",
    needsWitness: true,
    detail:
      "name-variant coreference is engine-tier and complete; binding pronouns and definite " +
      "descriptions to this referent is not derivable (eoreader5 measured distributional coref " +
      "failing twice). Supply a per-text prior to close this gap.",
  }));

  return { events, gaps };
};
