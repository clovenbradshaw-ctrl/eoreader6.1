const stable = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());

function edgeSignature(edge) {
  const roles = (edge.participants ?? []).map((p) => ({ role: p.role ?? null, standing: p.standing ?? null }));
  return stable({ relation: edge.relation, roles });
}

/**
 * Discover only recurrence already witnessed in the hypergraph.
 *
 * This is intentionally narrower than "theme" discovery: a pattern candidate
 * is a repeated relation/role organization. It carries its instances and can
 * later participate in larger structural matching without inventing semantic
 * labels not present in the material.
 */
export function discoverPatternCandidates(entries = [], { minInstances = 3 } = {}) {
  if (!Number.isInteger(minInstances) || minInstances < 2) throw new TypeError("minInstances must be >= 2");
  const groups = new Map();
  for (const entry of entries) {
    if (entry?.schema !== "EOHyperedge@1") continue;
    const signature = edgeSignature(entry);
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(entry);
  }

  const candidates = [];
  let ordinal = 0;
  for (const [signature, instances] of groups) {
    if (instances.length < minInstances) continue;
    candidates.push(Object.freeze({
      schema: "EOPatternCandidate@1",
      id: `pattern:${ordinal}:${instances[0].relation}`,
      signature,
      relation: instances[0].relation,
      structuralMapping: Object.freeze((instances[0].participants ?? []).map((p) => Object.freeze({ role: p.role ?? null, standing: p.standing ?? null }))),
      instances: Object.freeze(instances.map((edge) => edge.id)),
      witnessRefs: Object.freeze(instances.map((edge) => edge.witness).filter(Boolean)),
      support: instances.length,
      counterInstances: Object.freeze([]),
      status: "provisional",
    }));
    ordinal += 1;
  }
  return Object.freeze(candidates);
}
