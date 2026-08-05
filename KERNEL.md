# The kernel, as it stands

This file tracks what has actually been earned in `kernel/`, not what is
planned. See `docs/KERNEL_REBUILD_CHECKPOINT.md` for the design behind it.

## The discipline

A turn is a file. It is earned only if the file itself carries a falsifiable
argument for why the act it records is entailed by what came before it — what
would refuse it, and why that refusal doesn't apply. There is no executor yet
that checks this mechanically; at this stage, earning is by written argument,
the same way `eoreader6`'s `SEED.md` amendments were earned by argument before
any code existed to check them. A mechanical growth-rule check is future work,
not assumed here.

A turn that is attempted and fails its own argument is not deleted or
rewritten quietly — it is kept as a **gap**, named as a refusal, because a gap
is a result (carried forward from `eoreader6`'s own discipline, not
reinvented).

## Roster

| Turn | Act | Status | Stance / Site |
|---|---|---|---|
| `turn-000` | `NUL−` | earned | Clearing / Void |
| `turn-001` | `NUL+` | earned | Dissecting / Entity |
| `gap-002` | `NUL*` (attempted) | refused, superseded — insufficient recurrence at the time | Unraveling / Kind |
| `turn-002` | `NUL*` | earned — supersedes `gap-002` | Unraveling / Kind |
| `turn-003` | `SIG−` | earned | Tending / Void |
| `turn-004` | `SIG+` | earned | Binding / Entity |
| `turn-005` | `SIG*` | earned | Tracing / Kind |
| `turn-006` | `INS−` | earned | Cultivating / Void |
| `turn-007` | `INS+` | earned (anchors the kind directly) | Making / Entity |
| `gap-008` | `INS*` (attempted) | refused, superseded — one anchor existed; composing needs two | Composing / Kind |
| `turn-009` | `SEG−` | earned — opens from `turn-7`, not `gap-008` | Clearing / Field |
| `turn-010` | `SEG+` | earned | Dissecting / Link |
| `gap-011` | `SEG*` (attempted) | **refused** — one field, one partition; generalizing needs two | Unraveling / Network |
| `turn-012` | `INS+` | earned (anchors `signal-a` individually) | Making / Entity |
| `turn-013` | `INS+` | earned (anchors `signal-b` individually) | Making / Entity |
| `turn-014` | `INS*` | earned — supersedes `gap-008` | Composing / Kind |
| `turn-015` | `CON−` | earned | Tending / Field |
| `turn-016` | `CON+` | earned (two independent bindings) | Binding / Link |
| `turn-017` | `CON*` | earned — first attempt, no refusal needed | Tracing / Network |
| `turn-018` | `SYN−` | earned | Cultivating / Field |
| `turn-019` | `SYN+` | earned (relates `turn-7` and `turn-14` without collapsing either) | Making / Link |
| `gap-020` | `SYN*` (attempted) | **refused** — one synthesis exists; generalizing needs two | Composing / Network |

