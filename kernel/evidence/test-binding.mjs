// Test emergence/binding.js against real entity-arrival data derived from
// the actual Odyssey text - no synthetic entities, real character names,
// real word-position arrivals.
import fs from "node:fs";
import { tokenize } from "../../../eoreader6/packages/engine/perceiver/text/material.js";
import { stripContainer } from "../../../eoreader6/packages/engine/perceiver/text/spans.js";
import { readLinks, bindingTriples } from "../../../eoreader6/packages/engine/emergence/binding.js";

const raw = fs.readFileSync("../eoreader6/odyssey-greek.txt", "utf8");
const { text } = stripContainer(raw);
const words = tokenize(text); // already lowercased

const NAMES = ["ulysses", "telemachus", "penelope", "minerva", "eumaeus", "suitors", "antinous", "eurycleia"];
const entities = NAMES.map((id) => ({
  id,
  arrivals: words.reduce((acc, w, i) => (w === id ? (acc.push(i), acc) : acc), []),
}));

for (const e of entities) console.log(e.id, "- arrivals:", e.arrivals.length);

const totalUnits = words.length;
const links = readLinks(entities, { window: 300, draws: 200, seed: 42, totalUnits, extent: "combined-span" });

console.log("\n--- Links found:", links.length, "candidate pairs tested, of", entities.length * (entities.length - 1) / 2, "possible ---\n");
for (const l of links) {
  console.log(JSON.stringify({ a: l.a.id, b: l.b.id, direction: l.direction, polarity: l.polarity, strength: l.strength }));
}

const triples = bindingTriples(links);
console.log("\n--- directed triples (feed the graph) ---");
for (const t of triples) console.log(JSON.stringify(t));

fs.writeFileSync("kernel/evidence/binding-results.json", JSON.stringify({
  entityCounts: Object.fromEntries(entities.map((e) => [e.id, e.arrivals.length])),
  links: links.map((l) => ({ a: l.a.id, b: l.b.id, direction: l.direction, polarity: l.polarity, strength: l.strength })),
}, null, 2));
