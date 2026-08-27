// eoreader6 · perceiver/text/spans — real meaningful spans, not arbitrary
// fixed-size chunks. Everything built earlier this session (motif
// detection, structure tests, significance) operated on chunkWords(words,
// 40) — 40-word windows with no relationship to sentence or clause
// boundaries. That's the wrong foundation for anything above it: heat-
// tracking needs a real unit to attach activation to, coref resolution
// needs real sentence boundaries to resolve a pronoun within.
//
// Ported from eoreader5's text-organ.js::splitSentences, a real, tested
// implementation — paragraph breaks are a harder boundary than any
// terminator (a chapter heading has no period and must not glue onto the
// next paragraph), closing quotes after a terminator are absorbed, and a
// terminator NOT followed by whitespace is treated as a probable
// abbreviation ("Mr.") rather than a sentence end. Not reinvented — CLAUDE.md
// names sentence segmentation with offsets as one of the consistently
// reinvented wheels in this project family.

// Container, not content. A Project Gutenberg file wraps the work in a
// licence header, a title block, and often a table of contents; none of it
// is the text being read, and leaving it in put a chapter-number list at the
// top of a salience report earlier in this session. Knowing where the
// container ends is received knowledge ABOUT THE FILE FORMAT — the same kind
// as knowing an mp3 carries an ID3 header — not a linguistic rule and not a
// word set: no claim is made here about any language's vocabulary. Texts
// without these markers pass through untouched.
// ANCHORED TO A WHOLE LINE, which eoreader4.2 had and this did not. The old
// shape here was `\*\*\*\s*START OF ...[^*]*\*\*\*` — it matches across line
// breaks and depends on the trailing stars being the next asterisks in the
// file, so a book whose title contains one, or a marker PG wrote slightly
// differently, drags the cut to the wrong place. A marker is a LINE.
const GUTENBERG_START = /^[^\S\n]*\*{3}[^\S\n]*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;
const GUTENBERG_END = /^[^\S\n]*\*{3}[^\S\n]*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b[^\n]*$/im;

// THE BOOK TELLING YOU WHAT IT IS, WHICH IS NOT CHROME — the distinction
// eoreader4.2 drew and the reason this list exists. Everything before the
// start marker is host furniture except these: they are the work's own front
// matter, and dropping them with the licence text loses the only place a
// translator or an edition is ever named. They are carried over the cut.
//
// These are English field names and therefore a fact about PG's file format,
// received on exactly the same terms as the markers themselves (II.2). No
// claim is made about any language's vocabulary — a file that does not use
// them simply keeps nothing.
const FRONT_FIELD = /^(?:Title|Author|Editor|Translator|Illustrator|Release date|Language|Original publication|Credits)\s*:/i;

// THE CONTAINER DOES NOT END AT THE START MARKER, and assuming it did put 354
// forms of transcriber's note into the material on Heidi. Measured: the
// perished ground of a standpoint reader turned out to be Project Gutenberg's
// producer credits, so a reader imagining prose reached back and said the
// publisher's name, a copyright year and a page number.
//
// After the marker PG typically continues with a producer credit block, an
// ornamental rule, and a boxed transcriber's note, and only then the work.
// Two of the three are recognised by FORM alone, which is what keeps this out
// of linguistic-rule territory:
//
//   RULE   a line of nothing but asterisks and space
//   BOX    a run of lines drawn out of + - | and space, or bounded by pipes
//
// Neither says anything about a language's vocabulary — they are typography,
// and a Devanagari or CJK file draws its boxes the same way. The third needs a
// format marker, and a PG URL is exactly the same kind of received knowledge
// about the file format as the START marker itself already is (an mp3 has an
// ID3 header; a PG file has a credit block).
//
// STRIPPING STOPS AT THE FIRST PARAGRAPH THAT IS NONE OF THESE. It never scans
// the body, so a rule or a box drawn inside the work — a table, a scene break
// — is content and survives. Bounding it that way is what makes this safe;
// an unbounded version would eat an author's own ornament.
const PG_CREDIT_URL = /\b(?:pgdp\.net|gutenberg\.org|www\.gutenberg)/i;
const ORNAMENT_RULE = /^[\s*]+$/;
const BOX_BLOCK = /^[\s+|=_-]*$/;
const BOX_ROW = /^\s*\|.*\|\s*$/;

