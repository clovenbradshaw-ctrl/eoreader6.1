const OPEN = new Set([undefined, null, "open", "strengthened", "weakened"]);

export function deriveSurprise(delta) {
  const operations = (delta?.operations ?? []).filter((operation) => operation.operator !== "NUL");
  const affectedAddresses = [...new Set(operations.map((o) => `${o.mode}/${o.domain}/${o.grain}`))];
  return Object.freeze({
    schema: "SurpriseProfile@1",
    operations,
    affectedAddresses,
    downstreamConsequences: operations.flatMap((o) => o.consequence == null ? [] : [o.consequence]),
    recanonicalizations: operations.filter((o) => o.operator === "REC"),
    expectationEffects: operations.filter((o) => o.payload?.action === "expectation"),
    obligationEffects: operations.filter((o) => ["obligation", "resolve-obligation"].includes(o.payload?.action)),
  });
}

export function deriveTension(fold) {
  const obligations = (fold?.obligations ?? []).filter((o) => OPEN.has(o.status));
  const interactionNetwork = [];
  for (let i = 0; i < obligations.length; i += 1) {
    for (let j = i + 1; j < obligations.length; j += 1) {
      const a = obligations[i];
      const b = obligations[j];
      const ar = new Set([...(a.grounds ?? []), ...(a.alternatives ?? [])].map(String));
      const shared = [...(b.grounds ?? []), ...(b.alternatives ?? [])].map(String).filter((x) => ar.has(x));
      if (shared.length) interactionNetwork.push({ from: a.id, to: b.id, shared });
    }
  }
  return Object.freeze({
    schema: "TensionProfile@1",
    obligations,
    interactionNetwork,
    persistence: obligations.map((o) => ({ id: o.id, value: o.persistence ?? 0 })),
    consequences: obligations.map((o) => ({ id: o.id, value: o.consequences ?? [] })),
  });
}

export function deriveRelease(delta, beforeFold, afterFold) {
  const before = new Map((beforeFold?.obligations ?? []).map((o) => [o.id, o]));
  const releases = [];
  for (const after of afterFold?.obligations ?? []) {
    const prior = before.get(after.id);
    if (!prior || prior.status === after.status || OPEN.has(after.status)) continue;
    const transformation = (delta?.operations ?? []).filter((op) => op.payload?.id === after.id || op.payload?.value?.id === after.id);
    if (!transformation.length) continue;
    releases.push({ schema: "Release@1", obligation: after.id, before: prior, transformation, after, witness: transformation.map((op) => op.witness).filter(Boolean) });
  }
  return releases;
}
