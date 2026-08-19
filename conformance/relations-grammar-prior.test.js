// eoreader6 · conformance/relations-grammar-prior — discoverRelationVocab's
// optional posPrior cross-check (perceiver/text/wordclass.js composed in,
// 2026-08-19). SLOT (this organ's own measurement — what followed a
// surface) is not CLASS (what part of speech the token's FORM actually
// is, per real Universal Dependencies treebank evidence) — this file
// proves the composition holds, additively, without touching this organ's
// existing SLOT-only behaviour when posPrior is omitted.
//
// The fixture's counts are copied verbatim from a real run of
// scripts/build-pos-prior.mjs against the real UD_English-EWT training
// file — "party": {PROPN:9, NOUN:22, VERB:1} is the exact live specimen
// (the-fold, 2026-08-19): a real turn's own relation extraction admitted
// "party" as a verb candidate ("the Democratic —party→ ultimately
// contributed…") on slot evidence alone, and the treebank says that form
// is 68.75% noun, 3% verb.

import { test } from "node:test";
import assert from "node:assert/strict";

import { discoverRelationVocab } from "../packages/engine/perceiver/text/relations.js";

const POS_PRIOR = {
  schema: "POSPrior@1",
  forms: {
    party: { PROPN: 9, NOUN: 22, VERB: 1 },
    provides: { VERB: 9 },
  },
};

const SURFACES = ["Johnson", "Douglas"];
const TEXT =
  "Johnson party favored compromise. Douglas party opposed it. Johnson provides context. Douglas provides support. " +
  "Johnson frobnicated wisely. Douglas frobnicated boldly.";

test("posPrior omitted: candidates carry no grammar key at all — byte-identical to before this parameter existed", () => {
  const { verbs, candidates } = discoverRelationVocab(TEXT, { surfaces: SURFACES, minSurfaces: 1 });
  assert.ok(verbs.has("party"));
  const entry = candidates.find((c) => c.verb === "party");
  assert.ok(entry);
  assert.ok(!("grammar" in entry), "no posPrior supplied — nothing new added to the shape");
});

test("a form the treebank says is overwhelmingly a noun is flagged implausible as a verb, without being removed from vocab", () => {
  const { verbs, candidates } = discoverRelationVocab(TEXT, {
    surfaces: SURFACES,
    minSurfaces: 1,
    posPrior: POS_PRIOR,
    grammarMinShare: 0.5,
  });
  // Additive, never filtering: extractRelations still hears this candidate.
  assert.ok(verbs.has("party"), "grammar disclosure never removes a candidate from the vocabulary itself");
  const entry = candidates.find((c) => c.verb === "party");
  assert.equal(entry.grammar.found, true);
  assert.equal(entry.grammar.dominant.upos, "NOUN");
  assert.equal(entry.grammar.dominant.thraxClass, "noun");
  assert.equal(entry.grammar.plausibleAsVerb, false);
});

test("a genuine verb candidate is confirmed, not merely admitted on slot position", () => {
  const { candidates } = discoverRelationVocab(TEXT, {
    surfaces: SURFACES,
    minSurfaces: 1,
    posPrior: POS_PRIOR,
    grammarMinShare: 0.5,
  });
  const entry = candidates.find((c) => c.verb === "provides");
  assert.equal(entry.grammar.dominant.thraxClass, "verb");
  assert.equal(entry.grammar.plausibleAsVerb, true);
});

test("grammarMinShare is declared alongside posPrior, never defaulted — the same contract minSurfaces itself holds", () => {
  assert.throws(
    () => discoverRelationVocab(TEXT, { surfaces: SURFACES, minSurfaces: 1, posPrior: POS_PRIOR }),
    /grammarMinShare is declared/,
  );
});

test("a candidate the treebank never saw discloses found:false rather than guessing", () => {
  const { candidates } = discoverRelationVocab(TEXT, {
    surfaces: SURFACES,
    minSurfaces: 1,
    posPrior: POS_PRIOR,
    grammarMinShare: 0.5,
  });
  const entry = candidates.find((c) => c.verb === "frobnicated");
  assert.ok(entry, "the candidate is still discovered on slot evidence");
  assert.equal(entry.grammar.found, false);
  assert.equal(entry.grammar.dominant, null);
  assert.equal(entry.grammar.plausibleAsVerb, null);
});