const isContainerParagraph = (p) => {
  const trimmed = p.trim();
  if (!trimmed) return true;
  if (ORNAMENT_RULE.test(trimmed)) return true;
  if (PG_CREDIT_URL.test(trimmed)) return true;
  // A boxed block: every line is either a border or a piped row.
  const lines = trimmed.split("\n");
  if (lines.every((l) => BOX_BLOCK.test(l) || BOX_ROW.test(l))) return true;
  return false;
};

// The cell this organ occupies on the operator grid (engine/operators.js):
// SEG · Field · Clearing — sentence segmentation; abbreviations are injected
// priors, never a list. Declared, checked by conformance.
export const CELL = Object.freeze({ op: "SEG", grain: "Ground" });

/**
 * Does what survived read as material at all, or as the container's error page?
 *
 * eoreader4.2's `looksLikeBook`, re-earned and renamed away from books.
 * Project Gutenberg's `.txt` redirect is served with a malformed Location
 * header, so a client that follows it lands on an HTML error page — which
 * carries no PG markers, survives stripping untouched, and gets read as the
 * work. 4.2 recorded the symptom exactly: "the reader parses site chrome
 * (Search / Donate / DOCTYPE) instead of the novel."
 *
 * Structural and cheap: too short to be anything, or it opens on a markup
 * tag. Nothing here knows a language. REPORTS, DOES NOT RULE — `stripContainer`
 * returns it as a field rather than refusing, because a caller reading a
 * genuinely tiny fragment is doing something legitimate and a perceiver is not
 * the place to decide it is not.
 */
export const looksLikeMaterial = (text) => {
  const t = String(text ?? "").replace(/^﻿/, "").trimStart();
  if (t.length < 200) return false;
  if (/^<(?:!doctype|html|head|body|div|meta|title|\?xml)\b/i.test(t)) return false;
  return true;
};

/**
 * Separate the work from the container it arrived in.
 *
 * Returns `{ text, offset, front, looks_like_material }`.
 *
 * THE CONTIGUITY CONTRACT IS WHY `front` IS A FIELD AND NOT A PREFIX.
 * eoreader4.2 returned the front-matter lines glued onto the front of the
 * body, which is right for a metadata harvester and wrong here: everything
 * downstream of this resolves spans by slicing the SOURCE at `offset`, so
 * `text` has to remain a contiguous slice of what came in. Prepending would
 * make every anchor past the join point wrong by the length of the header —
 * the same class of drift as the byte/character mix eoreader5 records in
 * `host/corpus.js` ("indexOf gives a CHARACTER index; anchors are byte
 * offsets"), arriving by a different road.
 *
 * So the front matter is carried, not discarded and not inlined.
 */
export const stripContainer = (text) => {
  let s = String(text ?? "");
  let offset = 0;
  const front = [];
  const start = s.match(GUTENBERG_START);
  if (start) {
    // The book telling you what it is, kept from the header before the cut.
    for (const line of s.slice(0, start.index).split("\n")) {
      const trimmed = line.trim();
      if (FRONT_FIELD.test(trimmed)) {
        const at = trimmed.indexOf(":");
        front.push(Object.freeze({ field: trimmed.slice(0, at).trim(), value: trimmed.slice(at + 1).trim() }));
      }
    }
    offset = start.index + start[0].length;
    s = s.slice(offset);

    // Walk the leading paragraphs and drop the ones that are still container.
    // Offsets are accumulated as we go, because everything downstream anchors
    // spans against this offset and a strip that forgot to move it would
    // silently shift every citation in the reader.
    for (;;) {
      const m = s.match(/^(\s*)([\s\S]*?)(\n\s*\n|$)/);
      if (!m) break;
      const paragraph = m[2];
      if (!paragraph.trim()) break;
      if (!isContainerParagraph(paragraph)) break;
      const consumed = m[0].length;
      if (consumed === 0) break;
      offset += consumed;
      s = s.slice(consumed);
    }
  }
  const end = s.match(GUTENBERG_END);
  if (end) s = s.slice(0, end.index);
  return { text: s, offset, front: Object.freeze(front), looks_like_material: looksLikeMaterial(s) };
};

