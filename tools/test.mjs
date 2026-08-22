// Lightweight unit tests for WebMark's pure logic (no browser needed).
// Loads the core modules into this realm and exercises the DOM-free helpers.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const files = [
  "src/core/util.js",
  "src/core/markdown.js",
  "src/core/anchor.js",
  "src/core/storage.js",
  "src/core/highlighter.js",
  "src/core/export.js",
];
for (const f of files) {
  vm.runInThisContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), { filename: f });
}
const W = globalThis.WebMark;

let RenderCoordinator = null;
try {
  vm.runInThisContext(
    readFileSync(new URL("../src/pdf/render-coordinator.js", import.meta.url), "utf8"),
    { filename: "src/pdf/render-coordinator.js" }
  );
  RenderCoordinator = W.RenderCoordinator;
} catch {
  // The availability assertion below reports a useful red test before the helper exists.
}

let PanelMessageRouter = null;
try {
  vm.runInThisContext(
    readFileSync(new URL("../src/pdf/panel-messages.js", import.meta.url), "utf8"),
    { filename: "src/pdf/panel-messages.js" }
  );
  PanelMessageRouter = W.PanelMessageRouter;
} catch {
  // The availability assertion below reports a useful red test before the helper exists.
}

let pass = 0, fail = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`✗ ${msg}\n   expected ${e}\n   got      ${a}`); }
}
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error(`✗ ${msg}`); }
}

/* ---- util.keyForUrl ---- */
eq(W.util.keyForUrl("https://a.com/post?utm_source=x&id=2#frag"),
   "https://a.com/post?id=2", "keyForUrl strips tracking + hash, keeps query");
eq(W.util.keyForUrl("https://a.com/p#sec"), "https://a.com/p", "keyForUrl drops hash");
eq(W.util.keyForUrl("chrome-extension://abc/src/pdf/viewer.html?file=" +
     encodeURIComponent("https://x.com/doc.pdf")),
   "https://x.com/doc.pdf", "keyForUrl resolves viewer file param to underlying url");
eq(W.util.normalizeWs("  a\n  b   c "), "a b c", "normalizeWs collapses whitespace");
{
  const iso = W.util.todayIso();
  ok(/^\d{4}-\d{2}-\d{2}$/.test(iso), "todayIso is YYYY-MM-DD");
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  eq(iso, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, "todayIso uses local date (no UTC drift)");
}

/* ---- markdown.render ---- */
const md = W.markdown.render;
ok(md("# Title").includes("<h1>Title</h1>"), "heading");
ok(md("**bold**").includes("<strong>bold</strong>"), "bold");
ok(md("- a\n- b").includes("<ul>") && md("- a\n- b").includes("<li>a</li>"), "unordered list");
ok(md("1. a\n2. b").includes("<ol>"), "ordered list");
ok(md("> quote").includes("<blockquote>"), "blockquote");
ok(md("```\ncode\n```").includes("<pre><code>code</code></pre>"), "code fence");
ok(md("[hi](https://x.com)").includes('href="https://x.com"'), "safe link");
ok(!md("[x](javascript:alert(1))").includes("javascript:"), "unsafe link stripped");
ok(!md("<script>bad</script>").includes("<script>"), "html escaped");
ok(md("a `c` b").includes("<code>c</code>"), "inline code");
ok(md("`<tag>`").includes("<code>&lt;tag&gt;</code>"),
   "inline code is escaped exactly once");
{
  const nul = String.fromCharCode(0);
  ok(!md(`literal ${nul}0${nul} marker`).includes("<code>undefined</code>"),
     "literal text cannot collide with inline-code placeholders");
  const markdownSource = readFileSync(
    new URL("../src/core/markdown.js", import.meta.url),
    "utf8"
  );
  ok(!markdownSource.includes(nul), "markdown source remains a normal text file");
}

/* ---- anchor helpers (DOM-free) ---- */
const A = W.Anchor._;
const re = A.wsRegex("hello world");
ok(re.test("hello   world"), "wsRegex tolerates extra whitespace");
const full = "alpha hello world beta hello world gamma";
const hits = A.findOccurrences(full, "hello world");
eq(hits.length, 2, "findOccurrences finds both matches");
// disambiguate by context: prefer the second occurrence (suffix 'gamma')
const anchor = { quote: "hello world", prefix: "beta", suffix: "gamma", position: 0.6 };
let best = hits[0], bestScore = -1;
for (const h of hits) {
  const s = A.contextScore(full, h, anchor);
  if (s > bestScore) { bestScore = s; best = h; }
}
eq(best.start, full.indexOf("hello world", 10), "contextScore selects the contextually-correct occurrence");

