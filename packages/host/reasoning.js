// Host wiring: take the reader's already-discovered, referent-canonicalised
// relations and expose them as EOT tuples for the reasoning kernel.
// No semantic classifier lives here: the source organ already declares
// CON · Figure; terrain/stance are derived downstream by the cube algebra.

import { resolveRelations } from "./graph.js";
import { reasonOverEot, renderEotReasoning } from "../engine/reasoning/eot.js";
import { falsificationEnvelopes } from "../engine/reasoning/falsification.js";

export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

export function sessionEot(session, { sourceId, priors = [] } = {}) {
  if (!session) throw new TypeError("sessionEot: session is required");
  const targets = sourceId ? [sourceId] : Array.from(session.documents?.keys?.() ?? []);
  const tuples = [];
  const gaps = [];

  for (const id of targets) {
    const resolved = resolveRelations(session, { sourceId: id, priors });
    gaps.push(...(resolved.gaps ?? []).map((gap) => ({ sourceId: id, ...gap })));
    for (let i = 0; i < (resolved.relations ?? []).length; i += 1) {
      const relation = resolved.relations[i];
      tuples.push(Object.freeze({
        id: `eot:${id}:${relation.offset ?? i}`,
        op: "CON",
        grain: "Figure",
        subject: relation.subject,
        predicate: relation.verb,
        object: relation.object,
        polarity: relation.polarity,
        source: id,
        witness: Object.freeze({
          sourceId: id,
          offset: relation.offset ?? null,
          subjectOffset: relation.subjectOffset ?? null,
          objectOffset: relation.objectOffset ?? null,
        }),
        meta: Object.freeze({ origin: "packages/host/graph.js::resolveRelations" }),
      }));
    }
  }

  return Object.freeze({ tuples: Object.freeze(tuples), gaps: Object.freeze(gaps) });
}

export function reasonSession(session, { sourceId, priors = [], query = {} } = {}) {
  const live = sessionEot(session, { sourceId, priors });
  const reasoning = reasonOverEot(live.tuples, query);
  const envelopes = falsificationEnvelopes(reasoning.tuples);
  return Object.freeze({
    sourceId: sourceId ?? null,
    eot: live.tuples,
    extractionGaps: live.gaps,
    reasoning,
    falsification: envelopes,
  });
}

export function renderSessionReasoning(result) {
  const lines = [renderEotReasoning(result.reasoning)];
  if (result.falsification?.length) {
    lines.push("", "FALSIFICATION ENVELOPES");
    for (const envelope of result.falsification) {
      lines.push(`  ${envelope.tupleId} · ${envelope.cell.terrain}`);
      lines.push(`    ${envelope.attack}`);
    }
  }
  if (result.extractionGaps?.length) {
    lines.push("", `EXTRACTION GAPS ${result.extractionGaps.length}`);
  }
  return lines.join("\n");
}
