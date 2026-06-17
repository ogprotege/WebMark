// WebMark service worker.
// - Toolbar click / shortcut toggles the notes panel on the active tab.
// - On a PDF, it opens (or is already) the bundled PDF reader where annotation works.
// - A context-menu item and shortcut capture the current selection.
// - Optionally auto-opens PDFs in the reader.

const VIEWER_PATH = "src/pdf/viewer.html";
const MANAGER_PATH = "src/manager/manager.html";

function isPdfUrl(url) {
  return /^(https?|file):/i.test(url || "") && /\.pdf($|[?#])/i.test(url);
}

function isViewerUrl(url) {
  return (url || "").startsWith(chrome.runtime.getURL(VIEWER_PATH));
}

function viewerUrlFor(fileUrl) {
  return chrome.runtime.getURL(VIEWER_PATH) + "?file=" + encodeURIComponent(fileUrl);
}

async function getSettings() {
  const out = await chrome.storage.local.get("wm:settings");
  return Object.assign({ autoOpenPdf: true }, out["wm:settings"] || {});
}

// Send a message to a tab's content script / viewer page; returns false if no
// receiver is present (e.g. the page hasn't loaded our scripts).
async function tellTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

async function handleAction(tab, message) {
  if (!tab || !tab.id) return;
  const url = tab.url || "";

  // Native PDF still showing? Open it in our reader instead.
  if (isPdfUrl(url) && !isViewerUrl(url)) {
    await chrome.tabs.update(tab.id, { url: viewerUrlFor(url) });
    return;
  }

  const delivered = await tellTab(tab.id, message);
  if (delivered) return;

  // Content script not present yet — try to inject it, then retry once.
  if (/^https?:/i.test(url)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          "src/core/util.js",
          "src/core/markdown.js",
          "src/core/anchor.js",
          "src/core/storage.js",
          "src/core/highlighter.js",
          "src/core/export.js",
          "src/core/panel.js",
          "src/content.js",
        ],
      });
      await tellTab(tab.id, message);
    } catch (e) {
      // chrome:// pages, the web store, etc. can't be scripted — ignore.
    }
  }
}

chrome.action.onClicked.addListener((tab) => handleAction(tab, { type: "toggle" }));

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (command === "toggle-panel") handleAction(tab, { type: "toggle" });
  else if (command === "capture-selection") handleAction(tab, { type: "capture" });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "webmark-capture",
    title: "Add selection to WebMark",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "webmark-open-pdf",
    title: "Open this PDF in WebMark reader",
    contexts: ["page", "link"],
    targetUrlPatterns: ["*://*/*.pdf*", "file:///*.pdf*"],
    documentUrlPatterns: ["*://*/*.pdf*", "file:///*.pdf*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "webmark-capture") {
    handleAction(tab, { type: "capture" });
  } else if (info.menuItemId === "webmark-open-pdf") {
    const target = info.linkUrl || info.pageUrl || (tab && tab.url);
    if (target && isPdfUrl(target)) chrome.tabs.update(tab.id, { url: viewerUrlFor(target) });
  }
});

// Auto-open PDFs in the reader (best-effort, gated by a setting).
// Fast path by URL extension — also covers file:// PDFs (which webRequest can't see).
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  if (!isPdfUrl(changeInfo.url) || isViewerUrl(changeInfo.url)) return;
  const settings = await getSettings();
  if (!settings.autoOpenPdf) return;
  chrome.tabs.update(tabId, { url: viewerUrlFor(changeInfo.url) }).catch(() => {});
});

// Robust path by response Content-Type — catches PDFs served without a .pdf
// extension (e.g. https://arxiv.org/pdf/1706.03762). Observed locally only;
// nothing is sent anywhere.
if (chrome.webRequest && chrome.webRequest.onHeadersReceived) {
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.type !== "main_frame" || isViewerUrl(details.url)) return;
      const ct = (details.responseHeaders || []).find(
        (h) => h.name.toLowerCase() === "content-type"
      );
      if (!ct || !/application\/pdf/i.test(ct.value || "")) return;
      getSettings().then((settings) => {
        if (settings.autoOpenPdf) {
          chrome.tabs.update(details.tabId, { url: viewerUrlFor(details.url) }).catch(() => {});
        }
      });
    },
    { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
    ["responseHeaders"]
  );
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "open-manager") {
    chrome.tabs.create({ url: chrome.runtime.getURL(MANAGER_PATH) });
    sendResponse && sendResponse({ ok: true });
  }
  return false;
});
