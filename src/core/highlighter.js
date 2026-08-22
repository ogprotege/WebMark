// Applies, restores and removes on-page highlights, and keeps them in sync
// with the note. Works identically on web pages and in the PDF reader's text
// layer because both are ordinary DOM.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const COLORS = W.COLORS;

  function injectPageStyle(doc) {
    if (doc.getElementById("webmark-page-style")) return;
    const colorRules = COLORS.map(
      (c) => `.webmark-hl[data-webmark-color="${c.id}"]{background:${c.css};}`
    ).join("");
    const style = doc.createElement("style");
    style.id = "webmark-page-style";
    // mix-blend-mode:multiply lets the colour tint the text/canvas underneath
    // (essential in the PDF reader, where glyphs are painted on a canvas below
    // the transparent text layer the highlight lives in).
    style.textContent = `
      .webmark-hl{border-radius:2px;cursor:pointer;transition:filter .15s ease;
        mix-blend-mode:multiply;
        -webkit-box-decoration-break:clone;box-decoration-break:clone;color:inherit;}
      .webmark-hl:hover{filter:brightness(.94);}
      .webmark-hl.webmark-flash{animation:webmarkFlash 1.1s ease;}
      @keyframes webmarkFlash{0%,100%{filter:none;}30%{filter:brightness(.8) saturate(1.6);}}
      ${colorRules}
      html.webmark-open{transition:margin-right .2s ease;}
    `;
    (doc.head || doc.documentElement).appendChild(style);
  }

  class Highlighter {
    constructor(root, { onClick } = {}) {
      this.root = root;
      this.doc = root.ownerDocument || document;
      this.onClick = onClick;
      injectPageStyle(this.doc);
      this.doc.addEventListener("click", (e) => {
        const mark = e.target.closest && e.target.closest("mark.webmark-hl");
        if (mark && this.onClick) {
          this.onClick(mark.dataset.webmarkId, e);
        }
      });
    }

    _intersectingTextNodes(range) {
      const common =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentNode
          : range.commonAncestorContainer;
      const walker = this.doc.createTreeWalker(common, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
          if (n.parentNode && n.parentNode.closest("[data-webmark-ui]"))
            return NodeFilter.FILTER_REJECT;
          return range.intersectsNode(n)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      return nodes;
    }

    // Wrap a range in <mark> spans. Returns number of spans created.
    wrap(range, { id, color }) {
      const nodes = this._intersectingTextNodes(range);
      let count = 0;
      for (const node of nodes) {
        const sub = this.doc.createRange();
        sub.selectNodeContents(node);
        if (node === range.startContainer) sub.setStart(node, range.startOffset);
        if (node === range.endContainer) sub.setEnd(node, range.endOffset);
        if (sub.collapsed) continue;
        const mark = this.doc.createElement("mark");
        mark.className = "webmark-hl";
        mark.dataset.webmarkId = id;
        mark.dataset.webmarkColor = color || "yellow";
        try {
          sub.surroundContents(mark);
          count++;
        } catch {
          /* skip fragments that cross element boundaries oddly */
        }
      }
      return count;
    }

    has(id) {
      return !!this.root.querySelector(`mark.webmark-hl[data-webmark-id="${CSS.escape(id)}"]`);
    }

    remove(id) {
      const marks = this.root.querySelectorAll(
        `mark.webmark-hl[data-webmark-id="${CSS.escape(id)}"]`
      );
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      });
      return marks.length;
    }

    // Unwrap every highlight in the root (used when switching pages in an SPA).
    clearAll() {
      const marks = this.root.querySelectorAll("mark.webmark-hl");
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      });
      return marks.length;
    }

    setColor(id, color) {
      this.root
        .querySelectorAll(`mark.webmark-hl[data-webmark-id="${CSS.escape(id)}"]`)
        .forEach((m) => (m.dataset.webmarkColor = color));
    }

    scrollTo(id) {
      const mark = this.root.querySelector(
        `mark.webmark-hl[data-webmark-id="${CSS.escape(id)}"]`
      );
      if (!mark) return false;
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      this.root
        .querySelectorAll(`mark.webmark-hl[data-webmark-id="${CSS.escape(id)}"]`)
        .forEach((m) => {
          m.classList.remove("webmark-flash");
          void m.offsetWidth; // restart animation
          m.classList.add("webmark-flash");
        });
      return true;
    }

    // Re-apply a list of stored highlights to the live document.
    // Returns the ids that could not be located.
    restore(highlights) {
      const missing = [];
      for (const hl of highlights) {
        if (this.has(hl.id)) continue;
        let range = W.Anchor.find(hl.anchor, this.root);
        // Resilience: if the detailed anchor can't be located (or was corrupted),
        // fall back to the clean stored quote with the anchor's context hints.
        if ((!range || range.collapsed) && hl.quote) {
          const a = hl.anchor || {};
          range = W.Anchor.find(
            { quote: hl.quote, prefix: a.prefix || "", suffix: a.suffix || "", position: a.position || 0 },
            this.root
          );
        }
        if (range && !range.collapsed) {
          this.wrap(range, { id: hl.id, color: hl.color });
        } else {
          missing.push(hl.id);
        }
      }
      return missing;
    }
  }

  W.Highlighter = Highlighter;
})();
