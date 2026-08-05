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
| `turn-002` | `NUL*` | **earned** — supersedes `gap-002` | Unraveling / Kind |

`NUL`'s cycle is closed. See `kernel/GOAL.md` for the falsifiable test this
was earned against (`kernel/data/signal-a.json`, `signal-b.json`,
`noise-control.json`) rather than against prose alone.

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

## Next

- `SIG` becomes reachable now — the Existence triad's next operator,
  dependency-satisfied by `NUL` having made the space and closed its own
  cycle for real, not just claimed.
- Extend `GOAL.md`'s test to `SIG`: registering that one of the two recurring
  absences *matters* (a signal, not just a fact) is a different claim than
  finding it at all, and needs its own falsifiable check.
- A structural survey of `eoreader6`'s current kernel (`nul/index.js` and
  neighbors) to build the swap-in parity checklist this rebuild is aiming at.
