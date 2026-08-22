// WebMark PDF reader. Renders the PDF with PDF.js (canvas + selectable text
// layer) so the very same highlight/notes machinery used on web pages works on
// PDFs. Pages render lazily (on demand as they approach the viewport) and far
// pages are evicted, so even very large PDFs open instantly and stay light.
(function () {
  const W = globalThis.WebMark;
  const params = new URLSearchParams(location.search);
  const fileUrl = params.get("file");

  const statusEl = document.getElementById("status");
  const pagesEl = document.getElementById("pages");

  let pdfDoc = null;
  let pdfjsLib = null;
  let panel = null;
  let scale = 1;
  let baseScale = 1;
  let baseViewport = null; // first page @ scale 1, used to size placeholders
  let io = null;

  const pageDivs = [];               // 1-indexed page elements
  const rendered = new Set();        // page numbers currently rendered
  const renderTasks = new Map();     // page -> PDF.js RenderTask (for cancel)
  const renders = new W.RenderCoordinator();
  const MAX_RENDERED = 14;           // memory cap for very large PDFs

  function setStatus(html) {
    statusEl.innerHTML = html;
    statusEl.style.display = html ? "" : "none";
  }

  if (!fileUrl) {
    setStatus("No PDF specified.");
    return;
  }
  document.getElementById("openOriginal").href = fileUrl;

  /* ---------- load ---------- */
  async function main() {
    setStatus("Loading PDF…");
    try {
      pdfjsLib = await import(chrome.runtime.getURL("vendor/pdfjs/pdf.min.mjs"));
    } catch (e) {
      setStatus("Failed to load the PDF engine.");
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
      "vendor/pdfjs/pdf.worker.min.mjs"
    );

    try {
      pdfDoc = await pdfjsLib.getDocument({ url: fileUrl, isEvalSupported: false }).promise;
    } catch (e) {
      setStatus(
        `Could not open this PDF.<br><br><a href="${encodeURI(fileUrl)}">Open the original PDF instead</a>` +
          `<br><br><small>If it is a local file, enable “Allow access to file URLs” for WebMark on chrome://extensions.</small>`
      );
      return;
    }

    const name =
      decodeURIComponent((fileUrl.split("/").pop() || "document.pdf").split(/[?#]/)[0]) ||
      "document.pdf";
    document.getElementById("filename").textContent = name;
    document.title = name + " — WebMark";
    document.getElementById("pageinfo").textContent = `1 / ${pdfDoc.numPages}`;

    const first = await pdfDoc.getPage(1);
    baseViewport = first.getViewport({ scale: 1 });
    const target = Math.min(Math.max(pagesEl.clientWidth - 24, 320), 920);
    baseScale = Math.max(0.5, target / baseViewport.width);
    scale = baseScale;

    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) renderPage(Number(e.target.dataset.page));
        }
      },
      { rootMargin: "1200px 0px" }
    );

    buildPlaceholders();
    setStatus("");

    panel = new W.Panel({
      pageKey: W.util.keyForUrl(fileUrl),
      url: fileUrl,
      title: name,
      contentRoot: pagesEl,
      shiftTarget: document.documentElement,
      lazy: true,
      resolveHighlight: (hl) => (hl && hl.page ? ensurePageRendered(hl.page) : Promise.resolve()),
    });
    await panel.init();
    panel.open(); // a reader: notes open by default

    renderVisible();
    wireToolbar();
    return panel;
  }

  /* ---------- placeholders + lazy render ---------- */
  function placeholderInner(n) {
    return `<span class="pagenum">${n}</span>`;
  }

  function buildPlaceholders() {
    pagesEl.innerHTML = "";
    renders.invalidateAll();
    rendered.clear();
    renderTasks.clear();
    pageDivs.length = 0;
    const w = Math.floor(baseViewport.width * scale);
    const h = Math.floor(baseViewport.height * scale);
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const div = document.createElement("div");
      div.className = "page placeholder";
      div.dataset.page = String(n);
      div.style.width = w + "px";
      div.style.height = h + "px";
      div.style.setProperty("--scale-factor", scale);
      div.innerHTML = placeholderInner(n);
      pagesEl.appendChild(div);
      pageDivs[n] = div;
      io.observe(div);
    }
  }

  function renderPage(n) {
    if (!n) return Promise.resolve();
    const div = pageDivs[n];
    if (rendered.has(n) && div && !div.classList.contains("placeholder")) {
      return Promise.resolve();
    }
    return renders.run(n, (isCurrent) => performRenderPage(n, isCurrent));
  }

  async function performRenderPage(n, isCurrent) {
    rendered.add(n); // reserve immediately to avoid double-render
    const myScale = scale;
    let page;
    try {
      page = await pdfDoc.getPage(n);
    } catch {
      if (isCurrent()) rendered.delete(n);
      return;
    }
    const div = pageDivs[n];
    if (!isCurrent()) return;
    if (!div || myScale !== scale) {
      rendered.delete(n);
      return;
    }

    const viewport = page.getViewport({ scale: myScale });
    div.style.width = Math.floor(viewport.width) + "px";
    div.style.height = Math.floor(viewport.height) + "px";
    div.style.setProperty("--scale-factor", myScale);
    div.style.setProperty("--total-scale-factor", myScale);
    div.innerHTML = "";

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";
    div.appendChild(canvas);

    const textDiv = document.createElement("div");
    textDiv.className = "textLayer";
    div.appendChild(textDiv);

    const task = page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
    });
    renderTasks.set(n, task);
    try {
      await task.promise;
    } catch {
      if (isCurrent()) {
        if (renderTasks.get(n) === task) renderTasks.delete(n);
        rendered.delete(n);
        div.className = "page placeholder";
        div.innerHTML = placeholderInner(n);
      }
      return; // cancelled (e.g. by a zoom) — leave as placeholder
    }
    if (!isCurrent()) return;
    if (renderTasks.get(n) === task) renderTasks.delete(n);
    if (myScale !== scale) {
      rendered.delete(n);
      return;
    }

    try {
      const textContent = await page.getTextContent();
      if (myScale === scale) {
        const tl = new pdfjsLib.TextLayer({ textContentSource: textContent, container: textDiv, viewport });
        await tl.render();
      }
    } catch {
      /* text layer optional */
    }

    if (!isCurrent() || myScale !== scale) return;
    div.classList.remove("placeholder");
    if (panel) panel.reapplyHighlights(); // re-attach highlights now on this page
    evictIfNeeded(n);
  }

  function evictIfNeeded(center) {
    if (rendered.size <= MAX_RENDERED) return;
    // evict pages furthest from the one we just rendered
    const order = [...rendered].sort((a, b) => Math.abs(b - center) - Math.abs(a - center));
    for (const victim of order) {
      if (rendered.size <= MAX_RENDERED) break;
      if (victim === center) continue;
      evict(victim);
    }
  }

  function evict(p) {
    renders.invalidate(p);
    const task = renderTasks.get(p);
    if (task && task.cancel) {
      try { task.cancel(); } catch {}
    }
    renderTasks.delete(p);
    const div = pageDivs[p];
    if (div) {
      div.className = "page placeholder";
      div.innerHTML = placeholderInner(p);
    }
    rendered.delete(p);
  }

  function renderVisible() {
    const vh = window.innerHeight;
    for (let n = 1; n < pageDivs.length; n++) {
      const div = pageDivs[n];
      if (!div) continue;
      const r = div.getBoundingClientRect();
      if (r.bottom > -1200 && r.top < vh + 1200) renderPage(n);
    }
  }

  function ensurePageRendered(n) {
    const div = pageDivs[n];
    if (!div) return Promise.resolve();
    div.scrollIntoView({ block: "center" });
    if (rendered.has(n) && !div.classList.contains("placeholder")) return Promise.resolve();
    return renderPage(n);
  }

  /* ---------- zoom + toolbar ---------- */
  function setZoom(s) {
    scale = Math.min(4, Math.max(0.3, s));
    document.getElementById("zoomLevel").textContent =
      Math.round((scale / baseScale) * 100) + "%";
    renders.invalidateAll();
    renderTasks.forEach((t) => {
      if (t && t.cancel) { try { t.cancel(); } catch {} }
    });
    renderTasks.clear();
    rendered.clear();
    const w = Math.floor(baseViewport.width * scale);
    const h = Math.floor(baseViewport.height * scale);
    for (let n = 1; n < pageDivs.length; n++) {
      const div = pageDivs[n];
      if (!div) continue;
      div.className = "page placeholder";
      div.style.width = w + "px";
      div.style.height = h + "px";
      div.style.setProperty("--scale-factor", scale);
      div.innerHTML = placeholderInner(n);
    }
    renderVisible();
  }

  function currentPage() {
    let best = 1;
    let bestDist = Infinity;
    for (let n = 1; n < pageDivs.length; n++) {
      const div = pageDivs[n];
      if (!div) continue;
      const d = Math.abs(div.getBoundingClientRect().top - 70);
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }

  function wireToolbar() {
    document.getElementById("zoomLevel").textContent = "100%";
    document.getElementById("zoomIn").onclick = () => setZoom(scale * 1.15);
    document.getElementById("zoomOut").onclick = () => setZoom(scale / 1.15);
    document.getElementById("toggleNotes").onclick = () => panel && panel.toggle();

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          document.getElementById("pageinfo").textContent =
            `${currentPage()} / ${pdfDoc.numPages}`;
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  const panelMessages = new W.PanelMessageRouter(main());

  // Respond to toolbar and shortcut actions, including ones received while the
  // PDF engine and panel are still initializing.
  chrome.runtime.onMessage.addListener((msg) => {
    panelMessages.dispatch(msg);
  });
})();
