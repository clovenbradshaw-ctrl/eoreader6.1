# Kernel rebuild checkpoint

Status note for this repo's purpose: rebuilding
[`eoreader6`](https://github.com/clovenbradshaw-ctrl/eoreader6)'s kernel,
grounded in EO's own primitives rather than ported as JavaScript. Written so
the plan survives past the conversation that produced it. A matching
checkpoint (plus a determinism audit on the current JS kernel) is recorded in
`eoreader6`'s `docs/KERNEL_REBUILD_CHECKPOINT.md` on the same branch name.

## The idea

**The kernel is not the cube.** `eoreader6`'s `CUBE.md` already says this: the
27-cell grid "describes no data structure in this repository and must not
become one." The actual kernel is the ONE operation `SEED.md` names —
difference against a ground you rebuild — with three uses distinguished only
by what the difference is measured against: figure (against its own ground),
pattern (against the next ground — the difference this figure made), level
(against another figure's ground).

**That triad is not new.** Ground / Figure / Pattern is Peirce's Firstness /
Secondness / Thirdness: Ground is unrelated quality prior to any distinction;
Figure is brute dyadic fact, this against that; Pattern is mediation — a fact
becoming a rule for what the ground does next, which is exactly Bateson's
"difference that makes a difference." Spencer-Brown's calculus of indications
(the Mark; the law of calling; the law of crossing) gives the algebraic floor
underneath it, and its re-entrant forms are the formal reason Pattern/
Thirdness cannot be reduced to Figure/Secondness — a re-entrant mark oscillates
rather than settling, which is a proved result, not an assertion.

**Notation: EOT.** The EO wiki's own "Object axis" is explicitly named the
Time axis, and Decal Notation (an operator code plus one of `−` / `+` / `*`)
already gives a compact, native address for all 27 positions with composition
built in: `−` is reversal (the operator's ground — undoes/inverts), `+` is
forward (the canonical act), `*` is self-application (the operator meeting its
own pattern). This is the target language for this repo's kernel content —
not Rust, not JavaScript, not Python standing in for it.

**Canonical form.** Every act reduces to one tuple: `(turn, subject, operator,
decal, object)`. Stance, site, and the numeric coordinates are pure functions
of `(operator, decal)` — read from the Decal table, never stored redundantly
(`eoreader5`'s two incompatible cube ports, recorded in `eoreader6`'s
`CUBE.md`, drifted apart from exactly this kind of redundant storage). Turtle,
decal-compact, and JSON-event are three interchangeable renderings of that one
tuple; converting between them is re-punctuation, not translation. No format
is locked in yet — Turtle is the current working choice for hand-authoring
because it's the most legible, not because it's privileged.

**Time is a first-class axis.** Turns thread through a register: each act
receives exactly one scalar — the closing state of the act immediately before
it (`SEED.md` Amendment IX) — never a rollup of history. Order is
non-commutative and load-bearing.

**The kernel is earned, not authored by fiat.** No module joins this repo by
being written; it joins by clearing a growth-rule test the *existing* system
runs — a permutation-null check against the current core, gated by a
mandatory negative control — carrying forward `eoreader6`'s own discipline
(`nul`'s `level()`, the growth rule in `SEED.md`) rather than inventing a new
one.

**Goal: swap-in compatible.** This kernel should eventually replicate
`eoreader6`'s actual behavior — ground/aperture (IQR), the witness gate
(`pattern.moved`), the `gap()` taxonomy, the growth rule with its negative
control, frame/register sequencing across turns, binding's three nulls —
closely enough to stand in for the JS kernel it's rebuilding.

**Byte level, deferred on purpose.** Once the tuple and composition semantics
are proven, the same tuple packs into a byte: operator (9 values) into 4 bits,
decal (unmarked / `−` / `+` / `*`) into 2 bits. Not started — earning the
semantics comes first.

## What exists so far

Only this checkpoint and the repo skeleton. No kernel content has been
authored or earned yet. Next: turn-000 (`NUL−` — Void aimed at Ground,
stance *Clearing* — the one cell `eoreader6`'s `CUBE.md` names as
foundational), written in the working notation above, plus a structural
survey of `eoreader6`'s actual kernel modules to build the swap-in parity
checklist this rebuild is aiming at.
