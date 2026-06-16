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

  // --- local Backup & Restore (user-owned, no cloud) ---
  // Serialise every note + settings into a single portable object the user
  // controls. Nothing here ever leaves the machine unless the user saves the file.
  async function exportAll() {
    const all = await area().get(null);
    const notes = {};
    Object.keys(all).forEach((k) => {
      if (k.startsWith(PREFIX) && k !== SETTINGS_KEY) notes[k] = all[k];
    });
    return {
      app: "WebMark",
      type: "webmark-backup",
      schema: 1,
      exportedAt: new Date().toISOString(),
      settings: all[SETTINGS_KEY] || {},
      notes,
    };
  }

  // Restore from a backup object. mode "merge" keeps whichever copy is newer
  // per page; mode "replace" overwrites local data with the backup's.
  // Returns counts so the UI can report what happened.
  async function importAll(data, mode = "merge") {
    if (!data || data.type !== "webmark-backup" || !data.notes) {
      throw new Error("Not a WebMark backup file");
    }
    const existing = await area().get(null);
    const toWrite = {};
    let added = 0, updated = 0, skipped = 0;

    for (const [key, rec] of Object.entries(data.notes)) {
      if (!key.startsWith(PREFIX)) continue;
      const cur = existing[key];
      if (!cur) {
        toWrite[key] = rec;
        added++;
      } else if (mode === "replace") {
        toWrite[key] = rec;
        updated++;
      } else {
        // merge: keep the newer record
        if ((rec.updatedAt || 0) > (cur.updatedAt || 0)) {
          toWrite[key] = rec;
          updated++;
        } else {
          skipped++;
        }
      }
    }
    if (data.settings && mode === "replace") {
      toWrite[SETTINGS_KEY] = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    }
    if (Object.keys(toWrite).length) await area().set(toWrite);
    return { added, updated, skipped, total: Object.keys(data.notes).length };
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

  W.Storage = {
    PageStore, getSettings, setSettings, listNotes,
    exportAll, importAll, DEFAULT_SETTINGS,
  };
})();
