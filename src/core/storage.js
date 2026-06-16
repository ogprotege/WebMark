// Persistence layer over chrome.storage.local.
//
// Each page's note is stored under "wm:<normalized-url>". Settings live under
// "wm:settings". Saves are debounced so typing stays smooth.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const PREFIX = "wm:";
  const SETTINGS_KEY = "wm:settings";

  const DEFAULT_SETTINGS = {
    autoOpenPdf: true,
    defaultColor: "yellow",
    panelWidth: 380,
    fontScale: 1,
  };

  function area() {
    // Available in content scripts and extension pages alike.
    return chrome.storage.local;
  }

  async function getSettings() {
    const out = await area().get(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_SETTINGS, out[SETTINGS_KEY] || {});
  }

  async function setSettings(patch) {
    const current = await getSettings();
    const next = Object.assign(current, patch);
    await area().set({ [SETTINGS_KEY]: next });
    return next;
  }

  async function listNotes() {
    const all = await area().get(null);
    return Object.keys(all)
      .filter((k) => k.startsWith(PREFIX) && k !== SETTINGS_KEY)
      .map((k) => all[k])
      .filter((r) => r && (r.note || (r.highlights && r.highlights.length)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  class PageStore {
    constructor(pageKey) {
      this.key = pageKey;
      this.storageKey = PREFIX + pageKey;
      this._save = W.util.debounce(() => this._flush(), 600);
      this._pending = null;
    }

    async load() {
      const out = await area().get(this.storageKey);
      return (
        out[this.storageKey] || {
          key: this.key,
          url: "",
          title: "",
          note: "",
          highlights: [],
          updatedAt: 0,
        }
      );
    }

    queue(record) {
      this._pending = Object.assign({}, record, {
        key: this.key,
        updatedAt: Date.now(),
      });
      this._save();
    }

    async _flush() {
      if (!this._pending) return;
      await area().set({ [this.storageKey]: this._pending });
      this._pending = null;
    }

    flushNow() {
      this._save.flush();
    }

    async remove() {
      this._pending = null;
      await area().remove(this.storageKey);
    }

    // React to edits made in other tabs/windows on the same page.
    onExternalChange(cb) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return;
        if (changes[this.storageKey]) cb(changes[this.storageKey].newValue);
      });
    }
  }

  W.Storage = { PageStore, getSettings, setSettings, listNotes, DEFAULT_SETTINGS };
})();
