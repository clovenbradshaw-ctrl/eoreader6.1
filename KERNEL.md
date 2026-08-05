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
| `turn-017` | `CON*` | **earned — first attempt, no refusal needed** | Tracing / Network |

`NUL`, `SIG`, `INS`, and now `CON` are all fully closed. `SEG` alone is
still open — two of three uses earned, the third (`gap-011`) refused for
lack of a second field. See `kernel/GOAL.md` for the falsifiable test all
of this was earned against (`kernel/data/*.json`) rather than against prose
alone.

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

## Next

- `SYN` (Structure triad, third operator) is reachable now — and is
  specifically where the two distinct `INS` anchors (`turn-7`'s direct
  kind-anchor, `turn-14`'s composed one) were deferred to. SYN "produces a
  derived whole not reducible to its components" — deciding whether and how
  those two anchors relate is exactly that.
- `gap-011` (`SEG*`) stays open; nothing yet proposes a second field. Worth
  revisiting once `SYN` exists, in case synthesizing something produces one.
- A structural survey of `eoreader6`'s current kernel (`nul/index.js` and
  neighbors) to build the swap-in parity checklist this rebuild is aiming at.
