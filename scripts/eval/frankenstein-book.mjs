import fs from 'node:fs';
import path from 'node:path';

import { openBookReading, advanceBookReading, assertBookCast } from '../../packages/host/book-reading.js';
import { discoverParameters } from '../../packages/engine/emergence/parameter-discovery.js';
import { splitSentences } from '../../packages/engine/perceiver/text/spans.js';

const input = process.argv[2] ?? 'tmp/frankenstein.txt';
const output = process.argv[3] ?? 'artifacts/frankenstein-book-report.json';
const requestedSection = process.argv[4]?.trim() || null;
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

const heading = /^(?:LETTER\s+[IVXLC0-9]+|CHAPTER\s+[IVXLC0-9]+)\.?\s*$/gim;
const marks = [...body.matchAll(heading)].map(m => ({ at: m.index, label: m[0].trim() }));
const allSections = [];
if (marks.length) {
  if (marks[0].at > 0 && body.slice(0, marks[0].at).trim()) allSections.push({ label: 'front-matter', value: body.slice(0, marks[0].at).trim() });
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].at;
    const end = marks[i + 1]?.at ?? body.length;
    const value = body.slice(start, end).trim();
    if (value) allSections.push({ label: marks[i].label, value });
  }
} else allSections.push({ label: 'whole-work', value: body });

const normLabel = x => String(x ?? '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sections = requestedSection
  ? allSections.filter(s => normLabel(s.label) === normLabel(requestedSection))
  : allSections;
if (!sections.length) throw new Error(`Requested section not found: ${requestedSection}`);
const selectedBody = sections.map(s => s.value).join('\n\n');

const events = [];
for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
  const section = sections[sectionIndex];
  const propositions = splitSentences(section.value);
  for (let propositionIndex = 0; propositionIndex < propositions.length; propositionIndex++) {
    const proposition = propositions[propositionIndex];
    if (!proposition.text?.trim()) continue;
    events.push({
      kind: 'text', unit: 'proposition', value: proposition.text.trim() + '\n',
      section: sectionIndex, sectionLabel: section.label, proposition: propositionIndex,
    });
  }
}
const entitySpec = { window: 16, draws: 64, reseeds: 32, minArrivals: 2 };

console.error(`FRANKENSTEIN_INPUT bytes=${Buffer.byteLength(selectedBody)} sections=${sections.length} propositions=${events.length} scope=${requestedSection ?? 'whole-work'}`);
const state = openBookReading({ sourceId: 'gutenberg:84', language: 'en', entitySpec });
const t0 = Date.now();
for (let i = 0; i < events.length; i++) {
  advanceBookReading(state, events[i], { executeTopTasks: 1 });
  if ((i + 1) % 250 === 0 || i + 1 === events.length) {
    const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    console.error(`FRANKENSTEIN_PROGRESS ${i + 1}/${events.length} ${events[i].sectionLabel} heapMB=${heapMB} forms=${state.reader.ontology.forms.size} identities=${state.reader.ontology.identities.size} relations=${state.reader.ontology.relations.size} frontier=${state.reader.frontier.records.size} tasks=${state.tasks.tasks.size} eventLog=${state.eventLog.length}`);
  }
}
const readingElapsedMs = Date.now() - t0;

const castAuditStart = Date.now();
const castAssertion = assertBookCast(state);
const castEntities = castAssertion.beings;
const castAuditElapsedMs = Date.now() - castAuditStart;

const ontology = state.reader.ontology;
const identities = [...ontology.identities.values()].map(x => ({
  id: x.id, left: x.left, right: x.right, standing: x.standing,
  supportEvents: [...x.supportEvents], attackEvents: [...x.attackEvents], history: [...x.history],
}));
const relations = [...ontology.relations.values()].map(x => ({
  ...x,
  participants: (x.participants ?? []).map(p => ({ ...p })),
  witness: x.witness ? { ...x.witness } : null,
  scope: x.scope ? { ...x.scope } : null,
  meta: x.meta ? { ...x.meta } : null,
}));
const nodeValues = new Set();
for (const relation of relations) for (const participant of relation.participants ?? []) {
  if (participant?.value != null) nodeValues.add(typeof participant.value === 'string' ? participant.value : JSON.stringify(participant.value));
}
for (const identity of identities) { nodeValues.add(identity.left); nodeValues.add(identity.right); }
for (const entity of castEntities) for (const surface of entity.surfaces ?? []) nodeValues.add(surface);

