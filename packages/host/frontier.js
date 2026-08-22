// Open structure frontier: language- and medium-neutral temporal obligations.
//
// This module never parses material. It consumes already-earned unresolved
// structure from any perceiver/emergence path and carries it across ordered
// experience. Tension and release are derived projections over this ledger,
// never new EO operators and never text-specific semantics.

const freeze = x => Object.freeze(x);
const stable = x => JSON.stringify(x);

export const FRONTIER_SCHEMA = 'EOOpenFrontier@2';

export function createOpenFrontier() {
  return {
    schema: FRONTIER_SCHEMA,
    records: new Map(),
    history: [],
  };
}

const identityKey = x => `identity:${x.id}`;
const linkKey = x => `link:${stable(x.assertion ?? x)}`;
const obligationKey = x => `obligation:${x.id}`;

const currentlyOpen = ({ recursive, perturbation, obligations = [] }) => {
  const out = new Map();

  for (const identity of recursive?.identityAlternatives ?? []) {
    if (identity.standing === 'distinct') continue;
    out.set(identityKey(identity), {
      id: identityKey(identity),
      terrain: 'Entity',
      kind: 'identity_alternative',
      subject: identity.id,
      standing: identity.standing,
      provenance: identity.history ?? (identity.latestAct ? [identity.latestAct] : []),
    });
  }

  for (const link of perturbation?.links ?? []) {
    if (link.disposition === 'survives' || link.disposition === 'survives_scoped') continue;
    out.set(linkKey(link), {
      id: linkKey(link),
      terrain: 'Link',
      kind: 'unresolved_proposition',
      subject: link.assertion ?? link,
      standing: link.disposition ?? 'unresolved',
      provenance: link.witness ? [link.witness] : [],
    });
  }

  for (const obligation of obligations ?? []) {
    if (!obligation?.id || obligation.status === 'resolved' || obligation.status === 'closed') continue;
    out.set(obligationKey(obligation), {
      id: obligationKey(obligation),
      terrain: obligation.terrain ?? 'Field',
      kind: obligation.kind ?? 'open_structure',
      subject: obligation.subject ?? obligation.id,
      standing: obligation.standing ?? obligation.status ?? 'open',
      expectation: obligation.expectation ?? null,
      provenance: obligation.provenance ?? [],
      pressure: obligation.pressure ?? null,
    });
  }

  return out;
};

export function advanceFrontier(frontier, { eventIndex, recursive, perturbation, obligations = [] } = {}) {
  if (!frontier || !String(frontier.schema).startsWith('EOOpenFrontier@')) {
    throw new TypeError('advanceFrontier: createOpenFrontier state is required');
  }
  const compact = Boolean(recursive?.compact);
  const now = currentlyOpen({ recursive, perturbation, obligations });
  const opened = [];
  const persisted = [];
  const resolved = [];

  for (const [id, item] of now) {
    const prior = frontier.records.get(id);
    if (!prior || prior.status !== 'open') {
      const record = {
        ...item,
        status: 'open',
        openedAt: eventIndex,
        lastChangedAt: eventIndex,
        pressure: item.pressure ?? null,
      };
      frontier.records.set(id, record);
      opened.push({ ...record, age: 0 });
    } else {
      prior.lastChangedAt = eventIndex;
      prior.standing = item.standing;
      prior.expectation = item.expectation;
      prior.provenance = item.provenance;
      prior.pressure = item.pressure;
      persisted.push({ ...prior, age: eventIndex - prior.openedAt });
    }
  }

  if (compact) {
    // Absence from a delta means unchanged, never resolved. Only explicit
    // transformations close records in compact append-only reading.
    const explicitResolved = new Set([
      ...(recursive?.transformations?.identitySplits ?? []).map(x => `identity:${x.identityId}`),
      ...(obligations ?? [])
        .filter(x => x?.id && (x.status === 'resolved' || x.status === 'closed'))
        .map(x => obligationKey(x)),
    ]);
    for (const id of explicitResolved) {
      const prior = frontier.records.get(id);
      if (!prior || prior.status !== 'open') continue;
      prior.status = 'resolved';
      prior.resolvedAt = eventIndex;
      prior.lastChangedAt = eventIndex;
      resolved.push({ ...prior, age: eventIndex - prior.openedAt });
    }
  } else {
    for (const [id, prior] of frontier.records) {
      if (prior.status !== 'open' || now.has(id)) continue;
      prior.status = 'resolved';
      prior.resolvedAt = eventIndex;
      prior.lastChangedAt = eventIndex;
      resolved.push({ ...prior, age: eventIndex - prior.openedAt });
    }
  }

  // This is the current Fold view, not history. Age is derived from the cursor;
  // unchanged records are not rewritten merely because time advanced.
  const open = [...frontier.records.values()]
    .filter(x => x.status === 'open')
    .map(x => freeze({
      ...x,
      age: eventIndex - x.openedAt,
      provenance: freeze([...(x.provenance ?? [])]),
    }));

  const delta = freeze({
    event: eventIndex,
    opened: freeze(opened.map(x => freeze({ ...x }))),
    persisted: freeze(persisted.map(x => freeze({ ...x }))),
    resolved: freeze(resolved.map(x => freeze({ ...x }))),
  });
  frontier.history.push(delta);

  const weight = x => Number.isFinite(x.pressure) && x.pressure >= 0 ? x.pressure : 1;
  const tension = open.reduce((sum, x) => sum + weight(x) * (1 + x.age), 0);
  const release = resolved.reduce((sum, x) => sum + weight(x) * (1 + x.age), 0);

  return freeze({
    schema: FRONTIER_SCHEMA,
    open: freeze(open),
    delta,
    tension,
    release,
  });
}
