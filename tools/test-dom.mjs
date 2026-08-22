// DOM integration tests (jsdom) for the parts that touch the document:
// text-quote anchoring round-trips and highlight wrap/remove/restore.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { createFakeChrome } from "./fake-chrome.mjs";

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
  "src/core/export.js",
  "src/core/panel.js",
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

/* ---- 4c. element-boundary selection (selectNodeContents) — regression ----
   Previously, selecting to the end of an element made the anchor swallow the
   entire rest of the document (QA Steps 3 & 9). The quote must be just the
   element's text, and must re-find correctly. */
{
  setBody(`<div><p>Intro before.</p><p id="t">The quick brown fox jumps over.</p><p>Tail after here.</p></div>`);
  const p = doc.getElementById("t");
  const range = doc.createRange();
  range.selectNodeContents(p); // both endpoints are ELEMENT boundaries
  const anchor = W.Anchor.fromRange(range, doc.body);
  eq(anchor.quote, "The quick brown fox jumps over.", "element-boundary quote is just the element (not the rest of the doc)");
  ok(anchor.quote.length < 60, "element-boundary quote is not the whole document");
  ok(anchor.prefix.endsWith("Intro before."), "element-boundary prefix correct");
  ok(anchor.suffix.startsWith("Tail after"), "element-boundary suffix is populated (was empty before fix)");
  const found = W.Anchor.find(anchor, doc.body);
  ok(found && found.toString() === "The quick brown fox jumps over.", "element-boundary anchor re-finds after reload");
}

/* ---- 4d. restore falls back to hl.quote when the anchor is corrupted ----
   Mirrors the real-world bug: anchor.quote got polluted with the whole page,
   but the clean hl.quote is correct, so restore should still succeed. */
{
  setBody(`<article><p>Intro.</p><p>The exact passage to recover.</p><p>End.</p></article>`);
  const hl = new W.Highlighter(doc.body, {});
  const missing = hl.restore([{
    id: "fb1",
    color: "yellow",
    quote: "The exact passage to recover.",
    anchor: { quote: "THIS WHOLE GIANT STRING IS NOT ON THE PAGE AT ALL " .repeat(20) },
  }]);
  eq(missing, [], "restore recovered via the clean quote fallback");
  const mark = doc.querySelector('mark[data-webmark-id="fb1"]');
  ok(mark && mark.textContent === "The exact passage to recover.", "fallback wrapped the correct text");
}

/* ---- 5. anchor reports missing text gracefully ---- */
{
  setBody(`<p>nothing relevant here</p>`);
  const hl = new W.Highlighter(doc.body, {});
  const missing = hl.restore([{ id: "x", color: "yellow", anchor: { quote: "totally absent phrase" } }]);
  eq(missing, ["x"], "missing highlight reported, not crashed");
}

/* ---- 6. panel privacy + cross-tab deletion sync ---- */
{
  setBody(`<main><p id="private">A private passage lives here.</p></main>`);
  const text = doc.getElementById("private").firstChild;
  const range = doc.createRange();
  range.setStart(text, 2);
  range.setEnd(text, 17);
  const anchor = W.Anchor.fromRange(range, doc.body);
  const pageKey = "https://privacy.example/article";
  const storageKey = "wm:" + pageKey;
  globalThis.chrome = createFakeChrome({
    [storageKey]: {
      key: pageKey,
      url: pageKey,
      title: "Private",
      note: "secret note",
      highlights: [{
        id: "private-hl",
        color: "yellow",
        quote: "private passage",
        anchor,
        createdAt: 1,
      }],
      updatedAt: 1,
    },
  });

  const panel = new W.Panel({
    pageKey,
    url: pageKey,
    title: "Private",
    contentRoot: doc.body,
    shiftTarget: doc.documentElement,
  });
  await panel.init();

  ok(panel.host.shadowRoot === null,
     "host pages cannot inspect the notes panel shadow tree");
  ok(panel.selHost.shadowRoot === null,
     "host pages cannot manipulate the selection control shadow tree");
  eq(panel.textarea.value, "secret note", "panel loaded the stored note");
  ok(panel.highlighter.has("private-hl"), "panel restored the stored highlight");

  const oldValue = chrome._dump()[storageKey];
  panel._typing = true;
  chrome._delete(storageKey);
  chrome._emit({ [storageKey]: { oldValue } });

  eq(panel.textarea.value, "", "external deletion clears the open panel");
  ok(!panel.highlighter.has("private-hl"),
     "external deletion removes stale on-page highlights");

  panel.host.remove();
  panel.selHost.remove();
  delete globalThis.chrome;
}

