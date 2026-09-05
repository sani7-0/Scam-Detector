# Scam Detector browser extension

## Install locally

1. Open Chrome or Edge and visit `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `extension` folder.
5. Open any page, click the Scam Detector toolbar icon, and choose **Scan this website**.

## What's connected to the real backend now

- **Popup "Scan this website"** — the main page URL is checked against your live backend (`/check/url`). If the backend is unreachable, it falls back to a local heuristic and tells you so in the status line. The link list below stays on the local heuristic on purpose — checking every link on a page against the backend would mean dozens of requests per scan and would trip your rate limiter almost immediately.
- **Right-click a link → "Check this link for scams"** — sends that URL to `/check/url` and shows the verdict as a small toast on the page.
- **Right-click selected text → "Check selected text for scams"** — sends the highlighted text to `/check/text` and shows the verdict the same way.
- **Proactive warning** — before you land on any site, the extension checks it against the backend. If it comes back as `scam`, you're redirected to a warning page before the site loads, with a "continue anyway" option. This is a fast redirect, not a hard synchronous block — on very fast-loading sites there can be a brief flash of the real page before the redirect kicks in, the same trade-off real browser Safe Browsing warnings make. Toggle this on/off from **Settings**.

## Settings

Open the popup → **Settings** (or right-click the toolbar icon → Options):
- **Backend API URL** — defaults to your deployed backend if left blank. Set this if you're pointing at a different environment (e.g. local dev).
- **Warn before visiting risky sites** — toggle the proactive interstitial on/off.

## Notes

- The backend endpoint should return `{ verdict, risk_score, confidence, category }` and enforce its own rate limiting, input validation, and CORS as needed — extensions with `host_permissions` bypass normal page CORS enforcement, so no special CORS config is needed on the backend for the extension specifically (only for your website frontend).
- If a check fails (network error, backend down), the extension "fails open" — it does not block navigation and does not fabricate a verdict.
