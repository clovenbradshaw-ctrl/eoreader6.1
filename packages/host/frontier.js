// Open structure frontier: language- and medium-neutral temporal obligations.
//
// This module never parses material. It consumes already-earned unresolved
// structure from any perceiver/emergence path and carries it across ordered
// experience. Tension and release are derived projections over this ledger,
// never new EO operators and never text-specific semantics.

const freeze = x => Object.freeze(x);
const stable = x => JSON.stringify(x);

export const FRONTIER_SCHEMA = 'EOOpenFrontier@1';

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
      provenance: identity.history ?? [],
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

  // Generic omnimodal seam. An audio/music emergence organ can open an
  // expected recurrence or unresolved pattern continuation; a field reader
  // can open an unexplained regime transition; a table can open a missing
  // dependency. No language-shaped fields are required here.
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
  if (!frontier || frontier.schema !== FRONTIER_SCHEMA) {
    throw new TypeError('advanceFrontier: createOpenFrontier state is required');
  }
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
        age: 0,
      };
      frontier.records.set(id, record);
      opened.push({ ...record });
    } else {
      prior.age = eventIndex - prior.openedAt;
      prior.lastChangedAt = eventIndex;
      prior.standing = item.standing;
      prior.expectation = item.expectation;
      prior.provenance = item.provenance;
      prior.pressure = item.pressure;
      persisted.push({ ...prior });
    }
  }

  for (const [id, prior] of frontier.records) {
    if (prior.status !== 'open' || now.has(id)) continue;
    prior.status = 'resolved';
    prior.resolvedAt = eventIndex;
    prior.lastChangedAt = eventIndex;
    prior.age = eventIndex - prior.openedAt;
    resolved.push({ ...prior });
  }

  const open = [...frontier.records.values()]
    .filter(x => x.status === 'open')
    .map(x => freeze({ ...x, provenance: freeze([...(x.provenance ?? [])]) }));

  const delta = freeze({
    event: eventIndex,
    opened: freeze(opened.map(x => freeze({ ...x }))),
    persisted: freeze(persisted.map(x => freeze({ ...x }))),
    resolved: freeze(resolved.map(x => freeze({ ...x }))),
  });
  frontier.history.push(delta);

  // Scalars are downstream navigation aids. The inspectable ledger is the
  // canonical record. Default pressure is persistence-weighted only; a
  // modality/emergence organ may supply a nonnegative structural pressure.
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
