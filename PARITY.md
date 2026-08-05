# Swap-in parity checklist, against `eoreader6/nul/index.js`

Read directly from source (1221 lines), not from memory or from `SEED.md`'s
prose alone. This kernel's turns so far are honest about their own reasoning
but simpler than the real mechanism in several load-bearing ways. Recorded
here so the gap is explicit rather than discovered by someone trusting a
turn file's "earning argument" too far.

## What this kernel has approximated, not yet matched

**`ground()` is a distribution of a STATISTIC over many perturbed draws, not
a direct quantile of raw values.** `eoreader6`'s `ground` runs a chosen
statistic (`burstiness`, `windowMean`, `permutationEntropy`,
`irreversibility`) over `draws`-many perturbations of the material, then
takes quantiles of *those statistic values*. `turn-31`/`turn-32`'s
"magnitude ground" instead takes quantiles of the raw series directly,
excluding the candidate. Related in spirit (both refuse to condition a
ground on its own candidate), not the same construction. No turn here has
implemented a real `PERTURBATIONS`-style shuffle/resample/phase family or
run `draws`-many trials of one.

**`difference()` returns an exact rank against a real support, not a
boolean in/out.** `observed > hi` / `observed < lo` gives `exceeds_witness`
with a direction and a `censoredAt = 1/draws`; inside the support it returns
`rank = s.filter(v => v >= observed).length / s.length`. This kernel's
"absent"/"present" and "anomalous"/"ordinary" signs are binary, with no
rank and no censoring distinction between "barely inside" and "dead center."

**`pattern()`'s null is calibrated (`mean + 3·std` over `reseeds` draws),
not asserted.** Every `turn-*`'s `moved`/`consistent: true` in this kernel
is checked against exactly one alternative (a negative control), never
against a *distribution* of what reseeding noise alone would produce.
`eoreader6`'s own measurement (`nul/index.js:923-958`) shows why this
matters: an uncalibrated ceiling false-positives 34.7% of the time at low
`reseeds` and only converges to a defensible rate once calibrated. Nothing
in `kernel/` yet has a `reseeds`-many-trials mechanism at all.

**`witness()` requires an explicitly `kept` ground.** `keep(g)` is a
one-boolean phase transition — a ground is either still perceivable-through
or has been marked as retained testimony, never both. No turn in this
kernel has modeled `kept` as a state at all; `eot:witnessed true` has been
asserted directly wherever the underlying claim checked out, collapsing a
real two-step gate (mark kept, then check `pattern.moved`) into one.

**`level()` is the actual growth-rule mechanism**, comparing an observation's
rank against its own ground to its rank against a target ground, itself
null-calibrated the same way `pattern()` is. This kernel's Existence/
Structure/Significance progression (`NUL`→`SIG`→...) has been organized by
*argued* dependency ("X needs Y to have made the space first"), never by
running `level()` and checking `above`/`peer`/`unstable` for real.

**`extremeGround()`'s best-of-n correction has no analogue here.** Every
"two independent instances" check in this kernel (the actual discipline
that closed `turn-17`, `turn-23`, `turn-27`, etc.) is closer in spirit to
`extremeGround`'s concern (more candidates make false positives easier) than
to anything this kernel has built a defense against explicitly.

## What already matches in spirit, checked against the source

- **The contamination discipline is real and matches.** `turn-31`'s "a
  statistic must never condition on its own material" is exactly
  `pattern()`'s own check (`cites(before, material)`, and the reZero-vs-
  after-material bug it catches).
- **"A gap is a result" is held identically.** Every `gap-*` file in this
  kernel is kept, named, and superseded rather than deleted or rewritten —
  matching `eoreader6`'s own `GAP_TYPES` philosophy exactly, if not its
  specific type vocabulary.
- **Non-commutativity / register-threading matches `pattern()`'s own
  extent discipline**: `before`'s material must be `before`'s own, never
  substituted — the same discipline this kernel's `eot:opens` chain
  enforces by construction (a turn can only open from what actually closed
  immediately before it).

## A correction, checked by running the real code, not assumed

The framing above treats this kernel's magnitude mechanism as a simpler
approximation of `eoreader6`'s `ground()`/`difference()`. That was checked
directly (`check-real-ground-full.mjs`, importing `eoreader6/nul/index.js`
live) rather than left as an assumption, and it's wrong in an important way:

```
burstiness/shuffle on outlier:        rank=0.415   (not flagged)
windowMean/shuffle on outlier:        rank=0.540   (not flagged)
permutationEntropy/shuffle on outlier: rank=0.525  (not flagged)
irreversibility/shuffle on outlier:   rank=0.875   (not flagged)
irreversibility/phase on outlier:     rank=0.910   (not flagged)
```

**Every one of `eoreader6`'s currently licensed (statistic, perturbation)
pairs ranks the outlier series as unremarkable.** Shuffle preserves the
multiset of values (97.0 is still in there, just relocated), and none of
the four statistics isolate a single point's distance from its neighbors —
they measure windowed bursts, distributional order, and reversal asymmetry,
not pointwise deviation. `eoreader6`'s own kernel has the *identical* blind
spot `turn-28` found in this kernel's own frame, empirically, not by
analogy: it cannot see this outlier either.

This means `turn-31`/`turn-32`'s mechanism isn't a placeholder for
something `eoreader6` already does better — it's a capability neither
kernel had until this one built it. The honest parity claim narrows to
Amendment I's own terms: no (statistic, perturbation) pair carries a
warrant it hasn't been checked against, in either direction. `eoreader6`'s
richer calibration (rank, censoring, reseeding nulls) is still real and
still unmatched here for the questions it *does* answer — but "does
eoreader6 already solve stage two" is checked now, and the answer is no.

## What this means for "swap-in"

Not close yet, and worth saying plainly: this kernel has earned a real,
checked *shape* (ground/figure/pattern, witness, growth-rule refusal) but
not yet the *calibration* that shape needs to behave like `eoreader6`'s on
real material. The next honest step toward swap-in is not more operators —
it's replacing the binary sign-checks this kernel has used throughout with
an actual `PERTURBATIONS`-style null built from many draws, and an actual
calibrated (not asserted) `moved` threshold. Everything built so far in
`kernel/` would need to be re-earned against that mechanism, not assumed to
survive the upgrade — the same discipline `gap-033` already applied to a
smaller case (one kind's license not transferring to another).
