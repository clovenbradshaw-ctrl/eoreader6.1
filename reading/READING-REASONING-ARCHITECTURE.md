# EOReader: Recursive Reading and Reasoning Architecture

Status: architecture specification and implementation audit, 2026-08-22.

This document specifies how EOReader should read, how the reasoning engine participates in reading, how reasoning may recursively revise what the reader thinks exists, and what must change in the current mechanics to make that true.

It is subordinate to `READING-POLICY.md`, the Constitution, `SEED.md`, and the canonical operator algebra. Where this document and those authorities disagree, those authorities win.

---

## 0. Governing claim

EOReader is not an extraction machine standing outside completed material.

Its job is to undergo material in the order and manner in which that material can be experienced, maintaining a revisable world as it goes.

Two invariants govern the architecture:

> The purpose of the reader is not to extract the maximum number of propositions from material. It is to experience the material in the manner in which that material is capable of being experienced.

and:

> At byte/time/event `t`, EOReader may know only what a reader could have experienced through `t`.

The second invariant does not prohibit anticipation. It prohibits evidence leakage. A reader may project a horizon from its past; it may not obtain evidence from that horizon before the horizon arrives.

---

# 1. There is one reader

There should be one production reading process:

```text
ExperienceStream
    ↓
SURF(t)
    ↓
prior FOLD(t−1)
    ↓
tentative experience
    ↓
adversarial perturbation / reasoning
    ↓
EO stance / resolution
    ↓
revised ontology + relations + frames
    ↓
witnessed admission / lapse / unresolved state
    ↓
FOLD(t)
    ↓
structural surprise Δ
    ↓
expectation for the next SURF
```

There is no separate production “blind reader,” “incremental reader,” “reasoner,” or “fact checker.” Blindness is an invariant of this one pipeline. Reasoning is constitutive of the transition from one Fold to the next.

A replay or prefix reconstruction may exist in conformance tooling, but it is not a second semantic reader and must not appear as a public reading API.

---

# 2. The atomic unit is a reading event, not a document

A document is a container. A reading is a sequence of occasions.

The reader consumes an `ExperienceStream`, where each event is an increment of material that the medium makes available as a coherent next experience.

Examples:

- prose: sentence, utterance, paragraph, scene, chapter, or another structurally earned unit;
- dialogue: speaker turn;
- table: row, cell update, column relation, group transition;
- audio: onset, phrase, motif, transition, silence, movement;
- video: shot, cut, gesture, scene, event;
- time series: observation, interval, regime change;
- code: declaration, dependency, execution event, diff;
- live stream: the arrival event itself.

Storage chunks are not automatically reading events. Parser sentences are not automatically reading events. Fixed byte windows are not automatically reading events. A useful storage partition and a useful experiential partition may coincide, but the equivalence must be earned rather than assumed.

The event grammar is itself part of the reading problem.

---

# 3. Reading is an assembly, not an organ

`READING-POLICY.md` is explicit that the engine provides organs and the host assembles a reader. A driver that manually invokes two organs is an experiment, not evidence about the complete reader.

The policy currently enumerates:

1. perception;
2. witnessed admission;
3. alias resolution;
4. pronoun binding;
5. typed directional relation;
6. altitude;
7. population closure / individuation;
8. kind induction.

The heading says “Seven stages” while eight are numbered; the numbered sequence is the operative content.

In a batch architecture these look like phases. In a genuine reader they are recursively entangled. A later stage may force revision of assumptions made by an earlier stage.

The wrong model is:

```text
perceive everything
→ decide all entities
→ decide all relations
→ reason once
```

The correct model is:

```text
perceive
→ provisionally individuate
→ relate
→ reason
→ revise individuation / relation / scope / frame
→ re-canonicalize consequences of that revision
→ reason again if necessary
→ commit Fold
```

---

# 4. SURF is permissive perception, not belief

A Surf should be allowed to report that a form, relation-shaped event, voice cue, or boundary candidate occurred without claiming what it ultimately is.

Example:

```text
SURF
  candidate form: "Mara"
  candidate form: "brass door"
  candidate relation: [Mara ? locked ? door]
  candidate voice: narrator
```

