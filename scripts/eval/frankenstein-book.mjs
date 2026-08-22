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

// Read in the source's authored order and authored structural units. We do not
// create arbitrary fixed windows: letters and chapters are the book's own
// boundaries. Front matter before the first heading remains one initial unit.
const heading = /^(?:LETTER\s+[IVXLC0-9]+|CHAPTER\s+[IVXLC0-9]+)\.?\s*$/gim;
const marks = [...body.matchAll(heading)].map(m => ({ at: m.index, label: m[0].trim() }));
const sections = [];
if (marks.length) {
  if (marks[0].at > 0 && body.slice(0, marks[0].at).trim()) {
    sections.push({ label: 'front-matter', value: body.slice(0, marks[0].at).trim() });
  }
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].at;
    const end = marks[i + 1]?.at ?? body.length;
    const value = body.slice(start, end).trim();
    if (value) sections.push({ label: marks[i].label, value });
  }
} else {
  // Typed fallback: if the edition's heading typography is unrecognized, use
  // paragraphs rather than silently inventing chapters.
  for (const [i, value] of body.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean).entries()) {
    sections.push({ label: `paragraph:${i}`, value });
  }
}

const events = sections.map((section, i) => ({
  kind: 'text',
  unit: section.label.startsWith('LETTER') || section.label.startsWith('CHAPTER') ? 'authored-section' : 'passage',
  value: section.value + '\n\n',
  section: i,
  label: section.label,
}));
const entitySpec = { window: 16, draws: 64, reseeds: 32, minArrivals: 2 };

console.error(`FRANKENSTEIN_INPUT bytes=${Buffer.byteLength(body)} sections=${events.length} headings=${marks.length}`);
const state = openBookReading({ sourceId: 'gutenberg:84', language: 'en', entitySpec });
const trajectory = [];
const t0 = Date.now();
for (let i = 0; i < events.length; i++) {
  trajectory.push(advanceBookReading(state, events[i], { executeTopTasks: 1 }));
  console.error(`FRANKENSTEIN_PROGRESS ${i + 1}/${events.length} ${events[i].label}`);
}
const elapsedMs = Date.now() - t0;

const cast = sessionReferents(state.reader.horizon, { sourceId: 'gutenberg:84', limit: Infinity });
const relations = sessionRelations(state.reader.horizon, { sourceId: 'gutenberg:84' });
const graphAdmission = admitGraph(state.reader.horizon, { sourceId: 'gutenberg:84' });
const graph = sessionGraphSnapshot(state.reader.horizon, { limit: 100 });

const parameterRows = [];
for (let i = 0; i + 1 < trajectory.length; i++) {
  const here = trajectory[i].transition;
  const next = trajectory[i + 1].transition;
  parameterRows.push({
    distinctions: [
      ...(here?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
      ...(here?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
    ],
    outcomes: [
      ...(next?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
      ...(next?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
    ],
    provenance: {
      event: here?.event ?? i,
      label: events[i]?.label ?? null,
      byteStart: here?.surf?.admission?.byteStart ?? null,
      byteEnd: here?.surf?.admission?.byteEnd ?? null,
    },
  });
}
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
  schema: 'EOFrankensteinBookEvaluation@2',
  source: {
    id: 'gutenberg:84',
    url: 'https://www.gutenberg.org/cache/epub/84/pg84.txt',
    bytes: Buffer.byteLength(body),
    sections: events.length,
    sectionLabels: events.map(e => e.label),
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
  sections: report.source.sections,
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
