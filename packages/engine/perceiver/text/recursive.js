import { tokenize, buildFrequencyTable, functionWordSet } from "./material.js";
import { splitSentences } from "./spans.js";
import { extractSurfaces, discoverReferents, diaNorm } from "./surfaces.js";
import { discoverRelationVocab, extractRelations } from "./relations.js";
import { hyperedge } from "../../hypergraph/index.js";

const slug = (value) => diaNorm(value).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

function containsSurface(text, surface) {
  const hay = diaNorm(text);
  const needle = diaNorm(surface);
  if (!needle) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}([^\\p{L}\\p{N}]|$)`, "u").test(hay);
}

function currentReferents(text, refs = []) {
  return refs.filter((ref) => ref.surfaces.some((surface) => containsSurface(text, surface)));
}

function referentsInSpan(span, map) {
  const matches = new Map();
  for (const [surface, ref] of map) {
    if (containsSurface(span, surface)) {
      if (!matches.has(ref)) matches.set(ref, []);
      matches.get(ref).push(surface);
    }
  }
  return matches;
}

function resolveParticipant(surface, map, sequencePosition, relationIndex, role) {
  const exact = map.get(diaNorm(surface));
  if (exact) return { ref: exact, role, standing: "referent", surface, resolution: "exact_surface" };

  // Wider parser spans frequently contain a determiner, epithet, or title
  // around an already-earned referent ("dear Elizabeth", "my friend Clerval").
  // Bind only when every known surface inside the span converges on ONE
  // referent. Multiple candidate referents remain unresolved rather than
  // turning parser width into an identity decision.
  const candidates = referentsInSpan(surface, map);
  if (candidates.size === 1) {
    const [[ref, matchedSurfaces]] = candidates;
    return { ref, role, standing: "referent", surface, resolution: "unique_surface_in_span", matchedSurfaces };
  }

  const lexical = slug(surface) || "unknown";
  const occurrence = `occ:${sequencePosition}:${relationIndex}:${role}`;
  return {
    ref: occurrence,
    occurrence,
    surfaceKey: `surface:${lexical}`,
    role,
    standing: "unresolved_surface",
    surface,
    candidateReferents: [...candidates.keys()],
  };
}

function earnedClosedClass(table) {
  if (!table?.total || table.freq.size === 0) return new Set();
  const candidate = functionWordSet(table);
  return candidate.size * 2 < table.freq.size ? candidate : new Set();
}

function lexicalVerbVocabulary(result, minSurfaces, posPrior) {
  if (!posPrior) return result.verbs;
  const verbs = new Set();
  for (const candidate of result.candidates ?? []) {
    if (candidate.surfaces < minSurfaces) continue;
    const counts = candidate.upos;
    if (!counts) { verbs.add(candidate.verb); continue; }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const lexicalShare = total ? (counts.VERB ?? 0) / total : 0;
    if (lexicalShare > 0.5) verbs.add(candidate.verb);
  }
  return verbs;
}

export function createCausalTextPerceiver({ minRelationSurfaces = 2, refreshEvery = 25, posPrior = null } = {}) {
  if (!Number.isInteger(refreshEvery) || refreshEvery < 1) throw new TypeError("refreshEvery must be a positive integer");
  if (posPrior && (posPrior.schema !== "POSPrior@1" || !posPrior.provenance?.source)) throw new TypeError("posPrior must be a giver-named POSPrior@1");
  const priorSentences = [];
  let priorText = "";
  let cache = { closed: new Set(), refs: new Map(), referents: [], gaps: [], verbs: new Set() };

  const refresh = () => {
    const priorWords = tokenize(priorText);
    const table = buildFrequencyTable(priorWords);
    const closed = earnedClosedClass(table);
    const surfaces = extractSurfaces(priorSentences, { functionWords: closed });
    const discovered = discoverReferents(surfaces);
    const relationResult = discoverRelationVocab(priorText, { surfaces, functionWords: closed, minSurfaces: minRelationSurfaces, posPrior });
    cache = {
      closed,
      refs: surfaceMap(discovered.events),
      referents: referentObjects(discovered.events),
      gaps: discovered.gaps,
      verbs: lexicalVerbVocabulary(relationResult, minRelationSurfaces, posPrior),
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
          resolveParticipant(rel.subject, cache.refs, sequencePosition, index, "subject"),
          resolveParticipant(rel.object, cache.refs, sequencePosition, index, "object"),
        ],
        witness: `text:${sequencePosition}:${rel.offset}`,
        scope: { sequencePosition, offset: rel.offset },
        eo: { op: "CON", grain: "Figure" },
        meta: { polarity: rel.polarity, source: encounter.source },
      }));

      const seenReferents = currentReferents(encounter.material, cache.referents);
      const mentions = seenReferents.map((ref) => Object.freeze({
        schema: "EOMention@1",
        id: `mention:${sequencePosition}:${slug(ref.id)}`,
        referent: ref.id,
        anchor: encounter.anchor,
        witness: `text:${sequencePosition}`,
        source: encounter.source,
      }));
      const activeIds = new Set(seenReferents.map((ref) => ref.id));
      for (const edge of edges) for (const participant of edge.participants ?? []) if (participant.standing === "referent") activeIds.add(participant.ref);
      const gaps = cache.gaps
        .filter((gap) => activeIds.has(gap.referent))
        .map((gap) => ({ schema: "EOReferentGap@1", id: `gap:referent:${slug(gap.referent)}`, ...gap }));

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
          graphEntries: [...seenReferents, ...mentions, ...gaps],
        },
        anchor: encounter.anchor,
        evidence: encounter.material,
        nominationCause: "bottom_up_difference",
      }];
    },
  });
}

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
