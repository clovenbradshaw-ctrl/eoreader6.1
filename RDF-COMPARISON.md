# RDF comparison programme — resumption log

This is an append-only research log, not a claim that an RDF comparison has
been completed.  Each pass records **what was tried → what happened → what it
changed**, and ends with work that remains open.

## Pass 0 · 2026-08-20 · Name the subject before comparing it

### What was tried

The first pass read the engine's local governing and orientation documents
(`READING-POLICY.md`, `CUBE.md`, `SEED.md`, and `CLAUDE.md`), then traced the
actual reading path through `packages/host/corpus.js`,
`perceiver/text/relations.js`, `referents/entity.js`,
`emergence/binding.js`, and `emergence/graph.js`.  It also read the network
golden's method before proposing a new comparison mechanism.

The broader constitutions and the-fold/live-priors material named in the
brief were looked for at `/Users/mlacy/Documents/3.0`, but that tree is not
mounted in this environment.  Only `/workspace/eoreader6.1` is present.
Consequently this pass does not fetch RDF, choose an RDF-covered document,
change an engine organ, or claim compliance with documents it could not
inspect.

### What happened — the overloaded “hypergraph” map

| candidate | what it is | persistence and identity | RDF-comparison standing here |
|---|---|---|---|
| **Engine belief graph** (`emergence/graph.js`, fed by the host reading assembly) | A modality-agnostic, evolving set of entity nodes and verb/polarity edges; binding links can also enter through a structural edge key. | Node ids are whatever resolved identity the caller supplies. Edge keys are derived strings. Edge weights decay and may be pruned; this is belief at a declared cursor, not a cumulative knowledge store. | **Selected subject for the first comparison.** It is the structure produced by an actual engine reading, and it exposes typed, directional, polarity-bearing relations that can be compared separately from entity correspondence. |
| **The-fold live relation verifier** (`the-fold/hypergraph.js`) | Per-turn extraction and comparison of material edges with drafted-answer edges, yielding typed verdicts. | Recomputed verification state, not a stored graph. | Not selected: it measures answer grounding after drafting, a different question from whether the reading's own extracted representation corresponds to received RDF. The sibling repository is also absent here. |
| **Append-only claim/testimony substrate** (`task-log` and the P39 testimony spine named in the brief) | Stable claims and evidence/verdict events, including a claimed SHA-256 `claim_id` seam in the-fold. | Intended stable, addressable log identity rather than live graph identity. | Not selected for pass 1: it could become the durable envelope for comparison verdicts, but the P39 implementation and policy cannot be inspected in this checkout. It should record later results, not silently replace the thing being tested. |
| **`HYPERGRAPH-FIRST-GENERATION.md` proposal** | A proposed extract-before-draft ordering. | A plan, not an implemented graph. | Not a comparison subject. A later measured under-use finding may bear on it, but no such finding exists yet. |
| **eoWebLLM hypergraph** | A sibling application's progressive ingestion/retrieval structure. | Governed and implemented outside this repository. | Explicitly excluded: shared vocabulary is not shared implementation or evidence. |

The chosen subject is therefore **a cursor-stamped snapshot of the engine
belief graph produced through `packages/host` for one disclosed reading**,
not “the project hypergraph” in the abstract.  The snapshot must preserve
the reading specification, injected priors and their givers, source
provenance, cursor/tick, node records, verb-inclusive edges, structural
edges, weights, and the fact that absent edges may have decayed or been
pruned.  It must not present the final activation state as a persistent
knowledge base.

This selection is not “whichever is easiest to export.”  It is selected
because the research question begins with the representation an engine
reading itself produces.  The verifier asks a downstream claim-grounding
question, while the claim-id log supplies a future address for testimony;
neither substitutes for measuring the upstream reading product.

### Export and comparison seams already present

No new export mechanism is licensed yet.  The graph organ already exposes
plain `Map`-backed nodes and edges plus graph provenance, while the host has
an explicit `CorpusSession@1` serialize/reimport boundary for admitted spans,
documents, and provenance.  A future eval driver should compose those
existing seams rather than introduce a graph store.  Any snapshot format is
an eval artifact first and must say that it captured a changing belief at one
tick.

The network golden supplies the transferable scoring discipline, not an RDF
scorer ready for reuse.  It already separates candidate discovery,
spelling-based referent resolution, consequence-based alias resolution,
causal entity admission, and permutation-tested links.  RDF entity labels or
aliases may therefore **nominate** a correspondence through the real
referent machinery; they may not decide one through a new fuzzy threshold.
Entity correspondence and relation correspondence remain separate reports.
The existing literary references are undirected co-occurrence networks and
cannot validate RDF predicate type, direction, or polarity.

### Standing

- **shown:** the five-way map and selected subject are an architectural
  reading of the checked-out files, not an RDF measurement.
- **received:** the requested roles of the-fold P39, live_priors, Wikidata,
  DBpedia, and the absent constitutions are received from the research brief
  for this pass; they have not been independently admitted from local bytes.
