// Recursive provisional ontology for constitutive reading.
//
// The Entity witness gate remains the only route to settled beinghood. This
// module gives reasoning something honest to work on before that gate clears:
// candidate forms, live identity alternatives, and tentative relations. Its
// output may reorganize repeatedly inside one reading event, but never promotes
// a candidate into the settled cast.

import { reasonOverEot } from '../engine/reasoning/eot.js';

const freeze = x => Object.freeze(x);
const norm = x => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const WORD = /\p{L}[\p{L}\p{M}'’]*/gu;
const TITLE = /^\p{Lu}/u;
const LOWER = /^\p{Ll}/u;
const ARTICLES = new Set(['a', 'an', 'the']); // received text/en structural prior; never a content vocabulary
const NEGATION = new Set(['not', 'never', "didn't", "doesn't", "wasn't", "isn't"]);

const tokenRows = text => [...String(text ?? '').matchAll(WORD)].map((m, i) => ({
  token: m[0],
  key: norm(m[0]),
  at: i,
  charStart: m.index,
  charEnd: m.index + m[0].length,
}));

const pairKey = (descriptor, name) => `${norm(descriptor)}\u0000${norm(name)}`;
const stable = x => JSON.stringify(x);

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

const relationSnapshot = state => freeze([...state.relations.values()].map(x => freeze({
  ...x,
  subjectAlternatives: freeze([...x.subjectAlternatives]),
  witness: freeze({ ...x.witness }),
  scope: freeze({ ...x.scope }),
})));

const registerForm = (state, { surface, kind, event }) => {
  const key = norm(surface);
  if (!key) return;
  const current = state.forms.get(key);
  if (current) {
    current.events.add(event);
    if (current.kind !== 'name' && kind === 'name') current.kind = 'name';
    return;
  }
  state.forms.set(key, {
    id: `provisional:${key}`,
    key,
    display: surface,
    kind,
    standing: 'candidate',
    firstEvent: event,
    events: new Set([event]),
  });
};

const mentionRows = (surf, text, state, eventIndex) => {
  for (const candidate of surf.candidates ?? []) {
    const surface = candidate.surfaces?.[0] ?? candidate.display;
    if (!surface) continue;
    registerForm(state, {
      surface,
      kind: candidate.witnessable ? 'name' : 'form',
      event: eventIndex,
    });
  }

  const sentences = surf.sentences ?? [];
  return sentences.map((sentence, sentenceIndex) => {
    const tokens = tokenRows(sentence.text);
    const names = [];
    const descriptors = [];

    for (let i = 0; i < tokens.length; i++) {
      const row = tokens[i];
      const known = state.forms.get(row.key);
      if (known?.kind === 'name' || TITLE.test(row.token) && i > 0) {
        names.push({ ...row, surface: known?.display ?? row.token });
        registerForm(state, { surface: known?.display ?? row.token, kind: 'name', event: eventIndex });
      }
      if (LOWER.test(row.token) && row.key.length >= 4 && !ARTICLES.has(row.key)) {
        descriptors.push({ ...row, surface: row.token });
        registerForm(state, { surface: row.token, kind: 'descriptor', event: eventIndex });
      }
    }

    return { sentenceIndex, text: sentence.text, tokens, names, descriptors };
  });
};

const minGap = (a, b) => Math.max(0, Math.abs(a.at - b.at) - 1);

const updateIdentityAlternatives = (state, mentions, eventIndex) => {
  const acts = [];
  const opened = [];
  const supported = [];
  const splits = [];

  // Near name/descriptor adjacency opens a live alternative. It is not SYN:
  // the pair remains two forms with a `consistent` hypothesis between them.
  for (const sentence of mentions) {
    for (const name of sentence.names) {
      for (const descriptor of sentence.descriptors) {
        if (descriptor.key === norm(name.surface) || descriptor.key.length < 4) continue;
        const gap = minGap(name, descriptor);
        if (gap > 2) continue;
        const key = pairKey(descriptor.surface, name.surface);
        let record = state.identities.get(key);
        if (!record) {
          record = {
            id: `identity:${key}`,
            descriptor: descriptor.key,
            name: norm(name.surface),
            standing: 'consistent',
            supportEvents: new Set(),
            attackEvents: new Set(),
            history: [],
          };
          state.identities.set(key, record);
          opened.push({ identityId: record.id, descriptor: record.descriptor, name: record.name, event: eventIndex });
        }
        if (!record.supportEvents.has(eventIndex)) {
          record.supportEvents.add(eventIndex);
          record.history.push({ event: eventIndex, act: 'CON', reason: 'near co-presentation supports a live identity alternative' });
          supported.push({ identityId: record.id, event: eventIndex, gap });
        }
      }
    }
  }

  // A previously supported pair presented as separated figures in one
  // sentence attacks the identity hypothesis. Distance is not proof by itself;
  // it is an adversarial trigger. The current text perceiver is English-shaped
  // and names that limitation in the act's giver.
  for (const record of state.identities.values()) {
    if (record.standing === 'distinct') continue;
    for (const sentence of mentions) {
      const nameMentions = sentence.names.filter(x => norm(x.surface) === record.name);
      const descriptorMentions = sentence.descriptors.filter(x => x.key === record.descriptor);
      if (!nameMentions.length || !descriptorMentions.length) continue;
      const far = nameMentions.some(n => descriptorMentions.some(d => minGap(n, d) > 4));
      if (!far || record.supportEvents.size === 0) continue;

      record.standing = 'distinct';
      record.attackEvents.add(eventIndex);
      record.history.push({ event: eventIndex, act: 'SEG', reason: 'supported aliases appear as separated figures in one experience' });
      acts.push(freeze({
        op: 'SEG',
        grain: 'Figure',
        reason: 'incompatible multiplicity splits a live identity alternative',
        identityId: record.id,
        giver: 'text/en-distance-attack@1',
      }));
      acts.push(freeze({
        op: 'DEF',
        grain: 'Figure',
        reason: 'the prior identity alternative is refused in the current Fold',
        identityId: record.id,
        giver: 'text/en-distance-attack@1',
      }));
      splits.push({
        identityId: record.id,
        descriptor: record.descriptor,
        name: record.name,
        event: eventIndex,
      });
      break;
    }
  }

  return { acts, opened, supported, splits };
};

const subjectAlternatives = (state, subject) => {
  const key = norm(subject);
  const alternatives = new Set([key]);
  for (const identity of state.identities.values()) {
    if (identity.standing === 'distinct') continue;
    if (identity.descriptor === key) alternatives.add(identity.name);
    if (identity.name === key) alternatives.add(identity.descriptor);
  }
  return [...alternatives].sort();
};

const relationSubjects = sentence => {
  const rows = sentence.tokens;
  const out = [];
  for (const name of sentence.names) out.push({ at: name.at, surface: norm(name.surface), kind: 'name' });
  for (let i = 1; i < rows.length; i++) {
    if (!ARTICLES.has(rows[i - 1].key)) continue;
    const noun = rows[i];
    if (!LOWER.test(noun.token) || noun.key.length < 3) continue;
    out.push({ at: i, surface: noun.key, kind: 'descriptor' });
  }
  return out.sort((a, b) => a.at - b.at);
};

const extractTentativeRelations = (state, mentions, eventIndex) => {
  const added = [];
  for (const sentence of mentions) {
    const subjects = relationSubjects(sentence);
    for (const subject of subjects) {
      const predicateRow = sentence.tokens[subject.at + 1];
      if (!predicateRow || ARTICLES.has(predicateRow.key)) continue;
      const nextSubjectAt = subjects.find(x => x.at > subject.at)?.at ?? sentence.tokens.length;
      const objectRows = sentence.tokens.slice(subject.at + 2, Math.min(nextSubjectAt, subject.at + 6));
      if (!objectRows.length) continue;
      const object = objectRows.map(x => x.key).join(' ');
      const before = sentence.tokens.slice(Math.max(0, subject.at - 3), subject.at + 2).map(x => x.key);
      const polarity = before.some(x => NEGATION.has(x)) ? -1 : 1;
      const id = `provisional-link:${eventIndex}:${sentence.sentenceIndex}:${subject.at}:${state.relationCount++}`;
      const relation = {
        id,
        rawSubject: subject.surface,
        predicate: predicateRow.key,
        object,
        polarity,
        subjectAlternatives: subjectAlternatives(state, subject.surface),
        scope: { start: eventIndex, end: eventIndex + 1 },
        witness: { event: eventIndex, sentence: sentence.sentenceIndex, token: subject.at },
        standing: 'tentative',
      };
      state.relations.set(id, relation);
      added.push({ relationId: id, subject: relation.rawSubject, predicate: relation.predicate, object });
    }
  }
  return added;
};

const recanonicalizeRelations = state => {
  const changes = [];
  for (const relation of state.relations.values()) {
    const before = relation.subjectAlternatives;
    const after = subjectAlternatives(state, relation.rawSubject);
    if (stable(before) === stable(after)) continue;
    relation.subjectAlternatives = after;
    changes.push({
      relationId: relation.id,
      from: [...before],
      to: [...after],
      rawSubject: relation.rawSubject,
    });
  }
  return changes;
};

const eotOf = state => {
  const tuples = [];
  for (const identity of state.identities.values()) {
    tuples.push({
      id: `eot:${identity.id}`,
      op: identity.standing === 'distinct' ? 'DEF' : 'CON',
      grain: 'Figure',
      subject: identity.descriptor,
      predicate: 'may_corefer_with',
      object: identity.name,
      polarity: identity.standing === 'distinct' ? -1 : 1,
      scope: { start: Math.min(...identity.supportEvents, 0), end: Math.max(...identity.supportEvents, 0) + 1 },
      meta: { standing: identity.standing, provisional: true },
    });
  }
  for (const relation of state.relations.values()) {
    tuples.push({
      id: `eot:${relation.id}`,
      op: 'CON',
      grain: 'Figure',
      subject: relation.subjectAlternatives.length === 1
        ? relation.subjectAlternatives[0]
        : { alternatives: relation.subjectAlternatives },
      predicate: relation.predicate,
      object: relation.object,
      polarity: relation.polarity,
      scope: relation.scope,
      witness: relation.witness,
      meta: { standing: relation.standing, provisional: true, rawSubject: relation.rawSubject },
    });
  }
  return tuples;
};

export function advanceRecursiveOntology(state, { eventIndex, surf, text } = {}) {
  if (!state) throw new TypeError('advanceRecursiveOntology: state is required');
  const mentions = mentionRows(surf, text, state, eventIndex);

  const beforeEot = eotOf(state);
  const beforeReasoning = reasonOverEot(beforeEot);
  const identity = updateIdentityAlternatives(state, mentions, eventIndex);
  const relationAdmissions = extractTentativeRelations(state, mentions, eventIndex);
  const relationRecanonicalizations = recanonicalizeRelations(state);
  const afterEot = eotOf(state);
  const afterReasoning = reasonOverEot(afterEot);

  const directActs = identity.acts;
  const iterations = [
    freeze({
      pass: 0,
      phase: 'provisional-before-transform',
      eot: freeze(beforeEot),
      reasoning: beforeReasoning,
      acts: freeze(beforeReasoning.acts ?? []),
    }),
    freeze({
      pass: 1,
      phase: 'after-ontology-transform',
      eot: freeze(afterEot),
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
    identityAlternatives: identitySnapshot(state),
    provisionalEntities: formSnapshot(state),
    provisionalLinks: relationSnapshot(state),
    iterations: freeze(iterations),
    transformations,
  });
}
