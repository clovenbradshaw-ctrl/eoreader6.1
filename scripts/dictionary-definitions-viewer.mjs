import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("./dictionary-definitions-data.json", "utf8"));

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>eoreader6.1 — live word definitions</title>
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
</style>
</head>
<body>
<header>
  <h1>eoreader6.1 — live word definitions</h1>
  <div class="meta">
    <code>${data.corpus}</code> · first ${data.sliceChars.toLocaleString()} chars · ${data.sentences} sentences ·
    ${data.candidateTokens} candidate tokens · holon level: <code>${data.holonLevel}</code>
  </div>
  <div class="search"><input id="q" placeholder="filter words…" oninput="filterAll()"></div>
</header>
<main>
  <section class="before">
    <h2><span class="dot"></span>before-head <span class="count">(${data.partitions.before.population} words)</span></h2>
    <div class="desc">Words whose company mostly sits BEFORE their head noun — determiners, adjectives, quantifiers, this coarse split read directly off each word's own occurrence pattern, no search cost.</div>
    ${data.partitions.before.kinds.length === 0 ? `<div class="gapnote">Finer induction WITHIN this group (on distance/headship) certified <b>zero further sub-kinds</b> at these parameters — the same honest result this pipeline found on Alice in Wonderland's own "before" group. A gap is a result, not a failure.</div>` : ""}
    <div class="cards" id="before-cards"></div>
  </section>
  <section class="after">
    <h2><span class="dot"></span>after-head <span class="count">(${data.partitions.after.population} words)</span></h2>
    <div class="desc">Words whose company mostly sits AFTER their head noun.</div>
    ${data.partitions.after.kinds.length === 0 ? `<div class="gapnote">Finer induction WITHIN this group also certified zero further sub-kinds at these parameters.</div>` : ""}
    <div class="cards" id="after-cards"></div>
  </section>
</main>
<script>
const DATA = ${JSON.stringify(data)};

// position labels are earned (a/b/label = which slot of a Link this word
// occupies); the parenthetical grammar gloss is the SAME overlay
// mechanicalDefinition brackets — shown, never asserted as fact.
const POSITION_LABEL = { a: "end A", b: "end B", label: "label" };
function renderCards(containerId, members) {
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
          return \`<div class="edge"><span class="position">\${POSITION_LABEL[c.position]} <i>(\${esc(c.grammar.reading)}, unverified)</i></span>\${partA} → \${partLabel} → \${partB}\${c.negated ? " (negated)" : ""}\${corroborated}</div>\`;
        }).join("")
      : '<div class="empty">no direct graph Links recorded (may be real prose relation-extraction missed, not necessarily absent from the text — see uses below)</div>';
    const usesHtml = (m.topUses && m.topUses.length)
      ? m.topUses.map(u => \`<div class="quote"><span class="surp">\${u.surprisal.toLocaleString()} µbits</span>“\${esc(u.quote)}”</div>\`).join("")
      : '<div class="empty">no scored occurrences</div>';
    return \`<div class="card" data-word="\${m.word}" onclick="this.classList.toggle('open')">
      <div class="row1">
        <span class="word">\${m.word}</span>
        <span class="stats">dist \${m.distance?.toFixed(2) ?? "—"} · headship \${m.headship?.toFixed(2) ?? "—"}</span>
      </div>
      <div class="company">
        <div class="definition">\${esc(m.definition)}</div>
        \${(m.relatedForms && m.relatedForms.length) ? \`
        <div class="subhead" style="margin-top:10px">related forms <i>(candidate, unverified — suffix rule)</i></div>
        <div class="related">\${m.relatedForms.map(r => \`<span class="chip" onclick="event.stopPropagation(); jumpTo('\${esc(r.word)}')">\${esc(r.word)}</span>\`).join("")}</div>
        \` : ""}
        <div class="subhead" style="margin-top:10px">links (graph, earned position first)</div>
        \${companyHtml}
        <div class="subhead" style="margin-top:10px">top 5 significant uses (by causal surprisal)</div>
        \${usesHtml}
      </div>
    </div>\`;
  }).join("");
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function jumpTo(word) {
  const q = document.getElementById("q");
  q.value = word;
  filterAll();
  q.scrollIntoView({ behavior: "smooth", block: "start" });
}

renderCards("before-cards", DATA.partitions.before.members);
renderCards("after-cards", DATA.partitions.after.members);

function filterAll() {
  const q = document.getElementById("q").value.trim().toLowerCase();
  document.querySelectorAll(".card").forEach(c => {
    c.classList.toggle("hidden", q && !c.dataset.word.includes(q));
  });
}
</script>
</body>
</html>`;

writeFileSync("./dictionary-definitions.html", html);
console.log("wrote dictionary-definitions.html,", html.length, "bytes");
