import { buildHypergraph } from "../hypergraph/index.js";
import { discoverPatternCandidates } from "../patterns/index.js";
import { deltaFold, eoOperation } from "../fold/index.js";
import { obligation, openObligation } from "../obligations/index.js";

const allObservationEntries = (observations = []) => observations.flatMap((obs) => [
  obs,
  ...(obs.hyperedges ?? []),
  ...(obs.graphEntries ?? []),
]);

function existingEntries(fold) {
  return new Map((fold?.graphEntries ?? []).map((entry) => [entry?.id, entry]).filter(([id]) => Boolean(id)));
}

function existingObligationIds(fold) {
  return new Set((fold?.obligations ?? []).map((entry) => entry?.id).filter(Boolean));
}

function ambiguityObligations(fold, observations) {
  const open = existingObligationIds(fold);
  const ops = [];
  for (const observation of observations) {
    for (const edge of observation.hyperedges ?? []) {
      for (const participant of edge.participants ?? []) {
        const alternatives = [...new Set(participant.candidateReferents ?? [])];
        if (alternatives.length < 2) continue;
        const id = `obligation:identity:${edge.id}:${participant.role ?? "participant"}`;
        if (open.has(id)) continue;
        open.add(id);
        const value = obligation({
          id,
          distinction: { edge: edge.id, role: participant.role, occurrence: participant.ref },
          grounds: [edge.id, observation.id],
          alternatives,
          consequences: [{ kind: "relation_attribution", edge: edge.id }],
          openedAt: (fold?.sequence ?? 0) + 1,
          persistence: 0,
        });
        ops.push(openObligation(value, { witness: observation.id, grain: "Figure", op: "DEF" }));
      }
    }
  }
  return ops;
}

/**
 * A repeated unresolved surface in consequence-bearing relation positions is
 * itself an unresolved Fold structure. This does NOT assert that its
 * occurrences corefer. It opens the question of whether/how their scopes and
 * referents relate, preserving the occurrences as alternatives to be resolved
 * or segmented later.
 */
function persistentUnresolvedObligations(fold, graph, newEdgeIds, { minUnresolvedRecurrence = 3 } = {}) {
  const open = existingObligationIds(fold);
  const groups = new Map();
  for (const edge of graph.entries ?? []) {
    if (edge?.schema !== "EOHyperedge@1") continue;
    for (const participant of edge.participants ?? []) {
      if (participant.standing !== "unresolved_surface" || !participant.surfaceKey) continue;
      if (!groups.has(participant.surfaceKey)) groups.set(participant.surfaceKey, []);
      groups.get(participant.surfaceKey).push({ edge, participant });
    }
  }

  const ops = [];
  for (const [surfaceKey, instances] of groups) {
    const uniqueEdges = [...new Map(instances.map((item) => [item.edge.id, item.edge])).values()];
    if (uniqueEdges.length < minUnresolvedRecurrence) continue;
    if (!uniqueEdges.some((edge) => newEdgeIds.has(edge.id))) continue;
    const id = `obligation:unresolved:${surfaceKey}`;
    if (open.has(id)) continue;
    open.add(id);
    const alternatives = [...new Set(instances.flatMap((item) => item.participant.candidateReferents ?? []))];
    const value = obligation({
      id,
      distinction: {
        surfaceKey,
        occurrences: instances.map((item) => item.participant.ref),
        addressedRelationPositions: instances.map((item) => ({ edge: item.edge.id, role: item.participant.role })),
      },
      grounds: uniqueEdges.map((edge) => edge.id),
      alternatives,
      consequences: uniqueEdges.map((edge) => ({ kind: "relation_attribution", edge: edge.id })),
      openedAt: (fold?.sequence ?? 0) + 1,
      persistence: 0,
    });
    ops.push(openObligation(value, {
      witness: uniqueEdges.map((edge) => edge.witness).filter(Boolean),
      grain: "Pattern",
      op: "DEF",
    }));
  }
  return ops;
}

function competingValueObligations(fold, graph, newEdgeIds) {
  const open = existingObligationIds(fold);
  const groups = new Map();
  for (const edge of graph.entries ?? []) {
    if (edge?.schema !== "EOHyperedge@1") continue;
    const subject = (edge.participants ?? []).find((p) => p.role === "subject" && p.standing === "referent");
    const object = (edge.participants ?? []).find((p) => p.role === "object" && p.standing === "referent");
    if (!subject || !object) continue;
    const key = `${subject.ref}\u0000${edge.relation}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ edge, subject: subject.ref, object: object.ref });
  }

  const ops = [];
  for (const group of groups.values()) {
    if (!group.some((item) => newEdgeIds.has(item.edge.id))) continue;
    const values = [...new Set(group.map((item) => item.object))];
    if (values.length < 2) continue;
    const first = group[0];
    const id = `obligation:multiplicity:${first.subject}:${first.edge.relation}`;
    if (open.has(id)) continue;
    open.add(id);
    const value = obligation({
      id,
      distinction: { subject: first.subject, relation: first.edge.relation },
      grounds: group.map((item) => item.edge.id),
      alternatives: values,
      consequences: [{ kind: "relation_scope_or_multiplicity", relation: first.edge.relation }],
      openedAt: (fold?.sequence ?? 0) + 1,
      persistence: 0,
    });
    ops.push(openObligation(value, {
      witness: group.filter((item) => newEdgeIds.has(item.edge.id)).map((item) => item.edge.witness).filter(Boolean),
      grain: "Figure",
      op: "DEF",
    }));
  }
  return ops;
}

function patternOperations(fold, graph, newEdgeIds, { minPatternInstances = 3 } = {}) {
  const known = existingEntries(fold);
  const operations = [];
  for (const pattern of discoverPatternCandidates(graph.entries, { minInstances: minPatternInstances })) {
    if (!pattern.instances.some((id) => newEdgeIds.has(id))) continue;
    const prior = known.get(pattern.id);
    if (prior?.schema === "EOPatternCandidate@1" && (prior.support ?? 0) >= pattern.support) continue;
    operations.push(eoOperation({
      op: "SYN",
      grain: "Pattern",
      witness: pattern.witnessRefs,
      consequence: {
        kind: prior ? "structural_recurrence_strengthened" : "structural_recurrence",
        pattern: pattern.id,
        beforeSupport: prior?.support ?? 0,
        support: pattern.support,
      },
      inputs: pattern.instances,
      outputs: [pattern.id],
      payload: { action: "graph-object", value: pattern },
    }));
  }
  return operations;
}

/** Mechanical Fold revision from explicit hypergraph structure only. */
export function deriveGraphStructuralDelta(fold, observations = [], options = {}) {
  const newEdgeIds = new Set(observations.flatMap((obs) => (obs.hyperedges ?? []).map((edge) => edge.id)));
  if (newEdgeIds.size === 0) return deltaFold([], options.id ? { id: options.id } : {});
  const additions = allObservationEntries(observations);
  const graph = buildHypergraph([...(fold?.graphEntries ?? []), ...additions]);
  const operations = [
    ...ambiguityObligations(fold, observations),
    ...persistentUnresolvedObligations(fold, graph, newEdgeIds, options),
    ...competingValueObligations(fold, graph, newEdgeIds),
    ...patternOperations(fold, graph, newEdgeIds, options),
  ];
  return deltaFold(operations, options.id ? { id: options.id } : {});
}
