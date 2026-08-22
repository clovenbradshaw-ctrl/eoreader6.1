// Text structural observations for the constitutive reader.
//
// IMPORTANT: this is a perceiver adapter, not EOT. Grammatical assumptions
// belong here and enter as received system priors. The recursive ontology and
// reasoning layers consume role-neutral observations and never inspect word
// order, capitalization, determiners, or lexical tokens.

import { discoverRelationVocab, extractRelations } from './relations.js';
import { DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS } from './priors.js';
import { roleRelation } from '../../reasoning/role-eot.js';

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE = /^\p{Lu}/u;
const LOWER = /^\p{Ll}/u;
const APPOSITIONAL_RUN = /^[\p{L}\p{M}'’\s]+$/u;
const DETERMINERS = new Set([...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS]);

export const TEXT_STRUCTURE_SCHEMA = 'EOTextStructuralObservations@4';

const rows = text => [...String(text ?? '').matchAll(WORD)].map((m, i) => ({
  token: m[0], key: norm(m[0]), at: i, charStart: m.index, charEnd: m.index + m[0].length,
}));

const stripLeadingDeterminer = value => {
  const parts = String(value ?? '').trim().split(/\s+/);
  if (parts.length > 1 && DETERMINERS.has(norm(parts[0]))) return parts.slice(1).join(' ');
  return String(value ?? '').trim();
};

const formRows = surf => (surf.candidates ?? []).filter(c => c.witnessable).map(c => freeze({
  id: c.id,
  display: c.display ?? c.surfaces?.[0] ?? null,
  key: norm(c.display ?? c.surfaces?.[0]),
  kind: 'name_candidate',
  witnessable: true,
  giver: c.giver,
}));

const coPresenceRelations = ({ surf, eventIndex, forms }) => {
  const out = [];
  let n = 0;
  for (let sentenceIndex = 0; sentenceIndex < (surf.sentences ?? []).length; sentenceIndex++) {
    const text = surf.sentences[sentenceIndex].text;
    const present = forms.filter(f => ` ${norm(text)} `.includes(` ${f.key} `));
    for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
      out.push(roleRelation({
        id: `text-copresence:${eventIndex}:${n++}`,
        op: 'CON', grain: 'Figure', relation: 'co_present_in_unit',
        participants: [
          { role: 'member', value: present[i].key },
          { role: 'member', value: present[j].key },
        ],
        scope: { start: eventIndex, end: eventIndex + 1 },
        witness: { event: eventIndex, sentence: sentenceIndex, source: 'text/structural-floor' },
        meta: { giver: 'material:co-presence', grammaticalShape: null },
      }));
    }
  }
  return freeze(out);
};

const englishIdentityEvidence = (sentences, knownIdentities = []) => {
  const supports = [], attacks = [];
  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
    const sentenceText = sentences[sentenceIndex].text;
    const rs = rows(sentenceText);
    for (let i = 0; i < rs.length; i++) {
      if (!DETERMINERS.has(rs[i].key)) continue;
      for (let nameAt = i + 2; nameAt <= Math.min(i + 4, rs.length - 1); nameAt++) {
        if (!TITLE.test(rs[nameAt].token)) continue;
        const descriptorRows = rs.slice(i + 1, nameAt);
        if (!descriptorRows.length || !descriptorRows.every(x => LOWER.test(x.token))) continue;
        const rawRun = sentenceText.slice(rs[i].charStart, rs[nameAt].charEnd);
        if (!APPOSITIONAL_RUN.test(rawRun)) continue;
        supports.push(freeze({
          left: descriptorRows.map(x => x.key).join(' '), right: rs[nameAt].key, standing: 'consistent',
          evidence: freeze({ kind: 'text_appositional_shape', sentence: sentenceIndex, start: i, end: nameAt }),
          giver: 'lang/en:text-structure@1',
        }));
      }
    }
    for (const identity of knownIdentities ?? []) {
      if (identity.standing === 'distinct') continue;
      const leftTokens = norm(identity.descriptor ?? identity.left).split(/\s+/).filter(Boolean);
      const right = norm(identity.name ?? identity.right);
      if (!leftTokens.length || !right) continue;
      const rightRows = rs.filter(x => x.key === right);
      if (!rightRows.length) continue;
      for (let i = 0; i <= rs.length - leftTokens.length; i++) {
        let match = true;
        for (let j = 0; j < leftTokens.length; j++) if (rs[i + j].key !== leftTokens[j]) { match = false; break; }
        if (!match) continue;
        const leftCenter = i + (leftTokens.length - 1) / 2;
        if (!rightRows.some(r => Math.abs(r.at - leftCenter) > leftTokens.length + 3)) continue;
        attacks.push(freeze({
          left: norm(identity.descriptor ?? identity.left), right, standing: 'distinct',
          evidence: freeze({ kind: 'text_separated_copresentation', sentence: sentenceIndex }),
          giver: 'lang/en:text-structure@1',
        }));
        break;
      }
    }
  }
  return { supports: freeze(supports), attacks: freeze(attacks) };
};

