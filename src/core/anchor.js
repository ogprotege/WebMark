// Durable text-quote anchoring.
//
// The original MVP gave up on restoring highlights after reload. We do it with
// a robust approach inspired by the W3C TextQuoteSelector: store the highlighted
// text plus a little surrounding context, then re-find it in the live document.
// Matching is whitespace-tolerant, which matters a lot for PDFs and reflowed
// articles where spacing/line breaks shift between loads.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const CTX = 40; // chars of context stored on each side

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p || !n.nodeValue) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.nodeName)) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("[data-webmark-ui]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function buildIndex(root) {
    const nodes = collectTextNodes(root);
    let full = "";
    const map = [];
    for (const node of nodes) {
      map.push({ node, start: full.length, len: node.nodeValue.length });
      full += node.nodeValue;
    }
    return { full, map };
  }

  // Resolve a (container, offset) DOM boundary to a global index into `full`.
  function boundaryToIndex(index, container, offset) {
    if (container.nodeType === Node.TEXT_NODE) {
      for (const e of index.map) {
        if (e.node === container) return e.start + Math.min(offset, e.len);
      }
    }
    // Element boundary: find the first indexed text node at/after the boundary.
    const ref = container.childNodes ? container.childNodes[offset] : null;
    for (const e of index.map) {
      if (!ref) break;
      if (e.node === ref || ref.contains(e.node)) return e.start;
      const pos = ref.compareDocumentPosition(e.node);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return e.start;
    }
    return index.full.length;
  }

  function indexToBoundary(index, target) {
    for (const e of index.map) {
      if (target <= e.start + e.len) {
        return { node: e.node, offset: Math.max(0, target - e.start) };
      }
    }
    const last = index.map[index.map.length - 1];
    return last ? { node: last.node, offset: last.len } : null;
  }

  // Build an anchor descriptor from a live selection Range.
  function fromRange(range, root) {
    const index = buildIndex(root);
    let start = boundaryToIndex(index, range.startContainer, range.startOffset);
    let end = boundaryToIndex(index, range.endContainer, range.endOffset);
    if (end < start) [start, end] = [end, start];
    const quote = index.full.slice(start, end);
    return {
      quote,
      prefix: index.full.slice(Math.max(0, start - CTX), start),
      suffix: index.full.slice(end, end + CTX),
      // fractional position is a tiebreaker when the same quote appears twice
      position: index.full.length ? start / index.full.length : 0,
    };
  }

  function wsRegex(text) {
    const escaped = text
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    return escaped ? new RegExp(escaped, "g") : null;
  }

  function findOccurrences(full, quote) {
    const re = wsRegex(quote);
    const hits = [];
    if (!re) return hits;
    let m;
    while ((m = re.exec(full))) {
      hits.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
    }
    return hits;
  }

  function contextScore(full, hit, anchor) {
    const beforeRaw = full.slice(Math.max(0, hit.start - CTX * 2), hit.start);
    const afterRaw = full.slice(hit.end, hit.end + CTX * 2);
    const norm = (s) => W.util.normalizeWs(s);
    const wantPrefix = norm(anchor.prefix || "");
    const wantSuffix = norm(anchor.suffix || "");
    const before = norm(beforeRaw);
    const after = norm(afterRaw);
    let score = 0;
    // common suffix length of `before` vs wanted prefix
    let i = 0;
    while (
      i < wantPrefix.length &&
      i < before.length &&
      before[before.length - 1 - i] === wantPrefix[wantPrefix.length - 1 - i]
    ) i++;
    score += i;
    // common prefix length of `after` vs wanted suffix
    let j = 0;
    while (j < wantSuffix.length && j < after.length && after[j] === wantSuffix[j]) j++;
    score += j;
    return score;
  }

  // Locate the best Range for an anchor in the current document, or null.
  function find(anchor, root) {
    if (!anchor || !anchor.quote) return null;
    const index = buildIndex(root);
    const hits = findOccurrences(index.full, anchor.quote);
    if (!hits.length) return null;

    let best = hits[0];
    if (hits.length > 1) {
      let bestScore = -1;
      const targetPos = (anchor.position || 0) * index.full.length;
      for (const h of hits) {
        let s = contextScore(index.full, h, anchor) * 1000;
        s -= Math.abs(h.start - targetPos); // closeness tiebreaker
        if (s > bestScore) {
          bestScore = s;
          best = h;
        }
      }
    }

    const a = indexToBoundary(index, best.start);
    const b = indexToBoundary(index, best.end);
    if (!a || !b) return null;
    const range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch {
      return null;
    }
    return range;
  }

  W.Anchor = { fromRange, find, CTX };
  // exposed for unit tests (pure helpers)
  W.Anchor._ = { findOccurrences, wsRegex, contextScore, indexToBoundary };
})();