This does not yet imply:

```text
Mara is an admitted Entity.
brass door is an Entity.
Mara and a later "she" are the same referent.
Mara really locked the door.
the clause belongs to world testimony rather than reported speech.
```

EO's epistemic discipline belongs in admission and resolution, not in making perception so restrictive that obvious material never reaches the gates.

## 4.1 Current mismatch exposed by testing

The current `host/corpus.js::discoveredCast` path is document-scale. It derives surfaces using accumulated-document statistics and proceeds through referent discovery and downstream machinery.

That is useful as a document projection. It is not sufficient as the sole event-scale sensory organ.

The net-new beacon test exposed this directly: event-local names such as `Sela` and `Mara` never reached witnessed admission. The failure happened before ontology because the accumulated-document cast detector did not nominate them.

The architecture therefore needs an explicit event-local sensory record, conceptually:

```text
SurfObservation {
  cursor
  source
  medium
  unit
  witness/address
  candidateForms[]
  candidateRelations[]
  candidateBoundaries[]
  candidateVoices[]
  perceptualGaps[]
}
```

Candidate generation should be permissive. Ontological commitment should remain difficult.

---

# 5. Witnessed admission is the first ontological gate

`packages/engine/referents/entity.js` already contains the strongest implementation of the causal doctrine.

Its reading state is explicitly left-to-right:

- `arrive()` scores an arriving unit against the lexicon as it stood before that unit;
- `witnessArrival()` records that a candidate occurred at this reading unit;
- `admitFromArrivals()` asks whether recurrence makes a difference against a conditional null built only from the prefix already read;
- `offerCandidates()` births candidates that clear that gate;
- `reviewEntities()` later re-runs the same birth question and may lapse a previously admitted being.

This establishes:

```text
candidate ≠ being
surface ≠ referent
mention ≠ entity
frequency ≠ significance
```

An early state may honestly be:

```text
candidate: Mara
arrivals: [0]
being: none
reason: insufficient recurrence / no witnessed pattern yet
```

Later:

```text
candidate: Mara
arrivals: [0, 3, 7, 9]
being: e4
standing: witnessed admission
```

Still later:

```text
being: e4 lapsed
reason: the same birth condition no longer clears against the grown reading
```

The trajectory must retain all of these states. A lapse is not an error. It is the reader changing its mind about what exists.

---

# 6. Beinghood is recursive, not final

This is the central architectural point.

Reasoning is allowed to revise **what the reader thinks the things are**.

An Entity admitted at one point is not metaphysically frozen. Subsequent reasoning may discover that:

- two apparent beings are one referent;
- one apparent being contains several distinct referents;
- a surface treated as a being is actually a title, role, apparatus, field, quoted name, or another face;
- a pronoun binding created an identity collision;
- relations attributed to one referent actually belong to another;
- a changed frame requires reinterpreting the standing of earlier testimony;
- the population over which kinds were induced was itself wrong.

Ontology is therefore not a base layer that reasoning merely consumes. Ontology is part of the Fold and is recursively revisable by reasoning.

The process is:

```text
provisional ontology
    ↓
relations made possible by that ontology
    ↓
reasoning over those relations
    ↓
pressure on identity / multiplicity / scope / boundary / frame
    ↓
revised ontology
    ↓
relations re-canonicalized under revised ontology
    ↓
reasoning again if the revision changes the proposition graph
```

This may require more than one local pass at a single reading event.

Conceptually:

```text
state₀ = prior Fold + new Surf

repeat:
  candidates  = perceive(stateₙ)
  ontology    = individuate(candidates, stateₙ)
  relations   = bind(ontology, candidates, stateₙ)
  eot         = propositionView(ontology, relations, stateₙ)
  attacks     = reason(eot, stateₙ)
  stateₙ₊₁    = resolve(attacks, stateₙ)
until locally stable OR explicitly unresolved

commit Fold(t) = stateₙ
```

“Stable” does not mean “no contradiction exists.” It means this Surf has no further **earned** transformation available under the current operators, evidence, and priors. An unresolved plurality is a legitimate stable result.

---

# 7. Identity is revisable by consequence

