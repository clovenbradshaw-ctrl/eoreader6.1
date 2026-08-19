import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("./hyperlexicon-definitions-data.json", "utf8"));

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>HyperLexicon — eoreader6.1</title>
<style>
  :root {
    --bg: #0b0d10; --panel: #14171c; --border: #262b33; --text: #e6e9ef; --muted: #8b93a1;
    --accent: #6ea8fe; --accent2: #ffb454; --chip: #1c2128; --before: #6ea8fe; --after: #ffb454;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, system-ui, sans-serif; }
  header { padding: 20px 28px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); z-index: 10; }
  h1 { font-size: 17px; margin: 0 0 4px; font-weight: 600; }
  .meta { color: var(--muted); font-size: 12.5px; }
  .meta code { background: var(--chip); padding: 1px 5px; border-radius: 4px; }
  .search { margin-top: 12px; }
  .search input { width: 320px; max-width: 100%; padding: 7px 10px; background: var(--chip); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } }
  section { padding: 18px 24px; border-right: 1px solid var(--border); }
  section:last-child { border-right: none; }
  section h2 { font-size: 14px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .before .dot { background: var(--before); } .after .dot { background: var(--after); }
  section .desc { color: var(--muted); font-size: 12px; margin-bottom: 14px; }
  .gapnote { background: var(--chip); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 12px; color: var(--muted); margin-bottom: 14px; }
  .cards { display: flex; flex-direction: column; gap: 6px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 7px; padding: 8px 10px; cursor: pointer; }
  .card:hover { border-color: var(--accent); }
  .card .row1 { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .card .word { font-weight: 600; font-size: 13.5px; }
  .card .stats { color: var(--muted); font-size: 11px; white-space: nowrap; }
  .company { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); display: none; font-size: 12px; }
  .card.open .company { display: block; }
  .company .edge { color: var(--muted); padding: 2px 0; }
  .company .edge b { color: var(--text); font-weight: 500; }
  .company .position { color: var(--accent2); font-size: 10.5px; text-transform: uppercase; margin-right: 4px; }
  .company .empty { color: var(--muted); font-style: italic; }
  .company .subhead { color: var(--muted); font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; margin: 2px 0 6px; }
  .definition { font-size: 12.5px; color: var(--text); line-height: 1.6; margin-top: 8px; }
  .grammar-overlay { color: var(--muted); font-style: italic; }
  .corrob { color: var(--muted); font-size: 10.5px; }
  .nolabel { color: var(--muted); font-style: italic; }
  .related { display: flex; flex-wrap: wrap; gap: 6px; }
  .related .chip { background: var(--chip); border: 1px solid var(--border); border-radius: 12px; padding: 2px 10px; font-size: 12px; cursor: pointer; }
  .related .chip:hover { border-color: var(--accent2); color: var(--accent2); }
  .quote { color: var(--text); font-size: 12px; font-style: italic; line-height: 1.5; padding: 6px 0; border-top: 1px solid var(--border); }
  .quote:first-of-type { border-top: none; }
  .quote .surp { display: block; color: var(--accent2); font-style: normal; font-size: 10px; letter-spacing: .03em; margin-bottom: 2px; }
  .hidden { display: none !important; }
  .count { color: var(--muted); font-weight: 400; font-size: 12px; }
  .priors { margin-top: 12px; padding: 8px 10px; background: var(--chip); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; }
  .priors-label { color: var(--muted); font-size: 11px; margin-bottom: 6px; }
  .toggle { display: inline-flex; align-items: center; gap: 5px; margin-right: 18px; cursor: pointer; }
  .toggle i { color: var(--muted); font-style: italic; }
  .toggle input { cursor: pointer; }
  .overlay-off { opacity: 0.45; }
  .pos-abbr { color: var(--accent2); font-style: italic; font-weight: 400; font-size: 12px; }
  .card.proper-name { border-left: 2px solid var(--accent); }
  .card.proper-name .pos-abbr { color: var(--accent); }
  .entry-block { margin-top: 10px; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; }
  .entry-source { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
  .entry-source i { text-transform: none; letter-spacing: 0; }
  .wikt-record { padding: 8px 0; border-top: 1px solid var(--border); }
  .wikt-record:first-child { border-top: none; padding-top: 0; }
  .wikt-pos { color: var(--accent2); font-style: italic; font-size: 12px; margin: 0 0 4px; display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  .wikt-defs { margin: 0 0 6px 18px; padding: 0; font-size: 12.5px; }
  .wikt-defs li { margin-bottom: 4px; }
  .wikt-ex { color: var(--muted); font-style: italic; font-size: 11.5px; }
  .trad-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .trad-tag { background: var(--chip); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font-size: 10.5px; font-style: normal; color: var(--muted); cursor: default; }
  .trad-toggles { display: flex; flex-direction: column; gap: 3px; margin: 4px 0 8px 14px; }
  .record-match { margin: 4px 0 0 18px; font-size: 11.5px; }
  .record-match-label { color: var(--muted); text-transform: uppercase; font-size: 10px; letter-spacing: .03em; }
  .record-match-label i { text-transform: none; letter-spacing: 0; }
  .record-match.empty { color: var(--muted); font-style: italic; }
  .record-match .quote { padding: 3px 0; border: none; font-size: 11.5px; }
  .pos-jump { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .pos-jump-chip { background: var(--chip); border: 1px solid var(--accent2); color: var(--accent2); border-radius: 10px; padding: 2px 9px; font-size: 11px; cursor: pointer; }
  .pos-jump-chip:hover { background: var(--accent2); color: var(--bg); }
  .quote mark.hl { background: rgba(255,180,84,0.25); color: var(--accent2); font-weight: 600; font-style: normal; padding: 0 2px; border-radius: 2px; }
  .company-graph { display: block; margin: 6px auto 8px; width: 100%; max-width: 220px; height: auto; }
  .graph-center { fill: var(--accent); }
  .graph-center-label { fill: var(--bg); font-size: 9px; font-weight: 600; }
  .graph-node { fill: var(--chip); stroke: var(--border); stroke-width: 1; }
  .graph-node-label { fill: var(--text); font-size: 7px; }
  .graph-edge { stroke: var(--border); stroke-width: 1; }
  .graph-edge-label { fill: var(--muted); font-size: 6px; }
  .graph-overflow { fill: var(--muted); font-size: 8px; font-style: italic; }
</style>
</head>
<body>
<header>
  <h1>HyperLexicon <span style="opacity:.5;font-weight:400;font-size:14px">— eoreader6.1, live off one reading</span></h1>
  <div class="meta">
    <code>${data.corpus}</code> · ${Number.isFinite(data.sliceChars) ? `first ${data.sliceChars.toLocaleString()} chars` : "full corpus"} · ${data.sentences} sentences ·
    ${data.allMembers.length} words · holon level (internal, for search speed only): <code>${data.holonLevel}</code>
  </div>
  <div class="search"><input id="q" placeholder="filter words…" oninput="filterAll()"></div>
  <div class="priors">
    <div class="priors-label">how this definition is built — toggle a prior off to see the definition fall back to earned fact alone:</div>
    <div class="toggle" style="opacity:.85"><b>grammar</b>&nbsp;<i>— the underlying classification is always on (real evidence earned that); which grammarians' NAMES for it are shown is your call:</i></div>
    <div class="trad-toggles" id="trad-toggles"></div>
    <label class="toggle"><input type="checkbox" id="tg-bestfit" onchange="rerender()"> best fit per paradigm <i>— shows each grammarian's own top category even when no majority clears (labeled "best fit," never "dominant" — a plurality, not a certified reading)</i></label>
    <label class="toggle"><input type="checkbox" id="tg-forms" checked onchange="rerender()"> related forms <i>— giver: morphology.js suffix rule, unverified, no MorphologyPrior@1 table</i></label>
  </div>
</header>
<main>
  <section class="all-words">
    <div class="cards" id="all-cards"></div>
  </section>
</main>
<script>
const DATA = ${JSON.stringify(data)};

// position labels are earned (a/b/label = which slot of a Link this word
// occupies); the parenthetical grammar gloss is the SAME overlay
// mechanicalDefinition brackets — shown, never asserted as fact, and now
// TOGGLEABLE: turning a prior off does not hide it behind a CSS trick, it
// re-runs the definition build with that overlay excluded, the same
// server-side logic minus one input — so what you see with a prior off is
// what the definition actually falls back to, not a cosmetic dim-out of
// text that is still secretly there.
const POSITION_LABEL = { a: "end A", b: "end B", label: "label" };
const openWords = new Set(); // survives re-render across a toggle flip

// Mirrors scripts/hyperlexicon-definitions-data.mjs's mechanicalDefinition —
// same field order, same earned-facts-first structure — but as a pure
// function of (word data, toggle state), so flipping a toggle is a
// re-render, never a page reload or a server round-trip. Grammar is no
// longer toggleable — real treebank evidence earned "always on" — so it's
// unconditional here, matching the server side.
function grammarClause(g) {
  if (!g) return null;
  if (g.source === "wordclass") {
    if (g.dominant) {
      const total = g.candidates.reduce((s, c) => s + c.count, 0);
      return \`[grammar — giver: \${g.giver}: \${g.dominant.thraxClass} (\${(g.dominant.share * 100).toFixed(0)}% of \${total} attested tags)]\`;
    }
    const top2 = g.candidates.slice(0, 2).map(c => \`\${c.thraxClass ?? c.upos} \${(c.share * 100).toFixed(0)}%\`).join(" vs ");
    return \`[grammar — giver: \${g.giver}: no dominant reading (\${top2}) — needs an occurrence-level check, not a type-level table]\`;
  }
  return \`[grammar — giver: \${g.giver}: read as \${g.reading}, unverified]\`;
}
function buildDefinition(m, toggles) {
  // A proper name is a different KIND of entry — who this refers to, not
  // what it means — and the engine's own coreference already answered
  // that (sessionReferents), so this never falls through to the
  // common-word grammar/definition machinery, which has nothing honest to
  // say about a person's name.
  if (m.properName) {
    const p = m.properName;
    return \`"\${m.word}" — a proper name: \${p.display}, discovered by this reading's own coreference (\${p.mentions} mentions, surfaces attested: \${p.surfaces.join(", ")}). Not run through Wiktionary/grammar classification — those answer a different question (what a common word means) than this one (who this name refers to).\`;
  }
  const parts = [\`"\${m.word}" —\`];
  if (toggles.forms && m.relatedForms && m.relatedForms.length) {
    parts.push(\`Possibly related forms attested in this reading: \${m.relatedForms.map(r => r.word).join(", ")} [candidate, unverified — giver: \${m.relatedForms[0].giver}].\`);
  }
  if (m.mentions != null) parts.push(\`\${m.mentions} mention\${m.mentions === 1 ? "" : "s"} in this reading.\`);
  const { tally } = m.profile;
  // relation-extraction sometimes yields a blank end (empty string, not
  // undefined) — join()ing that in produces "with ." with nothing after
  // it. Filtered here rather than left to render as a broken sentence;
  // when NOTHING legible survives the filter, say so honestly instead of
  // silently dropping the clause or showing empty punctuation.
  const legible = (xs) => [...new Set(xs.filter((x) => x && x.trim().length > 0))];
  if (tally.label) {
    const pairs = m.company.filter(c => c.position === "label" && c.link.a?.trim() && c.link.b?.trim()).slice(0, 3).map(c => \`\${c.link.a} → \${c.link.b}\`);
    parts.push(pairs.length
      ? \`As a Link's label: connects \${tally.label} entity pair\${tally.label === 1 ? "" : "s"}: \${pairs.join("; ")}.\`
      : \`As a Link's label: connects \${tally.label} entity pair\${tally.label === 1 ? "" : "s"}, none legibly named by this extraction.\`);
  }
  if (tally.a) {
    const partners = legible(m.company.filter(c => c.position === "a").map(c => c.link.b)).slice(0, 3);
    parts.push(partners.length ? \`As Link end A (\${tally.a}x): with \${partners.join(", ")}.\` : \`As Link end A (\${tally.a}x), partner not legibly extracted.\`);
  }
  if (tally.b) {
    const partners = legible(m.company.filter(c => c.position === "b").map(c => c.link.a)).slice(0, 3);
    parts.push(partners.length ? \`As Link end B (\${tally.b}x): with \${partners.join(", ")}.\` : \`As Link end B (\${tally.b}x), partner not legibly extracted.\`);
  }
  if (!m.company.length) parts.push(\`No relation this reading extracted names it directly.\`);
  const gc = grammarClause(m.profile.grammar);
  if (gc) parts.push(gc);
  return parts.join(" ");
}

function currentToggles() {
  const traditions = new Set();
  document.querySelectorAll(".trad-toggles input:checked").forEach((el) => traditions.add(el.value));
  return {
    forms: document.getElementById("tg-forms").checked,
    bestFit: document.getElementById("tg-bestfit").checked,
    traditions,
  };
}

function renderCards(containerId, members) {
  const toggles = currentToggles();
  const el = document.getElementById(containerId);
  el.innerHTML = members.map((m, i) => {
    const companyHtml = m.company.length
      ? m.company.map(c => {
          // Always render the whole triple (A -> label -> B), with the word
          // this card is ABOUT bolded in whichever slot it actually occupies
          // — a label-position entry used to show only the other two slots
          // ("i -> come back"), never the queried word itself, so the row
          // was unreadable without remembering which card you were on.
          const partA = c.position === "a" ? \`<b>\${esc(c.link.a)}</b>\` : esc(c.link.a);
          const partB = c.position === "b" ? \`<b>\${esc(c.link.b)}</b>\` : esc(c.link.b);
          const partLabel = c.link.label
            ? (c.position === "label" ? \`<b>\${esc(c.link.label)}</b>\` : esc(c.link.label))
            : '<span class="nolabel">(no label)</span>';
          const corroborated = c.structuralWeight != null ? ' <span class="corrob">· also confirmed structurally</span>' : "";
          // Grammar reading is shown once — the headword badge, the
          // definition block, and (per-sense) the Wiktionary record's own
          // tradition tags — not repeated on every single link row, which
          // was noise once those other three places already say it.
          return \`<div class="edge"><span class="position">\${POSITION_LABEL[c.position]}</span>\${partA} → \${partLabel} → \${partB}\${c.negated ? " (negated)" : ""}\${corroborated}</div>\`;
        }).join("")
      : '<div class="empty">no direct graph Links recorded (may be real prose relation-extraction missed, not necessarily absent from the text — see uses below)</div>';
    const graphSvg = buildCompanyGraphSvg(displayWord(m), m.company);
    const usesHtml = (m.topUses && m.topUses.length)
      ? m.topUses.map(u => \`<div class="quote"><span class="surp">\${u.surprisal.toLocaleString()} µbits</span>"\${highlightWord(u.quote, m.word)}"</div>\`).join("")
      : '<div class="empty">no scored occurrences</div>';
    const openCls = openWords.has(m.word) ? " open" : "";
    const posAbbr = m.properName ? \`proper name · \${esc(m.properName.display)}\` : headwordTags(m.profile.grammar, toggles.traditions, toggles.bestFit);
    return \`<div class="card\${openCls}\${m.properName ? " proper-name" : ""}" data-word="\${m.word}" onclick="toggleCard(this, '\${esc(m.word)}')">
      <div class="row1">
        <span class="word">\${esc(displayWord(m))}\${posAbbr ? \` <span class="pos-abbr">\${posAbbr}</span>\` : ""}</span>
        <span class="stats">dist \${m.distance?.toFixed(2) ?? "—"} · headship \${m.headship?.toFixed(2) ?? "—"}</span>
      </div>
      <div class="company">
        <div class="entry-block">
          <div class="entry-source">wiktionary <i>(fetched live on open — en.wiktionary.org, CC BY-SA 4.0)</i></div>
          <div class="wikt" data-pending="1">·&nbsp;&nbsp;·&nbsp;&nbsp;·</div>
        </div>
        <div class="entry-block">
          <div class="entry-source">this reading <i>(measured, this session, this material only)</i></div>
          <div class="definition">\${esc(buildDefinition(m, toggles))}</div>
        </div>
        \${(toggles.forms && m.relatedForms && m.relatedForms.length) ? \`
        <div class="subhead" style="margin-top:10px">related forms <i>(candidate, unverified — suffix rule)</i></div>
        <div class="related">\${m.relatedForms.map(r => \`<span class="chip" onclick="event.stopPropagation(); jumpTo('\${esc(r.word)}')">\${esc(r.word)}</span>\`).join("")}</div>
        \` : ""}
        <div class="subhead" style="margin-top:10px">links (graph, earned position first)</div>
        \${graphSvg}
        \${companyHtml}
        <div class="subhead" style="margin-top:10px">top 5 significant uses (by causal surprisal)</div>
        \${usesHtml}
      </div>
    </div>\`;
  }).join("");
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function displayWord(m) {
  // A proper name gets its attested case-form (e.g. "Clerval") — never
  // invented, just the exact surface sessionReferents itself recorded.
  // Everything else IS its own key already.
  return m.properName ? (m.properName.caseForm || m.properName.display) : m.word;
}

// Case-insensitive, word-boundary-aware highlight of ONE target word
// inside already-unescaped quote text. Uses plain substring search
// rather than a dynamic RegExp — building a character-class escape for
// arbitrary text, doubled through this file's own outer template
// literal, is exactly the kind of layered escaping that has silently
// broken this file before; substring search needs none of it.
function highlightWord(quote, word) {
  const q = String(quote ?? "");
  if (!word) return esc(q);
  const lowerQ = q.toLowerCase();
  const lowerW = word.toLowerCase();
  const isWordChar = (ch) => /[a-z0-9']/i.test(ch);
  let out = "";
  let i = 0;
  while (i < q.length) {
    const hit = lowerQ.indexOf(lowerW, i);
    if (hit === -1) { out += esc(q.slice(i)); break; }
    const before = hit > 0 ? q[hit - 1] : "";
    const after = q[hit + word.length] || "";
    out += esc(q.slice(i, hit));
    const matched = q.slice(hit, hit + word.length);
    out += (!isWordChar(before) && !isWordChar(after)) ? \`<mark class="hl">\${esc(matched)}</mark>\` : esc(matched);
    i = hit + word.length;
  }
  return out;
}

function truncateNode(s) {
  const t = String(s ?? "");
  return t.length > 10 ? \`\${t.slice(0, 9)}…\` : t;
}

// The Links section as an actual graph, not a text list — the SAME
// edges companyHtml already shows, laid out radially with the card's
// own word at the center. Capped at MAX_SPOKES only to stay legible;
// the full text list still renders directly below this, so nothing
// shown there is hidden here — this is a second rendering of the same
// data, never a filtered one.
function buildCompanyGraphSvg(word, company) {
  if (!company || !company.length) return "";
  const MAX_SPOKES = 10;
  const edges = company.slice(0, MAX_SPOKES).map((c) => {
    if (c.position === "a") return { other: c.link.b, label: c.link.label || "", arrow: "out" };
    if (c.position === "b") return { other: c.link.a, label: c.link.label || "", arrow: "in" };
    return { other: \`\${c.link.a || "?"} → \${c.link.b || "?"}\`, label: "connects", arrow: "label" };
  }).filter((e) => e.other && String(e.other).trim());
  if (!edges.length) return "";
  const n = edges.length;
  const cx = 108, cy = 100, r = 66;
  const nodes = edges.map((e, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { ...e, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const spokes = nodes.map((nd) => {
    const midX = (cx + nd.x) / 2, midY = (cy + nd.y) / 2;
    const glyph = nd.arrow === "in" ? "←" : nd.arrow === "label" ? "·" : "→";
    const labelText = nd.label ? \`\${glyph} \${nd.label}\` : glyph;
    return \`<line x1="\${cx}" y1="\${cy}" x2="\${nd.x.toFixed(1)}" y2="\${nd.y.toFixed(1)}" class="graph-edge" />
      <text x="\${midX.toFixed(1)}" y="\${(midY - 3).toFixed(1)}" class="graph-edge-label" text-anchor="middle">\${esc(labelText)}</text>
      <circle cx="\${nd.x.toFixed(1)}" cy="\${nd.y.toFixed(1)}" r="17" class="graph-node"><title>\${esc(nd.other)}</title></circle>
      <text x="\${nd.x.toFixed(1)}" y="\${nd.y.toFixed(1)}" class="graph-node-label" text-anchor="middle" dominant-baseline="middle">\${esc(truncateNode(nd.other))}</text>\`;
  }).join("");
  const overflow = company.length > MAX_SPOKES
    ? \`<text x="\${cx}" y="\${(cy + r + 18).toFixed(1)}" class="graph-overflow" text-anchor="middle">+\${company.length - MAX_SPOKES} more edge\${company.length - MAX_SPOKES === 1 ? "" : "s"} — full list below</text>\`
    : "";
  return \`<svg viewBox="0 0 216 \${(cy + r + 26).toFixed(0)}" class="company-graph" role="img" aria-label="relationship graph for \${esc(word)}">
    <circle cx="\${cx}" cy="\${cy}" r="22" class="graph-center" />
    <text x="\${cx}" y="\${cy}" class="graph-center-label" text-anchor="middle" dominant-baseline="middle">\${esc(truncateNode(word))}</text>
    \${spokes}
    \${overflow}
  </svg>\`;
}

// word -> member record, built once, so a click can look up this word's
// own dominant grammar reading without re-scanning both partitions.
const wordIndex = new Map();
for (const m of DATA.allMembers) wordIndex.set(m.word, m);

// Dionysius Thrax's own eight, abbreviated the way a dictionary headword
// abbreviates them — but only ever from OUR measured dominant class, never
// invented, and never shown at all when the treebank had no dominant
// reading for this form (m.profile.grammar.dominant === null).
const THRAX_ABBR = { noun: "n.", verb: "v.", pronoun: "pron.", article: "art.", preposition: "prep.", conjunction: "conj.", adverb: "adv.", interjection: "interj." };
// headwordTags fills in once allReadings/TRADITIONS exist below — declared
// here (var, hoisted) so renderCards can reference it before that point in
// the file without a forward-reference error; assigned after the tables it
// depends on.
var headwordTags;

// ── other grammarians, as a legend, not a citation every time ──────────────
//
// Thrax is one tradition's carve-up, not a law — this session's own
// correction, several turns back. Two more, real and dated, each mapped
// from the SAME earned UD tag wordclass.js already measured (never a new
// classification, only a different NAME for the one already-measured
// class): Yaska's Nirukta (Vedic Sanskrit, ~7th-5th c. BCE — older than
// Thrax, and structurally different: four classes, not eight, because
// Sanskrit grammar never split preposition/conjunction/interjection/adverb
// apart the way Greek did — verified 2026-08-19 against Yaska's own
// definitions, not asserted from memory: nama (nouns AND pronouns, one
// class), akhyata (verb), upasarga (prefix, closest analogue to
// preposition), nipata (the catch-all indeclinable-particle class Thrax's
// tradition split four ways). And Lindley Murray's English Grammar (1795)
// — the codification most readers already carry around unnamed, chosen
// because it is the direct ancestor of ordinary school-grammar terms and
// diverges from Thrax mainly by giving adjective its own class, which
// Greek and Latin grammar folded under noun by shared nominal inflection.
const TRADITIONS = [
  { key: "thrax", name: "Dionysius Thrax", date: "~100 BCE, Alexandria (Greek)" },
  { key: "yaska", name: "Yaska's Nirukta", date: "~7th-5th c. BCE (Vedic Sanskrit) — verified via Yaska's own four-class definitions, not assumed" },
  { key: "murray", name: "Lindley Murray's English Grammar", date: "1795 — the school-grammar tradition most readers already know" },
];
// UD tag -> each tradition's own category name. Never a new measurement —
// THRAX_MAP already exists in wordclass.js; these two are additive
// translations of the identical earned tag, kept in the viewer rather than
// the engine because they are presentation, not a claim the engine itself
// makes.
const YASKA_MAP = { NOUN: "nāma", PROPN: "nāma", PRON: "nāma", DET: "nāma", VERB: "ākhyāta", AUX: "ākhyāta", ADP: "upasarga", CCONJ: "nipāta", SCONJ: "nipāta", ADV: "nipāta", INTJ: "nipāta", ADJ: "nāma" };
const MURRAY_MAP = { NOUN: "noun", PROPN: "noun", VERB: "verb", AUX: "verb", PRON: "pronoun", ADJ: "adjective", ADV: "adverb", ADP: "preposition", CCONJ: "conjunction", SCONJ: "conjunction", DET: "article", INTJ: "interjection" };
const TRADITION_MAPS = { yaska: YASKA_MAP, murray: MURRAY_MAP };

// Every ENABLED tradition's reading of ONE candidate, from its own upos —
// Thrax's own thraxClass is already in the candidate (wordclass.js's own
// work); the other two are read off the SAME upos here. 'enabled' is a
// Set of tradition keys the toggles say to show — filtering here, not by
// hiding-with-CSS, so a disabled tradition costs nothing to compute either.
// NOTE: this whole script lives inside ONE outer template literal — a bare
// backtick anywhere in a comment silently closes it early (measured: this
// exact line did, "Unexpected identifier 'enabled'"). Never use backticks
// for code-style quoting in these comments; single quotes only.
function allReadings(candidate, enabled) {
  return TRADITIONS.filter((t) => !enabled || enabled.has(t.key)).map((t) => ({
    key: t.key,
    name: t.name,
    reading: t.key === "thrax" ? candidate.thraxClass : TRADITION_MAPS[t.key]?.[candidate.upos] ?? null,
  })).filter((r) => r.reading);
}

// Legend checkboxes, generated from TRADITIONS itself so the list of
// grammarians lives in exactly one place — default all on.
document.getElementById("trad-toggles").innerHTML = TRADITIONS.map((t) =>
  \`<label class="toggle"><input type="checkbox" value="\${t.key}" checked onchange="rerender()"> \${esc(t.name)} <i>— \${esc(t.date)}</i></label>\`
).join("");

// BEST FIT is a DIFFERENT question from dominant, not a looser version of
// it: dominant asks "does ONE of this word's UD tags clear a majority,"
// checked once, in UD's own (Thrax-grain) tag space. Best fit re-AGGREGATES
// the same attested counts into EACH tradition's own category boundaries
// first, THEN takes the argmax — so Yaska's coarser 4-way split can show a
// confident best fit precisely where Thrax's finer 8-way split correctly
// refuses ("no dominant reading"), because tags Thrax keeps apart may
// collapse into one Yaska bucket. Always returns an argmax, majority or
// not — every caller must label it "best fit," never "dominant," so a weak
// plurality (e.g. 36%) is never shown as if it were a certified reading.
function bestFitReadings(candidates, enabled) {
  if (!candidates?.length) return [];
  return TRADITIONS.filter((t) => !enabled || enabled.has(t.key)).map((t) => {
    const byCategory = new Map();
    let total = 0;
    for (const c of candidates) {
      const cat = t.key === "thrax" ? c.thraxClass : TRADITION_MAPS[t.key]?.[c.upos];
      total += c.count;
      if (!cat) continue;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + c.count);
    }
    if (!byCategory.size) return null;
    const [reading, count] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return { key: t.key, name: t.name, reading, share: total > 0 ? count / total : 0 };
  }).filter(Boolean);
}

// The headword badge: every ENABLED tradition's reading of this word's own
// class. Strict mode uses g.dominant (majority or refuse); best-fit mode
// re-aggregates per tradition and always shows the argmax, sharing the
// same THRAX_ABBR-style abbreviation for Thrax/Murray's English category
// words and Yaska's own Sanskrit term as-is.
headwordTags = function (g, enabled, bestFit) {
  if (g?.source !== "wordclass") return null;
  const abbr = (r) => (r.key === "yaska" ? r.reading : (THRAX_ABBR[r.reading] ?? r.reading));
  if (bestFit) {
    const readings = bestFitReadings(g.candidates, enabled);
    if (!readings.length) return null;
    return readings.map((r) => \`\${abbr(r)} (\${(r.share * 100).toFixed(0)}%)\`).join(" · ");
  }
  if (!g.dominant) return null;
  const readings = allReadings(g.dominant, enabled);
  if (!readings.length) return null;
  return readings.map(abbr).join(" · ");
};

// Wiktionary's own POS heading text -> the UD tag it corresponds to, so a
// Wiktionary section can be cross-tagged with all three traditions' names
// for that same category — a real correspondence (both are naming the
// same grammatical fact about the word), not a claim Wiktionary and UD
// agree on everything.
// Wiktionary has no separate "Auxiliary" heading — would/will/can all sit
// under "Verb" there, while UD's own tagset splits AUX from VERB (the same
// fold THRAX_MAP itself already makes for Thrax's tradition). Arrays, not
// single tags, so a Wiktionary "Verb" section matches either.
const WIKT_POS_TO_UD = { Noun: ["NOUN"], "Proper noun": ["PROPN"], Verb: ["VERB", "AUX"], Pronoun: ["PRON"], Determiner: ["DET"], Article: ["DET"], Adjective: ["ADJ"], Adverb: ["ADV"], Preposition: ["ADP"], Conjunction: ["CCONJ", "SCONJ"], Interjection: ["INTJ"] };

// FETCHED LIVE ON OPEN, NOT PRE-FETCHED FOR 575 WORDS UP FRONT — one
// request, the moment you click, via Wikimedia's own REST definition
// endpoint (verified: access-control-allow-origin: * — a plain browser
// fetch works, no proxy). This is EXTERNAL, UNMEASURED reference content —
// Wiktionary's own editors' word, not this session's — kept in its own
// clearly-labeled block, never blended into the measured definition below
// it. HTML in the response (Wiktionary's own wikilinks/formatting) is
// stripped to plain text before insertion — never trust remote markup into
// innerHTML raw, however reputable the source.
function stripHtml(s) {
  const d = document.createElement("div");
  d.innerHTML = String(s ?? "");
  // .textContent walks EVERY text node, including inline <style>/<script>
  // Wiktionary's own markup embeds (e.g. ".mw-parser-output .defdate{...}")
  // — invisible when rendered, but textContent doesn't know "invisible,"
  // it only knows "text node." Strip those elements out before reading
  // text, not just style tags visually hidden by CSS the div never applies.
  d.querySelectorAll("style, script").forEach((el) => el.remove());
  return (d.textContent || "").replace(/\\s+/g, " ").trim();
}
// Match THIS reading's own evidence to a Wiktionary POS section — real
// evidence, honestly weak. Only one heuristic is trusted enough to state
// plainly: "<word> of" in a quote is a real phrasal-preposition signal
// (because of, instead of, in spite of — a genuine English pattern, not
// invented for this word). Every other assignment falls back to the
// word's own measured dominant/leading UD tag from wordclass.js, marked
// explicitly as type-level (this word usually reads as X) rather than a
// per-occurrence verdict — occurrence-level attribution is resolveSpanRole's
// job (wordclass.js's own stated next step), not built here. A section
// with nothing to attach says so, rather than forcing a quote into it.
function matchOccurrences(word, udTags, m) {
  const quotes = m.topUses ?? [];
  if (udTags.includes("ADP")) {
    const hits = quotes.filter((u) => u.quote.toLowerCase().includes(\`\${word} of\`));
    if (hits.length) return { quotes: hits, basis: \`contains "\${word} of" — a real phrasal-preposition pattern\` };
  }
  const g = m.profile.grammar;
  const leading = g?.source === "wordclass" ? (g.dominant?.upos ?? g.candidates?.[0]?.upos) : null;
  if (leading && udTags.includes(leading) && quotes.length) {
    return { quotes: quotes.slice(0, 2), basis: \`this word's own leading measured tag in this reading (type-level, not verified per-occurrence)\` };
  }
  return null;
}

async function loadWiktionary(word, container, m, enabledTraditions) {
  container.innerHTML = "<i>loading…</i>";
  try {
    const res = await fetch(\`https://en.wiktionary.org/api/rest_v1/page/definition/\${encodeURIComponent(word)}\`);
    if (res.status === 404) { container.innerHTML = '<i class="empty">no Wiktionary entry for this exact form</i>'; return; }
    if (!res.ok) { container.innerHTML = \`<i class="empty">Wiktionary lookup failed (HTTP \${res.status})</i>\`; return; }
    const data = await res.json();
    const sections = data.en ?? []; // English only — this whole pipeline is English-language material
    if (!sections.length) { container.innerHTML = '<i class="empty">no English entry on Wiktionary for this form</i>'; return; }
    const recIdOf = (secIdx) => \`wikt-\${esc(word)}-\${secIdx}\`;
    const records = sections.map((sec, secIdx) => {
      const defs = sec.definitions.map((d) => stripHtml(d.definition)).map((text, i) => ({ text, ex: sec.definitions[i].examples?.[0] })).filter((d) => d.text.length > 0).slice(0, 5);
      if (!defs.length) return null;
      const udTags = WIKT_POS_TO_UD[sec.partOfSpeech] ?? [];
      // Every candidate this word was ever classified as, restricted to
      // the ones that share THIS section's UD tag(s) — usually one, but
      // classifyWord's own candidates carry real counts if there's more.
      const candidate = (m.profile.grammar?.candidates ?? []).find((c) => udTags.includes(c.upos));
      const traditionTags = candidate ? allReadings(candidate, enabledTraditions) : [];
      const tagsHtml = traditionTags.length
        ? \`<div class="trad-tags">\${traditionTags.map((r) => \`<span class="trad-tag" title="\${esc(r.name)}">\${esc(r.key)}: \${esc(r.reading)}</span>\`).join("")}</div>\`
        : "";
      const match = udTags.length ? matchOccurrences(word, udTags, m) : null;
      const matchHtml = match
        ? \`<div class="record-match"><div class="record-match-label">seen in this reading <i>(\${esc(match.basis)})</i></div>\${match.quotes.map((u) => \`<div class="quote">"\${esc(u.quote)}"</div>\`).join("")}</div>\`
        : \`<div class="record-match empty">no occurrence in this reading matched to this sense</div>\`;
      return { pos: sec.partOfSpeech, html: \`<div class="wikt-record" id="\${recIdOf(secIdx)}">
      <div class="wikt-pos">\${esc(sec.partOfSpeech)}\${tagsHtml}</div>
      <ol class="wikt-defs">\${defs.map(d => \`<li>\${esc(d.text)}\${d.ex ? \`<div class="wikt-ex">"\${esc(stripHtml(d.ex))}"</div>\` : ""}</li>\`).join("")}</ol>
      \${matchHtml}
      </div>\` };
    }).map((r, i) => r ? { ...r, secIdx: i } : null).filter(Boolean);
    // "the other version of the word" — every OTHER part-of-speech this
    // same word has, as jump chips, so a word Wiktionary splits four ways
    // (like "because": conjunction/adverb/interjection/preposition) can be
    // hopped between without scrolling past the others.
    const jumpHtml = records.length > 1
      ? \`<div class="pos-jump">\${records.map((r) => \`<span class="pos-jump-chip" onclick="event.stopPropagation(); document.getElementById('\${recIdOf(r.secIdx)}').scrollIntoView({behavior:'smooth', block:'start'})">\${esc(r.pos)}</span>\`).join("")}</div>\`
      : "";
    container.innerHTML = jumpHtml + records.map((r) => r.html).join("");
  } catch (e) {
    container.innerHTML = \`<i class="empty">Wiktionary lookup failed (\${esc(e.message)})</i>\`;
  }
}
// A short, crude, MECHANICAL content-word filter — not a claim of
// linguistic rigor (frequencyBands' own real content/function split is
// server-side only), just enough to keep "the," "and," "with" from
// padding an overlap count that is supposed to mean something. Words
// under 4 letters are skipped for the same reason: too likely to collide
// by chance, not because they are unimportant.
const STOPWORDS = new Set(["that","this","with","from","have","were","been","they","their","which","about","into","upon","also","would","could","should","when","what","where","then","than","some","such","more","most","only","very","over","after","before"]);
function contentWords(text) {
  return new Set((text.toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
}

// DECLARED, NOT DERIVED — same discipline as everything else in this
// pipeline that refuses to guess. This engine's own genre machinery
// (emergence/genre-seed.js) is explicit that genre is witness-tier,
// received knowledge with a named giver, never something derived from the
// text itself ("THE PRIOR IS RECEIVED, NEVER INVENTED"). So the corpus's
// own title is named here, not parsed out of a file path.
const CORPUS_TITLE = "Frankenstein";
let corpusGenrePromise = null;
// Fetched ONCE, cached, reused by every proper-name resolution — the
// corpus's own genre identity from the SAME mechanism (a Wikipedia
// description) used to identify referents, so "is this referent native
// fiction to the book, or a real-world thing the book mentions" is one
// consistent physics, not two different heuristics.
function corpusGenre() {
  if (!corpusGenrePromise) {
    corpusGenrePromise = fetch(\`https://en.wikipedia.org/api/rest_v1/page/summary/\${encodeURIComponent(CORPUS_TITLE)}\`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return corpusGenrePromise;
}

// THE WARRANT CHECK, PHYSICS ONLY — no semantic judgment about whether a
// Wikipedia article "seems right." Two purely mechanical facts, both
// already available with no new measurement: (1) Wikipedia's own 'type'
// field — "disambiguation" is Wikipedia SAYING the query was too
// ambiguous to resolve, a refusal signal to trust, not overrule by trying
// harder; (2) literal word overlap between the returned extract and this
// reading's OWN context for the name (topUses — quotes already pulled by
// causal surprisal, nothing fetched new). A real historical/fictional
// match should share real vocabulary with the passages that mention it;
// near-zero overlap is reported as exactly that, not hidden.
async function resolveWikipedia(word, m, container) {
  container.innerHTML = "<i>resolving…</i>";
  const p = m.properName;
  // Longest attested surface first — sessionReferents' own coreference
  // already carries this; "Cornelius Agrippa" disambiguates on Wikipedia
  // where bare "Agrippa" does not, and that is a fact about Wikipedia's
  // own title/redirect graph, not something guessed here.
  const surfaces = [...p.surfaces].sort((a, b) => b.length - a.length);
  const query = surfaces[0];
  try {
    const res = await fetch(\`https://en.wikipedia.org/api/rest_v1/page/summary/\${encodeURIComponent(query.replace(/ /g, "_"))}\`);
    if (res.status === 404) {
      container.innerHTML = \`<i class="empty">no Wikipedia article for "\${esc(query)}" — tried the longest attested surface, not a guess at a different one.</i>\`;
      return;
    }
    if (!res.ok) { container.innerHTML = \`<i class="empty">Wikipedia lookup failed (HTTP \${res.status})</i>\`; return; }
    const data = await res.json();
    if (data.type === "disambiguation") {
      container.innerHTML = \`<i class="empty">"\${esc(query)}" is ambiguous on Wikipedia itself (a disambiguation page) — refused rather than guessed. This reading's own context alone isn't enough to pick one mechanically.</i>\`;
      return;
    }
    const extract = data.extract || "";

    // FICTION CHECK: does THIS referent's own Wikipedia description
    // reference the corpus's own work-identity (also fetched, also
    // giver-named — corpusGenre() above)? Agrippa's description is purely
    // biographical, naming no novel. Victor Frankenstein's description
    // names "Mary Shelley's 1818 novel" directly — the SAME work
    // corpusGenre() independently resolves this material to. That
    // agreement is checked as literal string containment, not asserted —
    // a real cross-reference between two independent lookups, not one
    // borrowed guess dressed as two facts.
    const description = data.description || "";
    const genre = await corpusGenre();
    const genreWords = genre ? contentWords(\`\${genre.title} \${genre.description || ""}\`) : new Set();
    const descWords = contentWords(description);
    const referencesThisWork = [...genreWords].some((w) => descWords.has(w));
    const fictionLanguage = /\\bfictional\\b|\\bcharacter\\b|\\bnovel\\b|\\bprotagonist\\b/i.test(description);
    const fictionNote = referencesThisWork
      ? \`<div class="wikt-record"><div class="record-match-label">fiction check — this description names the SAME work this corpus resolves to</div>"\${esc(description)}" vs. corpus genre (giver: Wikipedia, "\${esc(CORPUS_TITLE)}"): "\${esc(genre?.description ?? "unresolved")}" — native fictional character in this book, not an external reference.</div>\`
      : fictionLanguage
        ? \`<div class="wikt-record"><div class="record-match-label">fiction check — description uses fiction language ("\${esc(description)}") but does not name this specific work — likely fiction, not confirmed native to THIS book</div></div>\`
        : \`<div class="wikt-record"><div class="record-match-label">fiction check — description reads as biographical/real-world\${description ? \`: "\${esc(description)}"\` : ""} — an external reference the book makes, not a character native to it</div></div>\`;

    // The name's own words trivially "overlap" (we searched using them) —
    // that proves the query, not the match. Excluded here so the warrant
    // only counts words we did NOT already put in: real additional
    // information this reading independently carries about the referent
    // (surfaces, the display name, the article's own title) agreeing with
    // real additional information Wikipedia carries.
    const nameWords = contentWords([...p.surfaces, data.title, query].join(" "));
    const sourceWords = new Set([...contentWords((m.topUses || []).map((u) => u.quote).join(" "))].filter((w) => !nameWords.has(w)));
    const extractWords = new Set([...contentWords(extract)].filter((w) => !nameWords.has(w)));
    const shared = [...sourceWords].filter((w) => extractWords.has(w));
    const warrant = shared.length
      ? \`<div class="wikt-record"><div class="record-match-label">warrant — shared vocabulary with this reading's own context, name words excluded (physics only, no semantic judgment)</div><div class="trad-tags">\${shared.slice(0, 8).map((w) => \`<span class="trad-tag">\${esc(w)}</span>\`).join("")}</div></div>\`
      : \`<div class="wikt-record record-match empty">FAILED WARRANT — resolved to \${esc(data.title)} by name alone (Wikipedia's own title/redirect graph, not this reading); no shared vocabulary beyond the name itself between this reading's context and the article extract. Treat the match as unverified, not confirmed.</div>\`;
    container.innerHTML = \`<div class="wikt-record">
      <div class="wikt-pos">\${esc(data.title)} <a href="\${esc(data.content_urls?.desktop?.page || \`https://en.wikipedia.org/wiki/\${encodeURIComponent(data.title)}\`)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="pos-jump-chip">wikipedia ↗</a></div>
      <div class="wikt-ex">\${esc(extract)}</div>
      </div>\${fictionNote}\${warrant}\`;
  } catch (e) {
    container.innerHTML = \`<i class="empty">Wikipedia lookup failed (\${esc(e.message)})</i>\`;
  }
}

function openWiktionaryFor(word, wikt) {
  const m = wordIndex.get(word);
  if (m?.properName) {
    // A personal/place name is the wrong question for a general-language
    // dictionary — resolve against Wikipedia instead, with its own
    // mechanical warrant, rather than firing a Wiktionary lookup that
    // just confirms what sessionReferents already told us.
    resolveWikipedia(word, m, wikt);
    return;
  }
  loadWiktionary(word, wikt, m, currentToggles().traditions);
}
function toggleCard(el, word) {
  el.classList.toggle("open");
  if (el.classList.contains("open")) {
    openWords.add(word);
    const wikt = el.querySelector(".wikt");
    if (wikt && wikt.dataset.pending) { delete wikt.dataset.pending; openWiktionaryFor(word, wikt); }
  } else {
    openWords.delete(word);
  }
}
function jumpTo(word) {
  const q = document.getElementById("q");
  q.value = word;
  filterAll();
  q.scrollIntoView({ behavior: "smooth", block: "start" });
}

function rerender() {
  renderCards("all-cards", DATA.allMembers);
  // A toggle flip rebuilds every card's HTML fresh, including ones
  // openWords already marks open — repopulate THEIR wikt links too, same
  // as a real click would, so re-rendering never silently blanks a link
  // that was already pulled.
  document.querySelectorAll(".card.open").forEach(el => {
    const word = el.dataset.word;
    const wikt = el.querySelector(".wikt");
    if (wikt && wikt.dataset.pending) { delete wikt.dataset.pending; openWiktionaryFor(word, wikt); }
  });
  filterAll();
}
rerender();

function filterAll() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll(".card").forEach(c => {
    const hide = Boolean(q) && !c.dataset.word.includes(q);
    c.classList.toggle("hidden", hide);
    if (!hide) shown++;
  });
  // A zero-match filter used to render nothing at all — no cards, no
  // explanation, indistinguishable from the page being broken. Words drop
  // out of the candidate set for real reasons (frequency-band thresholds,
  // corpus size) and a search for one of them should say so, not go blank.
  let empty = document.getElementById("no-matches");
  if (shown === 0 && q) {
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "no-matches";
      empty.className = "gapnote";
      document.getElementById("all-cards").before(empty);
    }
    empty.innerHTML = \`No candidate word matches "\${esc(q)}". A word can be real in this material and still not appear here — e.g. it may sit outside the content-band frequency thresholds (\${DATA.candidateTokens} words currently qualify), not because it doesn't occur.\`;
  } else if (empty) {
    empty.remove();
  }
}
</script>
</body>
</html>`;

writeFileSync("./hyperlexicon-definitions.html", html);
console.log("wrote hyperlexicon-definitions.html,", html.length, "bytes");
