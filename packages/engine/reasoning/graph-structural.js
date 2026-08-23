import { buildHypergraph } from "../hypergraph/index.js";
import { discoverPatternCandidates } from "../patterns/index.js";
import { deltaFold, eoOperation } from "../fold/index.js";
import { obligation, openObligation } from "../obligations/index.js";

const allObservationEntries = (observations = []) => observations.flatMap((obs) => [
  obs,
  ...(obs.hyperedges ?? []),
  ...(obs.graphEntries ?? []),
]);

function existingIds(fold) {
  return new Set((fold?.graphEntries ?? []).map((entry) => entry?.id).filter(Boolean));
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
    ops.push(openObligation(value, { witness: group.filter((item) => newEdgeIds.has(item.edge.id)).map((item) => item.edge.witness).filter(Boolean), grain: "Figure", op: "DEF" }));
  }
  return ops;
}

function patternOperations(fold, graph, newEdgeIds, { minPatternInstances = 3 } = {}) {
  const known = existingIds(fold);
  const operations = [];
  for (const pattern of discoverPatternCandidates(graph.entries, { minInstances: minPatternInstances })) {
    if (!pattern.instances.some((id) => newEdgeIds.has(id))) continue;
    if (known.has(pattern.id)) continue;
    operations.push(eoOperation({
      op: "SYN",
      grain: "Pattern",
      witness: pattern.witnessRefs,
      consequence: { kind: "structural_recurrence", pattern: pattern.id, support: pattern.support },
      inputs: pattern.instances,
      outputs: [pattern.id],
      payload: { action: "graph-object", value: pattern },
    }));
  }
  return operations;
}

/**
 * Mechanical Fold revision from explicit hypergraph structure only.
 * No lexical semantics, narrator guessing, or domain ontology is introduced.
 */
export function deriveGraphStructuralDelta(fold, observations = [], options = {}) {
  const additions = allObservationEntries(observations);
  const graph = buildHypergraph([...(fold?.graphEntries ?? []), ...additions]);
  const newEdgeIds = new Set(observations.flatMap((obs) => (obs.hyperedges ?? []).map((edge) => edge.id)));
  const operations = [
    ...ambiguityObligations(fold, observations),
    ...competingValueObligations(fold, graph, newEdgeIds),
    ...patternOperations(fold, graph, newEdgeIds, options),
  ];
  return deltaFold(operations, options.id ? { id: options.id } : {});
}