const includesWholeForm = (phrase, form) => ` ${norm(phrase)} `.includes(` ${norm(form)} `);
const anchorObject = (rawObject, identitySupports, forms) => {
  const stripped = norm(stripLeadingDeterminer(rawObject));
  if (!stripped) return stripped;
  const identityHit = (identitySupports ?? []).flatMap(x => [x.left, x.right]).filter(Boolean)
    .filter(x => includesWholeForm(stripped, x)).sort((a, b) => norm(b).length - norm(a).length)[0];
  if (identityHit) return norm(identityHit);
  const nameHit = (forms ?? []).filter(x => x.witnessable && x.key && includesWholeForm(stripped, x.key))
    .sort((a, b) => b.key.length - a.key.length)[0];
  return nameHit?.key ?? stripped;
};
const subjectIsPerceivedName = (subject, forms) => (forms ?? []).some(x => x.witnessable && x.key === norm(subject));

const englishRelations = ({ text, surf, eventIndex, identitySupports, forms, posPrior }) => {
  const names = (surf.candidates ?? []).filter(c => c.witnessable)
    .map(c => ({ surface: c.display ?? c.surfaces?.[0] })).filter(x => x.surface);
  if (!names.length) return freeze([]);
  const discovered = discoverRelationVocab(text, { surfaces: names, functionWords: null, minSurfaces: 1, posPrior });
  const raw = extractRelations(text, { verbs: discovered.verbs, functionWords: null });
  return freeze(raw.filter(r => subjectIsPerceivedName(r.subject, forms)).map((r, i) => roleRelation({
    id: `text-role:${eventIndex}:${i}`, op: 'CON', grain: 'Figure', relation: norm(r.verb),
    participants: [
      { role: 'actor', value: norm(r.subject), witness: { event: eventIndex, offset: r.subjectOffset } },
      { role: 'undergoer', value: anchorObject(r.object, identitySupports, forms), witness: { event: eventIndex, offset: r.objectOffset } },
    ],
    polarity: r.polarity === '-' ? -1 : 1,
    scope: { start: eventIndex, end: eventIndex + 1 },
    witness: { event: eventIndex, source: 'text/en' },
    meta: { giver: 'lang/en:text-structure@1', grammaticalShape: 'SVO-candidate', posPrior: posPrior?.provenance?.source ?? null },
  })));
};

