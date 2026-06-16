// WebMark PDF reader. Renders the PDF with PDF.js (canvas + selectable text
// layer) so the very same highlight/notes machinery used on web pages works on
// PDFs — which is the main thing the original MVP couldn't do.
(function () {
  const W = globalThis.WebMark;
  const params = new URLSearchParams(location.search);
  const fileUrl = params.get("file");

  const statusEl = document.getElementById("status");
  const pagesEl = document.getElementById("pages");
  let pdfDoc = null;
  let scale = 1;
  let baseScale = 1;
  let pdfjsLib = null;
  let panel = null;

  function setStatus(html) {
    statusEl.innerHTML = html;
    statusEl.style.display = html ? "" : "none";
  }

  if (!fileUrl) {
    setStatus("No PDF specified.");
    return;
  }
  document.getElementById("openOriginal").href = fileUrl;

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
    document.getElementById("pageinfo").textContent =
      `${pdfDoc.numPages} page${pdfDoc.numPages > 1 ? "s" : ""}`;

    // Fit to width based on the first page.
    const first = await pdfDoc.getPage(1);
    const vp1 = first.getViewport({ scale: 1 });
    const target = Math.min(Math.max(pagesEl.clientWidth - 24, 320), 920);
    baseScale = Math.max(0.5, target / vp1.width);
    scale = baseScale;

    await renderAll();
    setStatus("");

    panel = new W.Panel({
      pageKey: W.util.keyForUrl(fileUrl),
      url: fileUrl,
      title: name,
      contentRoot: pagesEl,
      shiftTarget: document.documentElement,
    });
    await panel.init();
    panel.open(); // a reader: notes open by default

    wireToolbar();
  }

  async function renderAll() {
    pagesEl.innerHTML = "";
    const dpr = window.devicePixelRatio || 1;
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n);
      const viewport = page.getViewport({ scale });

      const pageDiv = document.createElement("div");
      pageDiv.className = "page";
      pageDiv.style.width = Math.floor(viewport.width) + "px";
      pageDiv.style.height = Math.floor(viewport.height) + "px";
      pageDiv.style.setProperty("--scale-factor", scale);
      pageDiv.style.setProperty("--total-scale-factor", scale);

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";
      pageDiv.appendChild(canvas);

      const textDiv = document.createElement("div");
      textDiv.className = "textLayer";
      pageDiv.appendChild(textDiv);
      pagesEl.appendChild(pageDiv);

      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      }).promise;

      const textContent = await page.getTextContent();
      const tl = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textDiv,
        viewport,
      });
      await tl.render();
    }
  }

  function setZoom(s) {
    scale = Math.min(4, Math.max(0.3, s));
    document.getElementById("zoomLevel").textContent =
      Math.round((scale / baseScale) * 100) + "%";
    renderAll().then(() => {
      if (panel) panel.highlighter.restore(panel.record.highlights || []);
    });
  }

  function wireToolbar() {
    document.getElementById("zoomLevel").textContent = "100%";
    document.getElementById("zoomIn").onclick = () => setZoom(scale * 1.15);
    document.getElementById("zoomOut").onclick = () => setZoom(scale / 1.15);
    document.getElementById("toggleNotes").onclick = () => panel && panel.toggle();
  }

  // Respond to the toolbar button / keyboard shortcut routed via the background.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!panel || !msg) return;
    if (msg.type === "toggle") panel.toggle();
    else if (msg.type === "capture") {
      if (!panel.isOpen) panel.open();
      panel.addSelection();
    }
  });

  main();
})();
