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
import { loadAbbreviationPrior } from './language-priors.js';

const CHUNK_SIZE = 2000;
const MIN_CHUNK_CHARS = 20;
const utf8 = new TextEncoder();
const byteLength = text => utf8.encode(String(text ?? '')).length;

const initialiseAppendCursors = info => {
  if (!info) return;
  if (!Number.isInteger(info.experienceByteEnd)) info.experienceByteEnd = byteLength(info.text ?? '');
  if (!Number.isInteger(info.experienceNextChunkIndex)) {
    const chunks = info.chunks ?? [];
    info.experienceNextChunkIndex = chunks.length
      ? Math.max(...chunks.map((chunk, i) => Number.isInteger(chunk.chunk_index) ? chunk.chunk_index : i)) + 1
      : 0;
  }
  if (!(info._experienceEventIds instanceof Set)) info._experienceEventIds = new Set(info.experienceEventIds ?? []);
};

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

  const corpusLanguage = language && loadAbbreviationPrior(language) ? language : null;

  const eventKey = String(eventId);
  let info = session.documents.get(sourceId);
  initialiseAppendCursors(info);
  if (info?._experienceEventIds.has(eventKey)) {
    return { chunks: 0, admitted: [], deduped: true, eventId: eventKey };
  }

  // Append-only cursors are part of the live source state. Do not re-encode the
  // entire accumulated document or scan every previous chunk/event merely to
  // find the next address.
  const baseText = info?.text ?? '';
  const baseByte = info?.experienceByteEnd ?? 0;
  const startChunkIndex = info?.experienceNextChunkIndex ?? 0;
  const admitted = [];
  const pieces = [];

  let offset = 0;
  let localChunk = 0;
  let localByteOffset = 0;
  while (offset < text.length) {
    const end = Math.min(offset + CHUNK_SIZE, text.length);
    const chunkText = text.slice(offset, end);
    const textBytes = byteLength(chunkText);
    if (chunkText.trim().length >= MIN_CHUNK_CHARS) {
      const chunkIndex = startChunkIndex + localChunk;
      const byteStart = baseByte + localByteOffset;
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
        chunk_index: chunkIndex,
        eventId: eventKey,
      };
      admitted.push(chunk);
      pieces.push({ byteStart, text: chunkText, length: textBytes, eventId: eventKey });
    }
    offset = end;
    localByteOffset += textBytes;
    localChunk += 1;
  }

  const eventBytes = localByteOffset;
  if (info) {
    // mutate the live append log in place; concat would copy the whole history
    // on every proposition.
    info.chunks.push(...admitted);
    info.pieces.push(...pieces);
    info.text += text;
    info.experienceEventIds.push(eventKey);
    info._experienceEventIds.add(eventKey);
    info.experienceByteEnd = baseByte + eventBytes;
    info.experienceNextChunkIndex = startChunkIndex + localChunk;
    if (corpusLanguage) info.language = corpusLanguage;
  } else {
    info = {
      id: sourceId,
      path: sourceId,
      chunks: admitted,
      pieces,
      text,
      language: corpusLanguage,
      admissionHashes: [],
      experienceEventIds: [eventKey],
      _experienceEventIds: new Set([eventKey]),
      experienceByteEnd: eventBytes,
      experienceNextChunkIndex: localChunk,
    };
    session.documents.set(sourceId, info);
  }

  return {
    chunks: admitted.length,
    admitted,
    eventId: eventKey,
    byteStart: baseByte,
    byteEnd: baseByte + eventBytes,
    language: language ?? null,
    corpusLanguage,
  };
}
