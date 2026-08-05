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
| `turn-007` | `INS+` | earned | Making / Entity |
| `gap-008` | `INS*` (attempted) | **refused** — exactly one anchor exists; composing needs two | Composing / Kind |

`NUL`'s and `SIG`'s cycles are closed. `INS`'s is open at the same place
`NUL`'s once was: two of three uses earned, the third refused for lack of a
second instance to compose. See `kernel/GOAL.md` for the falsifiable test
these were earned against (`kernel/data/signal-a.json`, `signal-b.json`,
`noise-control.json`, `anchor-001.json`) rather than against prose alone.

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

## Where INS stopped

`turn-006` cultivates the ground for an anchor; `turn-007` mints one for
real — a SHA-256 digest over exactly what `turn-005` earned, independently
recomputed and checked against `kernel/data/anchor-001.json` before being
called earned, not asserted from memory. `gap-008` attempts `INS*` and is
refused for exactly the reason `gap-002` was: composition needs two things,
and there is one anchor in this kernel. Manufacturing a second one just to
close the cell would be the same un-earned generality `eoreader6`'s
`SEED.md` #1 refuses for priors — so it stays open.

## Next

- A second, independently-anchored entity — not this one duplicated — would
  make `INS*` reachable, the same way `signal-b.json` made `NUL*` reachable.
  Nothing yet proposes what that second entity should be; inventing one just
  to close the cell is exactly what's being refused above.
- Alternatively: `NUL` and `SIG` are both fully closed, and `INS` has an
  earned anchor (`turn-007`) even with `INS*` open — worth checking directly
  whether that's enough load to reach the Structure triad's first operator,
  `SEG`, rather than assuming the Existence triad must close serially before
  anything else can start.
- A structural survey of `eoreader6`'s current kernel (`nul/index.js` and
  neighbors) to build the swap-in parity checklist this rebuild is aiming at.
