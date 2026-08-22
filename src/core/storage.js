// Persistence layer over chrome.storage.local.
//
// Each page's note is stored under "wm:<normalized-url>". Settings live under
// "wm:settings". Saves are debounced so typing stays smooth.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const PREFIX = "wm:";
  const SETTINGS_KEY = "wm:settings";
  const VALID_COLORS = new Set(["yellow", "green", "blue", "pink", "orange"]);

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

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeSettings(value) {
    const input = isObject(value) ? value : {};
    return {
      autoOpenPdf: typeof input.autoOpenPdf === "boolean"
        ? input.autoOpenPdf
        : DEFAULT_SETTINGS.autoOpenPdf,
      defaultColor: VALID_COLORS.has(input.defaultColor)
        ? input.defaultColor
        : DEFAULT_SETTINGS.defaultColor,
      panelWidth: Number.isFinite(input.panelWidth)
        ? Math.min(720, Math.max(280, input.panelWidth))
        : DEFAULT_SETTINGS.panelWidth,
      fontScale: Number.isFinite(input.fontScale)
        ? Math.min(2, Math.max(0.75, input.fontScale))
        : DEFAULT_SETTINGS.fontScale,
    };
  }

  async function getSettings() {
    const out = await area().get(SETTINGS_KEY);
    return normalizeSettings(out[SETTINGS_KEY]);
  }

  async function setSettings(patch) {
    const current = await getSettings();
    const next = normalizeSettings(Object.assign({}, current, isObject(patch) ? patch : {}));
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
      settings: normalizeSettings(all[SETTINGS_KEY]),
      notes,
    };
  }

  function sanitizeHighlight(value) {
    if (!isObject(value) || typeof value.id !== "string" || !value.id) {
      throw new Error("Backup contains an invalid highlight");
    }
    if (typeof value.quote !== "string") {
      throw new Error("Backup contains an invalid highlight quote");
    }
    const sourceAnchor = value.anchor == null ? {} : value.anchor;
    if (!isObject(sourceAnchor)) {
      throw new Error("Backup contains an invalid highlight anchor");
    }
    const anchor = {
      quote: typeof sourceAnchor.quote === "string" ? sourceAnchor.quote : value.quote,
      prefix: typeof sourceAnchor.prefix === "string" ? sourceAnchor.prefix : "",
      suffix: typeof sourceAnchor.suffix === "string" ? sourceAnchor.suffix : "",
      position: Number.isFinite(sourceAnchor.position)
        ? Math.min(1, Math.max(0, sourceAnchor.position))
        : 0,
    };
    const highlight = {
      id: value.id,
      color: VALID_COLORS.has(value.color) ? value.color : DEFAULT_SETTINGS.defaultColor,
      quote: value.quote,
      anchor,
      createdAt: Number.isFinite(value.createdAt) ? value.createdAt : 0,
      orphan: value.orphan === true,
    };
    if (Number.isInteger(value.page) && value.page > 0) highlight.page = value.page;
    return highlight;
  }

  function sanitizeRecord(storageKey, value) {
    if (!isObject(value)) throw new Error("Backup contains an invalid note");
    const pageKey = storageKey.slice(PREFIX.length);
    if (
      storageKey === SETTINGS_KEY ||
      value.key !== pageKey
    ) {
      throw new Error("Backup contains an invalid note key");
    }
    const url = value.url || pageKey;
    if (
      !W.util.isSupportedPageUrl(url) ||
      W.util.keyForUrl(url) !== pageKey
    ) {
      throw new Error("Backup contains an unsupported URL");
    }
    if (value.note != null && typeof value.note !== "string") {
      throw new Error("Backup contains invalid note text");
    }
    if (value.title != null && typeof value.title !== "string") {
      throw new Error("Backup contains an invalid title");
    }
    if (value.highlights != null && !Array.isArray(value.highlights)) {
      throw new Error("Backup contains invalid highlights");
    }
    return {
      key: pageKey,
      url,
      title: value.title || "",
      note: value.note || "",
      highlights: (value.highlights || []).map(sanitizeHighlight),
      updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
    };
  }

  function sanitizeBackup(data) {
    if (
      !isObject(data) ||
      data.type !== "webmark-backup" ||
      !isObject(data.notes) ||
      (data.schema != null && data.schema !== 1)
    ) {
      throw new Error("Not a supported WebMark backup file");
    }
    const notes = {};
    for (const [key, value] of Object.entries(data.notes)) {
      if (!key.startsWith(PREFIX) || key === SETTINGS_KEY) {
        throw new Error("Backup contains an invalid storage key");
      }
      notes[key] = sanitizeRecord(key, value);
    }
    return {
      notes,
      settings: normalizeSettings(data.settings),
    };
  }

  // Restore from a backup object. mode "merge" keeps whichever copy is newer
  // per page; mode "replace" overwrites local data with the backup's.
  // Returns counts so the UI can report what happened.
  async function importAll(data, mode = "merge") {
    if (mode !== "merge" && mode !== "replace") {
      throw new Error("Unknown import mode");
    }
    const backup = sanitizeBackup(data);
    const existing = await area().get(null);
    const toWrite = {};
    let added = 0, updated = 0, skipped = 0;

    for (const [key, rec] of Object.entries(backup.notes)) {
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
    if (mode === "replace") {
      toWrite[SETTINGS_KEY] = backup.settings;
    }
    if (Object.keys(toWrite).length) await area().set(toWrite);
    if (mode === "replace") {
      const staleKeys = Object.keys(existing).filter(
        (key) =>
          key.startsWith(PREFIX) &&
          key !== SETTINGS_KEY &&
          !(key in backup.notes)
      );
      if (staleKeys.length) await area().remove(staleKeys);
    }
    return { added, updated, skipped, total: Object.keys(backup.notes).length };
  }

  class PageStore {
    constructor(pageKey) {
      this.key = pageKey;
      this.storageKey = PREFIX + pageKey;
      this._save = W.util.debounce(() => this._flush(), 600);
      this._pending = null;
      this._flushing = null;
      this._operations = Promise.resolve();
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

    _enqueue(operation) {
      const result = this._operations.then(operation);
      // Keep later operations usable after a failed write while still returning
      // the original rejection to the caller that initiated it.
      this._operations = result.catch(() => {});
      return result;
    }

    async _flush() {
      if (this._flushing) return this._flushing;
      this._flushing = (async () => {
        while (this._pending) {
          const record = this._pending;
          this._pending = null;
          try {
            await this._enqueue(() => area().set({ [this.storageKey]: record }));
          } catch (error) {
            if (!this._pending) this._pending = record;
            throw error;
          }
        }
      })();
      try {
        await this._flushing;
      } finally {
        this._flushing = null;
      }
    }

    flushNow() {
      return this._save.flush();
    }

    async remove() {
      this._pending = null;
      await this._enqueue(() => area().remove(this.storageKey));
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
