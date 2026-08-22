// Incremental proposition reading for long-form sources.
//
// One proposition is one causal transformation event. It updates only the
// structural observations it touches; prior ontology/frontier state is carried
// forward rather than recomputing the whole admitted document. Whole-horizon
// adversarial resolution remains available separately as an explicit audit.

import { admitExperienceEvent } from './experience-admission.js';
import { advanceRecursiveOntology } from './recursive-ontology.js';
import { advanceFrontier } from './frontier.js';
import { observeTextStructure } from '../engine/perceiver/text/structural-observations.js';
import { splitSentences } from '../engine/perceiver/text/spans.js';
import { extractSurfaces } from '../engine/perceiver/text/surfaces.js';

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stable = x => JSON.stringify(x);

const perceive = text => {
  const sentences = splitSentences(text);
  const strictNames = extractSurfaces(sentences);
  const candidates = strictNames.map((s, i) => freeze({
    id: `prop-surf:${i}:${norm(s.surface)}`,
    display: s.surface,
    surfaces: freeze([s.surface]),
    standing: 'candidate',
    witnessable: true,
    giver: 'event-local-name-surface',
    mentions: s.mentions,
    sentenceCount: s.sentences,
  }));
  return freeze({
    medium: 'text',
    sentences: freeze(sentences.map(s => freeze({ text: s.text, offset: s.offset, order: s.order }))),
    candidates: freeze(candidates),
  });
};

const keys = ({ recursive, frontier } = {}) => {
  const out = new Set();
  for (const x of recursive?.identityAlternatives ?? []) out.add(`I:${x.id}:${x.standing}`);
  for (const x of recursive?.provisionalEntities ?? []) out.add(`P:${x.id}:${x.standing}`);
  for (const x of recursive?.provisionalLinks ?? []) out.add(`R:${x.id}:${stable(x.participants)}:${x.relation}:${x.polarity}`);
  for (const x of frontier?.open ?? []) out.add(`O:${x.id}:${x.standing}`);
  return out;
};

const delta = (before, after) => {
  const A = keys(before), B = keys(after);
  const admittedKeys = [...B].filter(x => !A.has(x));
  const withdrawnKeys = [...A].filter(x => !B.has(x));
  const reorganized = admittedKeys.length + withdrawnKeys.length;
  return freeze({
    admitted: admittedKeys.length,
    withdrawn: withdrawnKeys.length,
    reorganized,
    surprise: reorganized / Math.max(1, A.size + B.size),
    admittedKeys: freeze(admittedKeys),
    withdrawnKeys: freeze(withdrawnKeys),
  });
};

const propositionPerturbation = (state, observations) => {
  const links = (observations.relations ?? []).map(r => {
    const actor = r.participants?.find(p => p.role === 'actor') ?? r.participants?.[0];
    const undergoer = r.participants?.find(p => p.role === 'undergoer') ?? r.participants?.[1];
    return freeze({
      kind: 'Link',
      assertion: freeze({
        subject: actor?.value ?? null,
        predicate: r.relation,
        object: undergoer?.value ?? null,
        polarity: r.polarity ?? 1,
        scope: r.scope ?? null,
        offset: r.witness?.offset ?? null,
      }),
      disposition: 'survives',
      perturbations: freeze({}),
    });
  });
  return freeze({
    schema: 'EOPropositionPerturbation@1',
    sourceId: state.sourceId,
    cast: freeze([]),
    links: freeze(links),
  });
};

/** Advance a long-form reader by exactly one proposition/sentence. */
export function advanceProposition(state, text, { label = null, parentEvent = null } = {}) {
  const eventIndex = state.eventIndex;
  const surf = perceive(text);
  const admitted = admitExperienceEvent(state.horizon, {
    sourceId: state.sourceId,
    text,
    eventId: eventIndex,
    language: state.language,
  });
  state.prefixBytes = admitted.byteEnd;
  state.horizon._cast?.delete(state.sourceId);
  state.horizon._surfaces?.delete(state.sourceId);

  const observations = observeTextStructure({
    text,
    surf,
    eventIndex,
    language: state.language,
    knownIdentities: [...state.ontology.identities.values()],
    posPrior: state.languagePriors.pos,
  });
  const recursive = advanceRecursiveOntology(state.ontology, { eventIndex, observations });
  const perturbation = propositionPerturbation(state, observations);
  const frontier = advanceFrontier(state.frontier, {
    eventIndex,
    recursive,
    perturbation,
    obligations: [],
  });
  const currentState = { recursive, frontier };
  const change = delta(state.priorState, currentState);
  const transition = freeze({
    event: eventIndex,
    parentEvent,
    label,
    surf: freeze({
      kind: 'text', unit: 'proposition', value: text,
      horizonByteEnd: state.prefixBytes,
      admission: freeze({
        eventId: admitted.eventId,
        byteStart: admitted.byteStart,
        byteEnd: admitted.byteEnd,
        chunks: admitted.chunks,
      }),
      perception: surf,
    }),
    observations,
    iterations: recursive.iterations,
    perturbation,
    frontier,
    fold: freeze({
      cursor: freeze({ event: eventIndex, byteEnd: state.prefixBytes }),
      cast: perturbation.cast,
      links: perturbation.links,
      identityAlternatives: recursive.identityAlternatives,
      provisional: freeze({ entities: recursive.provisionalEntities, links: recursive.provisionalLinks }),
      frontier,
      tension: frontier.tension,
      release: frontier.release,
      unresolved: freeze([...frontier.open]),
    }),
    delta: change,
    surprise: freeze({
      transformations: recursive.transformations,
      admitted: change.admitted,
      withdrawn: change.withdrawn,
      reorganized: change.reorganized,
      score: change.surprise,
      tension: frontier.tension,
      release: frontier.release,
    }),
  });
  state.trajectory.push(transition);
  state.priorState = currentState;
  state.eventIndex += 1;
  return transition;
}

export function propositionsOf(text) {
  return freeze(splitSentences(String(text ?? '')).map(s => s.text.trim()).filter(Boolean));
}
