const freeze = (value) => Object.freeze(value);
const REF_RE = /^(ref|obs|edge|expectation|obligation|frame|pattern|motif|delta|op|occ|surface|mention|encounter|lex):/;
const addRef = (set, value) => { if (typeof value === "string" && REF_RE.test(value)) set.add(value); };
const addRefs = (set, values) => { for (const value of values ?? []) addRef(set, value); };

/**
 * Only index semantically declared references for each graph-object schema.
 *
 * Do NOT recursively walk an Observation's embedded hyperedges/graphEntries:
 * those objects are already first-class entries. Recursive indexing created
 * accidental shortcuts from one local encounter into every lexical surface
 * nested inside its Observation, causing local neighborhood queries to fan
 * out across the whole book.
 */
function referencesOf(entry) {
  const refs = new Set();
  if (!entry || typeof entry !== "object") return refs;
  switch (entry.schema) {
    case "Observation@1":
      for (const d of entry.distinctions ?? []) {
        addRef(refs, d?.ref);
        addRef(refs, d?.referentId);
        addRef(refs, d?.occurrence);
        addRef(refs, d?.surfaceKey);
      }
      addRef(refs, entry.encounterRef);
      break;
    case "EOHyperedge@1":
      for (const p of entry.participants ?? []) {
        addRef(refs, p.ref);
        addRef(refs, p.surfaceKey);
        addRefs(refs, p.candidateReferents);
      }
      addRef(refs, entry.meta?.encounterRef);
      addRef(refs, entry.witness);
      break;
    case "EOMention@1":
      addRef(refs, entry.referent);
      addRef(refs, entry.encounterRef);
      addRef(refs, entry.witness);
      break;
    case "EOLexicalOccurrence@1":
      addRef(refs, entry.surfaceKey);
      addRef(refs, entry.encounterRef);
      addRef(refs, entry.witness);
      break;
    case "EOExpectation@1":
      addRefs(refs, entry.grounds);
      addRefs(refs, entry.consequences);
      addRef(refs, entry.reframes);
      break;
    case "EOObligation@1":
      addRefs(refs, entry.grounds);
      addRefs(refs, entry.alternatives);
      addRefs(refs, entry.consequences);
      addRefs(refs, entry.resolutionRefs);
      if (typeof entry.distinction === "object") {
        for (const value of Object.values(entry.distinction)) addRef(refs, value);
      }
      break;
    case "EOPatternCandidate@1":
    case "EOMotifCandidate@1":
      addRefs(refs, entry.instances);
      addRefs(refs, entry.witnessRefs);
      break;
    case "EOOperation@1":
      addRefs(refs, entry.inputs);
      addRefs(refs, entry.outputs);
      addRef(refs, entry.witness);
      if (Array.isArray(entry.witness)) addRefs(refs, entry.witness);
      addRef(refs, entry.payload?.value?.id);
      addRef(refs, entry.payload?.id);
      break;
    default:
      break;
  }
  return refs;
}

export function hyperedge({ id, relation, participants = [], witness = null, scope = null, eo = null, meta = {} }) {
  if (!id) throw new TypeError("Hyperedge requires stable id");
  if (!relation) throw new TypeError("Hyperedge requires relation");
  if (!Array.isArray(participants) || participants.length === 0) throw new TypeError("Hyperedge requires participants");
  return freeze({ schema: "EOHyperedge@1", id, relation, participants: freeze(participants.map((p) => freeze({ ...p }))), witness, scope, eo, meta: freeze({ ...meta }) });
}

export function graphObject(value) {
  if (!value?.id || !value?.schema) throw new TypeError("graph object requires id and schema");
  return freeze({ ...value });
}

export function buildHypergraph(entries = []) {
  const byId = new Map();
  const incident = new Map();
  const dependent = new Map();
  const addIndex = (map, key, id) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(id);
  };
  for (const entry of entries) {
    if (!entry?.id) continue;
    byId.set(entry.id, entry);
    if (entry.schema === "EOHyperedge@1") {
      for (const p of entry.participants ?? []) {
        addIndex(incident, p.ref, entry.id);
        if (p.surfaceKey) addIndex(incident, p.surfaceKey, entry.id);
      }
    }
    if (entry.schema === "EOMention@1" && entry.referent) addIndex(incident, entry.referent, entry.id);
    if (entry.schema === "EOLexicalOccurrence@1" && entry.surfaceKey) addIndex(incident, entry.surfaceKey, entry.id);
    for (const ref of referencesOf(entry)) if (ref !== entry.id) addIndex(dependent, ref, entry.id);
  }
  return freeze({ schema: "EOHypergraph@1", entries: freeze([...byId.values()]), byId, incident, dependent });
}

/**
 * Traverse the declared graph. maxHops bounds consequence expansion; optional
 * maxEntries is a hard safety aperture so one high-degree referent cannot turn
 * a local query into a whole-corpus dump.
 */
export function relevantHypergraphNeighborhood(graph, seeds = [], { maxHops = 3, maxEntries = 500 } = {}) {
  if (!graph?.byId) return freeze({ schema: "EOHypergraphNeighborhood@1", entries: freeze([]), ids: freeze([]), truncated: false });
  const seedIds = new Set();
  for (const seed of seeds) {
    if (typeof seed === "string") seedIds.add(seed);
    else {
      if (seed?.id) seedIds.add(seed.id);
      for (const ref of referencesOf(seed)) seedIds.add(ref);
      for (const d of seed?.distinctions ?? []) {
        if (d?.ref) seedIds.add(d.ref);
        if (d?.referentId) seedIds.add(d.referentId);
      }
    }
  }
  const seen = new Set(seedIds);
  let frontier = new Set(seedIds);
  let truncated = false;
  const add = (id, next) => {
    if (!id || seen.has(id)) return;
    if (seen.size >= maxEntries + seedIds.size) { truncated = true; return; }
    seen.add(id);
    next.add(id);
  };
  for (let hop = 0; hop < maxHops && frontier.size && !truncated; hop += 1) {
    const next = new Set();
    for (const id of frontier) {
      for (const edgeId of graph.incident.get(id) ?? []) add(edgeId, next);
      for (const depId of graph.dependent.get(id) ?? []) add(depId, next);
      const entry = graph.byId.get(id);
      if (entry?.schema === "EOHyperedge@1") {
        for (const p of entry.participants ?? []) {
          add(p.ref, next);
          if (p.surfaceKey) add(p.surfaceKey, next);
        }
      }
      for (const ref of referencesOf(entry)) add(ref, next);
      if (truncated) break;
    }
    frontier = next;
  }
  const entries = [...seen].map((id) => graph.byId.get(id)).filter(Boolean);
  return freeze({ schema: "EOHypergraphNeighborhood@1", ids: freeze(entries.map((e) => e.id)), entries: freeze(entries), truncated });
}
