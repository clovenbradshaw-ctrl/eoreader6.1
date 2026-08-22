// Host-side loader for received language/system structure priors.
//
// Engine mechanisms accept prior DATA; they do not open files or infer a
// language. Natural language is one addressed system in the same omnimodal
// order-convention prior that also contains music, binary, code, and tables.
// Different gifts for one language may have different schemas; a negation
// prior is not silently treated as an abbreviation prior.

import fs from 'fs';

const LANG_ROOT = new URL('../../bin/priors/lang/', import.meta.url);
const POS_ROOT = new URL('../../bin/priors/pos/', import.meta.url);
const TYPOLOGY_ROOT = new URL('../../bin/priors/typology/', import.meta.url);
const ABBREVIATION_SCHEMAS = new Set(['AbbreviationPrior@1', 'AbbreviationPrior@2']);

const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8'));

export function loadAbbreviationPrior(language) {
  if (!language) return null;
  const path = new URL(`${language}.json`, LANG_ROOT);
  if (!fs.existsSync(path)) return null;
  const raw = readJson(path);
  if (!ABBREVIATION_SCHEMAS.has(raw.schema)) return null;
  if (!raw.provenance?.source) throw new TypeError('loadAbbreviationPrior: received prior must name its giver');
  return Object.freeze({
    schema: raw.schema,
    language: raw.language,
    giver: raw.provenance.source,
    abbreviations: Object.freeze([...(raw.abbreviations ?? [])]),
  });
}

export function loadPosPrior(language) {
  if (!language) return null;
  const filename = language === 'en' ? 'en-ud-ewt.json' : `${language}.json`;
  const path = new URL(filename, POS_ROOT);
  if (!fs.existsSync(path)) return null;
  const raw = readJson(path);
  if (raw.schema !== 'POSPrior@1') {
    throw new TypeError(`loadPosPrior: expected POSPrior@1, got ${raw.schema}`);
  }
  if (!raw.provenance?.source) {
    throw new TypeError('loadPosPrior: received prior must name its giver');
  }
  return raw;
}

export function loadOrderConvention(language) {
  if (!language) return null;
  const aliases = readJson(new URL('language-aliases.json', TYPOLOGY_ROOT));
  const conventions = readJson(new URL('order-conventions.json', TYPOLOGY_ROOT));
  if (aliases.schema !== 'SystemAliasPrior@1') {
    throw new TypeError(`loadOrderConvention: expected SystemAliasPrior@1, got ${aliases.schema}`);
  }
  if (conventions.schema !== 'OrderConventionPrior@1') {
    throw new TypeError(`loadOrderConvention: expected OrderConventionPrior@1, got ${conventions.schema}`);
  }
  const systemId = aliases.aliases?.[language] ?? null;
  const system = systemId ? conventions.systems?.[systemId] : null;
  if (!system) return null;
  if (!system.giver) throw new TypeError('loadOrderConvention: received convention must name its giver');
  return Object.freeze({ schema: conventions.schema, systemId, ...system });
}

export function textStructurePriors(language) {
  const abbreviation = loadAbbreviationPrior(language);
  const loadedPos = loadPosPrior(language);
  const order = loadOrderConvention(language);
  const pos = loadedPos
    ? Object.freeze({ ...loadedPos, orderConvention: order })
    : order
      ? Object.freeze({ schema: 'POSPriorGap@1', orderConvention: order })
      : null;
  const gaps = [];
  if (language && !abbreviation) gaps.push({
    reason: 'missing_abbreviation_prior', language,
    detail: `no AbbreviationPrior is installed for declared language ${language}; sentence segmentation uses the material-derived floor`,
  });
  if (language && !loadedPos) gaps.push({
    reason: 'missing_pos_prior', language,
    detail: `no POSPrior@1 is installed for declared language ${language}`,
  });
  if (language && !order) gaps.push({
    reason: 'missing_order_convention_prior', language,
    detail: `declared language ${language} is not addressed by the omnimodal OrderConventionPrior@1`,
  });
  if (!language) gaps.push({
    reason: 'undeclared_text_language', language: null,
    detail: 'language-specific grammatical roles will not be inferred without a declared language',
  });
  return Object.freeze({
    language: language ?? null,
    abbreviation,
    corpusLanguage: abbreviation ? language : null,
    pos,
    order,
    gaps: Object.freeze(gaps.map(Object.freeze)),
  });
}