The Reading Policy places alias resolution after witnessed admission. The codebase contains two different forms of evidence:

1. spelling/name-variant machinery;
2. consequence-based identity tests.

`referents/consequence.js` is particularly important because it encodes the nameless-referent principle: identity is judged by consequences in the reading, not merely by appearance.

It can return:

- `distinct`;
- `consistent`;
- `unstable`.

`consistent` is not proof of sameness. It is a refusal to refute sameness.

## 7.1 Identity alternatives are Fold state

The Fold must be able to carry richer identity state than a single canonical id:

```text
IdentityAlternative {
  members
  hypotheses[]
  standing
  evidence[]
  defeaters[]
}
```

A pronoun may likewise remain live against several referents rather than being merged early and repaired after the fact.

Reasoning therefore needs to operate before identity is treated as closed.

---

# 8. Relations are witnessed propositions, not parser output

`READING-POLICY.md` distinguishes basic SVO extraction from the substantive binding layer.

The SVO layer may emit typed and polarized candidate relations, but the policy itself notes that it is thin and carries parse artifacts. The stronger relation product comes from binding tests that measure co-arrival, transfer, and reversal before direction/polarity earn standing.

A useful standing ladder is:

```text
observed clause
→ candidate proposition
→ referent-canonicalized proposition
→ witnessed relation
→ adversarially tested relation
→ sustained / segmented / refused / unresolved relation
```

Each level retains provenance.

---

# 9. Scope is constitutive of truth conditions

Today's reasoning engine already handles an important class of errors: multiple values that only look contradictory because scope was collapsed.

The EOT kernel distinguishes:

- opposed polarity in overlapping/unknown scope → conflict pressure;
- opposed polarity in disjoint scopes → segmentation;
- different positive values in disjoint scopes → narrowed-by-scope;
- multiple values without earned segmentation → underdetermined.

This is the Lincoln/Hamlin/Johnson class of correction.

A proposition:

```text
Lincoln — vice_president → Hamlin
```

may be transformed into:

```text
Lincoln — vice_president → Hamlin   scope term 1
Lincoln — vice_president → Johnson  scope term 2
```

That is not “one fact true and the other false.” The relation was under-scoped and is transformed through segmentation.

---

# 10. The reasoning engine developed today

The reasoning stack currently contains four important pieces.

## 10.1 EOT proposition graph

`engine/reasoning/eot.js` normalizes explicit tuples into a proposition graph.

Good discipline already present:

- `(op, grain)` are declarations;
- terrain and stance are derived mechanically by `cellOf()`;
- content is not classified into cube cells;
- witness, scope, polarity, dependency, and provenance are retained;
- no semantic edge is invented merely from vocabulary.

The engine currently detects:

- polarity collision;
- competing values;
- temporal/scope segmentation;
- explicit refusal/evaluation testimony;
- defeated dependencies.

It resolves these with EO acts such as `SEG`, `DEF`, `EVA`, and `NUL`, not generic booleans.

## 10.2 Derivation

`engine/reasoning/derivation.js` performs deliberately limited structural derivation.

Repeated adjacency may nominate a Hyperlexicon composition affordance, but only a `GIVEN` affordance with a named giver licenses a composed bridge proposition.

That prevents graph adjacency from silently becoming implication.

It also derives scope-dependence when multiple values occupy disjoint declared scopes.

## 10.3 Hyperlexicon

`engine/reasoning/hyperlexicon.js` is an explicit ledger of relation affordances.

An affordance can be:

- unknown;
- candidate;
- given.

Experience may nominate a law. Experience may not grant itself authority to turn that law into received knowledge. `GIVEN` requires a named giver.

## 10.4 Falsification envelopes

`engine/reasoning/falsification.js` generates terrain-specific attacks.

Examples:

- Entity: identity collision, duplication, impossibility;
- Link: opposed polarity, competing object, direction reversal, scope split;
- Network: edge deletion, identity perturbation, alternative topology;
- Atmosphere: counter-signal / baseline sensitivity;
- Lens: rival framing / suppressed evidence;
- Paradigm: persistent anomaly / rival paradigm.

This is the right generalization beyond naive fact checking.