/* ---- 7. SPA switches flush before loading and reset typing state ---- */
{
  setBody(`<main><p>SPA article body.</p></main>`);
  const pageA = "https://spa.example/a";
  const pageB = "https://spa.example/b";
  const keyA = "wm:" + pageA;
  const keyB = "wm:" + pageB;
  const initial = {
    [keyB]: {
      key: pageB,
      url: pageB,
      title: "B",
      note: "page B",
      highlights: [],
      updatedAt: 1,
    },
  };
  let releaseWrite;
  globalThis.chrome = createFakeChrome(initial, {
    async beforeSet({ writeCount }) {
      if (writeCount === 1) {
        await new Promise((resolve) => { releaseWrite = resolve; });
      }
    },
  });

  const panel = new W.Panel({
    pageKey: pageA,
    url: pageA,
    title: "A",
    contentRoot: doc.body,
    shiftTarget: doc.documentElement,
  });
  await panel.init();
  panel.textarea.value = "latest page A";
  panel.record.note = panel.textarea.value;
  panel._typing = true;
  panel._persist();

  const switching = panel.switchPage(pageB, pageB, "B");
  await Promise.resolve();
  eq(panel.pageKey, pageA, "switchPage waits for the old page write");
  releaseWrite();
  await switching;

  eq(chrome._dump()[keyA].note, "latest page A",
     "switchPage persisted the latest old-page edit");
  eq(panel.pageKey, pageB, "switchPage activates the destination after flushing");
  ok(panel._typing === false, "switchPage clears typing state from the previous page");

  const external = {
    key: pageB,
    url: pageB,
    title: "B",
    note: "newer page B",
    highlights: [],
    updatedAt: 2,
  };
  chrome._put(keyB, external);
  chrome._emit({ [keyB]: { newValue: external } });
  eq(panel.textarea.value, "newer page B",
     "destination page receives cross-tab changes immediately");

  panel.host.remove();
  panel.selHost.remove();
  delete globalThis.chrome;
}

/* ---- 8. host-page control events cannot mutate extension state ---- */
{
  setBody(`<article><p>Host-controlled text.</p></article>`);
  const previousWindow = globalThis.window;
  const previousLocation = globalThis.location;
  const previousSetInterval = globalThis.setInterval;
  globalThis.window = window;
  globalThis.location = window.location;
  globalThis.setInterval = () => 0;
  globalThis.chrome = createFakeChrome();
  delete window.__webmarkContentLoaded;

  vm.runInThisContext(
    readFileSync(new URL("../src/content.js", import.meta.url), "utf8"),
    { filename: "src/content.js" }
  );
  await Promise.resolve();
  doc.dispatchEvent(new window.CustomEvent("webmark:control", { detail: "capture" }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  ok(!doc.querySelector('[data-webmark-ui="panel"]'),
     "page-dispatched control events cannot create or drive the notes panel");

  globalThis.setInterval = previousSetInterval;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
  if (previousLocation === undefined) delete globalThis.location;
  else globalThis.location = previousLocation;
  delete globalThis.chrome;
}

/* ---- 9. cancelling destructive backup import performs no write ---- */
{
  const managerDom = new JSDOM(
    readFileSync(new URL("../src/manager/manager.html", import.meta.url), "utf8")
  );
  const managerDocument = managerDom.window.document;
  const importModes = [];
  let confirmResult = false;
  const managerContext = {
    document: managerDocument,
    WebMark: {
      COLORS: [],
      util: {
        escapeHtml: (value) => String(value),
        todayIso: () => "2026-08-22",
      },
      Export: {
        FORMATS: [],
        downloadBlob() {},
        exportAs() {},
      },
      Storage: {
        getSettings: async () => ({ autoOpenPdf: true, defaultColor: "yellow" }),
        setSettings: async () => {},
        listNotes: async () => [],
        exportAll: async () => ({}),
        importAll: async (_data, mode) => {
          importModes.push(mode);
          return { total: 0, added: 0, updated: 0, skipped: 0 };
        },
      },
    },
    chrome: {
      runtime: { getURL: (path) => "chrome-extension://test/" + path },
      tabs: { create() {} },
    },
    Blob,
    confirm: () => confirmResult,
    alert() {},
    console,
  };
  vm.runInNewContext(
    readFileSync(new URL("../src/manager/manager.js", import.meta.url), "utf8"),
    managerContext,
    { filename: "src/manager/manager.js" }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  const input = managerDocument.getElementById("importFile");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [{ text: async () => JSON.stringify({ type: "webmark-backup", notes: {} }) }],
  });
  managerDocument.getElementById("importMode").value = "replace";
  await input.onchange();
  eq(importModes, [], "cancelling replacement does not import or delete notes");

  confirmResult = true;
  await input.onchange();
  eq(importModes, ["replace"], "confirmed replacement uses replace mode");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
