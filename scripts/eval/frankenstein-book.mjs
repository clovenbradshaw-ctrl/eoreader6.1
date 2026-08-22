import fs from 'node:fs';
import path from 'node:path';

import { readBook } from '../../packages/host/book-reading.js';
import { admitGraph, sessionGraphSnapshot } from '../../packages/host/graph.js';
import { sessionRelations } from '../../packages/host/corpus.js';

const input = process.argv[2] ?? 'tmp/frankenstein.txt';
const output = process.argv[3] ?? 'artifacts/frankenstein-book-report.json';
const raw = fs.readFileSync(input, 'utf8').replace(/\r\n/g, '\n');

const startMarkers = [
  '*** START OF THE PROJECT GUTENBERG EBOOK FRANKENSTEIN',
  '*** START OF THIS PROJECT GUTENBERG EBOOK FRANKENSTEIN',
];
const endMarkers = [
  '*** END OF THE PROJECT GUTENBERG EBOOK FRANKENSTEIN',
  '*** END OF THIS PROJECT GUTENBERG EBOOK FRANKENSTEIN',
];

const findMarker = (markers) => {
  for (const marker of markers) {
    const i = raw.toUpperCase().indexOf(marker);
    if (i >= 0) return i;
  }
  return -1;
};

const startAt = findMarker(startMarkers);
const endAt = findMarker(endMarkers);
let body = raw;
if (startAt >= 0) body = raw.slice(raw.indexOf('\n', startAt) + 1);
if (endAt >= 0) {
  const relative = body.toUpperCase().indexOf(endMarkers.find(m => body.toUpperCase().includes(m)) ?? '___NO_MARKER___');
  if (relative >= 0) body = body.slice(0, relative);
}
body = body.trim();

const paragraphs = body.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
const events = paragraphs.map((value, i) => ({ kind: 'text', unit: 'paragraph', value: value + '\n\n', paragraph: i }));
const entitySpec = { window: 16, draws: 64, reseeds: 32, minArrivals: 2 };

console.error(`FRANKENSTEIN_INPUT bytes=${Buffer.byteLength(body)} paragraphs=${events.length}`);
const t0 = Date.now();
const book = readBook({
  sourceId: 'gutenberg:84',
  events,
  language: 'en',
  entitySpec,
  executeTopTasks: 1,
});
const elapsedMs = Date.now() - t0;

// Compile the already-admitted full source into the repository's existing
// belief graph once, after the causal read. This avoids double-counting the
// same document at every event while still exposing a mechanically queryable
// graph over the final discovered cast and relation surface.
const graphAdmission = admitGraph(book._reader?.horizon ?? book.reader?.horizon ?? null, { sourceId: 'gutenberg:84' });
const graph = sessionGraphSnapshot(book._reader?.horizon ?? book.reader?.horizon ?? null, { limit: 100 });
const relations = sessionRelations(book._reader?.horizon ?? book.reader?.horizon ?? null, { sourceId: 'gutenberg:84' });

const taskCounts = {};
for (const task of book.tasks ?? []) taskCounts[`${task.kind}:${task.status}`] = (taskCounts[`${task.kind}:${task.status}`] ?? 0) + 1;
const hyperlexiconEntries = Object.values(book.hyperlexicon?.composition ?? {});
const finalTransition = book.trajectory?.at(-1)?.transition ?? null;

const report = {
  schema: 'EOFrankensteinBookEvaluation@1',
  source: {
    id: 'gutenberg:84',
    url: 'https://www.gutenberg.org/cache/epub/84/pg84.txt',
    bytes: Buffer.byteLength(body),
    paragraphs: events.length,
  },
  runtime: { elapsedMs },
  cast: {
    count: book.cast?.referents?.length ?? 0,
    referents: book.cast?.referents ?? [],
    gaps: book.cast?.gaps ?? [],
  },
  relations: {
    count: relations.relations?.length ?? 0,
    rows: relations.relations ?? [],
    gaps: relations.gaps ?? [],
  },
  graph: {
    admission: graphAdmission?.admitted ?? [],
    nodeCount: graph.nodeCount,
    edgeCount: graph.edgeCount,
    edgeTotal: graph.edgeTotal,
    topNodes: graph.nodes,
    topEdges: graph.edges,
    standings: graph.standings,
  },
  hyperlexicon: {
    count: hyperlexiconEntries.length,
    given: hyperlexiconEntries.filter(x => x.standing === 'given').length,
    candidate: hyperlexiconEntries.filter(x => x.standing === 'candidate').length,
    entries: hyperlexiconEntries,
  },
  tasks: {
    count: book.tasks?.length ?? 0,
    byKindAndStatus: taskCounts,
    rows: book.tasks ?? [],
    runs: book.taskRuns ?? [],
  },
  parameters: book.parameters ?? null,
  finalFold: finalTransition ? {
    event: finalTransition.event,
    horizonByteEnd: finalTransition.surf?.horizonByteEnd ?? null,
    beings: finalTransition.admission?.beings ?? [],
    identityAlternatives: finalTransition.fold?.identityAlternatives ?? [],
    provisionalLinks: finalTransition.fold?.provisional?.links ?? [],
    unresolved: finalTransition.fold?.unresolved ?? [],
    tension: finalTransition.fold?.tension ?? null,
    release: finalTransition.fold?.release ?? null,
    surprise: finalTransition.surprise ?? null,
  } : null,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  sourceBytes: report.source.bytes,
  paragraphs: report.source.paragraphs,
  elapsedMs,
  cast: report.cast.count,
  relations: report.relations.count,
  graphNodes: report.graph.nodeCount,
  graphEdges: report.graph.edgeCount,
  hyperlexiconCandidates: report.hyperlexicon.candidate,
  tasks: report.tasks.count,
  parameters: report.parameters?.parameters?.length ?? 0,
  output,
}));