/**
 * Remove every well-formed span wrapped in a DECLARED delimiter pair,
 * wherever it sits on a line — the whole line, or embedded inline within a
 * line that is otherwise real content. The delimiter pair is a received
 * fact about the SOURCE's own convention (SEED.md #1: a prior is received,
 * never derived) — this never guesses at what a source's markup looks like
 * from its content, the same standing `language` already holds at the host
 * tier (corpus.js's admitChunked).
 *
 * WHY A LINE-LEVEL, WHOLE-LINE-ONLY TEST IS NOT ENOUGH, measured against a
 * real tagged-transcript corpus (goldens/network/texts/shakespeare/ —
 * <ACT n> / <SCENE n> / <NAME> / <STAGE DIR> tags): most structural markup
 * is one whole line (`<Enter Mariners.>`), but not all of it — a stage
 * direction can sit inline at the tail of a real line of dialogue and the
 * matching close tag at the head of the next (`...Bring her to try with
 * main-course. <STAGE DIR>` / `</STAGE DIR> A plague upon this howling!
 * ...`, checked directly against the raw source rather than assumed). A
 * whole-line-only test keeps the tag on both lines, corrupting the surface
 * pool with "DIR"/"STAGE"/"STAGE DIR" as if they were recurring proper
 * nouns. Stripping the SPAN itself, never the line it sits in, is correct
 * for the block-only case too (the span degenerates to the whole line) —
 * this is a strict generalisation, not a narrowing.
 *
 * DOES NOT CROSS A NEWLINE. Confirmed against the same source before this
 * was written: a STAGE DIR block that visually spans several lines is
 * several individually well-formed spans in a row (each tag, and each
 * bracketed stage direction inside it, closes on the line it opens on),
 * never one delimiter pair with a literal newline inside it. A convention
 * that genuinely needs a delimiter spanning lines is different, undeclared
 * behaviour and is left alone here rather than guessed at — this function
 * would simply find no match and report `removed: 0`, never silently do
 * the wrong thing.
 *
 * Non-nesting: the body between `open` and `close` may not itself contain
 * either delimiter, so a shortest-span match never over-runs into a
 * SECOND tag (`<A> text <B>` strips to " text ", never past the first `>`).
 * A convention whose markup genuinely nests needs a different mechanism —
 * this one is honest about not being that.
 *
 * Returns `{ text, removed }` — `removed` is the count of spans taken out,
 * so a caller can tell "found nothing to strip" apart from a silent no-op
 * (P4: a gap is a result, not an assumption).
 */
export const stripDelimitedMarkup = (text, { open, close } = {}) => {
  if (!open || !close)
    throw new TypeError("stripDelimitedMarkup: a delimiter pair {open, close} must be declared, never inferred");
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = `[^${escRe(open)}${open === close ? "" : escRe(close)}\\n]*`;
  const re = new RegExp(`${escRe(open)}${body}${escRe(close)}`, "g");
  const src = String(text ?? "");
  const matches = src.match(re);
  return { text: src.replace(re, ""), removed: matches ? matches.length : 0 };
};

import { SENTENCE_TERMINATORS, CLOSING_QUOTES } from "./priors.js";

const PARAGRAPH_BREAK = /\n\s*\n+/g;

