const DEFAULT_API_BASE_URL = 'https://eaii-2026-group-4-final-project.onrender.com/v1';

const suspiciousWords = ['login', 'verify', 'claim', 'prize', 'gift', 'urgent', 'wallet', 'payment', 'password', 'account'];

// ---------------------------------------------------------------------------
// Tranco top-100k allowlist — skips the proactive warning check for
// well-known sites so a slow/flaky backend response can never block google.com.
// Loaded once and cached in memory; explicit right-click/popup checks still
// go to the real backend regardless of allowlist status.
// ---------------------------------------------------------------------------
let trancoSetPromise = null;

function getTrancoSet() {
  if (!trancoSetPromise) {
    trancoSetPromise = fetch(chrome.runtime.getURL('tranco-top100k.txt'))
      .then((response) => response.text())
      .then((text) => new Set(text.split('\n').map((line) => line.trim()).filter(Boolean)))
      .catch(() => new Set());
  }
  return trancoSetPromise;
}

async function isTopSite(hostname) {
  const set = await getTrancoSet();
  const host = hostname.toLowerCase().replace(/^www\./, '');
  if (set.has(host)) return true;
  // also match the registrable parent (e.g. mail.google.com -> google.com)
  const parts = host.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    if (set.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function getSettings() {
  const { apiUrl, proactiveWarning } = await chrome.storage.sync.get(['apiUrl', 'proactiveWarning']);
  let apiBaseUrl = apiUrl && apiUrl.trim() ? apiUrl.trim().replace(/\/+$/, '') : DEFAULT_API_BASE_URL;
  if (!/\/v1$/i.test(apiBaseUrl)) apiBaseUrl += '/v1'; // always ensure the /v1 prefix, no matter what was saved
  return {
    apiBaseUrl,
    proactiveWarning: proactiveWarning !== false, // defaults to on
  };
}

// ---------------------------------------------------------------------------
// Real backend calls
// ---------------------------------------------------------------------------
function toPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  // Backend sometimes sends a 0-1 fraction instead of 0-100; normalize either way.
  return value > 0 && value <= 1 ? value * 100 : value;
}

function normalizeResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Backend returned an empty or invalid response.');
  }
  return {
    ...raw,
    verdict: String(raw.verdict ?? 'suspicious').trim().toLowerCase(),
    confidence: toPercent(raw.confidence ?? 0),
    risk_score: toPercent(raw.risk_score ?? 0),
  };
}

async function callBackend(path, body) {
  const { apiBaseUrl } = await getSettings();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* not JSON */ }

  if (!response.ok) {
    let message = text || response.statusText;
    const raw = parsed?.message ?? parsed?.error;
    if (Array.isArray(raw)) {
      message = raw.join(', ');
    } else if (typeof raw === 'string') {
      message = raw;
    } else if (raw && typeof raw === 'object') {
      message = JSON.stringify(raw);
    }
    throw new Error(`${response.status}: ${message}`);
  }

  return normalizeResult(parsed);
}

function checkUrlBackend(url) {
  return callBackend('/check/url', { url });
}

function checkTextBackend(text) {
  return callBackend('/check/text', { text });
}

// ---------------------------------------------------------------------------
// Local heuristic — used as a fallback and for the fast per-link list in the
// popup (checking every link on a page against the backend would mean dozens
// of requests per scan and would get rate-limited almost immediately).
// ---------------------------------------------------------------------------
function inspectUrlLocal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const reasons = [];
    let score = 8;
    if (url.protocol !== 'https:') { score += 28; reasons.push('The link does not use HTTPS'); }
    if (/[0-9]{4,}/.test(host)) { score += 18; reasons.push('The domain contains an unusual number sequence'); }
    if (host.split('.').length > 3) { score += 10; reasons.push('The domain uses multiple subdomains'); }
    if (suspiciousWords.some((word) => `${host}${url.pathname}`.includes(word))) { score += 22; reasons.push('The address uses pressure or account language'); }
    if (host.includes('xn--')) { score += 26; reasons.push('The domain uses encoded characters'); }
    return { url: rawUrl, host, score: Math.min(score, 99), verdict: score >= 55 ? 'high' : score >= 28 ? 'medium' : 'low', reasons };
  } catch {
    return { url: rawUrl, host: rawUrl, score: 80, verdict: 'high', reasons: ['The address could not be parsed safely'] };
  }
}

function backendToLocalShape(backendResult, url, host) {
  const verdict = backendResult.verdict === 'scam' ? 'high' : backendResult.verdict === 'suspicious' ? 'medium' : 'low';
  const reasons = backendResult.category ? [`Flagged category: ${backendResult.category}`] : [];
  return { url, host, score: Math.round(backendResult.risk_score), verdict, reasons, source: 'backend' };
}

