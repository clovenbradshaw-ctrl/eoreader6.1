import test from 'node:test';
import assert from 'node:assert/strict';

import { readExperienceStream } from '../packages/host/experience-stream.js';
import { loadOrderConvention } from '../packages/host/language-priors.js';

const ENTITY_SPEC = { window: 8, draws: 32, reseeds: 16, minArrivals: 2 };
const one = value => [{ kind: 'text', unit: 'passage', value }];

const typed = transition => (transition.observations?.relations ?? [])
  .filter(r => r.meta?.systemId);

test('Welsh VSO is read through received typology, not English SVO', () => {
  const prior = loadOrderConvention('cy');
  assert.equal(prior.systemId, 'nl:cym');
  assert.deepEqual(prior.order, ['V', 'S', 'O']);

  const reading = readExperienceStream({
    sourceId: 'lang-welsh-vso',
    language: 'cy',
    entitySpec: ENTITY_SPEC,
    events: one('Gwelodd Carys Dafydd.'),
  });
  const relations = typed(reading.trajectory[0]);
  assert.equal(relations.length, 1);
  assert.equal(relations[0].relation, 'gwelodd');
  assert.deepEqual(relations[0].participants.map(p => [p.role, p.value]), [
    ['actor', 'carys'],
    ['undergoer', 'dafydd'],
  ]);
  assert.equal(relations[0].meta.grammaticalShape, 'VSO');
});

test('Arabic VSO order does not override received case marking', () => {
  const prior = loadOrderConvention('ar');
  assert.equal(prior.systemId, 'nl:arb');
  assert.deepEqual(prior.order, ['V', 'S', 'O']);
  assert.equal(prior.role_marking, 'case');

  const reading = readExperienceStream({
    sourceId: 'lang-arabic-case',
    language: 'ar',
    entitySpec: ENTITY_SPEC,
    events: one('رأى خالد عمر.'),
  });
  const t = reading.trajectory[0];
  assert.equal(typed(t).length, 0, 'VSO order alone must not masquerade as Arabic role evidence');
  assert.ok(t.observations.gaps.some(g => g.reason === 'missing_case_realisation_prior'));
});

test('Basque refuses an underspecified SOV clause even though an order convention exists', () => {
  const prior = loadOrderConvention('eu');
  assert.equal(prior.systemId, 'nl:eus');
  assert.equal(prior.role_marking, 'case');

  const reading = readExperienceStream({
    sourceId: 'lang-basque-unsafe',
    language: 'eu',
    entitySpec: ENTITY_SPEC,
    events: one('Ane Iker ikusi.'),
  });
  const t = reading.trajectory[0];
  assert.equal(typed(t).length, 0, 'SOV order alone must not masquerade as Basque role evidence');
  assert.ok(t.observations.gaps.some(g => g.reason === 'case_adapter_no_safe_clause'));
});

test('Basque role assignment follows received case evidence across word-order reversal', () => {
  const read = value => readExperienceStream({
    sourceId: `lang-basque-reorder:${value}`,
    language: 'eu',
    entitySpec: ENTITY_SPEC,
    events: one(value),
  }).trajectory[0];

  const canonical = typed(read('Anek Lea ikusi du.'));
  const reordered = typed(read('Lea Anek ikusi du.'));
  assert.equal(canonical.length, 1);
  assert.equal(reordered.length, 1);

  for (const relation of [canonical[0], reordered[0]]) {
    assert.equal(relation.relation, 'ikusi');
    assert.equal(relation.meta.roleMarking, 'case');
    assert.equal(relation.meta.alignment, 'ergative-absolutive');
    assert.deepEqual(relation.participants.map(p => [p.role, p.value]), [
      ['actor', 'ane'],
      ['undergoer', 'lea'],
    ]);
  }
});

test('German no-dominant-order prior never becomes positional roles', () => {
  const prior = loadOrderConvention('de');
  assert.equal(prior.systemId, 'nl:deu');
  assert.equal(prior.rigidity, 'none');
  assert.equal(prior.order, null);

  const reading = readExperienceStream({
    sourceId: 'lang-german-no-order',
    language: 'de',
    entitySpec: ENTITY_SPEC,
    events: one('Anna sieht Bruno.'),
  });
  const t = reading.trajectory[0];
  assert.equal(typed(t).length, 0);
  assert.ok(t.observations.gaps.some(g =>
    g.reason === 'no_dominant_order' || g.reason === 'missing_case_realisation_prior'));
});