const eventLog = state.eventLog;
const parameterRows = [];
for (let i = 0; i + 1 < eventLog.length; i++) {
  const here = eventLog[i];
  const next = eventLog[i + 1];
  parameterRows.push({
    distinctions: [
      ...(here?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
      ...(here?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
    ],
    outcomes: [
      ...(next?.delta?.admittedKeys ?? []).map(key => ({ change: 'admitted', key })),
      ...(next?.delta?.withdrawnKeys ?? []).map(key => ({ change: 'withdrawn', key })),
    ],
    provenance: { event: here.event, section: here.sectionLabel, proposition: here.proposition, byteStart: here.byteStart, byteEnd: here.byteEnd },
  });
}
const parameterStart = Date.now();
const parameters = discoverParameters(parameterRows);
const parameterElapsedMs = Date.now() - parameterStart;

const tasks = [...state.tasks.tasks.values()].map(x => ({
  ...x, triggers: [...(x.triggers ?? [])], witnesses: [...(x.witnesses ?? [])], consequences: [...(x.consequences ?? [])],
}));
const taskCounts = {};
for (const task of tasks) taskCounts[`${task.kind}:${task.status}`] = (taskCounts[`${task.kind}:${task.status}`] ?? 0) + 1;
const hyperlexiconEntries = Object.values(state.hyperlexicon?.composition ?? {});
const finalTransition = state.lastTransition;

const report = {
  schema: 'EOFrankensteinBookEvaluation@7',
  source: {
    id: 'gutenberg:84', url: 'https://www.gutenberg.org/cache/epub/84/pg84.txt',
    scope: requestedSection ?? 'whole-work', bytes: Buffer.byteLength(selectedBody), sections: sections.length, propositions: events.length,
    sectionLabels: sections.map(s => s.label),
  },
  runtime: { readingElapsedMs, castAuditElapsedMs, parameterElapsedMs, elapsedMs: Date.now() - t0 },
  eventLog,
  cast: {
    count: castEntities.length, referents: castEntities,
    assertionAudit: { born: castAssertion.born, lapsed: castAssertion.lapsed },
    refusals: castAssertion.refusals, lapsed: castAssertion.lapsedEntities,
    identityAlternatives: identities,
  },
  relations: { count: relations.length, rows: relations },
  graph: {
    source: 'live-fold-ontology', nodeCount: nodeValues.size,
    edgeCount: relations.length + identities.length, nodes: [...nodeValues], relations, identities,
  },
  hyperlexicon: {
    count: hyperlexiconEntries.length,
    given: hyperlexiconEntries.filter(x => x.standing === 'given').length,
    candidate: hyperlexiconEntries.filter(x => x.standing === 'candidate').length,
    entries: hyperlexiconEntries,
  },
  tasks: { count: tasks.length, byKindAndStatus: taskCounts, rows: tasks, runs: state.taskRuns ?? [] },
  parameters,
  finalFold: finalTransition ? {
    event: finalTransition.event,
    horizonByteEnd: finalTransition.surf?.horizonByteEnd ?? null,
    beings: castEntities,
    identityAlternatives: identities,
    provisionalLinksAtLastEvent: finalTransition.fold?.provisional?.links ?? [],
    unresolved: finalTransition.fold?.unresolved ?? [],
    tension: finalTransition.fold?.tension ?? null,
    release: finalTransition.fold?.release ?? null,
    surprise: finalTransition.surprise ?? null,
  } : null,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  scope: report.source.scope, sourceBytes: report.source.bytes, sections: report.source.sections, propositions: report.source.propositions,
  readingElapsedMs, castAuditElapsedMs, parameterElapsedMs, elapsedMs: report.runtime.elapsedMs,
  cast: report.cast.count, relations: report.relations.count,
  graphNodes: report.graph.nodeCount, graphEdges: report.graph.edgeCount,
  hyperlexiconCandidates: report.hyperlexicon.candidate, tasks: report.tasks.count,
  parameters: report.parameters?.parameters?.length ?? 0, output,
}));