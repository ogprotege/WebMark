// DOM integration tests (jsdom) for the parts that touch the document:
// text-quote anchoring round-trips and highlight wrap/remove/restore.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
  pretendToBeVisual: true,
});
const { window } = dom;
// expose the DOM globals the core modules expect
for (const k of ["document", "Node", "NodeFilter", "Range", "CSS", "getComputedStyle"]) {
  globalThis[k] = window[k] || window[k.toLowerCase && k];
}
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.NodeFilter = window.NodeFilter;
// jsdom doesn't ship CSS.escape; Chrome does. Polyfill just for the test env.
globalThis.CSS = window.CSS && window.CSS.escape
  ? window.CSS
  : { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c) };

for (const f of [
  "src/core/util.js",
  "src/core/markdown.js",
  "src/core/anchor.js",
  "src/core/storage.js",
  "src/core/highlighter.js",
]) {
  vm.runInThisContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), { filename: f });
}
const W = globalThis.WebMark;

let pass = 0, fail = 0;
const ok = (c, m) => (c ? pass++ : (fail++, console.error("✗ " + m)));
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m} (got ${JSON.stringify(a)})`);

const doc = window.document;
function setBody(html) { doc.body.innerHTML = html; }
function textNodeIn(el) { return el.firstChild; }

/* ---- 1. anchor round-trip, single text node, with duplicate text ---- */
setBody(`<p id="p1">The quick brown fox jumps.</p>
         <p id="p2">Later, the quick brown fox returns.</p>`);
{
  const tn = textNodeIn(doc.getElementById("p1"));
  const s = tn.nodeValue.indexOf("quick brown fox");
  const range = doc.createRange();
  range.setStart(tn, s);
  range.setEnd(tn, s + "quick brown fox".length);

  const anchor = W.Anchor.fromRange(range, doc.body);
  eq(anchor.quote, "quick brown fox", "anchor captures the quote");
  ok(anchor.prefix.endsWith("The "), "anchor captures left context");
  ok(anchor.suffix.startsWith(" jumps"), "anchor captures right context");

  const found = W.Anchor.find(anchor, doc.body);
  ok(found, "anchor re-found in document");
  eq(found.toString(), "quick brown fox", "found range text matches");
  ok(found.startContainer === tn, "found the FIRST occurrence via context, not the duplicate");
}

/* ---- 2. highlight wrap / has / remove ---- */
{
  const hl = new W.Highlighter(doc.body, {});
  const tn = textNodeIn(doc.getElementById("p2"));
  const s = tn.nodeValue.indexOf("quick brown fox");
  const range = doc.createRange();
  range.setStart(tn, s);
  range.setEnd(tn, s + "quick brown fox".length);

  const n = hl.wrap(range, { id: "h1", color: "green" });
  ok(n >= 1, "wrap created at least one <mark>");
  const mark = doc.querySelector('mark.webmark-hl[data-webmark-id="h1"]');
  ok(mark, "mark element present in DOM");
  eq(mark.textContent, "quick brown fox", "mark wraps the right text");
  eq(mark.dataset.webmarkColor, "green", "mark colour stored");
  ok(hl.has("h1"), "has() detects the highlight");

  hl.remove("h1");
  ok(!doc.querySelector('mark[data-webmark-id="h1"]'), "remove() unwraps the mark");
  ok(doc.getElementById("p2").textContent.includes("quick brown fox"), "text intact after remove");
}

/* ---- 3. multi-node range (spanning an inline element) ---- */
{
  setBody(`<p id="p3">foo <em>bar</em> baz qux</p>`);
  const p = doc.getElementById("p3");
  const start = p.firstChild;            // "foo "
  const em = p.querySelector("em").firstChild; // "bar"
  const range = doc.createRange();
  range.setStart(start, 0);
  range.setEnd(em, 3); // through end of "bar"

  const anchor = W.Anchor.fromRange(range, doc.body);
  eq(anchor.quote, "foo bar", "multi-node quote captured");

  const hl = new W.Highlighter(doc.body, {});
  const n = hl.wrap(range, { id: "h2", color: "blue" });
  ok(n >= 2, "wrap spans multiple text nodes");
  const text = Array.from(doc.querySelectorAll('mark[data-webmark-id="h2"]'))
    .map((m) => m.textContent).join("");
  eq(text, "foo bar", "combined marks cover the selection");
}

/* ---- 4. restore after a fresh load ---- */
{
  setBody(`<article><p>Intro line.</p><p>Important: anchoring survives reloads reliably.</p></article>`);
  const p = doc.querySelector("article p:nth-child(2)").firstChild;
  const s = p.nodeValue.indexOf("anchoring survives reloads");
  const range = doc.createRange();
  range.setStart(p, s);
  range.setEnd(p, s + "anchoring survives reloads".length);
  const anchor = W.Anchor.fromRange(range, doc.body);

  // simulate a reload: rebuild identical DOM, then restore from stored anchor
  setBody(`<article><p>Intro line.</p><p>Important: anchoring survives reloads reliably.</p></article>`);
  const hl = new W.Highlighter(doc.body, {});
  const missing = hl.restore([{ id: "r1", color: "yellow", anchor }]);
  eq(missing, [], "restore located the highlight after reload");
  const mark = doc.querySelector('mark[data-webmark-id="r1"]');
  ok(mark && mark.textContent === "anchoring survives reloads", "restored mark covers the original text");

  // restore is idempotent (won't double-wrap)
  const missing2 = hl.restore([{ id: "r1", color: "yellow", anchor }]);
  eq(missing2, [], "second restore is a no-op");
  eq(doc.querySelectorAll('mark[data-webmark-id="r1"]').length, 1, "no duplicate marks");
}

/* ---- 4b. clearAll() unwraps every highlight (used on SPA page switch) ---- */
{
  setBody(`<p id="cp">one two three four five six</p>`);
  const tn = doc.getElementById("cp").firstChild;
  const hl = new W.Highlighter(doc.body, {});
  const mk = (a, b, id) => {
    const r = doc.createRange();
    r.setStart(tn, a);
    r.setEnd(tn, b);
    hl.wrap(r, { id, color: "yellow" });
  };
  // wrap two separate spans (note: wrap on the same text node sequentially is
  // fine because each wraps a fresh sub-range)
  setBody(`<p id="cp2">alpha beta gamma delta</p>`);
  const tn2 = doc.getElementById("cp2").firstChild;
  const hl2 = new W.Highlighter(doc.body, {});
  let r1 = doc.createRange(); r1.setStart(tn2, 0); r1.setEnd(tn2, 5);
  hl2.wrap(r1, { id: "a", color: "yellow" });
  const tn2b = doc.getElementById("cp2").lastChild; // remaining text after first wrap
  let r2 = doc.createRange(); r2.setStart(tn2b, tn2b.nodeValue.indexOf("gamma"));
  r2.setEnd(tn2b, tn2b.nodeValue.indexOf("gamma") + 5);
  hl2.wrap(r2, { id: "b", color: "green" });
  ok(doc.querySelectorAll("mark.webmark-hl").length >= 2, "two highlights present before clearAll");
  hl2.clearAll();
  ok(doc.querySelectorAll("mark.webmark-hl").length === 0, "clearAll removed all highlights");
  eq(doc.getElementById("cp2").textContent, "alpha beta gamma delta", "text intact after clearAll");
}

/* ---- 5. anchor reports missing text gracefully ---- */
{
  setBody(`<p>nothing relevant here</p>`);
  const hl = new W.Highlighter(doc.body, {});
  const missing = hl.restore([{ id: "x", color: "yellow", anchor: { quote: "totally absent phrase" } }]);
  eq(missing, ["x"], "missing highlight reported, not crashed");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