const positionMarkedRelations = ({ surf, eventIndex, orderConvention }) => {
  if (!orderConvention || orderConvention.role_marking !== 'position') return freeze([]);
  if (!Array.isArray(orderConvention.order) || orderConvention.order.length !== 3) return freeze([]);
  const slots = orderConvention.order;
  if ([...slots].sort().join('') !== ['O', 'S', 'V'].sort().join('')) return freeze([]);
  const out = [];
  let n = 0;
  for (let sentenceIndex = 0; sentenceIndex < (surf.sentences ?? []).length; sentenceIndex++) {
    const rs = rows(surf.sentences[sentenceIndex].text);
    if (rs.length !== 3) continue;
    const byRole = new Map(slots.map((role, i) => [role, rs[i]]));
    const S = byRole.get('S'), V = byRole.get('V'), O = byRole.get('O');
    if (!S || !V || !O) continue;
    out.push(roleRelation({
      id: `text-order-role:${eventIndex}:${n++}`, op: 'CON', grain: 'Figure', relation: V.key,
      participants: [
        { role: 'actor', value: S.key, witness: { event: eventIndex, token: S.at } },
        { role: 'undergoer', value: O.key, witness: { event: eventIndex, token: O.at } },
      ],
      scope: { start: eventIndex, end: eventIndex + 1 },
      witness: { event: eventIndex, sentence: sentenceIndex, source: orderConvention.systemId },
      meta: {
        giver: orderConvention.giver, systemId: orderConvention.systemId,
        grammaticalShape: slots.join(''), rigidity: orderConvention.rigidity, roleMarking: orderConvention.role_marking,
      },
    }));
  }
  return freeze(out);
};

export function observeTextStructure({
  text, surf, eventIndex = 0, language, knownIdentities = [], posPrior = null,
  orderConvention = posPrior?.orderConvention ?? null,
} = {}) {
  if (!surf) throw new TypeError('observeTextStructure: surf is required');
  const forms = freeze(formRows(surf));
  const floor = coPresenceRelations({ surf, eventIndex, forms });
  const gaps = [];
  let identity = { supports: freeze([]), attacks: freeze([]) };
  let grammarRelations = freeze([]);

  if (language === 'en') {
    identity = englishIdentityEvidence(surf.sentences ?? [], knownIdentities);
    grammarRelations = englishRelations({ text, surf, eventIndex, identitySupports: identity.supports, forms, posPrior });
    if (!posPrior || posPrior.schema !== 'POSPrior@1') gaps.push(freeze({
      reason: 'missing_pos_prior', language: 'en',
      detail: 'English structural observation proceeded without a received POS prior; connector ambiguity remains unresolved',
    }));
  } else if (orderConvention?.role_marking === 'position') {
    grammarRelations = positionMarkedRelations({ surf, eventIndex, orderConvention });
    if (!grammarRelations.length) gaps.push(freeze({
      reason: 'position_adapter_no_safe_clause', language: language ?? null, systemId: orderConvention.systemId,
      detail: 'received order exists, but no minimal clause was safe enough for the conservative position adapter',
    }));
  } else if (orderConvention?.role_marking === 'case') {
    gaps.push(freeze({
      reason: 'missing_case_realisation_prior', language: language ?? null, systemId: orderConvention.systemId,
      detail: 'roles are received as case-marked for this system; word order was therefore not used as a substitute for morphology',
    }));
  } else if (orderConvention?.rigidity === 'none') {
    gaps.push(freeze({
      reason: 'no_dominant_order', language: language ?? null, systemId: orderConvention.systemId,
      detail: 'the received typology explicitly reports no dominant order; no positional roles were inferred',
    }));
  } else gaps.push(freeze({
    reason: language ? 'no_safe_grammar_adapter' : 'undeclared_text_language', language: language ?? null,
    detail: 'language-neutral co-presence was retained; typed grammatical roles were not inferred',
  }));

  return freeze({
    schema: TEXT_STRUCTURE_SCHEMA,
    language: language ?? null,
    giver: orderConvention?.giver ?? (language === 'en' ? 'lang/en:text-structure@1' : 'material:co-presence'),
    orderConvention: orderConvention ? freeze({
      systemId: orderConvention.systemId,
      order: orderConvention.order ? freeze([...orderConvention.order]) : null,
      rigidity: orderConvention.rigidity,
      roleMarking: orderConvention.role_marking,
      giver: orderConvention.giver,
    }) : null,
    forms,
    identitySupports: identity.supports,
    identityAttacks: identity.attacks,
    relations: freeze([...floor, ...grammarRelations]),
    gaps: freeze(gaps),
  });
}
