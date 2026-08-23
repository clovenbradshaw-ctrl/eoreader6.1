const freeze = (value) => Object.freeze(value);
const refsOf = (value) => {
  const refs = new Set();
  const visit = (v) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (/^(ref|obs|edge|expectation|obligation|frame|pattern|delta|op|occ|surface|mention):/.test(v)) refs.add(v);
      return;
    }
    if (Array.isArray(v)) return v.forEach(visit);
    if (typeof v === "object") Object.values(v).forEach(visit);
  };
  visit(value);
  return refs;
};

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
    if (entry.schema === "EOMention@1" && entry.referent) {
      addIndex(incident, entry.referent, entry.id);
    }
    for (const ref of refsOf(entry)) if (ref !== entry.id) addIndex(dependent, ref, entry.id);
  }
  return freeze({ schema: "EOHypergraph@1", entries: freeze([...byId.values()]), byId, incident, dependent });
}

export function relevantHypergraphNeighborhood(graph, seeds = [], { maxHops = 3 } = {}) {
  if (!graph?.byId) return freeze({ schema: "EOHypergraphNeighborhood@1", entries: freeze([]), ids: freeze([]) });
  const seedIds = new Set();
  for (const seed of seeds) {
    if (typeof seed === "string") seedIds.add(seed);
    else {
      if (seed?.id) seedIds.add(seed.id);
      for (const ref of refsOf(seed)) seedIds.add(ref);
      for (const d of seed?.distinctions ?? []) {
        if (d?.ref) seedIds.add(d.ref);
        if (d?.referentId) seedIds.add(d.referentId);
      }
    }
  }
  const seen = new Set(seedIds);
  let frontier = new Set(seedIds);
  for (let hop = 0; hop < maxHops && frontier.size; hop += 1) {
    const next = new Set();
    for (const id of frontier) {
      for (const edgeId of graph.incident.get(id) ?? []) if (!seen.has(edgeId)) { seen.add(edgeId); next.add(edgeId); }
      for (const depId of graph.dependent.get(id) ?? []) if (!seen.has(depId)) { seen.add(depId); next.add(depId); }
      const entry = graph.byId.get(id);
      if (entry?.schema === "EOHyperedge@1") {
        for (const p of entry.participants ?? []) {
          if (!seen.has(p.ref)) { seen.add(p.ref); next.add(p.ref); }
          if (p.surfaceKey && !seen.has(p.surfaceKey)) { seen.add(p.surfaceKey); next.add(p.surfaceKey); }
        }
      }
      for (const ref of refsOf(entry)) if (!seen.has(ref)) { seen.add(ref); next.add(ref); }
    }
    frontier = next;
  }
  const entries = [...seen].map((id) => graph.byId.get(id)).filter(Boolean);
  return freeze({ schema: "EOHypergraphNeighborhood@1", ids: freeze(entries.map((e) => e.id)), entries: freeze(entries) });
}
