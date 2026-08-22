import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession } from '../packages/host/corpus.js';
import { admitExperienceEvent } from '../packages/host/experience-admission.js';

const bytes = s => new TextEncoder().encode(s).length;

test('experience admission keeps absolute coordinates and does not erase legitimate repetition', () => {
  const session = createSession();
  const sourceId = 'stream:repeat';
  const repeated = 'Mara crossed the threshold and looked back.\n\n';

  const a = admitExperienceEvent(session, { sourceId, eventId: 0, text: repeated });
  const b = admitExperienceEvent(session, { sourceId, eventId: 1, text: repeated });

  assert.equal(a.deduped, undefined);
  assert.equal(b.deduped, undefined, 'same words at a later event are new experience, not re-ingestion');
  assert.equal(a.byteStart, 0);
  assert.equal(a.byteEnd, bytes(repeated));
  assert.equal(b.byteStart, bytes(repeated));
  assert.equal(b.byteEnd, bytes(repeated + repeated));

  const doc = session.documents.get(sourceId);
  assert.equal(doc.text, repeated + repeated);
  assert.deepEqual(doc.experienceEventIds, ['0', '1']);
  assert.equal(doc.chunks.length, 2);
  assert.equal(doc.chunks[0].chunk_index, 0);
  assert.equal(doc.chunks[1].chunk_index, 1);
  assert.equal(doc.chunks[0].byteStart, 0);
  assert.equal(doc.chunks[1].byteStart, bytes(repeated));
  assert.notEqual(doc.chunks[0].id, doc.chunks[1].id);

  const spans = [...session.spans.values()].sort((x, y) => x.byte_start - y.byte_start);
  assert.equal(spans.length, 2);
  assert.equal(spans[0].byte_start, 0);
  assert.equal(spans[1].byte_start, bytes(repeated));
  assert.notEqual(spans[0].span_id, spans[1].span_id);

  const provenance = [...session.provenance.values()].sort((x, y) => x.byteStart - y.byteStart);
  assert.equal(provenance.length, 2);
  assert.equal(provenance[0].byteStart, 0);
  assert.equal(provenance[1].byteStart, bytes(repeated));
});

test('experience admission dedupes only the same declared event id', () => {
  const session = createSession();
  const text = 'A sufficiently long event exists to become a stored span.\n\n';
  const first = admitExperienceEvent(session, { sourceId: 'stream:idempotent', eventId: 'e0', text });
  const second = admitExperienceEvent(session, { sourceId: 'stream:idempotent', eventId: 'e0', text });

  assert.equal(first.deduped, undefined);
  assert.equal(second.deduped, true);
  assert.equal(session.documents.get('stream:idempotent').text, text);
  assert.equal(session.spans.size, 1);
});