| `turn-021` | `DEF−` | earned | Clearing / Atmosphere |
| `turn-022` | `DEF+` | earned (two independent value-claims) | Dissecting / Lens |
| `turn-023` | `DEF*` | earned — second Pattern-grain act closed clean | Unraveling / Paradigm |
| `turn-024` | `EVA−` | earned | Tending / Atmosphere |
| `turn-025` | `EVA+` | earned (witnesses `turn-23`'s whole claim) | Binding / Lens |
| `turn-026` | `EVA+` | earned (witnesses `turn-22`'s two claims separately) | Binding / Lens |
| `turn-027` | `EVA*` | earned — third Pattern-grain act closed clean | Tracing / Paradigm |
| `turn-028` | `REC−` | earned (triggered by a real, checked limitation) | Cultivating / Atmosphere |
| `turn-029` | `REC+` | earned (extends the frame; does not overwrite `turn-23`) | Making / Lens |
| `gap-030` | `REC*` (attempted) | refused — one revision exists; generalizing needs two | Composing / Paradigm |
| `turn-031` | `SIG−` | earned (opens GOAL.md stage two) | Tending / Void |
| `turn-032` | `SIG+` | earned (new "anomalous"/"ordinary" sign kind) | Binding / Entity |
| `gap-033` | `SIG*` (attempted, for the "anomalous" kind) | **refused** — one anomaly exists; this kind's recurrence isn't earned just because `turn-005` earned a different kind's | Tracing / Kind |

**All nine operators have now been reached.** `NUL`, `SIG`, `INS`, `CON`,
`DEF`, and `EVA` are fully closed for the sign-kinds attempted on them.
`SEG`, `SYN`, and `REC` are each open at the identical place: two of three
uses earned, the third refused for lack of a second instance to generalize
(`gap-011`, `gap-020`, `gap-030`). `SIG` has now closed one kind
(`turn-005`, "absent"/"present") and opened, but not closed, a second
(`gap-033`, "anomalous"/"ordinary") — the same cell, two independent
recurrence claims, one earned, one not. See `kernel/GOAL.md` for the
falsifiable test all of this was earned against (`kernel/data/*.json`)
rather than against prose alone.

## Why it stopped, then closed

`turn-000` and `turn-001` complete the first two of NUL's three uses: clearing
a ground, then reading one specific figure against it. The third use —
Pattern — is not a fresh operation on a fresh target; per Decal Notation's own
composition rule, `*` is self-application, the operator meeting its own prior
output. `gap-002` is what happens when that's attempted honestly with only one
prior occurrence to re-enter on: it fails, because a single crossing never
oscillates (Spencer-Brown) and a rule cannot be asserted from a sample of one
(`eoreader6`'s confabulation gate, ported by discipline rather than by import).

`turn-002` is what happens once a second, independently generated occurrence
of the same kind of absence exists (`GOAL.md`'s `signal-a`/`signal-b`, same
site-role, different seeds) plus a negative control that correctly turns up
nothing (`noise-control`). The gap wasn't wrong when it was written — the
material that would have refuted the refusal didn't exist yet.

## What SIG added that NUL couldn't

NUL* (turn-2) verified a fact: the same kind of absence recurs. SIG* (turn-5)
verified a different, further thing: the same NAME for that fact — "absent"
— holds across every member of the kind, and a different name holds in the
negative control. That's what "matters, not just is true" cashes out to at
this grain: a sign earned across independent instances, not one binding
taken on faith. Turn-4 recorded a wrong draft binding and its correction in
the open, on purpose — the check is only real if a wrong answer was possible.

## Where INS stopped, then closed

`turn-006` cultivates the ground for an anchor; `turn-007` mints one for the
KIND directly — a SHA-256 digest over its shared properties (site-role,
sign, membership, control), independently recomputed before being called
earned. `gap-008` attempts `INS*` and is refused: composition needs two
anchors, and there was one.

What closed it: `turn-007` had skipped a step, not hit a wall. The kind's
two MEMBERS (`signal-a`, `signal-b`) had been independently evidenced since
`turn-1` and named since `turn-4`, but never individually anchored.
`turn-012` and `turn-013` do that — one anchor each, on each member's own
evidence. `turn-14` composes them, superseding `gap-008` for real.

The honest, checked (not smoothed-over) result: the composed anchor is
**not** identical to `turn-7`'s kind-anchor. That's correct, not a failure —
the two were built from different content (shared properties vs. member
identities), and content-addressing means exactly what was hashed, nothing
more. There are now two distinct, legitimate anchors for related territory.
Deciding whether and how they relate is `SYN`'s job when this kernel reaches
it, not `INS`'s.

## Where SEG stopped

`turn-009` clears the ground for a partition (opens from `turn-7`, since
`gap-008` produced no closing register to inherit — a refusal doesn't
advance the clock). `turn-010` draws the boundary the negative control has
enforced since `turn-2`, checked directly against `sign_at_site_role` in the
data, not redecided. `gap-011` attempts `SEG*` — generalizing the boundary
into a network-level rule — and is refused: one field, one partition, no
second field to check the rule against. This is the third Pattern-grain
(`*`) act in this kernel to need genuine independent recurrence and fail
without it (after `gap-002` and `gap-008`) — not bad luck, but Peirce's and
Spencer-Brown's actual claim, checked three times rather than assumed once.

## CON closed on the first attempt — and why that's not special pleading

`turn-15` tends to `turn-10`'s field as relational; `turn-16` binds both of
`INS*`'s individually-anchored entities (`turn-12`, `turn-13`) to the same
side of the partition, independently; `turn-17` traces that the relationship
holds consistently across both — and is earned immediately, the first
Pattern-grain act in this kernel not to need a refuse-then-supersede cycle.

The reason is not that `CON` is easier than `NUL`, `SIG`, `SEG`, or `INS`.
It's that the two-instance material every one of those needed already
existed by the time `CON` opened — `turn-12` and `turn-13` were earned for
`INS*`'s sake, and `CON` inherited them for free. `gap-002`, `gap-008`, and
`gap-011` weren't refused because Pattern-grain acts are hard in general;
they were refused because the specific material wasn't there yet, in each
specific case. `CON*` closing clean is the predicted consequence of that
being stated correctly, not an exception to it.

## SYN closed its first two uses by resolving INS's deferral

`turn-18` cultivates a field relating `turn-7`'s and `turn-14`'s distinct
anchors; `turn-19` makes the actual derived whole — a third, minted entity
(`kernel/data/anchor-004.json`, independently reverified) whose content is
the relation between them, not a collapse of one into the other. `gap-020`
attempts `SYN*` and is refused: one synthesis exists, generalizing needs a
second, independent one.

## The Pattern-grain count

Four refusals now share the identical structural cause: `gap-002` (`NUL*`),
`gap-008` (`INS*`), `gap-011` (`SEG*`), `gap-020` (`SYN*`) — every one
because exactly one instance existed where the act needed two. `CON*`
(`turn-17`) is the one Pattern-grain act that didn't need refusing, because
its two instances happened to already exist from fixing `INS`. Four
failures and one success, all explained by the same rule (recurrence must
be real, not asserted) rather than by anything specific to an operator —
which is the check this kernel keeps being able to run on itself.

## DEF closed clean, the same way CON did

`turn-21` clears the interpretive atmosphere, naming the frame GOAL.md
already set up ("signal, not noise"). `turn-22` makes two independent value
claims — not one claim about the kind, but one about each of `turn-12`'s
and `turn-13`'s already-anchored entities separately, learning from turn-7's
premature kind-level anchor rather than repeating it. `turn-23` traces
consistency across both and closes immediately — the second Pattern-grain
act in this kernel not needing a refuse-then-supersede cycle, for the same
reason `CON*` didn't: the two-instance material was already on hand.

This is the pivot `GOAL.md` was written toward: the kernel has now moved
from structural fact (something recurs, is named, is anchored, is bounded,
is related, is composed) to interpretation (that recurrence IS signal,
consistently, not asserted once). It is not yet reading — `turn-23`'s own
text says so directly — but it is the first operator whose entire domain is
meaning rather than structure, and it closed against real, checked material
rather than argument alone.

## EVA closed as the witness gate, not as a chooser between anchors

The open question `SYN` left — what `turn-7`'s and `turn-14`'s two distinct
anchors are to each other — turned out not to be EVA's job after all.
Nothing in this kernel ever proposed they compete, and EVA's own
definition ("not resolved, not reduced, held under evaluation") argues
against forcing a choice where none was asked for. Choosing between
genuinely competing claims is EVA's job when a real conflict exists; this
kernel doesn't have one yet.

What EVA actually did: `turn-24` names `turn-23`'s claim as a candidate and
`kernel/data/noise-control.json` as the general to test it against.
`turn-25` witnesses the claim as a whole; `turn-26` witnesses `turn-12`'s
and `turn-13`'s underlying claims separately — checked directly against the
control (value -0.46, `sign_at_site_role: "present"`, nothing planted) —
so `turn-27` (`EVA*`) has two independent witness instances and closes
clean, the third Pattern-grain act in this kernel not needing a
refuse-then-supersede cycle. Running count: six Pattern-grain attempts,
four refused for genuine absence of recurrence, three closed clean because
recurrence was already on hand.

## REC closed on a real limitation, not a scheduled step

`turn-28` names an actual, checked gap: `kernel/data/signal-c-outlier.json`
plants a present-but-hundredfold-anomalous value at the same site-role, and
`turn-21`'s frame — built entirely on NUL's presence/absence mechanism —
reads it as indistinguishable from ordinary noise, because it isn't null.
`turn-29` revises the frame to admit this honestly: "signal, not noise" now
names a family of possible mechanisms, of which absence-recurrence
(everything through `turn-27`) is the first, earned member, and magnitude-
anomaly is named as a second, structurally distinct candidate — explicitly
NOT earned, NOT witnessed, flagged rather than silently folded into "not
signal." `turn-23`'s original claim is unchanged and unsuperseded.
`gap-030` attempts `REC*` and is refused: one revision exists, generalizing
needs two.

**Every operator in the 27-cell grid has now been reached at least once,**
and the same finding holds at all seven Pattern-grain attempts made across
it: two of three uses earn cleanly on real material; the third needs
genuine independent recurrence, and either has it already (`turn-17`,
`turn-23`, `turn-27` — three clean closes) or doesn't yet (`gap-011`,
`gap-020`, `gap-030` — plus `gap-002`/`gap-008`, later superseded once
recurrence existed). This is now checked at every address in the grid this
kernel occupies, not assumed from one or two.

## Stage two, started: a real magnitude mechanism, checked not asserted

`turn-31` tends to the magnitude-distance question as its own class.
`turn-32` binds an actual, computed sign: `kernel/data/magnitude-ground-c.json`
builds a ground from a series' other 31 values (excluding the candidate,
per the contamination discipline `SEED.md` and this kernel's own `turn-9`
both hold) and reports the outlier at 96.04 aperture-widths beyond it;
`kernel/data/magnitude-ground-control.json` reports noise-control's
ordinary value at -0.10 widths — *inside* its own ground. Clean separation,
computed, not decided in advance. `gap-033` attempts `SIG*` for this new
kind and is refused: one anomaly exists, and — the actual finding worth
keeping — earning `SIG*` once (`turn-005`, for "absent"/"present") does
NOT make `SIG*` free for a different kind at the same cell. Each recurrence
claim stands on its own material.

## What's actually open, going into stage two proper

- A second, independently-generated magnitude anomaly, at a comparable
  site-role, is what `gap-033` needs — not manufactured solely to close it.
- Once (if) that exists, `INS`, `DEF`, `EVA` would need their own
  magnitude-kind passes too — everything each of them earned so far was
  for the "absent"/"present" kind specifically, and per `gap-033`'s own
  finding, none of that transfers automatically.
- `gap-011`, `gap-020`, `gap-030` stay open; nothing yet proposes the
  second instances any of them needs.
- What `turn-7`'s direct anchor and `turn-14`'s composed one are to each
  other, if not competitors — `EVA` left this alone on purpose. May simply
  not be a conflict requiring resolution.
- A structural survey of `eoreader6`'s current kernel (`nul/index.js` and
  neighbors) to build the swap-in parity checklist this rebuild is aiming
  at — owed since the first checkpoint, still not started.
