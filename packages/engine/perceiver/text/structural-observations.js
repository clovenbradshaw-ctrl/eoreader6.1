// Text structural observations for the constitutive reader.
//
// IMPORTANT: this is a perceiver adapter, not EOT. Grammatical assumptions
// belong here and must be declared by language. The recursive ontology and
// reasoning layers consume role-neutral observations and never inspect word
// order, capitalization, determiners, or lexical tokens.

import { tokenize, buildFrequencyTable, functionWordSet } from './material.js';
import { discoverRelationVocab, extractRelations } from './relations.js';
import { DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS } from './priors.js';
import { roleRelation } from '../../reasoning/role-eot.js';

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE = /^\p{Lu}/u;
const LOWER = /^\p{Ll}/u;
const DETERMINERS = new Set([...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS]);

export const TEXT_STRUCTURE_SCHEMA = 'EOTextStructuralObservations@1';

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

const formRows = surf => (surf.candidates ?? []).map(c => freeze({
  id: c.id,
  display: c.display ?? c.surfaces?.[0] ?? null,
  key: norm(c.display ?? c.surfaces?.[0]),
  kind: c.witnessable ? 'name_candidate' : 'form_candidate',
  witnessable: Boolean(c.witnessable),
  giver: c.giver,
}));

const englishIdentityEvidence = (sentences, knownIdentities = []) => {
  const supports = [];
  const attacks = [];

  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
    const rs = rows(sentences[sentenceIndex].text);

    // Appositional/name-like shape only: determiner + 1..3 lowercase forms +
    // capitalized name, e.g. "the courier Rowan" / "the hooded courier Rowan".
    // This is far narrower than generic token proximity and is explicitly
    // English-shaped evidence, not a universal identity mechanism.
    for (let i = 0; i < rs.length; i++) {
      if (!DETERMINERS.has(rs[i].key)) continue;
      for (let nameAt = i + 2; nameAt <= Math.min(i + 4, rs.length - 1); nameAt++) {
        if (!TITLE.test(rs[nameAt].token)) continue;
        const descriptorRows = rs.slice(i + 1, nameAt);
        if (!descriptorRows.length || !descriptorRows.every(x => LOWER.test(x.token))) continue;
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

    // Only identities that were already opened by stronger evidence may be
    // attacked by separated co-presentation. This prevents arbitrary nearby
    // nouns/verbs from becoming identity hypotheses in the first place.
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

const englishRelations = ({ text, surf, eventIndex }) => {
  const names = (surf.candidates ?? [])
    .filter(c => c.witnessable)
    .map(c => ({ surface: c.display ?? c.surfaces?.[0] }))
    .filter(x => x.surface);
  if (!names.length) return freeze([]);

  const functionWords = functionWordSet(buildFrequencyTable(tokenize(text)));
  const verbs = discoverRelationVocab(text, {
    surfaces: names,
    functionWords,
    minSurfaces: 1,
  }).verbs;
  const raw = extractRelations(text, { verbs, functionWords });

  return freeze(raw.map((r, i) => roleRelation({
    id: `text-role:${eventIndex}:${i}`,
    op: 'CON',
    grain: 'Figure',
    relation: norm(r.verb),
    participants: [
      { role: 'actor', value: norm(r.subject), witness: { event: eventIndex, offset: r.subjectOffset } },
      { role: 'undergoer', value: norm(stripLeadingDeterminer(r.object)), witness: { event: eventIndex, offset: r.objectOffset } },
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

  // Silence is honest when the language-specific structural adapter is not
  // declared. Surface/form perception may still proceed; grammar does not.
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
  const relations = englishRelations({ text, surf, eventIndex });
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
