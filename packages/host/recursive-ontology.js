// Recursive provisional ontology for constitutive reading.
//
// This layer is modality-neutral. It never tokenizes text, inspects word order,
// capitalization, determiners, audio samples, table cells, or pixels. Perceiver
// adapters supply structural observations; this module carries them, reasons
// over them, and recursively re-canonicalizes affected relations.

import { roleRelation, roleRelationToEot, reasonOverRoleRelations } from '../engine/reasoning/role-eot.js';

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const stable = x => JSON.stringify(x);
const pairKey = (a, b) => `${norm(a)}\u0000${norm(b)}`;

export function createRecursiveOntology() {
  return {
    forms: new Map(),
    identities: new Map(),
    relations: new Map(),
    relationCount: 0,
  };
}

const formSnapshot = state => freeze([...state.forms.values()].map(x => freeze({
  ...x,
  events: freeze([...x.events]),
})));

const identitySnapshot = state => freeze([...state.identities.values()].map(x => freeze({
  ...x,
  supportEvents: freeze([...x.supportEvents]),
  attackEvents: freeze([...x.attackEvents]),
  history: freeze(x.history.map(h => freeze({ ...h }))),
})));

const canonicalParticipants = (state, relation) => relation.participants.map(p => {
  const value = norm(p.value);
  const alternatives = new Set([value]);
  for (const identity of state.identities.values()) {
    if (identity.standing === 'distinct') continue;
    if (identity.left === value) alternatives.add(identity.right);
    if (identity.right === value) alternatives.add(identity.left);
  }
  return freeze({
    role: p.role,
    value,
    alternatives: freeze([...alternatives].sort()),
  });
});

const relationSnapshot = state => freeze([...state.relations.values()].map(x => {
  const participants = canonicalParticipants(state, x);
  // Legacy inspection aliases remain only so older host surfaces can display a
  // binary edge while migration completes. Their values are graph endpoints,
  // never grammatical subject/object assertions.
  return freeze({
    ...x,
    participants: freeze(participants),
    rawSubject: participants[0]?.value ?? null,
    subjectAlternatives: participants[0]?.alternatives ?? freeze([]),
    predicate: x.relation,
    object: participants[1]?.value ?? null,
    witness: freeze({ ...(x.witness ?? {}) }),
    scope: freeze({ ...(x.scope ?? {}) }),
  });
}));

const registerForms = (state, observations, eventIndex) => {
  for (const form of observations?.forms ?? []) {
    const key = norm(form.key ?? form.display ?? form.value);
    if (!key) continue;
    const current = state.forms.get(key);
    if (current) {
      current.events.add(eventIndex);
      if (form.kind) current.kind = form.kind;
      continue;
    }
    state.forms.set(key, {
      id: form.id ?? `provisional:${key}`,
      key,
      display: form.display ?? form.value ?? key,
      kind: form.kind ?? 'form_candidate',
      standing: 'candidate',
      firstEvent: eventIndex,
      giver: form.giver ?? observations?.giver ?? null,
      events: new Set([eventIndex]),
    });
  }
};

const updateIdentities = (state, observations, eventIndex) => {
  const acts = [];
  const opened = [];
  const supported = [];
  const splits = [];

  for (const evidence of observations?.identitySupports ?? []) {
    const left = norm(evidence.left);
    const right = norm(evidence.right);
    if (!left || !right || left === right) continue;
    const key = pairKey(left, right);
    let record = state.identities.get(key);
    if (!record) {
      record = {
        id: `identity:${key}`,
        left,
        right,
        // compatibility names used by existing recursive golden/inspection
        descriptor: left,
        name: right,
        standing: 'consistent',
        supportEvents: new Set(),
        attackEvents: new Set(),
        history: [],
      };
      state.identities.set(key, record);
      opened.push({ identityId: record.id, left, right, event: eventIndex });
    }
    if (!record.supportEvents.has(eventIndex)) {
      record.supportEvents.add(eventIndex);
      record.history.push({
        event: eventIndex,
        act: 'CON',
        reason: evidence.evidence?.kind ?? 'perceiver supplied identity support',
        giver: evidence.giver ?? observations?.giver ?? null,
      });
      supported.push({ identityId: record.id, event: eventIndex });
    }
  }

  for (const evidence of observations?.identityAttacks ?? []) {
    const left = norm(evidence.left);
    const right = norm(evidence.right);
    const record = state.identities.get(pairKey(left, right)) ?? state.identities.get(pairKey(right, left));
    if (!record || record.standing === 'distinct') continue;
    record.standing = 'distinct';
    record.attackEvents.add(eventIndex);
    record.history.push({
      event: eventIndex,
      act: 'SEG',
      reason: evidence.evidence?.kind ?? 'perceiver supplied incompatible multiplicity',
      giver: evidence.giver ?? observations?.giver ?? null,
    });
    acts.push(freeze({
      op: 'SEG',
      grain: 'Figure',
      reason: 'incompatible multiplicity splits a live identity alternative',
      identityId: record.id,
      giver: evidence.giver ?? observations?.giver ?? null,
    }));
    acts.push(freeze({
      op: 'DEF',
      grain: 'Figure',
      reason: 'the prior identity alternative is refused in the current Fold',
      identityId: record.id,
      giver: evidence.giver ?? observations?.giver ?? null,
    }));
    splits.push({ identityId: record.id, left: record.left, right: record.right, event: eventIndex });
  }

  return { acts, opened, supported, splits };
};

