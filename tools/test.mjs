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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
