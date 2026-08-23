import { eoOperation } from "../fold/index.js";

export function obligation({ id, distinction, grounds = [], alternatives = [], consequences = [], openedAt = null, persistence = 0, status = "open" }) {
  return Object.freeze({ id, distinction, grounds, alternatives, consequences, openedAt, persistence, status });
}

export function openObligation(value, { witness, grain = "Figure", op = "DEF" } = {}) {
  return eoOperation({
    op,
    grain,
    witness,
    consequence: value.consequences ?? null,
    payload: { action: "obligation", value: { ...value, status: value.status ?? "open" } },
  });
}

export function resolveObligation(id, { witness, status = "resolved", grain = "Figure", op = "DEF", consequence = null } = {}) {
  return eoOperation({
    op,
    grain,
    witness,
    consequence,
    payload: { action: "resolve-obligation", id, status },
  });
}

/** Persistence is derived at read time; silence does not close an obligation. */
export function carryObligations(fold) {
  return (fold?.obligations ?? []).map((item) => ["resolved", "closed", "superseded"].includes(item.status)
    ? item
    : { ...item, persistence: (item.persistence ?? 0) + 1 });
}
