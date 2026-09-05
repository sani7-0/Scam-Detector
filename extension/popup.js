const scanButton = document.querySelector('#scan');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const label = { high: 'Likely a scam', medium: 'Needs caution', low: 'Likely safe' };

scanButton.addEventListener('click', async () => {
  scanButton.disabled = true;
  status.textContent = 'Scanning the page and its links…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'scan-active-tab' });
    if (response?.error) throw new Error(response.error);
    document.querySelector('#verdict').textContent = label[response.page.verdict];
    document.querySelector('#score').textContent = `${response.page.score}/100`;
    document.querySelector('#total').textContent = response.summary.total;
    document.querySelector('#risky').textContent = response.summary.risky;
    document.querySelector('#safe').textContent = response.summary.safe;
    document.querySelector('#links').innerHTML = response.links
      .slice(0, 24)
      .map((link) => `<li class="${link.verdict}"><strong>${escapeHtml(link.host)}</strong><small>${label[link.verdict]} · ${link.score}/100</small></li>`)
      .join('');

    status.textContent = response.page.source === 'backend'
      ? `Scanned ${response.title || 'this page'} using your live backend.`
      : `Scanned ${response.title || 'this page'} using local heuristics (backend unavailable${response.page.error ? `: ${response.page.error}` : ''}).`;

    result.hidden = false;
  } catch (error) {
    status.textContent = `Could not scan this page: ${error.message}`;
  }
  scanButton.disabled = false;
});

document.querySelector('#options').addEventListener('click', () => chrome.runtime.openOptionsPage());
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}