// The guard this file used to rely on — "a terminator not followed by
// whitespace is probably an abbreviation" — catches `3.14` and does NOT catch
// `Mr. Darcy`, which is the case its own comment named. Measured on real text:
// "Mr. Collins" occurred in 0 of Pride and Prejudice's sentences against 145
// occurrences in the file, because every title was split off as a sentence of
// its own. War and Peace never showed it, since Russian titles ("Prince
// Vasíli", "Count Rostóv") carry no period — so the defect was invisible for
// exactly as long as the corpus was Russian.
//
// WHICH tokens are abbreviations is a fact about a language, so it is not
// decided here. It is injected (`options.abbreviations`) and lives as data in
// bin/priors/lang/*.json, on its way to eoPriors. This module stays
// language-agnostic in the same way material.js does: no list baked in.
//
// When nothing is injected the fallback is derived from the material itself,
// Zipf-style, with no word list: a token type ALWAYS written with a trailing
// period is an abbreviation, since a real sentence-final word also turns up
// mid-sentence without one. A length bar taken from the text's own 10th
// -percentile token length keeps out words that merely happen to be
// text-final-only in a short sample.
//
// The fallback is a floor, not a substitute, and it is fragile in a way worth
// stating precisely rather than implying it is close enough. Two limits, both
// measured:
//
//   - the length bar on real English prose comes out at 2 characters, so a
//     three-character title like `Mrs` is out of reach by construction;
//   - "always written with a period" is all-or-nothing, so ONE period-less
//     occurrence anywhere — including in a licence header — disqualifies a
//     token for the whole text.
//
// Together those are not a small shortfall. On Frankenstein the fallback
// recovers `Mr` and `M` (13 and 8 sentences repaired). On Pride and Prejudice
// it recovers NOTHING: `Mr. Darcy` stays at 0 sentences derived, against 249
// with the prior. A caller that has a prior should pass it.
const TOKEN_BEFORE_DOT = /(\p{L}[\p{L}\p{M}]*)\./gu;
const TOKEN_RE = /\p{L}[\p{L}\p{M}]*/gu;

export const deriveAbbreviations = (text) => {
  const withDot = new Map();
  const total = new Map();
  const lengths = [];
  for (const m of text.matchAll(TOKEN_BEFORE_DOT)) withDot.set(m[1], (withDot.get(m[1]) || 0) + 1);
  for (const m of text.matchAll(TOKEN_RE)) {
    total.set(m[0], (total.get(m[0]) || 0) + 1);
    lengths.push(m[0].length);
  }
  if (lengths.length === 0) return new Set();
  lengths.sort((a, b) => a - b);
  const bar = lengths[Math.floor(lengths.length * 0.1)];
  const out = new Set();
  for (const [token, n] of withDot) if (n >= 2 && total.get(token) === n && token.length <= bar) out.add(token);
  return out;
};

/** The token immediately before position i, or "" if there is none. */
const tokenEndingAt = (s, i) => {
  let j = i;
  while (j > 0 && /[\p{L}\p{M}]/u.test(s[j - 1])) j--;
  return s.slice(j, i);
};

// A lone capital letter before a period is a middle initial ("John C.
// Breckinridge") or a similar abbreviation, not a real sentence end, in
// any language/prior combination — a one-letter sentence is vanishingly
// rare next to how common initials are. General, not a word-list entry:
// this is true regardless of what's in `abbreviations`, and closes
// exactly the failure the infobox fix above surfaces directly (a
// succession-box "Preceded by" field with a middle initial glued a real
// value in half — confirmed live on the real Breckinridge/Hamlin
// material this fix was built against).
const isSingleCapitalLetter = (token) => token.length === 1 && /\p{Lu}/u.test(token);

const pushSentence = (s, start, end, out) => {
  const raw = s.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) return;
  const leading = raw.length - raw.trimStart().length;
  out.push({ text: trimmed, offset: start + leading, order: out.length });
};

