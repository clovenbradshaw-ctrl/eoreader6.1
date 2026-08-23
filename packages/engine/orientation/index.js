export function deriveOrientation(fold = {}) {
  const openExpectations = (fold.expectations ?? []).filter((e) => ["open", "strengthened", "weakened"].includes(e.state ?? "open"));
  const openObligations = (fold.obligations ?? []).filter((o) => !["resolved", "closed", "superseded"].includes(o.status));
  return Object.freeze({
    schema: "EOOrientation@1",
    activeReferents: Object.freeze([...(fold.activeReferents ?? [])]),
    activeKinds: Object.freeze([...(fold.activeKinds ?? [])]),
    activeLinks: Object.freeze([...(fold.activeLinks ?? [])]),
    openAlternatives: Object.freeze([...(fold.unresolvedAlternatives ?? [])]),
    unresolvedObligations: Object.freeze(openObligations),
    activeExpectations: Object.freeze(openExpectations),
    relevantPatterns: Object.freeze([...(fold.relevantPatterns ?? [])]),
    activeFrames: Object.freeze([...(fold.activeFrames ?? [])]),
    receivedPriors: Object.freeze([...(fold.receivedPriors ?? [])]),
    consequenceBearingQuestions: Object.freeze(openObligations.map((o) => ({
      obligationId: o.id,
      distinction: o.distinction,
      consequences: o.consequences ?? [],
    }))),
  });
}
