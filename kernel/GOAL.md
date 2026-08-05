# Goal: parse signal from noise, until we can read again

A north-star test for this kernel, stated so it can fail. Everything earned
in `kernel/` should be measured against whether it moves toward this, not
against whether it sounds right in prose.

All turns and gaps referenced below (`turn-N`/`gap-N`) live as acts inside
the single file `kernel/kernel.eot`, not as separate files — see `KERNEL.md`.

## The test

Three committed series, generated once and never regenerated at runtime
(`kernel/data/*.json` — same deterministic generator `eoreader6`'s own
`nul/index.js` uses, run once, output frozen as data):

- `signal-a.json`, `signal-b.json` — independent noise series (different
  seeds) each with a genuine structural absence (`null`, not a low-magnitude
  value) at the same relative site — index 16 of 32, the midpoint.
- `noise-control.json` — the same construction, same length, **no absence at
  all**. The negative control.

The kernel passes this goal's first stage when, and only when:

1. It constructs a ground from each series by perturbing what is present
   (never by assuming a distribution).
2. It registers a figure at the gap in `signal-a` and in `signal-b` —
   correctly, because there is a real, structural absence there.
3. It registers **no figure anywhere** in `noise-control` — because there is
   nothing there to be a figure. A kernel that finds a figure in the negative
   control has failed, however plausible the finding sounds. This is
   `eoreader6`'s own mandatory-negative-control discipline (Amendment XIV),
   not a new invention: no candidate gets believed until it has been checked
   against material with nothing planted in it.
4. It recognizes the gap at index 16 recurring across `signal-a` and
   `signal-b` — independently generated, same site-role — as a **pattern**:
   the same kind of absence, not the same instance restated. This is what
   `gap-002` correctly refused for lack of: with one instance there was no
   recurrence to test. With two, there is.

Passing stages 1-3 earns `NUL+` for real, on real (if synthetic) material
rather than a single hand-picked target address. Passing stage 4 earns
`NUL*` — and specifically retires `gap-002`, not by deleting it (history
isn't rewritten here either) but by recording a new turn that supersedes it
and says why the refusal no longer applies.

## Why this, and not a bigger test yet

Every later operator depends on this one closing honestly. `SIG` needs NUL to
have "made the space" first (SEED.md's Existence triad); if NUL's own cycle
is asserted rather than earned against real material, everything built on it
inherits the fabrication. Small and checkable now is worth more than
impressive and unverified.

## What "until we can read again" means

Numeric series are the cheapest material to check this against honestly —
`eoreader6`'s own growth-rule discipline was built the same way, against
turbulence lines and IID noise, long before it read a sentence. Once ground /
figure / pattern close on data this plain, the same cycle is what gets pointed
at actual text — which is the whole reason this project is called a reader.

## Stage two, opened honestly by REC (turn-028/029)

All nine operators reached the frame this test built — "signal, not noise,"
decided by NUL's presence/absence mechanism — and it worked, all the way
through `EVA*` witnessing it. Then `signal-c-outlier.json` (present, not
absent, but ~100x every other sample's magnitude at the same site-role)
showed the frame's actual boundary: it cannot see anomaly, only absence.
`REC` named this rather than papering over it.

Stage two, closed for `SIG` (`turn-031`–`turn-035`): a real mechanism,
checked before being claimed. `kernel/data/magnitude-ground-c.json` builds
a ground from a series' other 31 values (excluding the candidate) and
reports distance in aperture-widths — the first outlier reads 96.04 widths
beyond; a second, independent one (`signal-d-outlier.json`, opposite sign,
different magnitude) reads 62.49 widths beyond; `magnitude-ground-control.json`'s
ordinary value reads -0.10, inside its own ground. `SIG` bound and traced
"anomalous"/"ordinary" as its own stable kind, following exactly the
model stage one set (`gap-002` refused, `turn-002` earned once real
material existed) — here, `gap-033` refused, `turn-035` earned once a
second real anomaly existed.

Closed, in full: `INS` anchored both anomalous entities individually and
composed them (`turn-36`/`turn-37`); `DEF` claimed "signal (magnitude-
anomaly), not noise" for each, named distinctly from the absence-
recurrence claim (`turn-38`/`turn-39`); `EVA` witnessed both against the
same committed negative control (`turn-40`/`turn-41`). Stage two now stands
at the same depth stage one reached — anchored, claimed, witnessed, traced
— for a kind this kernel didn't have material for a few turns ago.

Neither kind generalizes past what's anchored. That's the honest
boundary of "read" this kernel has earned so far: it can recognize two
specific, checked kinds of departure from an expected ground, consistently
and independently corroborated, and it re-derives that recognition from
the committed data every time rather than assuming it. A third kind, or a
member of either kind not yet anchored, is still unearned — which is
exactly where this goal's next real test should come from.
