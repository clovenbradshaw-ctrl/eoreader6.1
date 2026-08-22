// Difference gate for recursive reading.
//
// A distinction earns deeper work only when its alternatives have a different
// consequence for the current reading. No scalar salience threshold is used.
// The gate names the structural consequence that changes under the
// counterfactual: ontology cardinality/canonicalisation, relation standing,
// frontier closure, or a derivation currently blocked by HL standing.

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stable = x => typeof x === 'string' ? x : JSON.stringify(x);

export const DIFFERENCE_GATE_SCHEMA = 'EODifferenceGate@1';

const participantValues = relation => (relation?.participants ?? []).flatMap(p => {
  const values = [p.value];
  if (p.value && typeof p.value === 'object' && Array.isArray(p.value.alternatives)) values.push(...p.value.alternatives);
  if (Array.isArray(p.alternatives)) values.push(...p.alternatives);
  return values.map(norm).filter(Boolean);
});

export function identityDifference(identity, recursive = {}) {
  const left = norm(identity?.left ?? identity?.descriptor);
  const right = norm(identity?.right ?? identity?.name);
  if (!left || !right || left === right) return freeze({ makesDifference: false, consequences: freeze([]) });

  const consequences = [];
  // Same-vs-distinct changes how many beings the Fold is entitled to carry.
  consequences.push(freeze({
    type: 'ontology_cardinality',
    alternatives: freeze([
      freeze({ standing: 'same_or_consistent', nodes: 1 }),
      freeze({ standing: 'distinct', nodes: 2 }),
    ]),
  }));

  for (const relation of recursive?.provisionalLinks ?? []) {
    const values = new Set(participantValues(relation));
    if (!values.has(left) && !values.has(right)) continue;
    consequences.push(freeze({
      type: 'relation_canonicalisation',
      relationId: relation.id,
      relation: relation.relation ?? relation.predicate ?? null,
      affectedValues: freeze([left, right]),
    }));
  }

  return freeze({
    schema: DIFFERENCE_GATE_SCHEMA,
    makesDifference: consequences.length > 0,
    consequences: freeze(consequences),
  });
}

export function frontierDifference(open) {
  if (!open) return freeze({ makesDifference: false, consequences: freeze([]) });
  const consequences = [];
  if (open.kind === 'unresolved_proposition') consequences.push(freeze({
    type: 'relation_standing',
    target: stable(open.subject),
    alternatives: freeze(['unresolved', 'resolved_or_refused']),
  }));
  if (open.kind === 'identity_alternative') consequences.push(freeze({
    type: 'ontology_standing',
    target: open.subject ?? open.id,
    alternatives: freeze(['live_alternative', 'resolved']),
  }));
  if (Number.isFinite(open.pressure) && open.pressure > 0) consequences.push(freeze({
    type: 'declared_structural_pressure',
    pressure: open.pressure,
    expectation: open.expectation ?? null,
  }));
  return freeze({
    schema: DIFFERENCE_GATE_SCHEMA,
    makesDifference: consequences.length > 0,
    consequences: freeze(consequences),
  });
}

export function hyperlexiconDifference(candidate, withheld = []) {
  const paths = withheld.filter(x => stable(x.leftPredicate) === stable(candidate?.left) && stable(x.rightPredicate) === stable(candidate?.right));
  const consequences = paths.map(x => freeze({
    type: 'blocked_derivation',
    bridge: x.bridge,
    from: x.from,
    to: x.to,
    tupleIds: freeze([...(x.tupleIds ?? [])]),
    currentStanding: x.standing,
  }));
  return freeze({
    schema: DIFFERENCE_GATE_SCHEMA,
    makesDifference: consequences.length > 0,
    consequences: freeze(consequences),
  });
}

const graphFromRelations = relations => {
  const adj = new Map();
  const connect = (a, b, relationId) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, relationId });
  };
  for (const relation of relations ?? []) {
    const values = [...new Set(participantValues(relation))];
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
      connect(values[i], values[j], relation.id);
      connect(values[j], values[i], relation.id);
    }
  }
  return adj;
};

const reachable = (adj, start, targets, bannedRelationId = null) => {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const at = queue.shift();
    if (targets.has(at)) return true;
    for (const edge of adj.get(at) ?? []) {
      if (edge.relationId === bannedRelationId || seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return false;
};

/**
 * Task-directed node hopping. A candidate relation is difference-making when
 * it participates in reachability from `from` to one of the task's structural
 * targets, and removing that relation destroys that reachability. This is a
 * counterfactual graph test, not edge weight or lexical similarity.
 */
export function differenceMakingHops({ relations = [], from, targets = [] } = {}) {
  const start = norm(from);
  const targetSet = new Set(targets.map(norm).filter(Boolean));
  if (!start || !targetSet.size) return freeze([]);
  const adj = graphFromRelations(relations);
  if (!reachable(adj, start, targetSet)) return freeze([]);

  const out = [];
  for (const edge of adj.get(start) ?? []) {
    if (reachable(adj, start, targetSet, edge.relationId)) continue;
    out.push(freeze({
      from: start,
      to: edge.to,
      relationId: edge.relationId,
      reason: 'removing this relation destroys reachability to a current consequence target',
    }));
  }
  return freeze(out);
}
