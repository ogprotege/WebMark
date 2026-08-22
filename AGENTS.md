# AGENTS.md

## Cursor Cloud specific instructions

WebMark is an unpacked Chrome MV3 extension (vanilla JS, no build step) that adds
a Markdown notes column beside any page/PDF; highlighting text turns it into a
blockquote note. User docs are in `README.md`; the manifest is `manifest.json`.

The environment update script runs `npm install` (only dev dependency is `jsdom`
for tests). There is no bundler — the `src/` files load directly via the manifest.

- **Verify core logic with the test suite:** `npm test` runs `tools/test.mjs`
  (markdown / anchor / storage / export / security / PDF helpers, 81 tests) and
  `tools/test-dom.mjs` (jsdom: text-quote anchors, highlights, panel privacy,
  SPA sync, and manager behavior, 45 tests).
  These execute the real `src/core/*.js` modules and are the reliable way to check
  the extension in the cloud.
- **Loading the unpacked extension in the VM's automated Chrome is unreliable.**
  Observed in this environment: `chrome://extensions` does not render extension
  cards and content scripts do not inject, so the in-browser panel (Alt+M toggle,
  Alt+H capture) could not be demonstrated headlessly. For a real interactive
  check, load it on a normal desktop Chrome: `chrome://extensions` → enable
  Developer mode → "Load unpacked" → select this repo root, and enable "Allow
  access to file URLs" to use it on `file://` pages.
- **`npm run icons`** regenerates `icons/*.png` via `tools/make_icons.py` (needs
  `python3`); not part of normal dev.
