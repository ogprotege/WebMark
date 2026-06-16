// Content-script entry for ordinary web pages. Loads after the core modules
// (declared earlier in the manifest), restores any saved highlights, and wires
// up messages from the background service worker.
(function () {
  if (window.__webmarkContentLoaded) return;
  window.__webmarkContentLoaded = true;
  const W = globalThis.WebMark;
  if (!W || !W.Panel) return;

  let panel = null;
  let initing = null;

  function ensurePanel() {
    if (panel) return Promise.resolve(panel);
    if (initing) return initing;
    const p = new W.Panel({
      pageKey: W.util.keyForUrl(location.href),
      url: location.href,
      title: document.title,
      contentRoot: document.body,
      shiftTarget: document.documentElement,
    });
    initing = p.init().then(() => {
      panel = p;
      return p;
    });
    return initing;
  }

  // Restore highlights quietly on load if this page has saved notes.
  (async function restoreIfSaved() {
    try {
      const key = W.util.keyForUrl(location.href);
      const rec = await new W.Storage.PageStore(key).load();
      if ((rec.highlights && rec.highlights.length) || rec.note) {
        await ensurePanel(); // builds hidden panel + restores highlights
      }
    } catch (e) {
      /* storage may be unavailable on some pages */
    }
  })();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === "toggle") {
      ensurePanel().then((p) => p.toggle());
      sendResponse && sendResponse({ ok: true });
    } else if (msg.type === "capture") {
      ensurePanel().then((p) => {
        if (!p.isOpen) p.open();
        p.addSelection();
      });
      sendResponse && sendResponse({ ok: true });
    } else if (msg.type === "ping") {
      sendResponse && sendResponse({ ok: true, where: "content" });
    }
    return true;
  });

  // Basic SPA support: re-key the panel when the user navigates back/forward.
  window.addEventListener("popstate", () => {
    if (!panel) return;
    const newKey = W.util.keyForUrl(location.href);
    if (newKey !== panel.pageKey) {
      // simplest safe behaviour: drop in-page marks and reload for the new URL
      location.reload();
    }
  });
})();
