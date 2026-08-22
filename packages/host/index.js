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

// Canonical whole-admission entrypoint retained for compatibility. Constitutive
// blind reading has one stateful experience-stream pipeline.
export { admitReading, READING_PIPELINE_SCHEMA, READING_ASSEMBLIES } from "./reading.js";
export {
  openExperienceReading,
  advanceReading,
  readExperienceStream,
  textExperienceStream,
  EXPERIENCE_READING_STATE_SCHEMA,
  EXPERIENCE_TRAJECTORY_SCHEMA,
} from "./experience-stream.js";

// Book-scale reading layers recursive work over the same one-event causal
// transition. It never replaces the reader with a batch second pass.
export {
  openBookReading,
  advanceBookReading,
  executeReadingTask,
  readBook,
  BOOK_READING_SCHEMA,
} from "./book-reading.js";
export {
  createReadingTaskLedger,
  advanceReadingTasks,
  closeReadingTask,
  READING_TASK_LEDGER_SCHEMA,
} from "./reading-tasks.js";

// Open structure is omnimodal Fold state. These surfaces parse no language:
// modality-specific perceivers/emergence organs supply unresolved structure;
// the frontier carries it, and tension/release are derived from that ledger.
export { createOpenFrontier, advanceFrontier, FRONTIER_SCHEMA } from "./frontier.js";
export { frontierFromSurf } from "./frontier-surf.js";

export { sessionTerrains, sessionKinds, kindsNullArm, foldExtract, TERRAIN_GRID } from "./terrains.js";
export { sessionEot, reasonSession, renderSessionReasoning } from "./reasoning.js";
export { retrievalTask, iterateReasonSession, renderAdversarialRun } from "./adversarial-reasoning.js";
export { adversariallyResolveAssertions } from "./assertion-resolution.js";

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