// whitespace-variant match still resolves
const full2 = "the   quick brown   fox";
const hits2 = A.findOccurrences(full2, "quick brown fox");
eq(hits2.length, 1, "findOccurrences matches across whitespace differences");

// indexToBoundary maps a global offset into the right node
const index = { full: "abcdef", map: [
  { node: "N1", start: 0, len: 3 },
  { node: "N2", start: 3, len: 3 },
] };
eq(A.indexToBoundary(index, 4), { node: "N2", offset: 1 }, "indexToBoundary maps offset into second node");
eq(A.indexToBoundary(index, 0), { node: "N1", offset: 0 }, "indexToBoundary maps start");

/* ---- storage settings defaults ---- */
ok(W.Storage.DEFAULT_SETTINGS.autoOpenPdf === true, "default autoOpenPdf true");
ok(Array.isArray(W.COLORS) && W.COLORS.length >= 3, "color palette present");

/* ---- export module ---- */
const X = W.Export;
const rec = {
  title: "My <Article>",
  url: "https://x.com/a",
  note: "# Heading\n\n**bold** and *italic* and `code`\n\n- one\n- two\n\n> a quote",
  updatedAt: Date.parse("2026-01-02"),
};
ok(X.FORMATS.some((f) => f.id === "docx") && X.FORMATS.some((f) => f.id === "pdf"),
   "export offers docx and pdf formats");
ok(X.toMarkdown(rec).includes("# My <Article>") && X.toMarkdown(rec).includes("> a quote"),
   "toMarkdown includes title + note");
{
  const t = X.toPlainText(rec);
  ok(!t.includes("**") && !t.includes("`") && t.includes("bold and italic and code"),
     "toPlainText strips markdown syntax");
  ok(t.includes("• one"), "toPlainText converts bullets");
}
{
  const h = X.toHtmlDoc(rec);
  ok(h.includes("<!DOCTYPE html>") && h.includes("<h1>My &lt;Article&gt;</h1>"),
     "toHtmlDoc escapes title + is a full document");
  ok(h.includes("<blockquote>"), "toHtmlDoc renders the markdown body");
  const unsafe = X.toHtmlDoc({ ...rec, url: "javascript:alert(1)" });
  ok(!unsafe.includes('href="javascript:'), "toHtmlDoc does not create active unsafe source links");
}

/* crc32 against the standard check value */
eq(X.crc32(new TextEncoder().encode("123456789")), 0xcbf43926, "crc32 matches the standard check value");

/* zip writer produces a valid stored archive */
{
  const buf = X.zipStore([{ name: "a.txt", data: "hello" }]);
  ok(buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04, "zip starts with PK\\x03\\x04");
  const s = new TextDecoder().decode(buf);
  ok(s.includes("a.txt") && s.includes("hello"), "zip contains the stored file name + data");
  ok(s.includes("PK\x05\x06"), "zip has an end-of-central-directory record");
}

/* docx is a valid OOXML zip whose document.xml carries the note text */
{
  const blob = X.toDocxBlob(rec);
  ok(blob && blob.size > 0, "toDocxBlob produces a non-empty Blob");
  const buf = new Uint8Array(await blob.arrayBuffer());
  const s = new TextDecoder().decode(buf);
  ok(s.includes("word/document.xml") && s.includes("[Content_Types].xml"), "docx contains required OOXML parts");
  ok(s.includes("<w:document"), "docx document.xml is present (stored, uncompressed)");
  ok(s.includes("a quote"), "docx carries the note text");
}