Its current architectural position is wrong when used after a complete reading. These attacks need to be callable during the event transition because they may change what gets admitted to the Fold.

---

# 11. Reading and reasoning are one recursive transition

The wrong architecture is:

```text
READ COMPLETE MATERIAL
→ build referents
→ build graph
→ create EOT
→ reason about completed graph
→ criticize it
```

That architecture creates an omniscient extractor and gives it an adversarial reviewer afterward.

The correct architecture is:

```text
Surf(t)
    ↓
perceptual candidates
    ↓
prior Fold supplies expectations and live alternatives
    ↓
provisional admission / binding
    ↓
construct only EOT propositions currently entertainable
    ↓
run adversarial reasoning immediately
    ↓
reasoning may transform Entity / Link / Network / Field / interpretation state
    ↓
re-canonicalize propositions affected by those transformations
    ↓
repeat local reasoning if ontology changed
    ↓
commit Fold(t)
```

The reasoning engine therefore has two roles.

### Role A — proposition pressure

Ask whether the newly entertained assertion survives:

- polarity attack;
- multiplicity attack;
- scope attack;
- dependency attack;
- direction attack;
- topology attack;
- rival frame attack.

### Role B — ontological pressure

Ask whether the assumptions required to state the proposition still hold:

- is the subject one being or several?
- are two subjects actually one referent?
- is the object an Entity, value, role, Field feature, or another face?
- is the relation scoped incorrectly?
- is a boundary wrong?
- does a frame shift change the standing of earlier testimony?

Role B is what makes the system recursive.

A proposition is not merely attacked **inside a fixed ontology**. Its failure can feed back into the ontology that made it expressible.

---

# 12. Fold is not a knowledge graph

The Fold is the reader's current experiential state, not a timeless final database.

It should contain at least:

```text
Fold {
  cursor
  activeGround
  beings[]
  lapsedBeings[]
  identityAlternatives[]
  pronounAlternatives[]
  relations[]
  unresolvedRelations[]
  boundaries[]
  scopes[]
  networkState
  atmospherePrior
  lensState
  paradigmState
  kindState
  gaps[]
  expectations
  testimonyLedger
  hyperlexiconSnapshot
}
```

Some structures can be persistent references rather than duplicated objects, but their standing **as of t** must be recoverable.

## 12.1 Persistence, activation, retrieval

The Reading Policy's distinction remains essential:

- persistence: admitted history stays addressable;
- activation: the reach of the present decays and can re-zero;
- retrieval: dormant beings can return to form on re-mention.

These are not interchangeable:

- becoming inactive is not deletion;
- reasoning revision is not activation decay;
- lapse from beinghood is not merely becoming cold;
- retrieval is not re-creation.

---

# 13. Surprise is Fold reorganization

The repository already contains several useful local surprise mechanisms:

- causal lexical surprisal;
- `loops/surf` anticipation / met / broke / flat;
- Bayesian prior movement;
- tier-specific continuation-null exceedance;
- atmosphere/lens/paradigm propagation.

These should remain because they are sensory and interpretive organs.

But experience-level surprise should answer the larger question:

> How much did this event force the prior Fold to reorganize?

That includes:

- new being admitted;
- being lapsed;
- referent split;
- referent merge / consequence-consistency;
- pronoun ambiguity opened or closed;
- relation polarity revised;
- relation split by scope;
- boundary changed;
- topology reorganized;
- lens shifted;
- paradigm re-zeroed;
- kind population changed.

The primary artifact should therefore be a transformation ledger, not one scalar over serialized JSON.

Conceptually:

```text
FoldDelta {
  entityBirths[]
  entityLapses[]
  identitySplits[]
  identityMerges[]
  relationAdmissions[]
  relationWithdrawals[]
  scopeSegments[]
  boundaryChanges[]
  frameRezeros[]
  unresolvedOpened[]
  unresolvedClosed[]
}
```

A scalar can summarize magnitude for navigation, but it must be downstream of the structured transformation record.

---

# 14. Altitude makes the recursion deeper

`emergence/tiers.js` already states the key idea correctly: meaning folds on itself.

Atmosphere, Lens, and Paradigm are not decorations after reading. They are priors built out of lower-level surprise, and movement at one tier becomes material for the next.

