// The WebMark side panel: a markdown notes column that lives in the page margin.
// Renders inside a Shadow DOM so the host page's CSS can't bleed in, coordinates
// the highlighter + storage, and offers live preview, export and a highlight list.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const { uid, normalizeWs, todayIso, debounce } = W.util;

  const PANEL_CSS = `
    :host{all:initial;}
    *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
    .wrap{position:fixed;top:0;right:0;height:100vh;display:flex;flex-direction:column;
      background:#fff;color:#0f172a;border-left:1px solid #e2e8f0;
      box-shadow:-8px 0 24px rgba(15,23,42,.08);font-size:14px;line-height:1.5;}
    header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eef2f7;background:#f8fafc;}
    .brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#1d4ed8;}
    .brand svg{width:18px;height:18px;}
    .title{flex:1;min-width:0;font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .iconbtn{border:0;background:transparent;cursor:pointer;border-radius:6px;padding:5px;color:#475569;line-height:0;}
    .iconbtn:hover{background:#e2e8f0;color:#0f172a;}
    .toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #eef2f7;}
    .seg{display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;}
    .seg button{border:0;background:#fff;padding:5px 10px;cursor:pointer;font-size:12px;color:#475569;}
    .seg button.active{background:#1d4ed8;color:#fff;}
    .spacer{flex:1;}
    .swatches{display:flex;gap:5px;}
    .swatch{width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #cbd5e1;cursor:pointer;}
    .swatch.active{box-shadow:0 0 0 2px #1d4ed8;}
    .body{flex:1;overflow:auto;}
    textarea{width:100%;height:100%;min-height:200px;border:0;outline:0;resize:none;padding:14px;
      font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:#0f172a;background:#fff;}
    .preview{padding:14px 16px;}
    .preview h1,.preview h2,.preview h3{line-height:1.25;margin:.8em 0 .4em;}
    .preview h1{font-size:1.4em;} .preview h2{font-size:1.2em;} .preview h3{font-size:1.05em;}
    .preview p{margin:.5em 0;} .preview ul,.preview ol{margin:.5em 0;padding-left:1.3em;}
    .preview blockquote{margin:.6em 0;padding:.2em 0 .2em .8em;border-left:3px solid #93c5fd;color:#334155;background:#f8fafc;}
    .preview code{background:#f1f5f9;padding:.1em .3em;border-radius:4px;font-size:.9em;}
    .preview pre{background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;overflow:auto;}
    .preview pre code{background:transparent;color:inherit;padding:0;}
    .preview a{color:#1d4ed8;} .preview hr{border:0;border-top:1px solid #e2e8f0;margin:1em 0;}
    .hl-section{border-top:1px solid #eef2f7;max-height:34%;overflow:auto;background:#fbfdff;}
    .hl-head{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11px;font-weight:700;
      text-transform:uppercase;letter-spacing:.04em;color:#64748b;position:sticky;top:0;background:#fbfdff;}
    .hl-list{list-style:none;margin:0;padding:0 8px 8px;}
    .hl-item{display:flex;gap:8px;align-items:flex-start;padding:7px;border-radius:8px;cursor:pointer;}
    .hl-item:hover{background:#eef2ff;}
    .hl-dot{width:12px;height:12px;border-radius:3px;flex:0 0 auto;margin-top:3px;box-shadow:0 0 0 1px rgba(0,0,0,.08);}
    .hl-text{flex:1;font-size:12px;color:#334155;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
    .hl-del{opacity:0;border:0;background:transparent;cursor:pointer;color:#94a3b8;font-size:14px;}
    .hl-item:hover .hl-del{opacity:1;}
    .empty{padding:18px;color:#94a3b8;font-size:12px;text-align:center;}
    footer{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #eef2f7;background:#f8fafc;font-size:11px;color:#94a3b8;}
    .btn{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;color:#334155;}
    .btn:hover{background:#f1f5f9;} .btn.primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}
    .btn.primary:hover{background:#1e40af;}
    .grip{position:absolute;left:-3px;top:0;width:6px;height:100%;cursor:col-resize;}
    .toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;
      padding:8px 14px;border-radius:8px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none;}
    .toast.show{opacity:1;}
  `;

  const LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3.5 20.5 8.5 9 20H4v-5z"/><path d="M13.5 5.5 18.5 10.5"/></svg>`;
  const ICON = (p) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  class Panel {
    constructor(opts) {
      this.pageKey = opts.pageKey;
      this.url = opts.url || location.href;
      this.title = opts.title || document.title || this.url;
      this.contentRoot = opts.contentRoot || document.body;
      this.doc = this.contentRoot.ownerDocument || document;
      this.win = this.doc.defaultView || window;
      this.shiftTarget = opts.shiftTarget || this.doc.documentElement;

      this.store = new W.Storage.PageStore(this.pageKey);
      this.highlighter = new W.Highlighter(this.contentRoot, {
        onClick: (id) => this.focusHighlight(id),
      });
      this.record = { note: "", highlights: [], url: this.url, title: this.title };
      this.isOpen = false;
      this.mode = "edit";
      this.color = "yellow";
      this.width = 380;
    }

    async init() {
      const settings = await W.Storage.getSettings();
      this.color = settings.defaultColor || "yellow";
      this.width = settings.panelWidth || 380;
      this.record = await this.store.load();
      this.record.url = this.url;
      this.record.title = this.record.title || this.title;

      this._build();
      this._buildSelectionButton();

      // Restore highlights from a previous session.
      if (this.record.highlights && this.record.highlights.length) {
        const missing = this.highlighter.restore(this.record.highlights);
        if (missing.length) {
          this.record.highlights = this.record.highlights.map((h) =>
            missing.includes(h.id) ? { ...h, orphan: true } : h
          );
        }
      }
      this._renderHighlights();

      // Reflect edits made in other tabs on the same page.
      this.store.onExternalChange((nv) => {
        if (!nv || this._typing) return;
        this.record = nv;
        if (this.textarea && this.textarea.value !== nv.note) this.textarea.value = nv.note || "";
        this._renderHighlights();
        if (this.mode === "preview") this._renderPreview();
      });

      this.win.addEventListener("beforeunload", () => this.store.flushNow());
    }

    /* ---------- UI construction ---------- */
    _build() {
      this.host = this.doc.createElement("div");
      this.host.setAttribute("data-webmark-ui", "panel");
      this.host.style.cssText = "all:initial;position:fixed;z-index:2147483646;";
      const shadow = this.host.attachShadow({ mode: "open" });
      const style = this.doc.createElement("style");
      style.textContent = PANEL_CSS;
      shadow.appendChild(style);

      const wrap = this.doc.createElement("div");
      wrap.className = "wrap";
      wrap.style.width = this.width + "px";
      wrap.innerHTML = `
        <div class="grip" data-act="resize"></div>
        <header>
          <span class="brand">${LOGO}<span>WebMark</span></span>
          <span class="title" title="${W.util.escapeHtml(this.title)}">${W.util.escapeHtml(this.title)}</span>
          <button class="iconbtn" data-act="close" title="Close (Alt+M)">${ICON('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')}</button>
        </header>
        <div class="toolbar">
          <div class="seg">
            <button data-act="mode-edit" class="active">Write</button>
            <button data-act="mode-preview">Preview</button>
          </div>
          <div class="swatches" data-role="swatches"></div>
          <span class="spacer"></span>
          <button class="iconbtn" data-act="copy" title="Copy markdown">${ICON('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>')}</button>
          <button class="iconbtn" data-act="export" title="Export .md">${ICON('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>')}</button>
        </div>
        <div class="body" data-role="body">
          <textarea data-role="editor" placeholder="Select text on the page to capture it here, or just start writing your notes in Markdown…"></textarea>
          <div class="preview" data-role="preview" style="display:none"></div>
        </div>
        <div class="hl-section">
          <div class="hl-head"><span data-role="hlcount">Highlights</span></div>
          <ul class="hl-list" data-role="hllist"></ul>
        </div>
        <footer>
          <button class="btn" data-act="manager">All notes</button>
          <span class="spacer" style="flex:1"></span>
          <button class="btn" data-act="clear">Clear</button>
          <span data-role="status"></span>
        </footer>
        <div class="toast" data-role="toast"></div>
      `;
      shadow.appendChild(wrap);
      this.shadow = shadow;
      this.wrap = wrap;
      this.textarea = wrap.querySelector('[data-role="editor"]');
      this.previewEl = wrap.querySelector('[data-role="preview"]');
      this.textarea.value = this.record.note || "";

      this._renderSwatches();
      wrap.addEventListener("click", (e) => this._onClick(e));
      this.textarea.addEventListener("input", () => this._onInput());
      this._initResize(wrap.querySelector(".grip"));

      this.doc.body.appendChild(this.host);
      this.host.style.display = "none";
    }

    _renderSwatches() {
      const box = this.wrap.querySelector('[data-role="swatches"]');
      box.innerHTML = "";
      W.COLORS.forEach((c) => {
        const s = this.doc.createElement("span");
        s.className = "swatch" + (c.id === this.color ? " active" : "");
        s.style.background = c.css;
        s.title = c.label;
        s.dataset.color = c.id;
        s.addEventListener("click", () => {
          this.color = c.id;
          this._renderSwatches();
        });
        box.appendChild(s);
      });
    }

    _onClick(e) {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      switch (act.dataset.act) {
        case "close": this.close(); break;
        case "mode-edit": this._setMode("edit"); break;
        case "mode-preview": this._setMode("preview"); break;
        case "copy": this._copy(); break;
        case "export": this._export(); break;
        case "clear": this._clear(); break;
        case "manager": chrome.runtime.sendMessage({ type: "open-manager" }); break;
      }
    }

    _setMode(mode) {
      this.mode = mode;
      this.wrap.querySelector('[data-act="mode-edit"]').classList.toggle("active", mode === "edit");
      this.wrap.querySelector('[data-act="mode-preview"]').classList.toggle("active", mode === "preview");
      this.textarea.style.display = mode === "edit" ? "" : "none";
      this.previewEl.style.display = mode === "preview" ? "" : "none";
      if (mode === "preview") this._renderPreview();
      else this.textarea.focus();
    }

    _renderPreview() {
      this.previewEl.innerHTML = W.markdown.render(this.textarea.value) ||
        '<p style="color:#94a3b8">Nothing to preview yet.</p>';
    }

    _onInput() {
      this._typing = true;
      clearTimeout(this._typingTimer);
      this._typingTimer = setTimeout(() => (this._typing = false), 800);
      this.record.note = this.textarea.value;
      this._persist();
      this._status("Saved");
    }

    _persist() {
      this.record.url = this.url;
      this.record.title = this.title;
      this.store.queue(this.record);
    }

    /* ---------- highlight capture ---------- */
    addSelection() {
      const sel = this.win.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        this._toast("Select some text first");
        return false;
      }
      const range = sel.getRangeAt(0);
      const text = normalizeWs(range.toString());
      if (!text) {
        this._toast("Select some text first");
        return false;
      }
      // Ignore selections inside our own UI.
      if (range.commonAncestorContainer.parentElement &&
          range.commonAncestorContainer.parentElement.closest("[data-webmark-ui]")) {
        return false;
      }

      const id = uid();
      const anchor = W.Anchor.fromRange(range, this.contentRoot);
      const applied = this.highlighter.wrap(range, { id, color: this.color });

      const hl = {
        id, color: this.color, quote: text, anchor,
        createdAt: Date.now(), orphan: applied === 0,
      };
      this.record.highlights = this.record.highlights || [];
      this.record.highlights.push(hl);

      this._appendQuote(text);
      this._renderHighlights();
      this._persist();
      sel.removeAllRanges();
      this._hideSelButton();
      if (!this.isOpen) this.open();
      this._toast("Captured");
      return true;
    }

    _appendQuote(text) {
      const quoted = text.split("\n").map((l) => "> " + l).join("\n");
      const cur = this.textarea.value;
      const sep = cur && !cur.endsWith("\n\n") ? (cur.endsWith("\n") ? "\n" : "\n\n") : "";
      this.textarea.value = cur + sep + quoted + "\n\n";
      this.record.note = this.textarea.value;
      // place caret at end ready for the user's own note
      this.textarea.focus();
      this.textarea.selectionStart = this.textarea.selectionEnd = this.textarea.value.length;
      this.textarea.scrollTop = this.textarea.scrollHeight;
      if (this.mode === "preview") this._renderPreview();
    }

    _renderHighlights() {
      const list = this.wrap.querySelector('[data-role="hllist"]');
      const countEl = this.wrap.querySelector('[data-role="hlcount"]');
      const hls = this.record.highlights || [];
      countEl.textContent = hls.length ? `Highlights · ${hls.length}` : "Highlights";
      list.innerHTML = "";
      if (!hls.length) {
        list.innerHTML = '<div class="empty">No highlights yet. Select text on the page and click “Highlight”.</div>';
        return;
      }
      const colorCss = (id) => (W.COLORS.find((c) => c.id === id) || W.COLORS[0]).css;
      hls.forEach((h) => {
        const li = this.doc.createElement("li");
        li.className = "hl-item";
        li.innerHTML = `
          <span class="hl-dot" style="background:${colorCss(h.color)}${h.orphan ? ";opacity:.4" : ""}"></span>
          <span class="hl-text">${W.util.escapeHtml(h.quote)}${h.orphan ? " <em style='color:#cbd5e1'>(not on page)</em>" : ""}</span>
          <button class="hl-del" title="Remove highlight">×</button>`;
        li.addEventListener("click", (e) => {
          if (e.target.classList.contains("hl-del")) {
            this._removeHighlight(h.id);
          } else {
            this.focusHighlight(h.id);
          }
        });
        list.appendChild(li);
      });
    }

    focusHighlight(id) {
      if (!this.isOpen) this.open();
      this.highlighter.scrollTo(id);
    }

    _removeHighlight(id) {
      this.highlighter.remove(id);
      this.record.highlights = (this.record.highlights || []).filter((h) => h.id !== id);
      this._renderHighlights();
      this._persist();
    }

    /* ---------- export / copy / clear ---------- */
    _buildMarkdown() {
      const lines = [
        `# ${this.title}`,
        "",
        `*Source:* ${this.url}`,
        `*Saved:* ${todayIso()}`,
        "",
        "---",
        "",
        this.textarea.value.trim() || "_(no notes yet)_",
        "",
      ];
      return lines.join("\n");
    }

    _export() {
      const md = this._buildMarkdown();
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = this.doc.createElement("a");
      const base = (this.title || "webmark").replace(/[^\w.-]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "");
      a.href = url;
      a.download = `${base || "webmark"}-${todayIso()}.md`;
      this.doc.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      this._toast("Exported .md");
    }

    async _copy() {
      try {
        await navigator.clipboard.writeText(this._buildMarkdown());
        this._toast("Copied markdown");
      } catch {
        this._toast("Copy failed — try export");
      }
    }

    _clear() {
      if (!this.textarea.value && !(this.record.highlights || []).length) return;
      if (!this.win.confirm("Clear this page's notes and highlights?")) return;
      (this.record.highlights || []).forEach((h) => this.highlighter.remove(h.id));
      this.record.highlights = [];
      this.record.note = "";
      this.textarea.value = "";
      this._renderHighlights();
      if (this.mode === "preview") this._renderPreview();
      this._persist();
      this._toast("Cleared");
    }

    /* ---------- open / close / resize ---------- */
    toggle() { this.isOpen ? this.close() : this.open(); }

    open() {
      this.isOpen = true;
      this.host.style.display = "";
      this._applyShift();
      this.shiftTarget.ownerDocument.documentElement.classList.add("webmark-open");
      this.textarea.focus();
    }

    close() {
      this.isOpen = false;
      this.host.style.display = "none";
      this._removeShift();
      this._hideSelButton();
      this.store.flushNow();
    }

    _applyShift() {
      if (this._prevMargin === undefined) {
        this._prevMargin = this.shiftTarget.style.marginRight || "";
      }
      this.shiftTarget.style.marginRight = this.width + "px";
    }

    _removeShift() {
      if (this._prevMargin !== undefined) {
        this.shiftTarget.style.marginRight = this._prevMargin;
      }
    }

    _initResize(grip) {
      let startX = 0, startW = 0, dragging = false;
      const onMove = (e) => {
        if (!dragging) return;
        const w = Math.min(720, Math.max(280, startW + (startX - e.clientX)));
        this.width = w;
        this.wrap.style.width = w + "px";
        if (this.isOpen) this.shiftTarget.style.marginRight = w + "px";
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        this.doc.removeEventListener("mousemove", onMove);
        this.doc.removeEventListener("mouseup", onUp);
        W.Storage.setSettings({ panelWidth: this.width });
      };
      grip.addEventListener("mousedown", (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startW = this.width;
        this.doc.addEventListener("mousemove", onMove);
        this.doc.addEventListener("mouseup", onUp);
      });
    }

    /* ---------- floating selection button ---------- */
    _buildSelectionButton() {
      const host = this.doc.createElement("div");
      host.setAttribute("data-webmark-ui", "selbtn");
      host.style.cssText = "all:initial;position:fixed;z-index:2147483647;display:none;";
      const sh = host.attachShadow({ mode: "open" });
      sh.innerHTML = `
        <style>
          .b{display:flex;align-items:center;gap:6px;background:#1d4ed8;color:#fff;border:0;
            padding:7px 11px;border-radius:8px;font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;
            cursor:pointer;box-shadow:0 6px 18px rgba(29,78,216,.4);}
          .b:hover{background:#1e40af;}
          .dot{width:11px;height:11px;border-radius:3px;background:#fde68a;}
          svg{width:14px;height:14px;}
        </style>
        <button class="b"><span class="dot"></span>Highlight</button>`;
      this.doc.body.appendChild(host);
      this.selHost = host;
      const btn = sh.querySelector(".b");
      this.selDot = sh.querySelector(".dot");
      // mousedown (not click) so the page selection isn't cleared before we read it
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.addSelection();
      });

      const reposition = debounce(() => this._positionSelButton(), 80);
      this.doc.addEventListener("selectionchange", reposition);
      this.win.addEventListener("scroll", () => this._hideSelButton(), true);
      this.win.addEventListener("resize", () => this._hideSelButton());
    }

    _positionSelButton() {
      if (!this.isOpen) return; // only offer capture while the panel is open
      const sel = this.win.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim() || sel.rangeCount === 0) {
        return this._hideSelButton();
      }
      const node = sel.anchorNode;
      if (node && node.parentElement && node.parentElement.closest("[data-webmark-ui]")) {
        return this._hideSelButton();
      }
      const rect = sel.getRangeAt(sel.rangeCount - 1).getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) return this._hideSelButton();
      const cur = W.COLORS.find((c) => c.id === this.color) || W.COLORS[0];
      if (this.selDot) this.selDot.style.background = cur.css;
      const top = Math.min(this.win.innerHeight - 50, rect.bottom + 8);
      const maxLeft = this.win.innerWidth - this.width - 130;
      const left = Math.max(8, Math.min(maxLeft, rect.left));
      this.selHost.style.top = top + "px";
      this.selHost.style.left = left + "px";
      this.selHost.style.display = "";
    }

    _hideSelButton() {
      if (this.selHost) this.selHost.style.display = "none";
    }

    /* ---------- misc ---------- */
    _status(text) {
      const el = this.wrap.querySelector('[data-role="status"]');
      if (!el) return;
      el.textContent = text;
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => (el.textContent = ""), 1200);
    }

    _toast(text) {
      const el = this.wrap.querySelector('[data-role="toast"]');
      if (!el) return;
      el.textContent = text;
      el.classList.add("show");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
    }
  }

  W.Panel = Panel;
})();