// ATTEMPTED AND REVERTED (2026-08-20) — a bare-newline boundary rule
// ("no terminator since the last boundary, next line opens uppercase or
// numeric") fixed the target case (Wikipedia infobox rows gluing into
// garbage relations) but MEASURED a real regression before shipping,
// exactly the discipline P5.5 asks for: conformance/host-graph.test.js's
// real Frankenstein fixture failed to discover "Henry Clerval" as one
// referent, because "Henry" line-wraps onto its own line with "Clerval"
// starting the next — structurally identical, under that rule, to an
// infobox row followed by another. The reasoning that this would be rare
// ("word-wrapped prose almost always continues lowercase") was wrong in
// practice: a two-word proper NAME wrapping at the space between its
// parts is common, not rare, across a 200K-word novel, and it broke
// character-name discovery, the most foundational thing this engine does.
// Reverted rather than shipped half-fixed. The narrower, still-open
// problem (infobox/succession-box rows gluing across bare newlines) is
// real and still unfixed here; a safe fix needs a signal that
// distinguishes a complete label-value row from a mid-name wrap — tried
// and rejected under time pressure: a word-count floor alone (2+ words)
// still misfires on two-word name fragments ("Mary Wollstonecraft" /
// "Shelley"). Named as open work, not solved by a narrower guess assumed
// safe without the same live measurement this reversion is evidence for.

/**
 * Blank (length-preserving, offsets untouched) Wikipedia-style succession-
 * box rows — "In office", "Preceded by X", "Succeeded by Y", "President
 * X", and the record's own ordinal+office title line — BEFORE the text
 * ever reaches a clause matcher whose whitespace connectors deliberately
 * span newlines (relations.js::MATCHER, built that way on purpose for
 * Gutenberg hard-wrapped prose — see that file's own header; disabling
 * newline-crossing there broke real hard-wrapped text once already, so
 * this fixes the problem by removing the furniture from what the matcher
 * SEES, never by changing how it searches). Same "furniture, not content"
 * posture as stripContainer/blankStructure elsewhere in this project
 * family — the row stays real text, addressable by offset; it is just
 * never handed to anything that would try to relate it to its neighbors
 * as prose.
 *
 * NARROW AND PATTERN-BASED, NOT A GENERAL INFOBOX DETECTOR — on purpose,
 * after two broader approaches were tried and measured to fail. A bare
 * newline-boundary rule (no terminator, next line capitalized) fixed the
 * target case and then broke real character-name discovery on Frankenstein
 * ("Henry\nClerval", a hard-wrapped name reading exactly like two infobox
 * rows) — reverted the same day. A self-referential "short relative to
 * this text's own median line length" signal never fired at all on a real
 * fetched Wikipedia page: extracted web text is dominated by short
 * furniture (nav, references, citations) throughout, so the page's own
 * median (13 characters, measured) sits BELOW the actual infobox rows
 * (9-40 characters) rather than above them — the assumption that infobox
 * rows read as short by comparison does not hold on real, noisy material.
 * This is the third attempt: reuse the-fold's succession.js's own five
 * patterns directly (duplicated, not imported — the engine does not
 * depend on an application repo; the same duplication succession.js's
 * sibling hyperlexicon.js already accepts for graph.js's key format, for
 * the identical reason). These patterns are validated, narrow, and safe
 * against the same risk that sank the first two attempts: "In office" or
 * "Preceded by NAME" occurring as a bare line is not something real prose
 * does, hard-wrapped or not, so there is no plausible false positive
 * shaped like the Frankenstein regression to guard against here.
 */
const SUCC_TITLE_RE = /^\d+(?:st|nd|rd|th)\s+.+?\s+of the United States$/i;
const SUCC_IN_OFFICE_RE = /^In office$/i;
const SUCC_PRECEDED_RE = /^Preceded by\s+.+$/i;
const SUCC_SUCCEEDED_RE = /^Succeeded by\s+.+$/i;
const SUCC_PRESIDENT_RE = /^President\s+.+$/;
const isSuccessionBoxLine = (line) => {
  const t = line.trim();
  return (
    SUCC_TITLE_RE.test(t) ||
    SUCC_IN_OFFICE_RE.test(t) ||
    SUCC_PRECEDED_RE.test(t) ||
    SUCC_SUCCEEDED_RE.test(t) ||
    SUCC_PRESIDENT_RE.test(t)
  );
};

