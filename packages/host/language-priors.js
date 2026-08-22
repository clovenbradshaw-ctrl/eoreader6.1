// Host-side loader for received language structure priors.
//
// Engine mechanisms accept prior DATA; they do not open files or infer a
// language. The host is the I/O boundary, matching corpus.js's existing
// abbreviation/POS loading discipline. Missing prior is an explicit gap, not
// permission to pretend one language's grammar is universal.

import fs from 'fs';

const POS_ROOT = new URL('../../bin/priors/pos/', import.meta.url);

export function loadPosPrior(language) {
  if (!language) return null;
  const filename = language === 'en' ? 'en-ud-ewt.json' : `${language}.json`;
  const path = new URL(filename, POS_ROOT);
  if (!fs.existsSync(path)) return null;
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (raw.schema !== 'POSPrior@1') {
    throw new TypeError(`loadPosPrior: expected POSPrior@1, got ${raw.schema}`);
  }
  if (!raw.provenance?.source) {
    throw new TypeError('loadPosPrior: received prior must name its giver');
  }
  return raw;
}

export function textStructurePriors(language) {
  const pos = loadPosPrior(language);
  return Object.freeze({
    language: language ?? null,
    pos,
    gaps: Object.freeze(pos || !language ? [] : [{
      reason: 'missing_pos_prior',
      language,
      detail: `no POSPrior@1 is installed for declared language ${language}`,
    }]),
  });
}
