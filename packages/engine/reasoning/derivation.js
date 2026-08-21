import { normalizeEotTuple } from "./eot.js";
import { cellOf } from "../operators.js";

const freeze = (x) => Object.freeze(x);
const stable = (x) => typeof x === "string" ? x : JSON.stringify(x);
const keyOf = (t) => `${stable(t.subject)}\u0000${stable(t.predicate)}`;

const scalar = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(value).trim() !== "") return asNumber;
  const asDate = Date.parse(value);
  return Number.isNaN(asDate) ? null : asDate;
};

const disjoint = (a, b) => {
  const a0 = scalar(a?.start); const a1 = scalar(a?.end);
  const b0 = scalar(b?.start); const b1 = scalar(b?.end);
  if ([a0, a1, b0, b1].some((v) => v === null)) return false;
  return Math.min(a1, b1) < Math.max(a0, b0);
};

/**
 * Derive only propositions licensed by tuple structure itself, never by lexical
 * world knowledge. These are meta-propositions about the reading: plurality,
 * scope dependence, and query underspecification.
 */
export function deriveEotInsights(input = [], query = {}) {
  const tuples = input.map((t, i) => t?.cell ? t : normalizeEotTuple(t, i)).filter((t) => !t?.gap);
  const groups = new Map();
  for (const t of tuples.filter((t) => t.polarity > 0)) {
    const key = keyOf(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const derived = [];
  for (const group of groups.values()) {
    const objects = new Set(group.map((t) => stable(t.object)));
    if (objects.size < 2) continue;

    const pairs = [];
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      if (stable(group[i].object) === stable(group[j].object)) continue;
      pairs.push([group[i], group[j]]);
    }
    const scopedPairs = pairs.filter(([a, b]) => disjoint(a.scope, b.scope));
    if (!scopedPairs.length) continue;

    const subject = group[0].subject;
    const predicate = group[0].predicate;
    const witnesses = [...new Set(scopedPairs.flatMap(([a, b]) => [a.id, b.id]))];

    derived.push(freeze({
      id: `derived:${stable(subject)}:${stable(predicate)}:scope-dependent`,
      op: "EVA",
      grain: "Pattern",
      subject,
      predicate: `${predicate}::scope_dependence`,
      object: true,
      polarity: 1,
      dependsOn: freeze(witnesses),
      meta: freeze({
        derived: true,
        rule: "distinct positive objects for one relation occupy disjoint declared scopes",
        sourcePredicate: predicate,
        values: freeze(group.map((t) => freeze({ object: t.object, scope: t.scope, tupleId: t.id }))),
      }),
      cell: cellOf("EVA", "Pattern"),
    }));

    const queryMatches = (query.subject === undefined || stable(query.subject) === stable(subject))
      && (query.predicate === undefined || stable(query.predicate) === stable(predicate));
    const queryHasScope = query.scope && (query.scope.start != null || query.scope.end != null);
    if (queryMatches && !queryHasScope) {
      derived.push(freeze({
        id: `derived:${stable(subject)}:${stable(predicate)}:query-needs-scope`,
        op: "DEF",
        grain: "Figure",
        subject: freeze({ ...query }),
        predicate: "requires_scope",
        object: true,
        polarity: 1,
        dependsOn: freeze(witnesses),
        meta: freeze({
          derived: true,
          rule: "an unscoped singular relation query is under-specified when distinct values occupy disjoint scopes",
          sourceSubject: subject,
          sourcePredicate: predicate,
        }),
        cell: cellOf("DEF", "Figure"),
      }));
    }
  }

  return freeze(derived);
}

export function renderDerivedInsights(insights = []) {
  if (!insights.length) return "DERIVED INSIGHTS — none";
  return ["DERIVED INSIGHTS", ...insights.map((x) =>
    `  ${x.op} · ${x.cell.terrain} · ${x.cell.stance}  ${stable(x.subject)} —${x.predicate}→ ${stable(x.object)}\n    because ${x.meta.rule}`
  )].join("\n");
}
