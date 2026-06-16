# WebMark — Margin Notes for Pages & PDFs

> When you read PDFs in Chrome or long articles, you often wish you could
> highlight passages and jot notes about them. **WebMark** opens a Markdown
> notes column in the page margin. Highlight any passage and it's copied into
> your notes as a blockquote — ready for you to write underneath.

WebMark is a Manifest V3 Chrome extension. It works on ordinary web pages
**and** on PDFs (via a built-in reader), keeps everything **on your own
machine**, autosaves as you go, and exports to **Markdown, plain text, HTML,
Word (.docx) and PDF** — so you never need a second app to read, mark up, and
keep your notes.

This is a build-out of an idea by [@rosswarren99](https://github.com/rosswarren99/markup)
("Markup Notes"), extended with the things that MVP flagged as TODO — durable
highlights and real PDF support — plus multi-format export and an all-notes
dashboard.

---

## Table of contents

- [Why WebMark](#why-webmark)
- [Feature overview](#feature-overview)
- [Install locally](#install-locally-developer-mode)
- [The core workflow](#the-core-workflow)
- [Use cases](#use-cases)
- [Exporting your notes](#exporting-your-notes)
- [Managing notes (the dashboard)](#managing-notes-the-dashboard)
- [Your data: local-first & offline](#your-data-local-first--offline)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [How it works (architecture)](#how-it-works-architecture)
- [Development & tests](#development--tests)
- [Known limitations](#known-limitations-mvp)
- [FAQ](#faq)
- [License](#license)

---

## Why WebMark

Reading and note-taking are usually split across tools: you read in the
browser, then copy-paste quotes into a separate notes app, losing the link back
to the source and your place on the page. WebMark collapses that into one
uninterrupted flow:

- **One surface.** Read on the left, write on the right. No tab-switching, no
  copy-paste shuffle.
- **No account, no cloud, no setup.** Nothing to sign into; it works the moment
  it's installed.
- **Local-first and offline.** Your notes live in the browser's own storage on
  your machine. Reading a downloaded PDF on a plane with no Wi-Fi works exactly
  the same as reading online. The only things that could lose unsaved work are a
  full machine/OS crash mid-keystroke or deleting the extension's data — i.e.
  genuine "unforeseeable disaster" territory, not normal use.
- **Yours to take with you.** Any note exports to five open formats in one
  click, so you're never locked in.

---

## Feature overview

- **Margin notes column.** Toggle a right-side panel from the toolbar icon (or
  `Alt+M`). The page content shifts left so the panel sits in the margin instead
  of covering what you're reading.
- **Highlight → blockquote.** Select text and click the floating **Highlight**
  button (or press `Alt+H`, or use the right-click menu). The passage is
  highlighted on the page and inserted into your notes as a Markdown blockquote,
  with the cursor placed right after it, ready for your own comment.
- **Five highlight colours**, switchable from the toolbar — colour-code by theme,
  importance, question vs. fact, etc.
- **Durable highlights.** Highlights are re-anchored and restored after you
  reload, using whitespace-tolerant text-quote matching with surrounding
  context, so they survive minor reflow. (This is the bit the original left for
  "later".)
- **Live Markdown preview.** Toggle between **Write** and **Preview** to see your
  notes formatted.
- **Real PDF support.** PDFs open in WebMark's bundled reader (PDF.js) where text
  is selectable, so the exact same highlight + notes flow works on PDFs — local
  files included.
- **Autosave**, scoped per page (origin + path), debounced so typing stays
  smooth. Reopen the page later and your notes and highlights are right where you
  left them.
- **Multi-format export & copy:** Markdown `.md`, plain text `.txt`, HTML
  `.html`, Word `.docx`, and PDF (via print) — plus one-click "copy as Markdown".
- **"All notes" dashboard.** Browse, search, re-open, export or delete every note
  you've ever taken, in one place.
- **Highlight list** in the panel — click an entry to jump to that highlight on
  the page, or remove it.
- **Cross-tab sync.** Editing the same page in two tabs keeps both in step.
- **Resizable panel** — drag its left edge; the width is remembered.

---

## Install locally (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing
   `manifest.json`).
4. Open any web page and click the **WebMark** icon (or press `Alt+M`).
5. *(Optional, for local PDFs)* click **Details** on the WebMark card and enable
   **Allow access to file URLs**.

No build step is required — the extension is plain JS/HTML/CSS plus a vendored
copy of PDF.js in `vendor/pdfjs/`.

---

## The core workflow

**On a web page**

1. Press `Alt+M` (or click the icon) to open the notes column.
2. Select some text — a **Highlight** button appears by the selection. Click it
   (or just press `Alt+H`).
3. The passage is highlighted on the page and added to your notes as a `>`
   blockquote. Type your own thoughts directly beneath it.
4. Keep reading and repeat. Everything autosaves. Switch to **Preview** anytime
   to read your notes formatted.
5. When you're done, **Export** in your preferred format, or leave it — it'll be
   waiting when you return to the page.

**On a PDF**

- By default, opening a PDF in Chrome reopens it in the WebMark reader with the
  notes column already open. (Turn this off in **All notes → settings** if you
  prefer to open the reader manually.)
- You can also right-click any PDF link and choose **Open this PDF in WebMark
  reader**, or click the toolbar icon while viewing a PDF.
- Select text in the PDF and highlight exactly as on a web page. Zoom with the
  toolbar buttons; highlights re-apply automatically after zooming.
- Local PDFs (`file://…`) work too, once you've enabled **Allow access to file
  URLs** (see install step 5).

---

## Use cases

- **Researching a topic across many articles.** Highlight the key claim in each
  source; your notes accumulate the quotes with your synthesis underneath. Open
  the dashboard to see every source you've touched.
- **Reading academic papers / PDFs.** Mark definitions, results and caveats in a
  paper, write margin commentary, then export the lot to `.docx` to drop into a
  literature-review document.
- **Studying & revision.** Colour-code highlights (e.g. yellow = key term, pink =
  "don't understand yet"), write explanations in your own words, and export to
  PDF for offline revision.
- **Journalists & writers.** Pull quotes from sources into blockquotes with
  attribution context preserved, annotate them, and export clean Markdown into
  your CMS or editor.
- **Legal / contract / policy review.** Highlight clauses, note questions inline,
  and export a `.docx` summary to share.
- **Meeting prep / briefing.** Skim a long page, highlight the parts that matter,
  and walk into the meeting with a one-screen notes column.
- **Book/long-read commonplace book.** Build a running set of favourite passages
  and reflections, all searchable from the dashboard.
- **Offline reading.** Save a PDF locally, read and annotate it on a flight; sync
  nothing, depend on nothing.

---

## Exporting your notes

Click the **export** icon in the panel (or the **Export ▾** menu on any card in
the dashboard) and pick a format:

| Format | Extension | Best for |
| --- | --- | --- |
| **Markdown** | `.md` | Notes apps (Obsidian, Notion import), GitHub, plain re-use |
| **Plain text** | `.txt` | Maximum portability; Markdown syntax stripped to clean text |
| **Web page** | `.html` | A styled, self-contained page you can open or share |
| **Word** | `.docx` | Handing off to colleagues; opens in Word/Google Docs/LibreOffice |
| **PDF** | print… | A fixed, printable copy — choose "Save as PDF" in the dialog |

Every export includes the page **title**, the **source URL**, and the **date**,
followed by your notes (which contain the passages you captured). You can also
**copy the note as Markdown** to the clipboard with one click.

> The `.docx` and `.html` exporters are written from scratch with no
> dependencies — the Word file is a real OOXML package (validated to open in
> Word/Docs/LibreOffice), and PDF uses the browser's own print engine, so there's
> nothing extra to install.

---

## Managing notes (the dashboard)

Open **All notes** from the panel footer (or the extension's *Options* entry on
`chrome://extensions`). From there you can:

- **See every note** you've taken, newest first, each showing the title, source,
  date, a snippet, and how many highlights it has.
- **Search** across titles, URLs and note text.
- **Open** a note's original page or PDF in one click (PDFs reopen in the
  reader).
- **Export** any note in any of the five formats.
- **Delete** a note you no longer need.
- **Adjust settings:** toggle auto-opening PDFs in the reader, and set your
  default highlight colour.

---

## Your data: local-first & offline

- **Where it lives:** everything is stored with Chrome's `storage.local` API —
  on your computer, in your browser profile. There is **no server, no account,
  and no telemetry**. WebMark makes no network requests of its own.
- **Keys:** each page's note is saved under a normalised version of its URL
  (origin + path, with tracking parameters and `#fragments` stripped), so
  revisiting the same article — even via a slightly different link — brings back
  the same note. PDF notes are keyed to the PDF's URL.
- **Autosave:** edits are saved automatically (debounced ~0.6s) and flushed
  immediately when you close the panel or leave the page.
- **Offline:** because nothing depends on the network, WebMark works fully
  offline. A network outage cannot lose your notes — they were never in transit.
- **Backups / portability:** export important notes to keep file copies. Note
  that browser-managed storage is tied to your Chrome profile; clearing the
  extension's data or removing the extension deletes its stored notes, so export
  anything you want to keep long-term.

---

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Toggle the notes panel | `Alt+M` |
| Add the current selection to notes | `Alt+H` |

You can rebind these at `chrome://extensions/shortcuts`.

---

## How it works (architecture)

```
manifest.json            MV3 manifest (content scripts, background, viewer, options)
src/
  background.js          Service worker: toolbar/shortcut/menu routing + PDF redirect
  content.js             Content-script entry for normal web pages
  core/                  Shared modules (loaded in both content scripts and the reader)
    util.js              URL keying, debounce, escaping
    markdown.js          Tiny, sanitising Markdown → HTML renderer (preview/HTML export)
    anchor.js            Text-quote anchoring: store + re-find highlighted passages
    highlighter.js       Wrap/restore/remove on-page <mark> highlights
    storage.js           chrome.storage.local wrapper (per-page notes + settings)
    export.js            Markdown/TXT/HTML/DOCX/PDF exporters (+ in-house ZIP writer)
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
highlight on a PDF go through identical code — the only difference is *what* DOM
the text lives in (the page body vs. the PDF's text layer). The UI is rendered in
a Shadow DOM so the host page's CSS can't leak in or out.

**Durable highlighting.** When you highlight, WebMark stores the selected text
plus a little context on each side and a fractional position. On reload it
searches the live document for that quote (whitespace-tolerantly), disambiguates
duplicates by context, and re-wraps the match. Notes themselves are plain
Markdown, so they're never lost even if a highlight can't be re-anchored (it's
then marked "not on page" in the list, with your note text intact).

---

## Development & tests

```bash
npm install        # installs jsdom (for tests only)
npm test           # pure-logic tests + jsdom DOM round-trip tests
npm run icons      # regenerate PNG icons (pure-Python, no deps)
```

`npm test` covers URL keying, the Markdown renderer (including link/HTML
sanitising), the anchoring matcher, all five exporters (including a CRC-checked
`.docx` ZIP), and full wrap → remove → reload-restore round-trips in jsdom.

---

## Known limitations (MVP)

- **PDFs with no `.pdf` extension** aren't auto-detected. Use the right-click menu
  to open them in the reader.
- **Single-page apps:** notes are keyed by URL; for SPAs that change the URL
  without a full load, WebMark reloads when you navigate back/forward.
- The reader renders all pages up front, which can be heavy for very large PDFs.
- **Scanned / image-only PDFs** have no selectable text, so they can't be
  highlighted (you can still take notes).
- **PDF export** uses the browser print dialog (choose "Save as PDF"); it isn't a
  silent file download like the other formats.
- Highlight restoration matches on text; if a page's text changes substantially,
  a highlight may not re-anchor (your note text is preserved regardless).

---

## FAQ

**Do I need an account or internet connection?** No to both. It's entirely local
and offline.

**Will my notes sync between computers?** Not in this version — storage is local
to the browser profile. Export to a file (e.g. `.md`) to move notes around.

**Does it send my reading anywhere?** No. WebMark makes no network requests and
has no analytics.

**Can I highlight a scanned PDF?** Only if it has a real text layer. Image-only
scans have no selectable text, though you can still write free-form notes.

**What happens to a highlight if the article is edited?** The note (including the
quoted text) is always kept. The on-page highlight re-appears if the text can
still be found; otherwise it's listed as "not on page".

---

## License

MIT © William Sherman. Original concept by Ross Warren. Bundled PDF.js is ©
Mozilla (Apache-2.0, see `vendor/pdfjs/LICENSE`).
