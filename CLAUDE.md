# Working in eoreader6.1

## Version

This is **eoreader6.1** — a published snapshot of `eoreader6`: the same
engine (`packages/`, `nul/`, `frame/`, `cascade/`, `induction/`,
`holon_level/`, `formation/`, `temporality/`, `verdict/`, `reading/`,
`provenance/`, `lens/`, `event_log/`, `discourse/`) and the full conformance
suite, with the essays, research scratch (`scripts/experiments/`,
`scripts/adversarial/challenge-*.mjs`), and raw corpora (`scripts/corpus/`,
gitignored `goldens/*/texts/`) stripped out. No git history — this is a
clean base, not a fork of eoreader6's own repo.

**Successor:** none yet. This is the current published version. If a newer
one ships (eoreader6.2 or later), its location will be linked on this line —
check here before assuming 6.1 is still current.

This file is operational guidance for coding agents (and humans) working in
this repo — narrower in scope than `SEED.md` (the engine's own theory, under
the EO constitution's governance) and `CUBE.md` (the operator grid). Nothing
here needs ratification to add to; it is a running list of mistakes made
once, named so they are not made twice.

## Search for the organ before you write one

**Before writing a new statistical test, graph, or extraction mechanism,
grep for it. This engine already has more built than any one task's context
window surfaces on the first pass.**

Concretely: `packages/engine/emergence/`, `packages/engine/perceiver/text/`,
`packages/engine/referents/`, and `induction/`, `frame/`, `lens/`,
`holon_level/` at the repo root are where a capability already lives more
often than not. A one-line `grep -rl <keyword>` across those directories
before implementing anything costs seconds; reimplementing a worse version
of an existing organ costs a rewrite.

**The incident this rule is named for** (`goldens/network/`, 2026-08):
building a co-occurrence golden, an early version hand-rolled "did two
characters ever share a chapter" as a same-segment counting function, plus a
post-hoc Monte Carlo chance baseline to guess at significance. Both already
existed, done properly: `emergence/binding.js::bindLinks` runs a real
permutation-null significance test **per pair**, needs no notion of
"chapter" at all (it works over the reading's own reach-unit arrival
positions, so it has resolution on a 25-scene play exactly as well as on a
366-chapter novel), and already had direction and polarity built in via
transfer entropy. The hand-rolled version was strictly worse on every axis
— weaker signal, no per-pair significance, and structurally incapable of
resolving anything on a short text — and it took a direct instruction
("look harder at what we've built") to go find the organ that had been
sitting one directory over the whole time.

The check that would have caught it early: `grep -rln "cooccur\|co-arriv\|co-occur" packages/engine/` finds `emergence/binding.js` and `emergence/graph.js`
immediately. The same is true for relationship extraction
(`perceiver/text/relations.js` — measured, not hand-listed, SVO triples),
population/kind induction (`emergence/people.js`, `emergence/kinds.js`), and
referent coreference (`perceiver/text/surfaces.js::discoverReferents`) —
all real capabilities that a plausible-sounding from-scratch implementation
could otherwise silently duplicate, worse.

`scripts/read-people.mjs` is worth reading start to end before building any
new "read a book and extract X" driver — it already chains candidate
discovery → referent coreference → relation-vocabulary measurement → SVO
extraction → belief graph → population understanding, in the order those
organs actually compose. A new driver's job is usually to ask a new
QUESTION of that pipeline's output, not to rebuild pieces of the pipeline.

**Instance-level role resolution** (`perceiver/text/roles.js::resolveSpanRole`,
added 2026-08-19) — the general sibling of `pronouns.js::resolvePronouns`:
given a span of unknown role and other spans already known to fill
declared roles, resolves which role THIS occurrence's own local vocabulary
resembles, by the same causal one-hop `emergence/activation.js` recall
pronouns.js already trusts for referent identity. "Role" is never typed
in — it is a caller-declared label, so this is the organ to reach for
before hand-rolling any type-level word statistic (a determiner-adjacency
vote, a POS-frequency table) to decide what a specific occurrence of an
ambiguous word is doing — that class of mistake, and the type-vs-instance
reasoning behind the fix, is recorded in the-fold's own CLAUDE.md ("Closed
the same day — a new engine organ, not another word-level proxy") along
with a measured limitation: the mechanism needs same-role vocabulary to
actually recur within the material, which book-length text has and a
single short passage often does not.

## Never tune a parameter by checking what it does to a golden's own score

**If a number feeds a reading (a threshold, a window, a `minX`), its value
must be justified WITHOUT looking at how it moves the score against that
reading's own reference/golden. If the only justification you have is "I
tried a few values and this one scored best," stop — that is calibrating
against the answer key, and it is the same mistake as hand-rolling a
mechanism, aimed at a parameter instead of a function.**

`goldens/cast`'s own discipline states this directly: "the engine never
sees the reference — it is scored against it after the fact." That applies
to every number that shapes what the engine does before scoring, not just
to the engine's output.

**The incident this rule is named for** (`goldens/network/`, same session as
above): trying to raise entity coverage, `SPEC.minArrivals` was walked down
from 6 to 5 to 4 to 3, checking each value's effect on Les Misérables'
entity/edge recall against `lesmis.json` — exactly the leak the rule above
forbids. The correct move, once named, was to find a justification for the
number that referenced nothing about the golden at all:
`referents/entity.js::admitFromArrivals`'s own witness gate requires
`half = floor(arrivals / 2) >= 2` to run its split test, so any candidate
with fewer than 4 arrivals is refused by the Born gate itself regardless of
`minArrivals` — 4 is the lowest value at which that gate, not a pre-filter
sitting in front of it, is what decides admission. The number came out the
same (4) either way; the METHOD is what mattered, because the empirical
route would have silently rationalized whatever value best fit these four
specific books, with no way to tell afterward that it had.

If a value's only defensible justification really does require checking
the golden (rare, and worth naming explicitly when true), say so out loud
and flag the result as calibrated-on-this-fixture, not measured-blind — the
two are different claims and this codebase's own goldens depend on being
able to tell them apart.

## When two goldens grow the same tool independently, reconcile them — don't just dedupe

**Two drivers solving adjacent problems (here, `goldens/cast/read.mjs` and
`goldens/network/read.mjs`) will grow near-identical helper functions
independently. When you find one, don't just factor out whichever copy is
convenient — read both, find the better one (or the union of what's right in
each), and give BOTH callers the improved version. Deduplication that
preserves a known bug in one copy while fixing it in the other is not
finished.**

**The incident this rule is named for** (`goldens/shared/`, same session as
above): `goldens/network/read.mjs`'s fuzzy name-matcher had already been
fixed once (the `.find()`-first-match bug from the rule above). Extracting
the PG-boilerplate stripper (`stripPgBoilerplate`) into `goldens/shared/`
was a pure, risk-free move — cast's and network's copies were byte-identical.
The name-matcher was not: cast's own `matches()` had the identical
`.find()`-over-a-boolean shape network's used to, just quieter, because
cast's surfaces are mostly single tokens (fewer chances to collide with the
wrong reference entry). Checking whether cast's copy of the SAME bug was
still live took one grep and one read; fixing it took porting the already-
generalized `matchScore`/`bestMatch` (single-token surfaces degrade to
exactly cast's old behaviour, so this was a strict generalization, not a
narrowing). Measured afterward, honestly (not tuned toward this number):
`hu-69689` (A Pál utcai fiúk) went from 5/19 to 7/19 cast recall on the
identical register — a real bug, not a theoretical one, sitting unfixed in
a "proven" golden until the adjacent driver's own fix got checked against it.

