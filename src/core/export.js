// Multi-format export for a page's notes: Markdown, plain text, HTML, Word
// (.docx) and PDF (via the browser's print-to-PDF). Everything here is
// dependency-free — the .docx writer builds a real OOXML package with a small
// in-house ZIP encoder, and the PDF path prints a styled HTML view.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});
  const esc = (s) => W.util.escapeHtml(s);

  function fmtDate(ts) {
    const d = ts ? new Date(ts) : new Date();
    try {
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  function fileBase(rec) {
    const base = (rec.title || "webmark")
      .replace(/[^\w.-]+/g, "-")
      .slice(0, 60)
      .replace(/^-+|-+$/g, "");
    return (base || "webmark") + "-" + (W.util.todayIso ? W.util.todayIso() : "notes");
  }

  function sourceHtml(url) {
    if (!url) return "";
    const text = esc(url);
    if (!W.util.isSupportedPageUrl(url)) return `Source: ${text}<br>`;
    return `Source: <a href="${text}" rel="noopener noreferrer">${text}</a><br>`;
  }

  /* ---------- format builders ---------- */

  function toMarkdown(rec) {
    return [
      `# ${rec.title || rec.url || "Untitled"}`,
      "",
      rec.url ? `*Source:* ${rec.url}` : "",
      `*Saved:* ${fmtDate(rec.updatedAt)}`,
      "",
      "---",
      "",
      (rec.note || "").trim() || "_(no notes yet)_",
      "",
    ].filter((l, i) => !(l === "" && i === 2 && !rec.url)).join("\n");
  }

  // Strip the Markdown syntax to leave clean, readable plain text.
  function toPlainText(rec) {
    const body = (rec.note || "")
      .replace(/^#{1,6}\s+/gm, "")        // headings
      .replace(/\*\*([^*]+)\*\*/g, "$1")  // bold
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")      // italic
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")        // inline code
      .replace(/^\s*[-*+]\s+/gm, "• ")    // bullets
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"); // links
    return [
      rec.title || rec.url || "Untitled",
      rec.url ? "Source: " + rec.url : "",
      "Saved: " + fmtDate(rec.updatedAt),
      "",
      "----------------------------------------",
      "",
      body.trim() || "(no notes yet)",
      "",
    ].filter(Boolean).join("\n");
  }

  function toHtmlDoc(rec) {
    const bodyHtml = W.markdown.render(rec.note || "") || "<p><em>(no notes yet)</em></p>";
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(rec.title || "WebMark notes")}</title>
<style>
  body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
       color:#0f172a;max-width:46rem;margin:2.4rem auto;padding:0 1.2rem;}
  h1,h2,h3{line-height:1.25;} h1{font-size:1.8rem;}
  .meta{color:#64748b;font-size:.85rem;margin:.2rem 0 1rem;}
  .meta a{color:#1d4ed8;word-break:break-all;}
  hr{border:0;border-top:1px solid #e2e8f0;margin:1.4rem 0;}
  blockquote{margin:.8rem 0;padding:.3rem 0 .3rem 1rem;border-left:3px solid #93c5fd;
             color:#334155;background:#f8fafc;}
  code{background:#f1f5f9;padding:.1em .3em;border-radius:4px;font-size:.9em;}
  pre{background:#0f172a;color:#e2e8f0;padding:.8rem;border-radius:8px;overflow:auto;}
  pre code{background:none;color:inherit;padding:0;}
  a{color:#1d4ed8;} ul,ol{padding-left:1.4rem;}
  @media print{body{margin:0;max-width:none;}}
</style></head>
<body>
<h1>${esc(rec.title || rec.url || "Untitled")}</h1>
<div class="meta">${sourceHtml(rec.url)}Saved: ${esc(fmtDate(rec.updatedAt))}</div>
<hr>
${bodyHtml}
</body></html>`;
  }

  /* ---------- .docx (OOXML) ---------- */

  function xmlEsc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function inlineRuns(text) {
    const runs = [];
    const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) runs.push({ text: text.slice(last, m.index) });
      if (m[2] != null) runs.push({ text: m[2], bold: true });
      else if (m[3] != null) runs.push({ text: m[3], bold: true });
      else if (m[4] != null) runs.push({ text: m[4], italic: true });
      else if (m[5] != null) runs.push({ text: m[5], italic: true });
      else if (m[6] != null) runs.push({ text: m[6], code: true });
      last = re.lastIndex;
    }
    if (last < text.length) runs.push({ text: text.slice(last) });
    return runs.length ? runs : [{ text }];
  }

  function runXml(r, extra) {
    const rpr = [];
    if (r.bold || (extra && extra.bold)) rpr.push("<w:b/>");
    if (r.italic || (extra && extra.italic)) rpr.push("<w:i/>");
    if (extra && extra.sz) rpr.push(`<w:sz w:val="${extra.sz}"/>`);
    if (extra && extra.color) rpr.push(`<w:color w:val="${extra.color}"/>`);
    if (r.code) rpr.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
    const rprXml = rpr.length ? `<w:rPr>${rpr.join("")}</w:rPr>` : "";
    return `<w:r>${rprXml}<w:t xml:space="preserve">${xmlEsc(r.text)}</w:t></w:r>`;
  }

  function para(runsXml, pprXml) {
    return `<w:p>${pprXml || ""}${runsXml}</w:p>`;
  }

  function docxBody(rec) {
    const lines = (rec.note || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    // Title block
    out.push(para(runXml({ text: rec.title || rec.url || "Untitled" }, { bold: true, sz: 40 })));
    if (rec.url) out.push(para(runXml({ text: "Source: " + rec.url }, { color: "1D4ED8", sz: 18 })));
    out.push(para(runXml({ text: "Saved: " + fmtDate(rec.updatedAt) }, { color: "64748B", sz: 18 })));
    out.push(para(""));

    let i = 0, inCode = false;
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) { inCode = !inCode; i++; continue; }
      if (inCode) {
        out.push(para(runXml({ text: line, code: true }), '<w:pPr><w:ind w:left="360"/></w:pPr>'));
        i++; continue;
      }
      if (/^\s*$/.test(line)) { out.push(para("")); i++; continue; }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const sz = [36, 32, 28, 26, 24, 22][h[1].length - 1];
        out.push(para(inlineRuns(h[2]).map((r) => runXml(r, { bold: true, sz })).join(""),
          '<w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>'));
        i++; continue;
      }
      if (/^\s*>/.test(line)) {
        const txt = line.replace(/^\s*>\s?/, "");
        out.push(para(inlineRuns(txt).map((r) => runXml(r, { italic: true })).join(""),
          '<w:pPr><w:ind w:left="480"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="93C5FD"/></w:pBdr></w:pPr>'));
        i++; continue;
      }
      const li = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        out.push(para('<w:r><w:t xml:space="preserve">•  </w:t></w:r>' + inlineRuns(li[1]).map((r) => runXml(r)).join(""),
          '<w:pPr><w:ind w:left="360"/></w:pPr>'));
        i++; continue;
      }
      out.push(para(inlineRuns(line).map((r) => runXml(r)).join("")));
      i++;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${out.join("")}<w:sectPr/></w:body></w:document>`;
  }

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  function toDocxBlob(rec) {
    const files = [
      { name: "[Content_Types].xml", data: CONTENT_TYPES },
      { name: "_rels/.rels", data: ROOT_RELS },
      { name: "word/document.xml", data: docxBody(rec) },
    ];
    return new Blob([zipStore(files)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  /* ---------- minimal ZIP (store, no compression) ---------- */

  let CRC_TABLE = null;
  function crc32(bytes) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        CRC_TABLE[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
    const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

    for (const f of files) {
      const nameBytes = enc.encode(f.name);
      const dataBytes = f.data instanceof Uint8Array ? f.data : enc.encode(f.data);
      const crc = crc32(dataBytes);
      const local = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(dataBytes.length), u32(dataBytes.length),
        u16(nameBytes.length), u16(0)
      );
      parts.push(Uint8Array.from(local), nameBytes, dataBytes);
      central.push(
        [].concat(
          u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
          u32(crc), u32(dataBytes.length), u32(dataBytes.length),
          u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
          u32(0), u32(offset)
        ),
        nameBytes
      );
      offset += local.length + nameBytes.length + dataBytes.length;
    }

    const centralBytes = [];
    let centralSize = 0;
    for (let i = 0; i < central.length; i += 2) {
      const head = Uint8Array.from(central[i]);
      centralBytes.push(head, central[i + 1]);
      centralSize += head.length + central[i + 1].length;
    }
    const end = Uint8Array.from(
      [].concat(
        u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
        u32(centralSize), u32(offset), u16(0)
      )
    );

    const all = [...parts, ...centralBytes, end];
    const total = all.reduce((n, a) => n + a.length, 0);
    const buf = new Uint8Array(total);
    let p = 0;
    for (const a of all) { buf.set(a, p); p += a.length; }
    return buf;
  }

  /* ---------- delivery ---------- */

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Print-to-PDF via a hidden iframe (no popup, lets the user "Save as PDF").
  function printPdf(rec) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-webmark-ui", "print");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;";
    document.body.appendChild(iframe);
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        win.focus();
        win.print();
      } catch (e) {
        /* ignore */
      }
      cleanup();
    };
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(toHtmlDoc(rec));
    doc.close();
    if (doc.readyState === "complete") iframe.onload();
  }

  const FORMATS = [
    { id: "md", label: "Markdown (.md)" },
    { id: "txt", label: "Plain text (.txt)" },
    { id: "html", label: "Web page (.html)" },
    { id: "docx", label: "Word (.docx)" },
    { id: "pdf", label: "PDF (print…)" },
  ];

  function exportAs(format, rec) {
    const base = fileBase(rec);
    switch (format) {
      case "txt":
        downloadBlob(new Blob([toPlainText(rec)], { type: "text/plain" }), base + ".txt");
        break;
      case "html":
        downloadBlob(new Blob([toHtmlDoc(rec)], { type: "text/html" }), base + ".html");
        break;
      case "docx":
        downloadBlob(toDocxBlob(rec), base + ".docx");
        break;
      case "pdf":
        printPdf(rec);
        break;
      case "md":
      default:
        downloadBlob(new Blob([toMarkdown(rec)], { type: "text/markdown" }), base + ".md");
    }
  }

  W.Export = {
    FORMATS, exportAs, toMarkdown, toPlainText, toHtmlDoc, toDocxBlob,
    printPdf, downloadBlob, fileBase, zipStore, crc32,
  };
})();
