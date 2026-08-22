import fs from 'node:fs';
import path from 'node:path';

import { openBookReading, advanceBookReading } from '../../packages/host/book-reading.js';
import { admitGraph, sessionGraphSnapshot } from '../../packages/host/graph.js';
import { sessionRelations, sessionReferents } from '../../packages/host/corpus.js';
import { discoverParameters } from '../../packages/engine/emergence/parameter-discovery.js';

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

const upper = raw.toUpperCase();
const startMarker = startMarkers.find(m => upper.includes(m));
const endMarker = endMarkers.find(m => upper.includes(m));
let body = raw;
if (startMarker) {
  const at = upper.indexOf(startMarker);
  body = raw.slice(raw.indexOf('\n', at) + 1);
}
if (endMarker) {
  const at = body.toUpperCase().indexOf(endMarker);
  if (at >= 0) body = body.slice(0, at);
}
body = body.trim();

const paragraphs = body.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
const events = paragraphs.map((value, i) => ({ kind: 'text', unit: 'paragraph', value: value + '\n\n', paragraph: i }));
const entitySpec = { window: 16, draws: 64, reseeds: 32, minArrivals: 2 };

console.error(`FRANKENSTEIN_INPUT bytes=${Buffer.byteLength(body)} paragraphs=${events.length}`);
const state = openBookReading({ sourceId: 'gutenberg:84', language: 'en', entitySpec });
const trajectory = [];
const t0 = Date.now();
for (let i = 0; i < events.length; i++) {
  trajectory.push(advanceBookReading(state, events[i], { executeTopTasks: 1 }));
  if ((i + 1) % 100 === 0) console.error(`FRANKENSTEIN_PROGRESS ${i + 1}/${events.length}`);
}
const elapsedMs = Date.now() - t0;

const cast = sessionReferents(state.reader.horizon, { sourceId: 'gutenberg:84', limit: Infinity });
const relations = sessionRelations(state.reader.horizon, { sourceId: 'gutenberg:84' });
const graphAdmission = admitGraph(state.reader.horizon, { sourceId: 'gutenberg:84' });
const graph = sessionGraphSnapshot(state.reader.horizon, { limit: 100 });

const parameterRows = trajectory.slice(0, -1).map((entry, i) => ({
  distinctions: [
    ...(entry.transition?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
    ...(entry.transition?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
  ],
  outcomes: [
    ...(trajectory[i + 1].transition?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
    ...(trajectory[i + 1].transition?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
  ],
  provenance: {
    event: i,
    byteStart: entry.transition?.surf?.admission?.byteStart ?? null,
    byteEnd: entry.transition?.surf?.admission?.byteEnd ?? null,
  },
}));
const parameters = discoverParameters(parameterRows);

const tasks = [...state.tasks.tasks.values()].map(x => ({
  ...x,
  triggers: [...(x.triggers ?? [])],
  witnesses: [...(x.witnesses ?? [])],
  consequences: [...(x.consequences ?? [])],
}));
const taskCounts = {};
for (const task of tasks) taskCounts[`${task.kind}:${task.status}`] = (taskCounts[`${task.kind}:${task.status}`] ?? 0) + 1;
const hyperlexiconEntries = Object.values(state.hyperlexicon?.composition ?? {});
const finalTransition = trajectory.at(-1)?.transition ?? null;

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
    count: cast.referents?.length ?? 0,
    referents: cast.referents ?? [],
    gaps: cast.gaps ?? [],
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
    count: tasks.length,
    byKindAndStatus: taskCounts,
    rows: tasks,
    runs: state.taskRuns ?? [],
  },
  parameters,
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
