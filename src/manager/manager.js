// The "All notes" dashboard + settings.
(function () {
  const W = globalThis.WebMark;
  const listEl = document.getElementById("list");
  const searchEl = document.getElementById("search");
  let notes = [];

  function isPdf(url) {
    return /\.pdf($|[?#])/i.test(url || "");
  }
  function viewerUrl(url) {
    return chrome.runtime.getURL("src/pdf/viewer.html") + "?file=" + encodeURIComponent(url);
  }
  function host(url) {
    try { return new URL(url).host; } catch { return url; }
  }
  function fmtDate(ts) {
    if (!ts) return "";
    try { return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch { return ""; }
  }

  function buildMarkdown(rec) {
    return [
      `# ${rec.title || rec.url}`,
      "",
      `*Source:* ${rec.url || ""}`,
      `*Saved:* ${fmtDate(rec.updatedAt)}`,
      "",
      "---",
      "",
      (rec.note || "").trim() || "_(no notes yet)_",
      "",
    ].join("\n");
  }

  function download(rec) {
    const blob = new Blob([buildMarkdown(rec)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (rec.title || "webmark").replace(/[^\w.-]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "");
    a.href = url;
    a.download = `${base || "webmark"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      if (!q) return true;
      return ((n.title || "") + " " + (n.url || "") + " " + (n.note || "")).toLowerCase().includes(q);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">${
        notes.length ? "No notes match your search." : "No notes yet. Open a page or PDF and start highlighting!"
      }</div>`;
      return;
    }

    listEl.innerHTML = "";
    filtered.forEach((rec) => {
      const card = document.createElement("div");
      card.className = "card note-card";
      const hlCount = (rec.highlights || []).length;
      card.innerHTML = `
        <div class="top">
          <span class="title">${esc(rec.title || rec.url || "Untitled")}</span>
          <span class="meta">${fmtDate(rec.updatedAt)}</span>
        </div>
        <div class="host">${esc(host(rec.url))}${isPdf(rec.url) ? " · PDF" : ""}</div>
        ${rec.note ? `<div class="snippet">${esc(rec.note)}</div>` : ""}
        <div class="actions">
          ${hlCount ? `<span class="pill">${hlCount} highlight${hlCount > 1 ? "s" : ""}</span>` : ""}
          <span style="flex:1"></span>
          <button class="btn primary" data-act="open">Open</button>
          <button class="btn" data-act="export">Export .md</button>
          <button class="btn danger" data-act="delete">Delete</button>
        </div>`;
      card.querySelector('[data-act="open"]').onclick = () => {
        chrome.tabs.create({ url: isPdf(rec.url) ? viewerUrl(rec.url) : rec.url });
      };
      card.querySelector('[data-act="export"]').onclick = () => download(rec);
      card.querySelector('[data-act="delete"]').onclick = async () => {
        if (!confirm("Delete the notes and highlights for this page?")) return;
        await new W.Storage.PageStore(rec.key).remove();
        notes = notes.filter((n) => n.key !== rec.key);
        render();
      };
      listEl.appendChild(card);
    });
  }

  function esc(s) {
    return W.util.escapeHtml(s || "");
  }

  async function initSettings() {
    const sel = document.getElementById("defaultColor");
    (W.COLORS || []).forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.label;
      sel.appendChild(o);
    });
    const settings = await W.Storage.getSettings();
    document.getElementById("autoOpenPdf").checked = !!settings.autoOpenPdf;
    sel.value = settings.defaultColor || "yellow";

    document.getElementById("autoOpenPdf").addEventListener("change", (e) => {
      W.Storage.setSettings({ autoOpenPdf: e.target.checked });
    });
    sel.addEventListener("change", (e) => {
      W.Storage.setSettings({ defaultColor: e.target.value });
    });
  }

  async function main() {
    await initSettings();
    notes = await W.Storage.listNotes();
    render();
    searchEl.addEventListener("input", render);
  }

  main();
})();