/* ---- storage Backup & Restore (with a fake chrome.storage.local) ---- */
{
  const makeFakeChrome = (initial = {}) => {
    let data = { ...initial };
    return {
      storage: {
        local: {
          get: async (k) => {
            if (k == null) return { ...data };
            if (typeof k === "string") return k in data ? { [k]: data[k] } : {};
            const out = {};
            (Array.isArray(k) ? k : Object.keys(k)).forEach((x) => { if (x in data) out[x] = data[x]; });
            return out;
          },
          set: async (obj) => { Object.assign(data, obj); },
          remove: async (k) => { (Array.isArray(k) ? k : [k]).forEach((x) => delete data[x]); },
        },
        onChanged: { addListener() {} },
      },
      _dump: () => data,
    };
  };

  // export gathers notes + settings, ignores unrelated keys
  globalThis.chrome = makeFakeChrome({
    "wm:https://a.com/x": { key: "https://a.com/x", note: "alpha", updatedAt: 100 },
    "wm:https://b.com/y": { key: "https://b.com/y", note: "beta", updatedAt: 200 },
    "wm:settings": { defaultColor: "green" },
    "unrelated": { foo: 1 },
  });
  const backup = await W.Storage.exportAll();
  eq(Object.keys(backup.notes).length, 2, "exportAll captures only note records");
  ok(backup.type === "webmark-backup" && backup.settings.defaultColor === "green", "exportAll includes settings + type tag");
  ok(!("unrelated" in backup.notes), "exportAll ignores non-WebMark keys");

  // import merge keeps the newer record, adds new ones, skips older
  globalThis.chrome = makeFakeChrome({
    "wm:https://a.com/x": { key: "https://a.com/x", note: "OLD-local", updatedAt: 50 },
  });
  const importData = {
    type: "webmark-backup",
    notes: {
      "wm:https://a.com/x": { key: "https://a.com/x", note: "NEW-backup", updatedAt: 100 }, // newer -> wins
      "wm:https://c.com/z": { key: "https://c.com/z", note: "added", updatedAt: 10 },        // new -> added
    },
  };
  const res = await W.Storage.importAll(importData, "merge");
  eq([res.added, res.updated, res.skipped], [1, 1, 0], "importAll merge counts (added/updated/skipped)");
  eq(chrome._dump()["wm:https://a.com/x"].note, "NEW-backup", "merge keeps the newer note");

  // merge skips when local is newer
  globalThis.chrome = makeFakeChrome({
    "wm:https://a.com/x": { key: "https://a.com/x", note: "LOCAL-newer", updatedAt: 999 },
  });
  const res2 = await W.Storage.importAll(importData, "merge");
  eq(res2.skipped, 1, "merge skips when local copy is newer");
  eq(chrome._dump()["wm:https://a.com/x"].note, "LOCAL-newer", "merge leaves newer local note intact");

  // replace mode overwrites regardless of timestamps
  globalThis.chrome = makeFakeChrome({
    "wm:https://a.com/x": { key: "https://a.com/x", note: "LOCAL-newer", updatedAt: 999 },
  });
  await W.Storage.importAll(importData, "replace");
  eq(chrome._dump()["wm:https://a.com/x"].note, "NEW-backup", "replace overwrites even a newer local note");

  // rejects non-backup files
  let threw = false;
  try { await W.Storage.importAll({ foo: 1 }, "merge"); } catch { threw = true; }
  ok(threw, "importAll rejects files that aren't WebMark backups");

  // replace removes local notes that are absent from the backup
  globalThis.chrome = makeFakeChrome({
    "wm:https://a.com/x": { key: "https://a.com/x", note: "local-a", highlights: [], updatedAt: 1 },
    "wm:https://b.com/y": { key: "https://b.com/y", note: "local-b", highlights: [], updatedAt: 1 },
  });
  await W.Storage.importAll({
    type: "webmark-backup",
    schema: 1,
    notes: {
      "wm:https://a.com/x": {
        key: "https://a.com/x",
        url: "https://a.com/x",
        title: "A",
        note: "backup-a",
        highlights: [],
        updatedAt: 2,
      },
    },
  }, "replace");
  ok(!("wm:https://b.com/y" in chrome._dump()), "replace deletes notes absent from the backup");

  // imported records must not be able to introduce active or mismatched URLs
  threw = false;
  try {
    await W.Storage.importAll({
      type: "webmark-backup",
      schema: 1,
      notes: {
        "wm:javascript:alert(1)": {
          key: "javascript:alert(1)",
          url: "javascript:alert(1)",
          note: "unsafe",
          highlights: [],
          updatedAt: 1,
        },
      },
    }, "merge");
  } catch {
    threw = true;
  }
  ok(threw, "importAll rejects unsupported URL schemes");

  threw = false;
  try {
    await W.Storage.importAll({
      type: "webmark-backup",
      schema: 1,
      notes: {
        "wm:https://a.com/x": {
          key: "https://other.example/",
          url: "https://other.example/",
          note: "mismatched",
          highlights: [],
          updatedAt: 1,
        },
      },
    }, "merge");
  } catch {
    threw = true;
  }
  ok(threw, "importAll rejects records whose key does not match the storage key");

  threw = false;
  try { await W.Storage.importAll(importData, "unknown"); } catch { threw = true; }
  ok(threw, "importAll rejects unknown import modes");

  const localUrl = "file:///home/reader/paper.pdf";
  const localKey = W.util.keyForUrl(localUrl);
  globalThis.chrome = makeFakeChrome();
  const localResult = await W.Storage.importAll({
    type: "webmark-backup",
    schema: 1,
    notes: {
      ["wm:" + localKey]: {
        key: localKey,
        url: localUrl,
        title: "Local paper",
        note: "offline note",
        highlights: [],
        updatedAt: 1,
      },
    },
  }, "merge").catch(() => null);
  ok(localResult && localResult.added === 1,
     "importAll accepts backups for supported local PDF URLs");

  globalThis.chrome = makeFakeChrome({
    "wm:settings": {
      autoOpenPdf: "yes",
      defaultColor: "not-a-colour",
      panelWidth: "100vw",
      fontScale: null,
    },
  });
  const safeSettings = await W.Storage.getSettings();
  eq(safeSettings, W.Storage.DEFAULT_SETTINGS,
     "getSettings discards malformed persisted values");
  delete globalThis.chrome;
}