```text
tier 0 material
  ↓ surprise
Atmosphere prior
  ↓ surprising shift
Lens prior
  ↓ surprising shift
Paradigm prior
```

A paradigm shift is not a very large lexical surprise. It is an event that remained surprising through recursive folds of expectation.

## 14.1 Higher-level reasoning may revise lower-level standing

If a later event establishes that a narrator is unreliable, a Lens/Paradigm shift can alter the **current standing** of earlier testimony.

The historical state must still preserve:

```text
At t1 the reader was entitled to treat X as world testimony.
At t7 the reader acquired grounds to reinterpret X as narrator-scoped testimony.
```

This is not future leakage. Fold(t1) remains historically unchanged. Fold(t7) carries a revision of present belief about earlier testimony, grounded in evidence first encountered at t7.

The distinction is fundamental:

> Later evidence may revise what the reader now believes about the past; it may not rewrite what the reader had experienced at the earlier time.

---

# 15. Surf and Fold are complementary

`loops/surf.js` already contains the computational seed of the desired architecture: anticipation is frozen before arrival, using only what has settled behind the standpoint.

Surf therefore means more than “parse this chunk.” It is the event where expectation meets arrival.

`emergence/fold.js` defines Fold as a universe projected from a given here, not a summary.

The canonical transition joins them:

```text
FOLD(t−1) supplies the horizon
SURF(t) supplies the arrival
reasoning measures mismatch and consequences
FOLD(t) is the revised world produced by that encounter
```

This is why adversarial reasoning belongs between Surf and Fold commitment.

---

# 16. Terrains are surfaces of the reading, not labels on content

`host/terrains.js` is explicit that the terrain grid is a representation standard / assembler, not a classifier of passages.

The terrains expose different faces of one reading:

| Terrain | Surface |
|---|---|
| Void | gaps, refusals, absences |
| Entity | beings / referents |
| Kind | received or induced kinds |
| Field | admitted structure / extent |
| Link | relations |
| Network | relational whole |
| Atmosphere | ambient interpretive ground |
| Lens | current/declared interpretive figure |
| Paradigm | frame / interpretive pattern |

A single event may perturb several terrains simultaneously.

Example: delayed identity revelation may cause:

```text
Entity: split one referent into two alternatives
Link: reassign prior relations
Network: topology changes
Atmosphere: local surprise spike
Lens: narrator reliability changes
Paradigm: unchanged
```

The reader should journal the actual transformations rather than reduce the encounter to a generic update verb.

---

# 17. Operators and stances are acts, not content labels

`engine/operators.js` defines the canonical operator set:

```text
NUL SIG INS
SEG CON SYN
DEF EVA REC
```

Terrain and stance are mechanically derived from operator + grain.

The canonical stances are:

```text
Differentiate:
  Ground  Clearing
  Figure  Dissecting
  Pattern Unraveling

Relate:
  Ground  Tending
  Figure  Binding
  Pattern Tracing

Generate:
  Ground  Cultivating
  Figure  Making
  Pattern Composing
```

These are not classes assigned to content. They describe what the reader did.

A recursive resolution may therefore journal several acts at one event, for example:

```text
SEG · Figure / Dissecting
  one apparent referent separated into two live beings

CON · Pattern / Tracing
  prior relations reattached to the newly distinct beings

DEF · Figure / Dissecting
  old identity hypothesis refused
```

The cell comes from the declared operator + grain through `cellOf()`, never from semantic resemblance to a terrain name.

---

# 18. Canonical event transition

The implementation should converge on a function conceptually like:

```text
advanceReading(readerState, experienceEvent) -> ReadingTransition
```

with:

```text
ReadingTransition {
  cursor
  surf
  priorFoldRef

  perception {
    candidates
    gaps
  }

  iterations[] {
    provisionalOntology
    provisionalRelations
    eot
    attacks
    acts
    ontologyChanges
    relationChanges
    frameChanges
    unresolved
  }

  fold

  surprise {
    transformations
    summary
  }
}
```

The `iterations[]` are not optional bookkeeping. If reasoning changes identity, every proposition involving those identities may need re-canonicalization before the event settles.