The test for whether reconciliation is safe to do live (not just leave as a
TODO): is the function under a pinned/asserted conformance test? Neither
`cast/read.mjs`'s nor `network/read.mjs`'s own `score()` is (`entity.js`'s
7/7-brothers golden goes through a SEPARATE scorer,
`scripts/score-cast-entities.mjs`, untouched here) — so there was no pinned
number to break, only console output and JSON files to re-verify by eye.
When a golden's score IS pinned by a conformance test, fixing a shared bug
underneath it is still correct, but say so explicitly and expect the pinned
number to move — a moved number from a real fix is not the same failure as
regression from an unrelated change, and the two must not be reported the
same way.

## A scaffolded prior sitting unused is still "search first" — check what already exists before hand-typing a closed class

**`scripts/build-pos-prior.mjs` existed before this pass, fully written, fully
commented, and had never been run: a transform from a real, human-annotated
treebank (Universal Dependencies UD_English-EWT, CC BY-SA 4.0) into
`POSPrior@1` — every English word form's attested part-of-speech tags, with
real counts, ambiguity preserved rather than collapsed. Nothing consumed it.
`grep -rl POSPrior` before this pass found exactly one file: the builder
itself.**

The incident this rule is named for (2026-08-19, a session working from
the-fold's own committed evidence that `extractRelations`'s connector slot
sometimes holds a preposition or pronoun instead of a verb — see
`eval/results/asserted-crosslingual.md`, the-fold): the fix looked like it
needed two new hand-typed closed classes (prepositions, conjunctions,
mirroring `priors.js`'s existing `NEGATION_WORDS`/`DEFINITE_DETERMINERS`
pattern) — English has small, genuinely closed inventories for both, so
hand-typing them would not itself have been the mistake this file's other
sections warn about. But `find . -iname "*prior*"` first, the way this
file's own top rule demands, surfaced `build-pos-prior.mjs` instead — a
real 16,654-word, giver-cited, ambiguity-preserving prior sitting one
`curl` and one `node` invocation away, covering not just prepositions and
conjunctions but all of Dionysius Thrax's ancient eight parts of speech at
once, built from real annotation rather than a hand-typed list. Fetching
the real treebank and running the existing script (`scripts/corpus/` is
gitignored, so this is a local, reproducible build, never a git-history
cost) took under a minute and produced a strictly better foundation than
the two lists that were about to be hand-typed.