- **gap:** no commensurable corpus/RDF pair, received RDF snapshot, human
  correspondence labels, matcher calibration, null battery, or comparison
  result exists yet.
- Evidence flags: `real_ground=false`, `descended_to_rows=false`,
  `counted_search=true`, `independent_rerun=false`.  The counted search is a
  repository search for RDF/SPARQL/OWL and the named organs; it is not
  evidence of RDF quality.

### What it changed

It fixes the subject of the next pass without changing runtime code: compare
the host-assembled engine belief graph at a declared cursor.  The-fold's
verdicts and testimony spine remain downstream consumers/records of that
comparison, not aliases for its subject.

### Open, not yet attempted

1. Mount or otherwise provide the named sibling repositories and governing
   documents; run the-fold's setup script and baseline suite there before
   touching shared code.
2. Read the-fold P39 implementation and policy from its own bytes and decide
   how a comparison verdict is appended to its testimony spine.
3. Inspect `live_priors` publisher frontmatter and toggle ledger; choose one
   enabled government/legal document only after checking that the same
   subject has substantive RDF coverage.
4. Define a reproducible, giver-named, local RDF acquisition artifact with a
   snapshot date.  Do not perform an ambient network fetch from an eval run.
5. Specify the cursor-stamped graph snapshot by composing the host session
   provenance and existing graph state; do not add a persistent graph store.
6. Build a small human-labelled correspondence set before reporting an
   automatic match rate.  Record nominated, confirmed, and refused entity
   correspondences separately.
7. Compare entity correspondence separately from predicate/direction/
   polarity structure, and run the same pipeline on a perturbed input as its
   commensurable null.
8. Only after a measured discrepancy exists, run the shipped grammar
   diagnostics and inspect shared-organ callers before proposing a grammar,
   logical-layer, or live-prior ingestion fix.

## Pass 1 · 2026-08-20 · Run the available assessment; refuse the absent one

### What was tried

`goldens/rdf/rdf-belief-assessment.mjs` ran the selected host-assembled belief graph
over the repository's Project Gutenberg *Frankenstein* fixture.  It then ran
the identical `createSession` → `admitChunked` → `admitGraph` →
`sessionGraphSnapshot` path over a declared sentence-order reversal.  The
driver records the material digest, giver, transformation, graph cursor and
shape in `goldens/rdf/results/rdf-belief-frankenstein.json`.

Wikidata was also approached as the prospective received giver through its
SPARQL endpoint, entity search API, and `Special:EntityData`; DBpedia's JSON
document endpoint was tried independently.  Every HTTPS request was refused
by this environment's CONNECT proxy with HTTP 403.  No remembered or
hand-authored triples were substituted.

### What happened

The observed run admitted 210 chunks and produced 5,991 node strings and
9,803 live edge keys at tick 1: 4,935 verb-bearing keys, 4,868 structural
keys, and 356 negative keys.  The sentence-reversal run produced 5,993 nodes
and 9,808 edges: 4,938 verb-bearing, 4,870 structural, and 364 negative.

This is a measured **shape result**, not an RDF agreement result.  In
particular, the observed strongest nodes begin with pronouns and function
words (`i`, `and`, `you`, `he`, `it`), and the snapshot carries edge keys but
zero stable external entity identifiers.  That is a concrete entity-
alignment obstacle upstream of RDF predicate comparison.  The near-equality
of the order null is also not evidence of robustness: the host admits this
whole document to the graph in one call (tick 1), so graph decay never sees
the sentence order as a sequence of cursors.  This attempt therefore exposes
that a staged cursor-level run is required for the planned temporal null.

The RDF-quality verdict is **refused**, with zero RDF triples and zero
confirmed correspondences.  Reporting an overlap percentage from those rows
would turn failed acquisition into a false finding.

### Standing and what it changed

- **measured:** local graph and null shape; `real_ground=true`,
  `descended_to_rows=true`, `counted_search=true`,
  `independent_rerun=true` (the executable artifact rebuilds both rows).
- **refused:** RDF entity/relation quality; `received_rdf=false` and
  `confirmed_correspondences=false`.
- **gap:** staged graph admission and a giver-named RDF snapshot.

The programme now has a rerunnable eval rather than documentation alone, and
it has two discrepancy leads: noisy/non-external node identity at the host
graph seam, and a one-tick admission path that is not an adequate temporal
null.  Neither licenses an engine correction until the RDF rows and human
correspondence decisions exist.

### Open, not yet attempted

1. Re-run the acquisition builder where Wikidata/DBpedia egress is available,
   freezing response bytes, request, retrieval date, digest, and giver.
2. Replace *Frankenstein* with a toggle-enabled `live_priors` government/legal
   source once that sibling corpus is mounted; keep this run as the pipeline
   assay, not the headline corpus.
3. Run graph admission at declared staged cursors so sentence/order
   perturbation can exercise decay through the same pipeline.
4. Hand-confirm/refuse a calibration sample of nominated external IDs before
   computing entity coverage; only then compare predicate, direction and
   polarity separately.
