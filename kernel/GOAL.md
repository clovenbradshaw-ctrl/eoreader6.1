# Goal: parse signal from noise, until we can read again

A north-star test for this kernel, stated so it can fail. Everything earned
in `kernel/` should be measured against whether it moves toward this, not
against whether it sounds right in prose.

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