/* ---- PageStore write serialization ---- */
{
  let data = {};
  let releaseFirst;
  let writes = 0;
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => (key in data ? { [key]: data[key] } : {}),
        set: async (obj) => {
          const snapshot = structuredClone(obj);
          writes++;
          if (writes === 1) {
            await new Promise((resolve) => { releaseFirst = resolve; });
          }
          Object.assign(data, snapshot);
        },
        remove: async (key) => { delete data[key]; },
      },
      onChanged: { addListener() {} },
    },
  };

  const store = new W.Storage.PageStore("https://race.example/");
  store.queue({ note: "first", highlights: [] });
  const flushing = store.flushNow();
  store.queue({ note: "second", highlights: [] });
  releaseFirst();
  await flushing;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await store.flushNow();
  eq(data["wm:https://race.example/"].note, "second",
     "PageStore preserves edits queued during an in-flight write");
  delete globalThis.chrome;
}

/* ---- PageStore delete/write ordering ---- */
{
  let data = {};
  let releaseFirst;
  let writes = 0;
  const operations = [];
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => (key in data ? { [key]: data[key] } : {}),
        set: async (obj) => {
          const snapshot = structuredClone(obj);
          const note = Object.values(snapshot)[0].note;
          operations.push("set:" + note);
          writes++;
          if (writes === 1) {
            await new Promise((resolve) => { releaseFirst = resolve; });
          }
          Object.assign(data, snapshot);
        },
        remove: async (key) => {
          operations.push("remove");
          delete data[key];
        },
      },
      onChanged: { addListener() {} },
    },
  };

  const store = new W.Storage.PageStore("https://ordered.example/");
  store.queue({ note: "before-delete", highlights: [] });
  const firstWrite = store.flushNow();
  const removing = store.remove();
  store.queue({ note: "after-delete", highlights: [] });
  releaseFirst();
  await firstWrite;
  await removing;
  await store.flushNow();

  eq(data["wm:https://ordered.example/"] && data["wm:https://ordered.example/"].note, "after-delete",
     "edits made after a deletion request are preserved");
  eq(operations, ["set:before-delete", "remove", "set:after-delete"],
     "storage writes and deletion execute in user-action order");
  delete globalThis.chrome;
}

