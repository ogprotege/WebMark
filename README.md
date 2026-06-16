<div align="center">

<img src="icons/icon128.png" width="96" alt="WebMark logo" />

# W E B M A R K

### *Read it. Highlight it. Keep it — right in the margin.*

A Chrome extension that opens a **Markdown notes column** beside any web page **or PDF**.
Select a passage and it's highlighted on the page and dropped into your notes as a
blockquote to write beneath. **Local‑first, offline, no account, no tracking** — and every
note exports to Markdown, plain text, HTML, Word, and PDF.

<br>

![Version](https://img.shields.io/badge/version-0.1.0-2563eb?style=flat&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest_V3-1d4ed8?style=flat&logo=googlechrome&logoColor=white)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e?style=flat)](LICENSE)
![Offline](https://img.shields.io/badge/storage-local--first-0ea5e9?style=flat)
![Private](https://img.shields.io/badge/tracking-none-64748b?style=flat)
![Free](https://img.shields.io/badge/free-forever-22c55e?style=flat)

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-f7df1e?style=flat&logo=javascript&logoColor=black)
[![PDF.js](https://img.shields.io/badge/PDF.js-4.10.38-e11d48?style=flat&logo=mozilla&logoColor=white)](https://mozilla.github.io/pdf.js/)
![HTML5](https://img.shields.io/badge/HTML5-_-e34f26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-_-1572b6?style=flat&logo=css3&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-zero-22c55e?style=flat)
![Tests](https://img.shields.io/badge/tests-57_passing-3fb950?style=flat)

</div>

---

> *“When I read PDFs in Chrome or long articles I always wish I could highlight and make
> notes about them.”*
> — the idea behind WebMark, by [@rosswarren99](https://github.com/rosswarren99/markup)

<div align="center">

**Read on the left · write on the right · no copy‑paste shuffle, no second app.**

</div>

---

## Contents

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

Reading and note‑taking are usually split across tools: you read in the browser, then
copy‑paste quotes into a separate notes app, losing the link back to the source and your
place on the page. WebMark collapses that into one uninterrupted flow:

| | |
| --- | --- |
| 🪟 **One surface** | Read on the left, write on the right. No tab‑switching, no copy‑paste shuffle. |
| 🔓 **No setup** | No account, no cloud, nothing to sign into. It works the moment it's installed. |
| ✈️ **Local‑first & offline** | Notes live in the browser's own storage on your machine. A flight with no Wi‑Fi works exactly like being online. |
| 📦 **Yours to keep** | Any note exports to five open formats in one click — you're never locked in. |

---

## Feature overview

- **Margin notes column.** Toggle a right‑side panel from the toolbar icon (or `Alt+M`).
  The page shifts left so the panel sits in the margin instead of covering what you read.
- **Highlight → blockquote.** Select text and click the floating **Highlight** button (or
  press `Alt+H`, or use the right‑click menu). The passage is highlighted on the page and
  inserted into your notes as a Markdown blockquote, cursor placed ready for your comment.
- **Five highlight colours**, switchable from the toolbar — colour‑code by theme,
  importance, question vs. fact.
- **Durable highlights.** Highlights are re‑anchored and restored after reload using
  whitespace‑tolerant text‑quote matching with surrounding context, so they survive minor
  reflow.
- **Live Markdown preview.** Toggle between **Write** and **Preview**.
- **Real PDF support.** PDFs open in WebMark's bundled reader (PDF.js) where text is
  selectable, so the same highlight + notes flow works on PDFs — local files included.
- **Autosave**, scoped per page (origin + path), debounced so typing stays smooth.
- **Multi‑format export & copy:** `.md`, `.txt`, `.html`, `.docx`, and PDF (via print),
  plus one‑click copy‑as‑Markdown.
- **"All notes" dashboard.** Browse, search, re‑open, export, or delete every note.
- **Highlight list** in the panel — click to jump to a highlight, or remove it.
- **Cross‑tab sync** and a **resizable, remembered** panel width.

---

## Install locally (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top‑right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Open any web page and click the **WebMark** icon (or press `Alt+M`).
5. *(Optional, for local PDFs)* click **Details** on the WebMark card and enable
   **Allow access to file URLs**.

No build step is required — the extension is plain JS/HTML/CSS plus a vendored copy of
PDF.js in `vendor/pdfjs/`.

---

## The core workflow

**On a web page**

1. Press `Alt+M` (or click the icon) to open the notes column.
2. Select some text — a **Highlight** button appears by the selection. Click it (or press
   `Alt+H`).
3. The passage is highlighted on the page and added to your notes as a `>` blockquote.
   Type your own thoughts directly beneath it.
4. Keep reading and repeat. Everything autosaves. Switch to **Preview** to read formatted.
5. When you're done, **Export** in your preferred format — or just leave it; it's waiting
   when you return to the page.

**On a PDF**

- By default, opening a PDF in Chrome reopens it in the WebMark reader with the notes
  column already open. (Turn this off in **All notes → settings**.)
- You can also right‑click any PDF link and choose **Open this PDF in WebMark reader**, or
  click the toolbar icon while viewing a PDF.
- Select text in the PDF and highlight exactly as on a web page. Zoom with the toolbar;
  highlights re‑apply automatically after zooming.
- Local PDFs (`file://…`) work once you've enabled **Allow access to file URLs**.

---

## Use cases

- **Researching a topic across many articles** — highlight the key claim in each source;
  your notes accumulate the quotes with your synthesis underneath.
- **Reading academic papers / PDFs** — mark definitions, results and caveats, write margin
  commentary, then export to `.docx` for a literature review.
- **Studying & revision** — colour‑code highlights, explain in your own words, export to
  PDF for offline revision.
- **Journalists & writers** — pull quotes into blockquotes with context preserved,
  annotate, export clean Markdown into your CMS.
- **Legal / contract / policy review** — highlight clauses, note questions inline, export a
  `.docx` summary to share.
- **Meeting prep / briefing** — skim a long page, highlight what matters, arrive with a
  one‑screen notes column.
- **Commonplace book** — a running, searchable set of favourite passages and reflections.
- **Offline reading** — save a PDF locally, annotate it on a flight, depend on nothing.

---

## Exporting your notes

Click the **export** icon in the panel (or the **Export ▾** menu on any dashboard card) and
pick a format:

| Format | Extension | Best for |
| --- | --- | --- |
| **Markdown** | `.md` | Notes apps (Obsidian, Notion import), GitHub, plain re‑use |
| **Plain text** | `.txt` | Maximum portability; Markdown syntax stripped to clean text |
| **Web page** | `.html` | A styled, self‑contained page to open or share |
| **Word** | `.docx` | Handing off to colleagues; opens in Word / Google Docs / LibreOffice |
| **PDF** | print… | A fixed, printable copy — choose "Save as PDF" in the dialog |

Every export includes the page **title**, the **source URL**, and the **date**, followed by
your notes. You can also **copy the note as Markdown** with one click.

> The `.docx` and `.html` exporters are written from scratch with **no dependencies** — the
> Word file is a real OOXML package (validated to open in Word / Docs / LibreOffice), and
> PDF uses the browser's own print engine, so there's nothing extra to install.

---

## Managing notes (the dashboard)

Open **All notes** from the panel footer (or the extension's *Options* entry on
`chrome://extensions`). From there you can:

- **See every note**, newest first — title, source, date, snippet, and highlight count.
- **Search** across titles, URLs and note text.
- **Open** a note's original page or PDF in one click (PDFs reopen in the reader).
- **Export** any note in any of the five formats.
- **Delete** notes you no longer need.
- **Adjust settings** — auto‑open PDFs in the reader, and your default highlight colour.

---

## Your data: local-first & offline

- **Where it lives** — everything is stored with Chrome's `storage.local` API, on your
  computer, in your browser profile. **No server, no account, no telemetry.** WebMark makes
  no network requests of its own.
- **Keys** — each page's note is saved under a normalised URL (origin + path, with tracking
  params and `#fragments` stripped), so revisiting the same article brings back the same
  note. PDF notes are keyed to the PDF's URL.
- **Autosave** — edits save automatically (debounced ~0.6 s) and flush immediately when you
  close the panel or leave the page.
- **Offline** — nothing depends on the network, so a network outage cannot lose your notes;
  they were never in transit.
- **Backups / portability** — export important notes to keep file copies. Browser‑managed
  storage is tied to your Chrome profile; clearing the extension's data or removing it
  deletes its stored notes, so export anything you want to keep long‑term.

---

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Toggle the notes panel | `Alt+M` |
| Add the current selection to notes | `Alt+H` |

Rebind these at `chrome://extensions/shortcuts`.

---

## How it works (architecture)

```
manifest.json            MV3 manifest (content scripts, background, viewer, options)
src/
  background.js          Service worker: toolbar/shortcut/menu routing + PDF redirect
  content.js             Content-script entry for normal web pages
  core/                  Shared modules (loaded in both content scripts and the reader)
    util.js              URL keying, debounce, escaping
    markdown.js          Tiny, sanitising Markdown -> HTML renderer (preview/HTML export)
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

The same `core/` modules power both contexts, so a highlight on a web page and a highlight
on a PDF go through identical code — the only difference is *what* DOM the text lives in
(the page body vs. the PDF's text layer). The UI renders in a Shadow DOM so the host page's
CSS can't leak in or out.

**Durable highlighting.** When you highlight, WebMark stores the selected text plus a little
context on each side and a fractional position. On reload it searches the live document for
that quote (whitespace‑tolerantly), disambiguates duplicates by context, and re‑wraps the
match. Notes themselves are plain Markdown, so they're never lost even if a highlight can't
be re‑anchored (it's then marked "not on page", with your note text intact).

---

## Development & tests

```bash
npm install        # installs jsdom (for tests only)
npm test           # pure-logic tests + jsdom DOM round-trip tests
npm run icons      # regenerate PNG icons (pure-Python, no deps)
```

`npm test` covers URL keying, the Markdown renderer (including link/HTML sanitising), the
anchoring matcher, all five exporters (including a CRC‑checked `.docx` ZIP), and full
wrap → remove → reload‑restore round‑trips in jsdom.

---

## Known limitations (MVP)

- **PDFs with no `.pdf` extension** aren't auto‑detected — use the right‑click menu to open
  them in the reader.
- **Single‑page apps** — notes are keyed by URL; for SPAs that change the URL without a full
  load, WebMark reloads when you navigate back/forward.
- The reader renders all pages up front, which can be heavy for very large PDFs.
- **Scanned / image‑only PDFs** have no selectable text, so they can't be highlighted (you
  can still take notes).
- **PDF export** uses the browser print dialog (choose "Save as PDF"); it isn't a silent
  download like the other formats.
- Highlight restoration matches on text; if a page's text changes substantially, a
  highlight may not re‑anchor (your note text is preserved regardless).

---

## FAQ

**Do I need an account or internet connection?** No to both — it's entirely local and
offline.

**Will my notes sync between computers?** Not in this version; storage is local to the
browser profile. Export to a file to move notes around.

**Does it send my reading anywhere?** No. WebMark makes no network requests and has no
analytics.

**Can I highlight a scanned PDF?** Only if it has a real text layer. Image‑only scans have
no selectable text, though you can still write free‑form notes.

**What happens to a highlight if the article is edited?** The note (including the quoted
text) is always kept. The on‑page highlight re‑appears if the text can still be found;
otherwise it's listed as "not on page".

---

<div align="center">

**MIT** © William Sherman · original concept by [Ross Warren](https://github.com/rosswarren99/markup)
· bundled [PDF.js](https://mozilla.github.io/pdf.js/) © Mozilla (Apache‑2.0)

<sub>Made with care for a brother who didn't have time to build it himself. 💙</sub>

</div>
