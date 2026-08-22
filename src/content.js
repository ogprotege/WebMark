// Content-script entry for ordinary web pages. Loads after the core modules
// (declared earlier in the manifest), restores any saved highlights, wires up
// messages from the background service worker, and follows SPA navigations.
(function () {
  if (window.__webmarkContentLoaded) return;
  window.__webmarkContentLoaded = true;
  const W = globalThis.WebMark;
  if (!W || !W.Panel) return;

  let panel = null;
  let initing = null;
  let lastKey = W.util.keyForUrl(location.href);

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

  // Build the (hidden) panel + restore highlights if this page has saved notes.
  async function restoreIfSaved() {
    try {
      const key = W.util.keyForUrl(location.href);
      const rec = await new W.Storage.PageStore(key).load();
      if ((rec.highlights && rec.highlights.length) || rec.note) {
        await ensurePanel();
      }
    } catch (e) {
      /* storage may be unavailable on some pages */
    }
  }

  restoreIfSaved();

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

  // --- SPA route awareness ---
  // Single-page apps change the URL without a full load. Detect it and re-key
  // the panel (saving the old note, restoring the new one) instead of reloading.
  function onLocationMaybeChanged() {
    const key = W.util.keyForUrl(location.href);
    if (key === lastKey) return;
    lastKey = key;
    if (panel) {
      panel.switchPage(key, location.href, document.title);
    } else {
      restoreIfSaved();
    }
  }

  window.addEventListener("popstate", onLocationMaybeChanged);
  window.addEventListener("hashchange", onLocationMaybeChanged);
  // The Navigation API fires for same-document SPA navigations (Chrome 102+).
  if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener("navigatesuccess", onLocationMaybeChanged);
  }
  // Belt-and-braces: catch pushState/replaceState route changes that emit no
  // event by polling the URL at a low frequency.
  setInterval(onLocationMaybeChanged, 700);
})();
