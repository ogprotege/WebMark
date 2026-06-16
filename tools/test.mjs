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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
