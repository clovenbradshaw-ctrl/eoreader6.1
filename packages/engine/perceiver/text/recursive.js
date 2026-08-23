import { tokenize, buildFrequencyTable, functionWordSet } from "./material.js";
import { splitSentences } from "./spans.js";
import { extractSurfaces, discoverReferents, diaNorm } from "./surfaces.js";
import { discoverRelationVocab, extractRelations } from "./relations.js";
import { hyperedge } from "../../hypergraph/index.js";

const slug = (value) => diaNorm(value).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

function surfaceMap(events = []) {
  const map = new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    map.set(diaNorm(event.surface), event.referent_id);
  }
  return map;
}

function resolveParticipant(surface, map, sequencePosition, role) {
  const exact = map.get(diaNorm(surface));
  if (exact) return { ref: exact, role, standing: "referent" };
  return {
    ref: `surface:${slug(surface) || "unknown"}`,
    role,
    standing: "unresolved_surface",
    occurrence: `occ:${sequencePosition}:${role}`,
    surface,
  };
}

/**
 * A causal text organ for createRecursiveReader.
 *
 * It recomputes candidate referents and relation vocabulary from material that
 * has already been encountered. The current sentence can supply witness for a
 * relation, but cannot teach the vocabulary used to perceive that same
 * relation. This deliberately trades recall for authored-order honesty.
 */
export function createCausalTextPerceiver({ minRelationSurfaces = 2 } = {}) {
  const priorSentences = [];
  let priorText = "";

  return Object.freeze({
    id: "text/recursive",
    async perceive(encounter) {
      if (encounter?.modality !== "text" || typeof encounter.material !== "string") return [];
      const sequencePosition = encounter.sequencePosition ?? priorSentences.length;

      const priorWords = tokenize(priorText);
      const table = buildFrequencyTable(priorWords);
      const closed = priorWords.length ? functionWordSet(table) : new Set();
      const surfaces = extractSurfaces(priorSentences, { functionWords: closed });
      const { events: referentEvents, gaps: referentGaps } = discoverReferents(surfaces);
      const refs = surfaceMap(referentEvents);
      const relationVocab = discoverRelationVocab(priorText, {
        surfaces,
        functionWords: closed,
        minSurfaces: minRelationSurfaces,
      }).verbs;

      const relations = extractRelations(encounter.material, { verbs: relationVocab, functionWords: closed });
      const hyperedges = relations.map((rel, index) => hyperedge({
        id: `edge:text:${sequencePosition}:${index}`,
        relation: rel.verb,
        participants: [
          resolveParticipant(rel.subject, refs, sequencePosition, "subject"),
          resolveParticipant(rel.object, refs, sequencePosition, "object"),
        ],
        witness: `text:${sequencePosition}:${rel.offset}`,
        scope: { sequencePosition, offset: rel.offset },
        eo: { op: "CON", grain: "Figure" },
        meta: { polarity: rel.polarity, source: encounter.source },
      }));

      const currentSentence = { text: encounter.material, offset: encounter.anchor?.start ?? 0, order: priorSentences.length };
      priorSentences.push(currentSentence);
      priorText += `${priorText ? "\n" : ""}${encounter.material}`;

      if (hyperedges.length === 0) return [];
      return [{
        candidate: {
          distinctions: hyperedges.map((edge) => ({ relation: edge.relation, participants: edge.participants })),
          hyperedges,
          graphEntries: referentGaps.map((gap, i) => ({ schema: "EOReferentGap@1", id: `gap:referent:${sequencePosition}:${i}`, ...gap })),
        },
        anchor: encounter.anchor,
        evidence: encounter.material,
        nominationCause: "bottom_up_difference",
      }];
    },
  });
}

/** Turn contiguous text into authored-order sentence Encounters. */
export function textEncounters(text, { source = "text", offset = 0 } = {}) {
  return splitSentences(text).map((sentence) => ({
    schema: "Encounter@1",
    source,
    modality: "text",
    anchor: { start: offset + sentence.offset, end: offset + sentence.offset + sentence.text.length },
    extent: sentence.text.length,
    material: sentence.text,
    sequencePosition: sentence.order,
  }));
}
