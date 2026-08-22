// Role-neutral relation observations for EOT reasoning.
//
// `subject` / `object` are legacy graph-endpoint names. They must never be
// mistaken for grammatical subject/object. This layer gives the canonical
// reading path a modality-neutral representation: a relation plus explicitly
// named participant roles. Text/en may supply actor/patient, Basque may derive
// ergative/absolutive roles differently, audio may supply antecedent/return,
// and a table may supply variable/value. The reasoning kernel sees endpoints
// only after this representation has already been earned.

import { reasonOverEot } from './eot.js';

const freeze = x => Object.freeze(x);

export const ROLE_RELATION_SCHEMA = 'EORoleRelation@1';

const normalizeParticipant = (p, i) => {
  if (!p || typeof p !== 'object') throw new TypeError(`role relation participant ${i} must be an object`);
  if (p.value === undefined && p.referent === undefined) throw new TypeError(`role relation participant ${i} needs value/referent`);
  return freeze({
    role: p.role ?? `participant:${i}`,
    value: p.value ?? p.referent,
    standing: p.standing ?? 'provisional',
    witness: p.witness ?? null,
  });
};

export function roleRelation({
  id,
  op = 'CON',
  grain = 'Figure',
  relation,
  participants,
  polarity = 1,
  scope,
  witness,
  dependsOn = [],
  meta = {},
} = {}) {
  if (relation === undefined) throw new TypeError('roleRelation: relation is required');
  if (!Array.isArray(participants) || participants.length < 1) {
    throw new TypeError('roleRelation: participants must contain at least one role');
  }
  return freeze({
    schema: ROLE_RELATION_SCHEMA,
    id: id ?? null,
    op,
    grain,
    relation,
    participants: freeze(participants.map(normalizeParticipant)),
    polarity: polarity === -1 || polarity === false ? -1 : 1,
    scope: freeze({ ...(scope ?? {}) }),
    witness: witness ?? null,
    dependsOn: freeze([...dependsOn]),
    meta: freeze({ ...meta }),
  });
}

// Compatibility projection only. The first participant is endpoint A and the
// remaining participant set is endpoint B. These names are graph coordinates,
// not grammar. Keeping the projection isolated prevents SVO from becoming EOT
// metaphysics while the existing reasoner is migrated incrementally.
export function roleRelationToEot(observation, index = 0) {
  const r = observation?.schema === ROLE_RELATION_SCHEMA ? observation : roleRelation(observation);
  const [first, ...rest] = r.participants;
  return freeze({
    id: r.id ?? `role-eot:${index}`,
    op: r.op,
    grain: r.grain,
    subject: freeze({ role: first.role, value: first.value }),
    predicate: r.relation,
    object: rest.length === 0
      ? null
      : rest.length === 1
        ? freeze({ role: rest[0].role, value: rest[0].value })
        : freeze(rest.map(p => freeze({ role: p.role, value: p.value }))),
    polarity: r.polarity,
    scope: r.scope,
    witness: r.witness,
    dependsOn: r.dependsOn,
    meta: freeze({
      ...r.meta,
      roleRelation: true,
      participantRoles: freeze(r.participants.map(p => p.role)),
    }),
  });
}

export function reasonOverRoleRelations(relations = [], query = {}) {
  if (!Array.isArray(relations)) throw new TypeError('reasonOverRoleRelations: relations must be an array');
  return reasonOverEot(relations.map(roleRelationToEot), query);
}