// ---------------------------------------------------------------------------
// Popup: full page scan
// ---------------------------------------------------------------------------
async function scanTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      url: location.href,
      title: document.title,
      links: [...document.querySelectorAll('a[href]')]
        .map((a) => ({ text: (a.textContent || '').trim().slice(0, 100), url: a.href }))
        .filter((item) => /^https?:/i.test(item.url))
        .slice(0, 80),
    }),
  });

  let page;
  try {
    const backendResult = await checkUrlBackend(result.url);
    page = backendToLocalShape(backendResult, result.url, new URL(result.url).hostname);
  } catch (error) {
    page = { ...inspectUrlLocal(result.url), source: 'heuristic-fallback', error: error.message };
  }

  const unique = [...new Map(result.links.map((item) => [item.url, item.url])).values()];
  const links = unique.map(inspectUrlLocal);
  const risky = links.filter((link) => link.verdict === 'high').length;
  const medium = links.filter((link) => link.verdict === 'medium').length;

  return {
    page,
    title: result.title,
    links,
    summary: { total: links.length, risky, medium, safe: links.length - risky - medium },
  };
}

// ---------------------------------------------------------------------------
// Right-click menu: check a link, or check selected text
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'check-link', title: 'Check this link for scams', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'check-selection', title: 'Check selected text for scams', contexts: ['selection'] });
});

function injectToast(tabId, payload) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: (data) => {
      const existing = document.getElementById('__scam-detector-toast');
      if (existing) existing.remove();

      const colors = { safe: '#3f8f6f', suspicious: '#d3aa70', scam: '#c47c78', error: '#888' };
      const accent = colors[data.kind] || '#444';

      const box = document.createElement('div');
      box.id = '__scam-detector-toast';
      box.style.cssText = `position:fixed;z-index:2147483647;top:16px;right:16px;max-width:320px;background:#121212;color:#e0e0e0;border:1px solid ${accent};border-left:6px solid ${accent};border-radius:10px;padding:14px 40px 14px 16px;font:13px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);`;

      const title = document.createElement('strong');
      title.textContent = data.title;
      title.style.cssText = `display:block;margin-bottom:4px;color:${accent};text-transform:uppercase;font-size:11px;letter-spacing:.05em`;

      const body = document.createElement('div');
      body.textContent = data.message;

      const close = document.createElement('button');
      close.textContent = '\u00D7';
      close.style.cssText = 'position:absolute;top:8px;right:10px;background:none;border:0;color:#888;font-size:16px;cursor:pointer;line-height:1';
      close.onclick = () => box.remove();

      box.append(title, body, close);
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 10000);
    },
    args: [payload],
  });
}

function verdictToToast(result, subject) {
  const kind = result.verdict === 'scam' ? 'scam' : result.verdict === 'suspicious' ? 'suspicious' : 'safe';
  const title = result.verdict === 'scam' ? 'Likely a scam' : result.verdict === 'suspicious' ? 'Needs a closer look' : 'Looks safe';
  const message = `${subject} — risk ${Math.round(result.risk_score)}/100, ${Math.round(result.confidence)}% confidence${result.category ? `, category: ${result.category}` : ''}`;
  return { kind, title, message };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  try {
    if (info.menuItemId === 'check-link' && info.linkUrl) {
      const result = await checkUrlBackend(info.linkUrl);
      await injectToast(tab.id, verdictToToast(result, info.linkUrl));
    } else if (info.menuItemId === 'check-selection' && info.selectionText) {
      const result = await checkTextBackend(info.selectionText);
      await injectToast(tab.id, verdictToToast(result, `"${info.selectionText.slice(0, 80)}"`));
    }
  } catch (error) {
    await injectToast(tab.id, { kind: 'error', title: 'Check failed', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// Proactive warning before landing on a site the backend flags as a scam
// ---------------------------------------------------------------------------
const inFlightChecks = new Map(); // url -> Promise, avoids duplicate concurrent checks

async function isAllowed(url) {
  const { allowedUrls = [] } = await chrome.storage.session.get(['allowedUrls']);
  return allowedUrls.includes(url);
}

async function allowUrl(url) {
  const { allowedUrls = [] } = await chrome.storage.session.get(['allowedUrls']);
  if (!allowedUrls.includes(url)) {
    allowedUrls.push(url);
    await chrome.storage.session.set({ allowedUrls: allowedUrls.slice(-200) });
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only, skip iframes
  const { url, tabId } = details;
  if (!/^https?:/i.test(url)) return;

  const { proactiveWarning } = await getSettings();
  if (!proactiveWarning) return;
  if (await isAllowed(url)) return;
  if (inFlightChecks.has(url)) return;

  try {
    if (await isTopSite(new URL(url).hostname)) return; // known top-100k site, skip the check
  } catch {
    return; // unparsable URL, don't attempt a check
  }

  const checkPromise = (async () => {
    try {
      const result = await checkUrlBackend(url);
      if (result.verdict === 'scam') {
        const warningUrl = chrome.runtime.getURL(
          `warning.html?url=${encodeURIComponent(url)}&score=${Math.round(result.risk_score)}&confidence=${Math.round(result.confidence)}&category=${encodeURIComponent(result.category || '')}`,
        );
        chrome.tabs.update(tabId, { url: warningUrl }).catch(() => {});
      }
    } catch {
      // Backend unreachable or errored — fail open rather than block browsing.
    } finally {
      inFlightChecks.delete(url);
    }
  })();

  inFlightChecks.set(url, checkPromise);
});

// ---------------------------------------------------------------------------
// Messages from the popup and the warning page
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'scan-active-tab') {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => scanTab(tab.id))
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message.type === 'allow-url') {
    allowUrl(message.url).then(() => sendResponse({ ok: true }));
    return true;
  }
});