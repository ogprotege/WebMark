# WebMark — Margin Notes for Pages & PDFs

> When you read PDFs in Chrome or long articles, you often wish you could
> highlight passages and jot notes about them. **WebMark** opens a Markdown
> notes column in the page margin. Highlight any passage and it's copied into
> your notes as a blockquote — ready for you to write underneath.

WebMark is a Manifest V3 Chrome extension. It works on ordinary web pages
**and** on PDFs (via a built-in PDF reader), and your notes autosave per page.

This is a build-out of an idea by [@rosswarren99](https://github.com/rosswarren99/markup)
("Markup Notes"), extended with the things the original MVP flagged as TODO —
durable highlights and real PDF support.

---

## Features

- **Margin notes column.** Toggle a right-side panel from the toolbar icon (or `Alt+M`).
  The page content shifts left so the panel sits in the margin instead of covering it.
- **Highlight → blockquote.** Select text and click the floating **Highlight** button
  (or `Alt+H`, or the right-click menu). The passage is highlighted on the page and
  inserted into your notes as a Markdown blockquote, with the cursor placed ready for
  your own comment.
- **Five highlight colours**, switchable from the toolbar.
- **Durable highlights.** Highlights are re-anchored and restored after you reload —
  using whitespace-tolerant text-quote matching with surrounding context, so it
  survives minor reflow (this is what the original version left for "later").
- **Live Markdown preview.** Toggle between *Write* and *Preview*.
- **Real PDF support.** PDFs open in WebMark's bundled reader (PDF.js) where text is
  selectable, so the exact same highlight + notes flow works on PDFs.
- **Autosave**, scoped per page (origin + path), kept in `chrome.storage.local`.
- **Export / copy** the current note as a `.md` file or to the clipboard.
- **"All notes" dashboard.** Browse, search, re-open, export or delete every note you've taken.
- **Highlight list** in the panel — click to jump to a highlight, or remove it.
- Cross-tab sync: editing the same page in two tabs keeps both in step.

---

## Install locally (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Open any web page and click the **WebMark** icon (or press `Alt+M`).
5. *(Optional, for local PDFs)* click **Details** on the WebMark card and enable
   **Allow access to file URLs**.

No build step is required — the extension is plain JS/HTML/CSS plus a vendored
copy of PDF.js in `vendor/pdfjs/`.

---

## Using it

**On a web page**

1. Press `Alt+M` (or click the icon) to open the notes column.
2. Select some text — a **Highlight** button appears near the selection. Click it.
3. The passage is highlighted and added to your notes as a `>` blockquote. Type your
   own thoughts beneath it.
4. Use **Preview** to render the Markdown, **Export** to save a `.md`, or **All notes**
   to see everything you've collected.

**On a PDF**

- By default, when you open a PDF in Chrome it's automatically reopened in the WebMark
  reader, with the notes column already open. (Toggle this off in **All notes → settings**.)
- You can also right-click a PDF link and choose **Open this PDF in WebMark reader**.
- Select text in the PDF and highlight exactly as on a web page. Zoom with the toolbar;
  highlights re-apply after zooming.

**Shortcuts**

| Action | Shortcut |
| --- | --- |
| Toggle the notes panel | `Alt+M` |
| Add current selection to notes | `Alt+H` |

(You can change these at `chrome://extensions/shortcuts`.)

---

## How it works

```
manifest.json            MV3 manifest (content scripts, background, viewer, options)
src/
  background.js          Service worker: toolbar/shortcut/menu routing + PDF redirect
  content.js             Content-script entry for normal web pages
  core/                  Shared modules (loaded in both content scripts and the reader)
    util.js              URL keying, debounce, escaping
    markdown.js          Tiny, sanitising Markdown → HTML renderer (for preview/export)
    anchor.js            Text-quote anchoring: store + re-find highlighted passages
    highlighter.js       Wrap/restore/remove on-page <mark> highlights
    storage.js           chrome.storage.local wrapper (per-page notes + settings)
    panel.js             The notes panel UI (Shadow DOM) tying it all together
  pdf/
    viewer.html/.css/.js WebMark PDF reader built on PDF.js (canvas + text layer)
  manager/
    manager.html/.js     "All notes" dashboard + settings (also the options page)
vendor/pdfjs/            Vendored PDF.js (v4.10.38) build + worker
icons/                   Generated PNG icons
tools/                   Icon generator + tests
```

The same `core/` modules power both contexts, so a highlight on a web page and a
highlight on a PDF go through identical code — the only difference is *what* DOM the
text lives in (page body vs. the PDF text layer).

**Durable highlighting.** When you highlight, WebMark stores the selected text plus a
little context on each side and a fractional position. On reload it searches the live
document for that quote (whitespace-tolerantly), disambiguates duplicates by context,
and re-wraps the match. Notes themselves are plain Markdown, so they're never lost even
if a highlight can't be re-anchored (it's then marked "not on page" in the list).

---

## Development

```bash
npm install        # installs jsdom (for tests only)
npm test           # pure-logic tests + jsdom DOM round-trip tests
npm run icons      # regenerate PNG icons (pure-Python, no deps)
```

`npm test` covers URL keying, the Markdown renderer (including link/HTML sanitising),
the anchoring matcher, and full wrap → remove → reload-restore round-trips in jsdom.

---

## Known limitations (MVP)

- **PDFs with no `.pdf` extension** aren't auto-detected (the file is recognised by URL).
  Use the right-click menu to open them in the reader.
- **Single-page-app navigation**: notes are keyed by URL; for SPAs that change the URL
  without a full load, WebMark reloads when you navigate back/forward.
- The reader renders all pages up front, which can be heavy for very large PDFs.
- Scanned/image-only PDFs have no selectable text, so they can't be highlighted (you can
  still take notes).
- Highlight restoration matches on text; if the underlying page text changes substantially,
  a highlight may not re-anchor (the note text is preserved regardless).

---

## License

MIT © William Sherman. Original concept by Ross Warren. Bundled PDF.js is © Mozilla
(Apache-2.0, see `vendor/pdfjs/LICENSE`).