export function blankLabelRows(text) {
  const s = String(text ?? "");
  const lines = s.split("\n");
  const out = lines.map((line) => (isSuccessionBoxLine(line) ? " ".repeat(line.length) : line));
  return out.join("\n");
}

const splitSentencesInRange = (s, rangeStart, rangeEnd, out, abbreviations, terminators, closingQuotes, receivedMarks) => {
  let start = rangeStart;
  for (let i = rangeStart; i < rangeEnd; i++) {
    if (!terminators.has(s[i])) continue;
    let end = i + 1;
    while (end < rangeEnd && closingQuotes.has(s[end])) end += 1;
    // The whitespace guard exists for the DEFAULT Latin set: it is what
    // tells "3.14" from "3. 14". A mark RECEIVED by language prior carries
    // its own evidence — the giving corpus was measured, and an unspaced
    // script writes 。 hard against the next sentence's first character.
    // Received marks are exempt; the default set behaves exactly as before.
    if (end < rangeEnd && !/\s/.test(s[end]) && !receivedMarks.has(s[i])) continue; // a decimal point, not a stop
    if (s[i] === "." && (abbreviations.has(tokenEndingAt(s, i)) || isSingleCapitalLetter(tokenEndingAt(s, i)))) continue; // a title or an initial, not a stop
    pushSentence(s, start, end, out);
    start = end;
  }
  pushSentence(s, start, rangeEnd, out);
};

/**
 * @param {string} text
 * @param {object} [options]
 * @param {Iterable<string>|null} [options.abbreviations] - tokens that take a
 *   trailing period without ending a sentence. A LANGUAGE prior; pass one from
 *   bin/priors/lang/*.json. Omit to derive a weaker set from the text itself.
 * @param {Iterable<string>|null} [options.sentenceTerminators] - marks that
 *   end a sentence, RECEIVED by language prior (AbbreviationPrior@3) and
 *   merged over the frozen script/latn default. Received marks are exempt
 *   from the whitespace guard: an unspaced script writes its terminator hard
 *   against the next sentence, and the giving corpus's measurement — not this
 *   engine's Latin habits — is the evidence.
 * @param {Iterable<string>|null} [options.closingQuoteChars] - closing
 *   brackets/quotes that may follow a terminator inside one sentence
 *   (Japanese 」 after dialogue), same channel as sentenceTerminators.
 */
export const splitSentences = (text, { abbreviations = null, sentenceTerminators = null, closingQuoteChars = null } = {}) => {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const abbrev = abbreviations ? new Set(abbreviations) : deriveAbbreviations(s);
  // Received marks MERGE over the frozen script/latn default — a Japanese
  // document may still contain an English sentence, and the prior extends
  // reception, it does not replace what script/latn already earned.
  // receivedMarks tracks exactly which marks arrived by prior (vs default),
  // because only those are exempt from the whitespace guard: their giver's
  // corpus was measured writing them hard against the next sentence.
  let terminators = SENTENCE_TERMINATORS;
  let closingQuotes = CLOSING_QUOTES;
  let receivedMarks = new Set();
  if (sentenceTerminators || closingQuoteChars) {
    receivedMarks = new Set([...(sentenceTerminators ?? [])].filter((m) => !SENTENCE_TERMINATORS.has(m)));
    terminators = new Set([...SENTENCE_TERMINATORS, ...(sentenceTerminators ?? [])]);
    closingQuotes = new Set([...CLOSING_QUOTES, ...(closingQuoteChars ?? [])]);
  }
  const paragraphs = [];
  let paraStart = 0;
  let pm;
  PARAGRAPH_BREAK.lastIndex = 0;
  while ((pm = PARAGRAPH_BREAK.exec(s))) {
    paragraphs.push({ start: paraStart, end: pm.index });
    paraStart = pm.index + pm[0].length;
  }
  paragraphs.push({ start: paraStart, end: s.length });

  const sentences = [];
  for (const para of paragraphs) splitSentencesInRange(s, para.start, para.end, sentences, abbrev, terminators, closingQuotes, receivedMarks);
  sentences.forEach((sent, i) => { sent.order = i; });
  return sentences;
};
