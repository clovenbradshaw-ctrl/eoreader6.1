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

export function eoOperation({ op, grain, witness = null, consequence = null, payload = null }) {
  const cell = cellOf(op, grain);
  if (cell.gap) throw new TypeError(cell.reason);
  return Object.freeze({
    schema: "EOOperation@1",
    mode: cell.mode,
    domain: cell.domain,
    grain: cell.grain,
    operator: cell.op,
    terrain: cell.terrain,
    stance: cell.stance,
    witness,
    consequence,
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

function applyPayload(fold, operation) {
  const payload = operation.payload ?? {};
  switch (payload.action) {
    case "witness":
      fold.witnessed = upsertById(fold.witnessed, payload.value);
      break;
    case "provisional":
      fold.provisional = upsertById(fold.provisional, payload.value);
      break;
    case "expectation": {
      const value = payload.value ?? {};
      if (value.state && !STATES.has(value.state)) throw new TypeError(`unknown expectation state: ${value.state}`);
      fold.expectations = upsertById(fold.expectations, value);
      break;
    }
    case "obligation":
      fold.obligations = upsertById(fold.obligations, payload.value);
      break;
    case "exclusion":
      fold.exclusions = upsertById(fold.exclusions, payload.value);
      break;
    case "alternative":
      fold.unresolvedAlternatives = upsertById(fold.unresolvedAlternatives, payload.value);
      break;
    case "frame":
      fold.activeFrames = upsertById(fold.activeFrames, payload.value);
      break;
    case "prior":
      fold.receivedPriors = upsertById(fold.receivedPriors, payload.value);
      break;
    case "resolve-obligation":
      fold.obligations = fold.obligations.map((item) => item?.id === payload.id
        ? { ...item, status: payload.status ?? "resolved", resolvedAt: fold.sequence + 1 }
        : item);
      break;
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
  for (const operation of delta.operations ?? []) {
    if (operation?.schema !== "EOOperation@1") throw new TypeError("DeltaFold contains a non-EO operation");
    applyPayload(next, operation);
  }
  const ref = delta.id ?? `delta:${next.sequence}`;
  next.transformationHistoryRefs = [...(next.transformationHistoryRefs ?? []), ref];
  return next;
}

/**
 * Reconstruct current Fold from append-only entries. Fold snapshots are rejected
 * so history cannot silently become serialized state.
 */
export function reconstruct(entries = [], seed = {}) {
  let fold = receivedGround(seed);
  for (const entry of entries) {
    if (entry?.schema === "EOFold@1") throw new TypeError("Fold snapshots are not append-log events");
    if (entry?.schema === "Observation@1") {
      fold.witnessed = upsertById(fold.witnessed, entry);
      continue;
    }
    if (entry?.schema === "DeltaFold@1") fold = applyDelta(fold, entry);
  }
  return fold;
}
