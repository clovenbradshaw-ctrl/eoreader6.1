// Causal corpus admission for an ExperienceStream.
//
// corpus.admitChunked() is intentionally compatible with whole-document and
// append-style callers, but its chunk coordinates restart for each call and
// its content-addressed repeat guard cannot distinguish a legitimate repeated
// later event from re-ingestion. A live reading needs a stricter contract:
// every event is a new temporal occasion with absolute coordinates in the
// growing source. This adapter writes the same host session shape while making
// that temporal identity explicit.

import { canonicalHashSync } from '../spec/canonical-json/index.js';
import { register } from '../../provenance/index.js';

const CHUNK_SIZE = 2000;
const MIN_CHUNK_CHARS = 20;
const utf8 = new TextEncoder();
const byteLength = text => utf8.encode(String(text ?? '')).length;

export function admitExperienceEvent(session, {
  sourceId,
  text,
  eventId,
  language,
} = {}) {
  if (!session) throw new TypeError('admitExperienceEvent: session is required');
  if (!sourceId) throw new TypeError('admitExperienceEvent: sourceId is required');
  if (eventId === undefined || eventId === null) throw new TypeError('admitExperienceEvent: eventId is required');
  if (!text) return { chunks: 0, admitted: [] };

  const eventKey = String(eventId);
  let info = session.documents.get(sourceId);
  const seenEvents = new Set(info?.experienceEventIds ?? []);
  if (seenEvents.has(eventKey)) {
    return { chunks: 0, admitted: [], deduped: true, eventId: eventKey };
  }

  const baseText = info?.text ?? '';
  const baseByte = byteLength(baseText);
  const startChunkIndex = info?.chunks?.length ?? 0;
  const admitted = [];
  const pieces = [];

  let offset = 0;
  let localChunk = 0;
  while (offset < text.length) {
    const end = Math.min(offset + CHUNK_SIZE, text.length);
    const chunkText = text.slice(offset, end);
    if (chunkText.trim().length >= MIN_CHUNK_CHARS) {
      const chunkIndex = startChunkIndex + localChunk;
      const byteStart = baseByte + byteLength(text.slice(0, offset));
      const textBytes = byteLength(chunkText);
      const byteEnd = byteStart + textBytes;
      const chunkId = `${sourceId}:chunk-${chunkIndex}`;
      const spanId = `span:${canonicalHashSync({
        sourceId,
        eventId: eventKey,
        chunkIndex,
        byteStart,
        chunkText,
      })}`;

      const span = {
        span_id: spanId,
        source_id: chunkId,
        byte_start: byteStart,
        byte_end: byteEnd,
        text: chunkText,
        preview: chunkText.slice(0, 110),
        score: 0,
        coverage: 0,
        phrase: chunkText.slice(0, 60),
        chunk_index: chunkIndex,
        experience_event: eventKey,
      };

      if (session.spans.size < session.spanCap) {
        session.spans.set(spanId, span);
        register(session.provenance, {
          sourceId: chunkId,
          byteStart,
          byteEnd,
          text: chunkText,
          spec: { experienceEvent: eventKey, documentSource: sourceId },
        });
      }

      const chunk = {
        id: chunkId,
        text: chunkText,
        byteStart,
        byteEnd,
        eventId: eventKey,
      };
      admitted.push(chunk);
      pieces.push({ byteStart, text: chunkText, length: textBytes, eventId: eventKey });
    }
    offset = end;
    localChunk += 1;
  }

  if (info) {
    info.chunks = info.chunks.concat(admitted);
    info.pieces = info.pieces.concat(pieces);
    info.text = baseText + text;
    info.experienceEventIds = [...seenEvents, eventKey];
    if (language) info.language = language;
  } else {
    info = {
      id: sourceId,
      path: sourceId,
      chunks: admitted,
      pieces,
      text,
      language: language ?? null,
      admissionHashes: [],
      experienceEventIds: [eventKey],
    };
    session.documents.set(sourceId, info);
  }

  return {
    chunks: admitted.length,
    admitted,
    eventId: eventKey,
    byteStart: baseByte,
    byteEnd: baseByte + byteLength(text),
  };
}