## 18.1 Example: mistaken identity

Event 1:

```text
A masked visitor enters.
```

Fold:

```text
candidate V1
identity unresolved
```

Event 2:

```text
Mara speaks from behind the mask.
```

The reader may carry:

```text
hypothesis H1: V1 = Mara
hypothesis H2: V1 ≠ Mara
```

Do not prematurely SYN.

Event 3:

```text
Mara is seen across the room while the masked visitor remains present.
```

Reasoning attacks H1 with incompatible multiplicity.

Resolution:

```text
SEG / Dissecting:
  V1 ≠ Mara
DEF:
  refuse H1
```

Every prior relation provisionally canonicalized to Mara through H1 must then be reattached to V1. Ontology changed, so the relation graph changed, so reasoning must see the revised graph before Fold(t3) commits.

That is recursive reading.

---

# 19. Current implementation audit

## 19.1 What already works

### Causal entity admission

`referents/entity.js` reads left-to-right and supports birth, refusal, review, lapse, and re-admission.

### Anticipation before arrival

`loops/surf.js` freezes expectation before observing the next arrival.

### Causal interpretive priors

`emergence/tiers.js` measures how far a prior moved before folding the new arrival in, and recursively propagates surprising shifts upward.

### Consequence-based identity evidence

`referents/consequence.js` already refuses to equate names by spelling alone and measures segregation/displacement.

### Mechanical adversarial reasoning

`reasoning/eot.js` attacks explicit propositions for polarity, multiplicity, scope, and dependencies without inventing semantic edges.

### Explicit withheld inference

`reasoning/derivation.js` and `hyperlexicon.js` correctly refuse to infer relation composition without a GIVEN affordance.

## 19.2 What is currently wrong

### A. Event perception is downstream of document-scale cast discovery

Current `experience-stream.js` obtains its tentative experience from `adversariallyResolveAssertions()`, which obtains `sessionReferents()` and resolved relations from the accumulated session.

That means event-local candidates must survive document-scale cast discovery before they can even become arrivals in `entity.js`.

This is backwards. Event perception must feed witnessed admission, not depend on the result of a batch cast projection.

### B. `adversariallyResolveAssertions()` attacks an already accumulated ontology

It calls:

```text
sessionReferents(session)
resolveRelations(session)
sessionTerrains(session)
```

and attacks the resulting cast and links.

It can mark identity collision or relation conflict, but it does not mutate/rewrite the ontology that produced those relations.

It is therefore still principally a reviewer of a reading result.

### C. `experience-stream.js` has no local fixed-point loop

The current event transition is:

```text
tentative = adversariallyResolveAssertions(horizon)
changes = admitExperienceCandidates(...)
perturbation = gateThroughWitnessedBeings(...)
fold = foldFrom(perturbation)
commit
```

There is exactly one pass.

No reasoning act can:

1. split or merge identity;
2. cause relations to be re-canonicalized;
3. cause EOT to be rebuilt;
4. trigger another reasoning pass before commit.

So the architecture is temporally incremental but ontologically non-recursive.

### D. Fold is currently too thin

Current Fold contains only:

```text
cursor
cast
links
unresolved
```

That cannot represent the required recursive state: identity alternatives, lapsed beings, pronoun alternatives, boundaries, scopes, frame state, prior testimony, or transformation history.

### E. Surprise is currently a diff of serialized cast/link assertions

Current `structuralDelta()` counts changed assertion keys.

That is useful as a temporary smoke test, but it cannot distinguish:

```text
one entity split into two
one relation re-scoped
five string-level assertion reorderings
one paradigm re-zero
```

The canonical surprise record must be transformation-aware.

### F. `reading.js` still describes a batch assembly

The current canonical `admitReading()` says:

```text
material → corpus/EOT ingestion → level0/self → cube reasoning → HL → falsification
```

This makes reasoning constitutive in name but still executes it after whole admission.

The eventual canonical host entrypoint must delegate to the experience transition rather than run full-document extraction and reasoning afterward.

---

# 20. Required mechanical changes

The smallest coherent implementation path is:

## Step 1 — Add an event-local perception organ

