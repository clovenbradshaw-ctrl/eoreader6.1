import { cellOf } from "../operators.js";

const STATES = new Set(["open", "strengthened", "weakened", "fulfilled", "violated", "reframed", "superseded"]);
const emptyClasses = () => ({
  witnessed: [],
  provisional: [],
  expectations: [],
  obligations: [],
  exclusions: [],
  unresolvedAlternatives: [],
  activeFrames: [],
  receivedPriors: [],
  graphEntries: [],
  transformationObjects: [],
  transformationHistoryRefs: [],
});

const clone = (value) => value == null ? value : structuredClone(value);

export function receivedGround(seed = {}) {
  return {
    schema: "EOFold@1",
    sequence: 0,
    ...emptyClasses(),
    ...clone(seed),
  };
}

export function eoOperation({ id = null, op, grain, witness = null, consequence = null, inputs = [], outputs = [], payload = null }) {
  const cell = cellOf(op, grain);
  if (cell.gap) throw new TypeError(cell.reason);
  if (op === "NUL" && payload?.action) {
    throw new TypeError("NUL records no transformation and cannot carry a mutating payload");
  }
  return Object.freeze({
    schema: "EOOperation@1",
    id,
    mode: cell.mode,
    domain: cell.domain,
    grain: cell.grain,
    operator: cell.op,
    terrain: cell.terrain,
    stance: cell.stance,
    witness,
    consequence,
    inputs: Object.freeze([...inputs]),
    outputs: Object.freeze([...outputs]),
    payload,
  });
}

export function deltaFold(operations = [], meta = {}) {
  return Object.freeze({
    schema: "DeltaFold@1",
    operations: Object.freeze([...operations]),
    ...meta,
  });
}

function upsertById(list, value) {
  const next = [...list];
  const i = value?.id == null ? -1 : next.findIndex((item) => item?.id === value.id);
  if (i >= 0) next[i] = { ...next[i], ...clone(value) };
  else next.push(clone(value));
  return next;
}

function removeById(list, id) {
  return id == null ? [...list] : list.filter((item) => item?.id !== id);
}

function addGraphEntry(fold, value) {
  if (!value?.id || !value?.schema) return;
  fold.graphEntries = upsertById(fold.graphEntries ?? [], value);
}

/** Admit a witnessed observation into a reconstructed Fold without pretending it is a transformation. */
export function applyObservation(fold, observation) {
  if (observation?.schema !== "Observation@1") throw new TypeError("applyObservation requires Observation@1");
  const next = clone(fold ?? receivedGround());
  next.witnessed = upsertById(next.witnessed ?? [], observation);
  addGraphEntry(next, observation);
  for (const edge of observation.hyperedges ?? []) addGraphEntry(next, edge);
  for (const entry of observation.graphEntries ?? []) addGraphEntry(next, entry);
  return next;
}

function applyPayload(fold, operation) {
  if (operation.operator === "NUL") return;
  const payload = operation.payload ?? {};
  switch (payload.action) {
    case "provisional":
      fold.provisional = upsertById(fold.provisional, payload.value);
      addGraphEntry(fold, payload.value);
      break;
    case "expectation": {
      const value = payload.value ?? {};
      if (value.state && !STATES.has(value.state)) throw new TypeError(`unknown expectation state: ${value.state}`);
      fold.expectations = upsertById(fold.expectations, value);
      addGraphEntry(fold, value);
      break;
    }
    case "obligation":
      fold.obligations = upsertById(fold.obligations, payload.value);
      addGraphEntry(fold, payload.value);
      break;
    case "exclusion":
      fold.exclusions = upsertById(fold.exclusions, payload.value);
      addGraphEntry(fold, payload.value);
      break;
    case "alternative":
      fold.unresolvedAlternatives = upsertById(fold.unresolvedAlternatives, payload.value);
      addGraphEntry(fold, payload.value);
      break;
    case "frame":
      fold.activeFrames = upsertById(fold.activeFrames, payload.value);
      addGraphEntry(fold, payload.value);
      break;
    case "prior":
      fold.receivedPriors = upsertById(fold.receivedPriors, payload.value);
      break;
    case "hyperedge":
      addGraphEntry(fold, payload.value);
      break;
    case "graph-object":
      addGraphEntry(fold, payload.value);
      break;
    case "resolve-obligation": {
      const existing = fold.obligations.find((item) => item?.id === payload.id);
      const revised = existing ? { ...existing, status: payload.status ?? "resolved", resolvedAt: fold.sequence + 1, resolutionRefs: [...(existing.resolutionRefs ?? []), operation.id].filter(Boolean) } : null;
      if (revised) {
        fold.obligations = upsertById(fold.obligations, revised);
        addGraphEntry(fold, revised);
      }
      break;
    }
    case "remove-provisional":
      fold.provisional = removeById(fold.provisional, payload.id);
      break;
    default:
      break;
  }
}

/** Apply only a DeltaFold. The Fold is a reconstruction, never a historical event. */
export function applyDelta(fold, delta) {
  if (delta?.schema !== "DeltaFold@1") throw new TypeError("applyDelta requires DeltaFold@1");
  const next = clone(fold ?? receivedGround());
  next.sequence = (next.sequence ?? 0) + 1;
  let opIndex = 0;
  for (const rawOperation of delta.operations ?? []) {
    if (rawOperation?.schema !== "EOOperation@1") throw new TypeError("DeltaFold contains a non-EO operation");
    if (rawOperation.operator === "NUL" && rawOperation.payload?.action) throw new TypeError("NUL cannot mutate Fold state");
    const operation = rawOperation.id ? rawOperation : { ...rawOperation, id: `${delta.id ?? `delta:${next.sequence}`}:op:${opIndex}` };
    opIndex += 1;
    applyPayload(next, operation);
    next.transformationObjects = upsertById(next.transformationObjects ?? [], operation);
    addGraphEntry(next, operation);
  }
  const ref = delta.id ?? `delta:${next.sequence}`;
  next.transformationHistoryRefs = [...(next.transformationHistoryRefs ?? []), ref];
  return next;
}

/** Reconstruct current Fold from append-only evidence and transformations. */
export function reconstruct(entries = [], seed = {}) {
  let fold = receivedGround(seed);
  for (const entry of entries) {
    if (entry?.schema === "EOFold@1") throw new TypeError("Fold snapshots are not append-log events");
    if (entry?.schema === "Observation@1") {
      fold = applyObservation(fold, entry);
      continue;
    }
    if (entry?.schema === "EOHyperedge@1") {
      const next = clone(fold);
      addGraphEntry(next, entry);
      fold = next;
      continue;
    }
    if (entry?.schema === "DeltaFold@1") fold = applyDelta(fold, entry);
  }
  return fold;
}