const addRelations = (state, observations, eventIndex) => {
  const added = [];
  for (const raw of observations?.relations ?? []) {
    const relation = raw?.schema === 'EORoleRelation@1' ? raw : roleRelation(raw);
    const id = relation.id ?? `provisional-link:${eventIndex}:${state.relationCount++}`;
    const stored = { ...relation, id, standing: relation.meta?.standing ?? 'tentative' };
    state.relations.set(id, stored);
    added.push({
      relationId: id,
      relation: relation.relation,
      participants: relation.participants.map(p => ({ role: p.role, value: p.value })),
    });
  }
  return added;
};

const recanonicalizeRelations = (state, before) => {
  const changes = [];
  for (const relation of state.relations.values()) {
    const previous = before.get(relation.id) ?? [];
    const next = canonicalParticipants(state, relation);
    if (stable(previous) === stable(next)) continue;
    changes.push({
      relationId: relation.id,
      from: previous,
      to: next,
    });
  }
  return changes;
};

const reasoningRelations = state => {
  const out = [];
  for (const identity of state.identities.values()) {
    out.push(roleRelation({
      id: `eot:${identity.id}`,
      op: identity.standing === 'distinct' ? 'DEF' : 'CON',
      grain: 'Figure',
      relation: 'may_corefer_with',
      participants: [
        { role: 'candidate_a', value: identity.left },
        { role: 'candidate_b', value: identity.right },
      ],
      polarity: identity.standing === 'distinct' ? -1 : 1,
      scope: {
        start: identity.supportEvents.size ? Math.min(...identity.supportEvents) : 0,
        end: identity.supportEvents.size ? Math.max(...identity.supportEvents) + 1 : 1,
      },
      meta: { standing: identity.standing, provisional: true },
    }));
  }
  for (const relation of state.relations.values()) {
    const participants = canonicalParticipants(state, relation).map(p => ({
      role: p.role,
      value: p.alternatives.length === 1 ? p.value : { alternatives: p.alternatives },
    }));
    out.push(roleRelation({
      ...relation,
      id: `eot:${relation.id}`,
      participants,
      meta: { ...(relation.meta ?? {}), standing: relation.standing, provisional: true },
    }));
  }
  return out;
};

export function advanceRecursiveOntology(state, { eventIndex, observations } = {}) {
  if (!state) throw new TypeError('advanceRecursiveOntology: state is required');
  if (!observations) throw new TypeError('advanceRecursiveOntology: modality-specific structural observations are required');

  registerForms(state, observations, eventIndex);
  const beforeCanonical = new Map([...state.relations.values()].map(r => [r.id, canonicalParticipants(state, r)]));
  const beforeRelations = reasoningRelations(state);
  const beforeReasoning = reasonOverRoleRelations(beforeRelations);

  const identity = updateIdentities(state, observations, eventIndex);
  const relationAdmissions = addRelations(state, observations, eventIndex);
  const relationRecanonicalizations = recanonicalizeRelations(state, beforeCanonical);

  const afterRelations = reasoningRelations(state);
  const afterReasoning = reasonOverRoleRelations(afterRelations);
  const directActs = identity.acts;
  const iterations = [
    freeze({
      pass: 0,
      phase: 'provisional-before-transform',
      eot: freeze(beforeRelations.map(roleRelationToEot)),
      roleRelations: freeze(beforeRelations),
      reasoning: beforeReasoning,
      acts: freeze(beforeReasoning.acts ?? []),
    }),
    freeze({
      pass: 1,
      phase: 'after-ontology-transform',
      eot: freeze(afterRelations.map(roleRelationToEot)),
      roleRelations: freeze(afterRelations),
      reasoning: afterReasoning,
      acts: freeze([...directActs, ...(afterReasoning.acts ?? [])]),
    }),
  ];

  const transformations = freeze({
    identityOpens: freeze(identity.opened.map(freeze)),
    identitySupports: freeze(identity.supported.map(freeze)),
    identitySplits: freeze(identity.splits.map(freeze)),
    relationAdmissions: freeze(relationAdmissions.map(freeze)),
    relationRecanonicalizations: freeze(relationRecanonicalizations.map(freeze)),
  });

  return freeze({
    observationSchema: observations.schema ?? null,
    observationGiver: observations.giver ?? null,
    observationGaps: freeze([...(observations.gaps ?? [])]),
    identityAlternatives: identitySnapshot(state),
    provisionalEntities: formSnapshot(state),
    provisionalLinks: relationSnapshot(state),
    iterations: freeze(iterations),
    transformations,
  });
}
