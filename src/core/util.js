// WebMark shared utilities. Attaches to a global namespace so the same code
// works in a content-script isolated world and inside the PDF reader page.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const COLORS = [
    { id: "yellow", label: "Yellow", css: "#fde68a" },
    { id: "green", label: "Green", css: "#bbf7d0" },
    { id: "blue", label: "Blue", css: "#bfdbfe" },
    { id: "pink", label: "Pink", css: "#fbcfe8" },
    { id: "orange", label: "Orange", css: "#fed7aa" },
  ];

  const TRACKING_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "ref_src",
  ];
  const PAGE_PROTOCOLS = new Set(["http:", "https:", "file:"]);

  function isSupportedPageUrl(rawUrl) {
    try {
      return PAGE_PROTOCOLS.has(new URL(String(rawUrl)).protocol);
    } catch {
      return false;
    }
  }

  // Build a stable storage key for a page so notes re-attach on revisit.
  // Drops the hash and common tracking params; keeps origin + path + meaningful query.
  function keyForUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol === "chrome-extension:" && u.searchParams.get("file")) {
        return keyForUrl(u.searchParams.get("file"));
      }
      TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
      u.hash = "";
      const search = u.searchParams.toString();
      return u.origin + u.pathname + (search ? "?" + search : "");
    } catch {
      return String(rawUrl).split("#")[0];
    }
  }

  function debounce(fn, ms) {
    let t = null;
    const wrapped = (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        fn(...args);
      }, ms);
    };
    wrapped.flush = (...args) => {
      if (t) {
        clearTimeout(t);
        t = null;
      }
      return fn(...args);
    };
    return wrapped;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Collapse runs of whitespace (incl. newlines) to single spaces and trim.
  function normalizeWs(s) {
    return String(s).replace(/\s+/g, " ").trim();
  }

  function uid() {
    return "wm-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function todayIso() {
    // Local date (not UTC) so export filenames match the dates shown in the UI.
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  W.util = {
    keyForUrl,
    isSupportedPageUrl,
    debounce,
    escapeHtml,
    normalizeWs,
    uid,
    todayIso,
    TRACKING_PARAMS,
  };
  W.COLORS = COLORS;
})();
