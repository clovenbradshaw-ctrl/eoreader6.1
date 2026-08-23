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

function referentObjects(events = []) {
  const byId = new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    if (!byId.has(event.referent_id)) byId.set(event.referent_id, { schema: "EOReferent@1", id: event.referent_id, surfaces: [], provenance: [] });
    const ref = byId.get(event.referent_id);
    if (!ref.surfaces.includes(event.surface)) ref.surfaces.push(event.surface);
    ref.provenance.push(event.provenance);
  }
  return [...byId.values()].map((value) => Object.freeze({ ...value, surfaces: Object.freeze(value.surfaces), provenance: Object.freeze(value.provenance) }));
}

function currentReferents(text, refs = []) {
  const lowered = diaNorm(text);
  return refs.filter((ref) => ref.surfaces.some((surface) => {
    const s = diaNorm(surface);
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u").test(lowered);
  }));
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
 * Causal text organ for createRecursiveReader.
 *
 * Candidate vocabulary is refreshed from the prefix only. The current sentence
 * never contributes to the referent/relation model used to perceive itself.
 * refreshEvery is an efficiency aperture, not a look-ahead: larger values only
 * delay what the reader can notice; they can never expose future material.
 */
export function createCausalTextPerceiver({ minRelationSurfaces = 2, refreshEvery = 25 } = {}) {
  if (!Number.isInteger(refreshEvery) || refreshEvery < 1) throw new TypeError("refreshEvery must be a positive integer");
  const priorSentences = [];
  let priorText = "";
  let cache = { closed: new Set(), refs: new Map(), referents: [], gaps: [], verbs: new Set() };

  const refresh = () => {
    const priorWords = tokenize(priorText);
    const table = buildFrequencyTable(priorWords);
    const closed = priorWords.length ? functionWordSet(table) : new Set();
    const surfaces = extractSurfaces(priorSentences, { functionWords: closed });
    const discovered = discoverReferents(surfaces);
    cache = {
      closed,
      refs: surfaceMap(discovered.events),
      referents: referentObjects(discovered.events),
      gaps: discovered.gaps,
      verbs: discoverRelationVocab(priorText, {
        surfaces,
        functionWords: closed,
        minSurfaces: minRelationSurfaces,
      }).verbs,
    };
  };

  return Object.freeze({
    id: "text/recursive",
    async perceive(encounter) {
      if (encounter?.modality !== "text" || typeof encounter.material !== "string") return [];
      const sequencePosition = encounter.sequencePosition ?? priorSentences.length;
      if (priorSentences.length === 0 || priorSentences.length % refreshEvery === 0) refresh();

      const relations = extractRelations(encounter.material, { verbs: cache.verbs, functionWords: cache.closed });
      const edges = relations.map((rel, index) => hyperedge({
        id: `edge:text:${sequencePosition}:${index}`,
        relation: rel.verb,
        participants: [
          resolveParticipant(rel.subject, cache.refs, sequencePosition, "subject"),
          resolveParticipant(rel.object, cache.refs, sequencePosition, "object"),
        ],
        witness: `text:${sequencePosition}:${rel.offset}`,
        scope: { sequencePosition, offset: rel.offset },
        eo: { op: "CON", grain: "Figure" },
        meta: { polarity: rel.polarity, source: encounter.source },
      }));
      const seenReferents = currentReferents(encounter.material, cache.referents);
      const gaps = cache.gaps.map((gap, i) => ({ schema: "EOReferentGap@1", id: `gap:referent:${sequencePosition}:${i}`, ...gap }));

      const currentSentence = { text: encounter.material, offset: encounter.anchor?.start ?? 0, order: priorSentences.length };
      priorSentences.push(currentSentence);
      priorText += `${priorText ? "\n" : ""}${encounter.material}`;

      if (edges.length === 0 && seenReferents.length === 0) return [];
      return [{
        candidate: {
          distinctions: [
            ...seenReferents.map((ref) => ({ referent: ref.id, surfaces: ref.surfaces })),
            ...edges.map((edge) => ({ relation: edge.relation, participants: edge.participants })),
          ],
          hyperedges: edges,
          graphEntries: [...seenReferents, ...gaps],
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
