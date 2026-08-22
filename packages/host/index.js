// eoreader6 · packages/host — the host face of the engine.
// Thin by the constitution: session, I/O, and the reader's own surfaces.
export {
  createSession,
  admitChunked,
  ingestFile,
  searchSpans,
  spanUnits,
  foldSpans,
  readSpan,
  documentIds,
  documentText,
  sessionSegments,
  sessionOutline,
  snipSegment,
  sessionReferents,
  sessionRelations,
  CORPUS_API_VERSION,
} from "./corpus.js";

export { executePrompt } from "./surfer.js";
export { createSinger, singPass, singRun, apertureSeries, sing } from "./sing.js";
export { attachGraph, admitGraph, resolveRelations, sessionGraphSnapshot, createGraph, readTriples, injectPrior, strongestEdges, edgeKey, structuralKey } from "./graph.js";
export { attachTiers, admitTiers, sessionTiersSnapshot } from "./tiers.js";
export { attachSelf, admitSelf, sessionSelfSnapshot, sessionTestimonyHolarchy, SELF, SELF_MISMATCH, WORLD } from "./self.js";

// Canonical whole-admission entrypoint retained for compatibility. New blind
// reading work should prefer the experience-stream transition below.
export { admitReading, READING_PIPELINE_SCHEMA, READING_ASSEMBLIES } from "./reading.js";
export { readExperienceStream, textExperienceStream, EXPERIENCE_TRAJECTORY_SCHEMA } from "./experience-stream.js";

export { sessionTerrains, sessionKinds, kindsNullArm, foldExtract, TERRAIN_GRID } from "./terrains.js";
export { sessionEot, reasonSession, renderSessionReasoning } from "./reasoning.js";
export { retrievalTask, iterateReasonSession, renderAdversarialRun } from "./adversarial-reasoning.js";
export { adversariallyResolveAssertions } from "./assertion-resolution.js";

// HL is named in full at the API boundary while preserving the historical HL
// name as an explicit canonical identity.
export {
  HL,
  HL_SCHEMA,
  pairKey as hyperlexiconPairKey,
  createHyperlexicon,
  normalizeHyperlexicon,
  compositionAffordance,
  admitHyperlexiconCandidates,
  giveHyperlexiconAffordance,
} from "../engine/reasoning/hyperlexicon.js";
