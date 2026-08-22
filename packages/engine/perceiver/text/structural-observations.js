// Text structural observations for the constitutive reader.
//
// IMPORTANT: this is a perceiver adapter, not EOT. Grammatical assumptions
// belong here and must be declared by language. The recursive ontology and
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

export const TEXT_STRUCTURE_SCHEMA = 'EOTextStructuralObservations@2';

const rows = text => [...String(text ?? '').matchAll(WORD)].map((m, i) => ({
  token: m[0],
  key: norm(m[0]),
  at: i,
  charStart: m.index,
  charEnd: m.index + m[0].length,
}));

const stripLeadingDeterminer = value => {
  const parts = String(value ?? '').trim().split(/\s+/);
  if (parts.length > 1 && DETERMINERS.has(norm(parts[0]))) return parts.slice(1).join(' ');
  return String(value ?? '').trim();
};

// Surf is deliberately permissive; ontology is not. Generic lexical n-grams
// remain visible in surf.perception.candidates but do not become provisional
// beings merely because they occurred. Only witnessable/referent-shaped forms
// cross this boundary automatically. Descriptor/object forms can still enter
// reasoning as participants in explicit identity/relation observations.
const formRows = surf => (surf.candidates ?? [])
  .filter(c => c.witnessable)
  .map(c => freeze({
    id: c.id,
    display: c.display ?? c.surfaces?.[0] ?? null,
    key: norm(c.display ?? c.surfaces?.[0]),
    kind: 'name_candidate',
    witnessable: true,
    giver: c.giver,
  }));

const englishIdentityEvidence = (sentences, knownIdentities = []) => {
  const supports = [];
  const attacks = [];

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
        const descriptor = descriptorRows.map(x => x.key).join(' ');
        supports.push(freeze({
          left: descriptor,
          right: rs[nameAt].key,
          standing: 'consistent',
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
        const separated = rightRows.some(r => Math.abs(r.at - leftCenter) > leftTokens.length + 3);
        if (!separated) continue;
        attacks.push(freeze({
          left: norm(identity.descriptor ?? identity.left),
          right,
          standing: 'distinct',
          evidence: freeze({ kind: 'text_separated_copresentation', sentence: sentenceIndex }),
          giver: 'lang/en:text-structure@1',
        }));
        break;
      }
    }
  }

  return { supports: freeze(supports), attacks: freeze(attacks) };
};

const includesWholeForm = (phrase, form) => {
  const hay = ` ${norm(phrase)} `;
  const needle = ` ${norm(form)} `;
  return needle.trim().length > 0 && hay.includes(needle);
};

const anchorObject = (rawObject, identitySupports, forms) => {
  const stripped = norm(stripLeadingDeterminer(rawObject));
  if (!stripped) return stripped;

  const identityForms = (identitySupports ?? []).flatMap(x => [x.left, x.right]).filter(Boolean);
  const identityHit = identityForms
    .filter(x => includesWholeForm(stripped, x))
    .sort((a, b) => norm(b).length - norm(a).length)[0];
  if (identityHit) return norm(identityHit);

  const nameHit = (forms ?? [])
    .filter(x => x.witnessable && x.key && includesWholeForm(stripped, x.key))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (nameHit) return nameHit.key;

  return stripped;
};

const subjectIsPerceivedName = (subject, forms) => {
  const s = norm(subject);
  return (forms ?? []).some(x => x.witnessable && x.key === s);
};

const englishRelations = ({ text, surf, eventIndex, identitySupports, forms }) => {
  const names = (surf.candidates ?? [])
    .filter(c => c.witnessable)
    .map(c => ({ surface: c.display ?? c.surfaces?.[0] }))
    .filter(x => x.surface);
  if (!names.length) return freeze([]);

  const verbs = discoverRelationVocab(text, {
    surfaces: names,
    functionWords: null,
    minSurfaces: 1,
  }).verbs;
  const raw = extractRelations(text, { verbs, functionWords: null });

  return freeze(raw
    .filter(r => subjectIsPerceivedName(r.subject, forms))
    .map((r, i) => roleRelation({
      id: `text-role:${eventIndex}:${i}`,
      op: 'CON',
      grain: 'Figure',
      relation: norm(r.verb),
      participants: [
        { role: 'actor', value: norm(r.subject), witness: { event: eventIndex, offset: r.subjectOffset } },
        { role: 'undergoer', value: anchorObject(r.object, identitySupports, forms), witness: { event: eventIndex, offset: r.objectOffset } },
      ],
      polarity: r.polarity === '-' ? -1 : 1,
      scope: { start: eventIndex, end: eventIndex + 1 },
      witness: { event: eventIndex, source: 'text/en' },
      meta: { giver: 'lang/en:text-structure@1', grammaticalShape: 'SVO-candidate' },
    })));
};

export function observeTextStructure({ text, surf, eventIndex = 0, language, knownIdentities = [] } = {}) {
  if (!surf) throw new TypeError('observeTextStructure: surf is required');
  const forms = freeze(formRows(surf));

  if (language !== 'en') {
    return freeze({
      schema: TEXT_STRUCTURE_SCHEMA,
      language: language ?? null,
      giver: null,
      forms,
      identitySupports: freeze([]),
      identityAttacks: freeze([]),
      relations: freeze([]),
      gaps: freeze([freeze({
        reason: language ? 'no_text_structure_adapter_for_language' : 'undeclared_text_language',
        language: language ?? null,
        detail: 'role/identity structure was not inferred; no language grammar was declared',
      })]),
    });
  }

  const identity = englishIdentityEvidence(surf.sentences ?? [], knownIdentities);
  const relations = englishRelations({
    text,
    surf,
    eventIndex,
    identitySupports: identity.supports,
    forms,
  });
  return freeze({
    schema: TEXT_STRUCTURE_SCHEMA,
    language: 'en',
    giver: 'lang/en:text-structure@1',
    forms,
    identitySupports: identity.supports,
    identityAttacks: identity.attacks,
    relations,
    gaps: freeze([]),
  });
}