/* ---- URL and manifest security boundaries ---- */
const isSupportedPageUrl = W.util.isSupportedPageUrl;
ok(typeof isSupportedPageUrl === "function", "URL security policy is available");
if (isSupportedPageUrl) {
  ok(isSupportedPageUrl("https://example.com/a"), "https page URLs are supported");
  ok(isSupportedPageUrl("file:///tmp/a.pdf"), "local file URLs are supported");
  ok(!isSupportedPageUrl("javascript:alert(1)"), "javascript URLs are rejected");
  ok(!isSupportedPageUrl("data:text/html,boom"), "data URLs are rejected");
}
{
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  ok(!manifest.web_accessible_resources,
     "internal extension pages are not exposed to arbitrary websites");

  for (const path of ["../src/content.js", "../src/pdf/viewer.js"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    ok(!source.includes("webmark:control"),
       `${path.split("/").pop()} does not trust page-dispatched control events`);
  }
  const viewerSource = readFileSync(
    new URL("../src/pdf/viewer.js", import.meta.url),
    "utf8"
  );
  ok(viewerSource.includes("isSupportedPageUrl(fileUrl)"),
     "PDF viewer rejects unsupported source URL schemes");

  const managerHtml = readFileSync(
    new URL("../src/manager/manager.html", import.meta.url),
    "utf8"
  );
  const managerSource = readFileSync(
    new URL("../src/manager/manager.js", import.meta.url),
    "utf8"
  );
  ok(managerHtml.includes('id="importMode"'),
     "backup restore exposes an explicit import mode");
  ok(!managerSource.includes("Cancel = replace"),
     "cancelling an import cannot trigger destructive replacement");
}

/* ---- PDF render coordination ---- */
ok(typeof RenderCoordinator === "function",
   "PDF rendering exposes a reusable in-flight coordinator");
if (RenderCoordinator) {
  const coordinator = new RenderCoordinator();
  let releaseFirst;
  let starts = 0;
  const first = coordinator.run("page-1", async (isCurrent) => {
    starts++;
    await new Promise((resolve) => { releaseFirst = resolve; });
    return isCurrent();
  });
  const joined = coordinator.run("page-1", async () => {
    starts++;
    return false;
  });
  ok(first === joined, "duplicate page renders join the in-flight promise");
  await Promise.resolve();
  eq(starts, 1, "only one render starts for a page");
  releaseFirst();
  eq(await first, true, "a current render remains authoritative");

  let releaseStale;
  const stale = coordinator.run("page-2", async (isCurrent) => {
    await new Promise((resolve) => { releaseStale = resolve; });
    return isCurrent();
  });
  await Promise.resolve();
  coordinator.invalidate("page-2");
  const replacement = coordinator.run("page-2", async (isCurrent) => isCurrent());
  releaseStale();
  eq(await stale, false, "invalidated renders cannot mutate replacement state");
  eq(await replacement, true, "replacement render becomes authoritative");

  let invalidatedTaskStarted = false;
  const invalidatedBeforeStart = coordinator.run("page-3", async () => {
    invalidatedTaskStarted = true;
  });
  coordinator.invalidate("page-3");
  await invalidatedBeforeStart;
  ok(!invalidatedTaskStarted, "renders invalidated before startup do no work");
}

/* ---- PDF panel message readiness ---- */
ok(typeof PanelMessageRouter === "function",
   "PDF panel messages have a readiness-aware router");
if (PanelMessageRouter) {
  let resolvePanel;
  const ready = new Promise((resolve) => { resolvePanel = resolve; });
  const calls = [];
  const fakePanel = {
    isOpen: true,
    toggle() { calls.push("toggle"); },
    open() { this.isOpen = true; calls.push("open"); },
    addSelection() { calls.push("capture"); },
  };
  const router = new PanelMessageRouter(ready);
  const pending = router.dispatch({ type: "toggle" });
  await Promise.resolve();
  eq(calls, [], "messages wait while the PDF panel initializes");
  resolvePanel(fakePanel);
  eq(await pending, true, "queued panel messages report delivery");
  eq(calls, ["toggle"], "queued toggle runs after panel initialization");

  fakePanel.isOpen = false;
  eq(await router.dispatch({ type: "capture" }), true, "capture message is delivered");
  eq(calls.slice(-2), ["open", "capture"], "capture opens the panel before capturing");
  eq(await router.dispatch({ type: "unknown" }), false, "unknown panel messages are ignored");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