Create a sensor that reports occurrence candidates from the current event without granting referent standing.

For text, it should minimally expose:

```text
forms with offsets
pronouns
clause/relation candidates
voice markers
boundary evidence
```

It may use document-so-far statistics as context, but it must not require document-scale referent admission before reporting that a form occurred.

## Step 2 — Make entity admission consume Surf candidates directly

`witnessArrival()` should receive candidate surfaces from the current Surf, not from `sessionReferents()`.

This fixes the failure where obvious names never reach the birth gate.

## Step 3 — Introduce explicit identity hypothesis state

Do not make canonical referent ids the only identity representation.

Maintain provisional identity edges / alternatives with standing:

```text
same
consistent
unstable
distinct
```

and provenance.

Pronoun binding should be able to create or update these alternatives.

## Step 4 — Build EOT from current Fold standing, not raw session cast

The EOT adapter should accept the current Fold's admitted/provisional ontology and witnessed relations.

The reasoning engine must never see a relation as canonicalized through an identity the Fold has not earned.

## Step 5 — Make reasoning return transformations, not only findings

Reasoning acts should be executable state transitions.

Examples:

```text
SEG Entity:
  split referent R into R1/R2

DEF IdentityHypothesis:
  refuse R1=R2

SEG Link:
  split one relation by temporal scope

REC Interpretation Ground:
  re-zero frame
```

Each act must identify the state records it transforms.

## Step 6 — Re-canonicalize after ontology-changing acts

If an Entity act changes identity, rerun relation canonicalization for affected assertions only, rebuild affected EOT groups, and reason again.

This is the core recursion.

## Step 7 — Stop at a local fixed point or explicit unresolved state

The event transition ends when no earned act changes current standing.

Prevent infinite loops with:

- immutable transition records;
- monotonic act ids;
- no-op detection;
- a diagnostic iteration ceiling that yields a typed gap rather than silently truncating.

The ceiling is an engineering guard, not a semantic stopping rule.

## Step 8 — Replace assertion-count surprise with a transformation ledger

Compute surprise from the actual acts applied during the event.

## Step 9 — Make `admitReading()` stream through `advanceReading()`

Whole-document reading becomes simply repeated event transition over an ExperienceStream.

The final graph becomes one projection of the final Fold. The trajectory becomes the primary artifact.

---

# 21. Gold-standard testing

The gold standard is not final link count.

A reading golden should specify an experiential trajectory:

```text
Fold0
→ Surf1
→ allowed/prohibited beliefs
→ Fold1
→ Surf2
→ allowed/prohibited beliefs
→ Fold2
...
```

The test must include cases where the ontology itself changes.

Required classes:

1. mistaken identity;
2. delayed revelation;
3. surname/pronoun ambiguity;
4. apparent contradiction resolved by scope/time;
5. unreliable narration / testimony re-framing;
6. scientific hypothesis overturned by later evidence;
7. relation direction reversal;
8. boundary/frame failure.

For each event, assert:

- what was merely perceived;
- what was admitted;
- what remained unresolved;
- what identity hypotheses were live;
- what propositions were entertainable;
- what attacks were generated;
- what EO acts were applied;
- what Fold transformations occurred;
- what could not yet have been known.

The strongest invariant remains:

> No Fold snapshot may depend on future Surf.

But the harder test is now:

> When new evidence defeats an ontological assumption, the reader must revise the ontology and all affected relations before committing the new Fold.

---

# 22. What success looks like

A successful EOReader run over a novel should not primarily produce “500 links.”

It should produce a history such as:

```text
t17  candidate "the stranger" begins recurring

t24  being E9 admitted

t38  hypothesis E9 = Mara becomes consequence-consistent

t52  simultaneous appearance defeats that identity
     SEG Entity
     relations 41, 44, 47 re-canonicalized
     Network reorganized
     surprise spike

t73  narrator testimony supporting relation 47 is re-scoped after a Lens shift

t121 prior ambiguity closes
```

The final graph matters, but it is downstream.

The primary artifact is the history of a reader acquiring a world, being surprised by it, discovering that its own ontology was wrong, and reconstructing that world without ever using evidence before it arrived.