**Files.** `perceiver/text/wordclass.js` (new, pure, organs injected):
`THRAX_MAP` (Universal Dependencies UPOS tags → Thrax's own eight
categories, every entry naming exactly where the two schemes agree and
where they do not — UD's AUX/VERB split and CCONJ/SCONJ split have no
ancient counterpart; Thrax's own article was narrower than UD's DET;
`INTJ` is Donatus and Priscian's later Latin addition, not Thrax's own),
`THRAX_OUT_OF_SCOPE` (ADJ/PART/NUM/PUNCT/SYM/X — UD categories with no
Thrax-tradition analogue, kept OUT of the map rather than silently forced
into the nearest one), `classifyWord` (every attested class for a form,
real counts, never collapsed), `dominantClass` (the one permitted
convenience — a caller-declared `minShare` floor, never defaulted, the
same standing `roles.js::resolveSpanRole`'s own `minActivation`/
`minMargin` already hold). `conformance/wordclass.test.mjs` (10 cases
against real treebank counts, including one composition test proving a
type-level tie `classifyWord` correctly refuses to collapse — a plain
majority TABLE cannot separate "walked to the station" from "wanted to
leave" — is resolvable per-OCCURRENCE by `roles.js::resolveSpanRole`,
given real local company; no new resolution mechanism, the existing organ
composed exactly as its own header already invites).

**SLOT is not CLASS, and this file only ever answers CLASS.** Which
position a span fills in a clause (subject/connector/object —
`extractRelations`'s own structure) and which part of speech a word's FORM
is (independent of any one clause) are different questions — Halliday's
Systemic Functional Grammar keeps them apart for exactly this reason
(function vs. class: a function can be realised by any class), and
conflating them is the defect this whole pass closes. `wordclass.js` has
no notion of a clause, a triple, or a slot; it answers one question, about
one word, and always as a disclosed set of candidates rather than a
verdict.

**Disclosed, not fixed: participle.** Thrax's `metokhē` (μετοχή, participle)
has no clean signal in `POSPrior@1` as currently built — UD's own UPOS
tagset has no separate participle tag (`VerbForm=Part` lives in FEATS,
which `build-pos-prior.mjs` reads from the CoNLL-U columns but does not
currently tally); `THRAX_MAP` omits it rather than guessing from a `VERB`
tag alone. Extending the builder to also tally FEATS is real, scoped,
unattempted future work, named here so the next pass does not have to
re-discover the gap.

## When a rewrite is still the right call

Not everything is built. `goldens/network/read.mjs`'s chapter-boundary
detection for Gutenberg novels (`novelChapters`) and its Shakespeare
scene-splitter (`shakespeareScenes`) are both genuinely new — `segments.js`'s
`outlineOfIndex` was tried first and correctly rejected on the merits (it
refuses Huckleberry Finn's own "CHAPTER I." heading style as sentence-shaped,
which is the right general policy, just wrong for this one corpus's
convention). The rule above is "search first," not "never write new code" —
it just means the search has to actually happen, and the reason for writing
new code instead of reusing what's found has to be stated, not assumed.
