# Plan: AI Garage — Continue on Desktop App (Chrome Extension)

## Context

Build a Manifest V3 Chrome extension that adds a "Continue on Desktop App" button on claude.ai and chatgpt.com. Clicking it converts the current web URL into the matching desktop deep link (`claude://` or `chatgpt://`) and launches the native app to that conversation. Enables seamless browser-to-desktop-app handoff.

**Greenfield project** — repo has only `docs/ai-garage-continue-on-desktop-build-outline.md`. No existing code.

**Requirements confirmed with user:**
- Button injection: anchored in header first, floating overlay fallback (auto-detect)
- Scope: includes v1.1 options popup (per-site enable/disable)
- Icons: user will provide PNGs — scaffold placeholder structure
- Toolbar action: mini popup with deep link display, "Open in App" button, "Copy Link" button

---

## Priority Table

| # | Item | Phase | Severity |
|---|------|-------|----------|
| 1 | Scaffold + manifest.json | Phase 1 | Foundation |
| 2 | Deep-link mapping utility | Phase 1 | Foundation |
| 3 | Content script: URL detection + button injection | Phase 2 | Core |
| 4 | SPA navigation handling (URL change detection) | Phase 2 | Core |
| 5 | Site-aware CSS (dark/light, per-site styling) | Phase 2 | Core |
| 6 | Clipboard fallback on protocol handler failure | Phase 2 | Core |
| 7 | Toolbar mini popup (Open + Copy) | Phase 3 | Feature |
| 8 | Options page (per-site toggle) | Phase 3 | Feature |
| 9 | Background service worker (default settings) | Phase 3 | Feature |
| 10 | README, LICENSE, .gitignore | Phase 4 | Polish |
| 11 | Live DOM testing + selector hardening | Phase 4 | Polish |
| 12 | GitHub Action: zip + publish to Chrome Web Store on tag | Phase 5 | Distribution |
| 13 | Store listing metadata (description, screenshots placeholders) | Phase 5 | Distribution |

---

## Phase 1: Scaffold & Deep-Link Utility

**Goal:** Project skeleton that loads as a valid unpacked extension + the shared URL→deep-link logic.

**Files to create:**
- `manifest.json` — MV3, content scripts on both domains, action popup, options page, background service worker
- `src/utils.js` — deep-link mapping functions (IIFE pattern, no ES modules since MV3 content scripts don't support them)
- `icons/.gitkeep` — placeholder for user-provided PNGs
- Stub files: `src/content-script.js`, `src/background.js`, `src/styles.css`, `popup/popup.html`, `options/options.html`

**Deep-link mapping (from doc):**

| Web URL | Deep link |
|---------|-----------|
| `claude.ai/chat/{id}` | `claude://claude.ai/chat/{id}` |
| `claude.ai/project/{id}` | `claude://claude.ai/project/{id}` |
| `chatgpt.com/c/{id}` | `chatgpt://chatgpt.com/threads/{id}` |

**`src/utils.js` exports (via global namespace):**
- `ContinueOnDesktop.getSiteInfo(url)` → `{ site: "claude"|"chatgpt"|null, deepLink: string|null, conversationId: string|null }`
- `ContinueOnDesktop.isSupported(url)` → boolean (true if URL matches a known conversation pattern)

**Design note:** No build step. Vanilla JS. `utils.js` listed first in manifest's content_scripts array so it loads before `content-script.js`. Popup loads it via `<script>` tag.

**Testing checklist:**
- [ ] Load unpacked at `chrome://extensions` — no errors in extension card
- [ ] Extension appears in toolbar
- [ ] Console: `ContinueOnDesktop.getSiteInfo("https://claude.ai/chat/abc123")` returns correct deep link
- [ ] Console: `ContinueOnDesktop.getSiteInfo("https://chatgpt.com/c/xyz")` returns correct deep link with `/threads/` path
- [ ] Console: `ContinueOnDesktop.getSiteInfo("https://claude.ai/settings")` returns null deep link

**Sign-off gate:** Extension loads without errors and deep-link mapping is verified in console. No next phase until tested + approved.

---

## Phase 2: Content Script — Button Injection + Styling

**Goal:** Working "Continue on Desktop App" button on both sites with proper styling, SPA awareness, and clipboard fallback.

**Files to create/modify:**
- `src/content-script.js` — main injection logic
- `src/styles.css` — all button + toast styling

**Content script architecture:**

1. **Init:** Check `chrome.storage.sync` for per-site enabled flag (default: true). If disabled, bail.
2. **URL check:** Call `getSiteInfo()`. If no deep link (not a conversation page), don't inject.
3. **Injection strategy (auto-detect):**
   - Attempt anchored injection: query site-specific header selectors
     - Claude: header bar near conversation title
     - ChatGPT: header bar near model selector
   - If selector not found within 2 seconds (retried via MutationObserver), fall back to floating button
   - Floating button: fixed position, bottom-right, always visible
4. **Button behavior:**
   - Click → `window.location.href = deepLink`
   - After 1.5s timeout with no visible navigation, assume protocol handler missing → copy to clipboard + show toast
5. **SPA handling:**
   - Poll `location.href` every 500ms (simplest reliable approach for SPAs)
   - On URL change: update deep link on existing button, or re-inject if button was removed
   - Debounce re-injection (300ms) to avoid flicker during rapid navigation

**Styling approach:**
- CSS custom properties for theming
- Dark mode: `prefers-color-scheme: dark` + site-specific class detection (`html.dark` on claude.ai, similar on ChatGPT)
- Anchored button: matches adjacent header controls (border radius, padding, font)
- Floating button: subtle shadow, semi-transparent background, hover/active states
- Toast notification: slide-in from bottom, auto-dismiss after 3s

**Testing checklist:**
- [ ] Claude: navigate to `claude.ai/chat/{id}` — button appears (anchored or floating)
- [ ] Claude: click button — `claude://` deep link fires (or clipboard fallback)
- [ ] ChatGPT: navigate to `chatgpt.com/c/{id}` — button appears
- [ ] ChatGPT: click button — `chatgpt://` deep link fires with `/threads/` path
- [ ] SPA nav: switch conversations on either site — button updates with new deep link
- [ ] Dark mode: toggle dark/light on both sites — button styling adapts
- [ ] No-match pages: visit `claude.ai` homepage, `chatgpt.com/gpts` — no button injected
- [ ] Clipboard fallback: if desktop app not installed, verify toast + clipboard content

**Sign-off gate:** Button works on both sites, handles SPA navigation, and clipboard fallback is verified. No next phase until tested + approved.

---

## Phase 3: Toolbar Popup + Options Page + Service Worker

**Goal:** Mini popup for toolbar icon, per-site settings, and default initialization.

**Files to create/modify:**
- `popup/popup.html`, `popup/popup.js`, `popup/popup.css`
- `options/options.html`, `options/options.js`, `options/options.css`
- `src/background.js`

### 3a: Toolbar mini popup

- `popup.html`: compact layout (~300px wide)
  - Shows site name + deep link (or "Not on a supported page")
  - "Open in Desktop App" primary button
  - "Copy Link" secondary button
  - Status line for feedback ("Copied!", "Opening...")
- `popup.js`:
  - `chrome.tabs.query({ active: true, currentWindow: true })` to get current URL
  - Use `ContinueOnDesktop.getSiteInfo()` for deep link
  - Open → `chrome.tabs.update(tabId, { url: deepLink })`
  - Copy → `navigator.clipboard.writeText(deepLink)`
- `popup.css`: clean compact styling, dark/light aware

### 3b: Options page (per-site toggles)

- `options.html`: simple settings page
  - Toggle: "Enable on claude.ai" (default on)
  - Toggle: "Enable on chatgpt.com" (default on)
- `options.js`:
  - Read/write `chrome.storage.sync`: `{ enableClaude: true, enableChatGPT: true }`
  - Save on change, brief "Saved" confirmation
- `options.css`: clean settings styling

### 3c: Background service worker

- `src/background.js`:
  - `chrome.runtime.onInstalled` → set default storage values if not already set
  - Minimal — no persistent background logic needed

**Testing checklist:**
- [ ] Click toolbar icon → popup appears with correct deep link for current tab
- [ ] Popup "Open" button → deep link fires
- [ ] Popup "Copy" button → deep link copied to clipboard, status shows "Copied!"
- [ ] Popup on unsupported page → shows "Not on a supported page", buttons disabled
- [ ] Options: toggle claude.ai off → navigate to claude.ai chat → no button injected
- [ ] Options: toggle back on → button reappears on next navigation
- [ ] Fresh install: default storage values set (both sites enabled)

**Sign-off gate:** Popup and options both work correctly. Extension is feature-complete. No next phase until tested + approved.

---

## Phase 4: Documentation + Hardening

**Goal:** README, license, gitignore, and live DOM testing to harden selectors.

**Files to create:**
- `README.md` — install, usage, deep-link reference, known limitations (ChatGPT stale-thread bug per doc)
- `LICENSE` — MIT
- `.gitignore` — `node_modules/`, `dist/`, `.DS_Store`, `*.zip`

**Hardening:**
- Test on live claude.ai and chatgpt.com to verify/refine header selectors
- Adjust injection selectors if needed based on actual DOM structure
- Verify no console errors or performance issues

**Testing checklist:**
- [ ] README renders correctly, install steps are accurate
- [ ] Full end-to-end test on live sites (both anchored + floating scenarios)
- [ ] No console errors from the extension
- [ ] Extension loads cleanly from fresh install

**Sign-off gate:** Documentation complete, extension verified on live sites. No next phase until tested + approved.

---

## Phase 5: CI/CD — Chrome Web Store Auto-Publish

**Goal:** GitHub Action that zips the extension and publishes to Chrome Web Store on tagged releases.

**Prerequisites (user must set up before this phase works):**
1. Chrome Web Store developer account ($5 one-time at https://chrome.google.com/webstore/devconsole)
2. Create the extension listing manually once (first upload must be manual)
3. Set up Google Cloud OAuth credentials for the Chrome Web Store API:
   - Create project in Google Cloud Console
   - Enable Chrome Web Store API
   - Create OAuth 2.0 client (Desktop app type)
   - Get `CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN`
4. Add as GitHub repo secrets: `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`

**Files to create:**
- `.github/workflows/publish.yml` — GitHub Action workflow
- `scripts/zip.sh` — build script that creates clean extension zip

**Workflow: `.github/workflows/publish.yml`**
- Trigger: push of tags matching `v*` (e.g. `v1.0.0`)
- Steps:
  1. Checkout code
  2. Run `scripts/zip.sh` → produces `extension.zip` (excludes `.git`, `.github`, `docs/`, `scripts/`, `node_modules/`, `.DS_Store`, `README.md`, `LICENSE`)
  3. Upload zip as GitHub Release artifact (so users can also sideload)
  4. Publish to Chrome Web Store using `chrome-webstore-upload-cli`:
     - `npx chrome-webstore-upload-cli upload --source extension.zip --extension-id $EXTENSION_ID --client-id $CLIENT_ID --client-secret $CLIENT_SECRET --refresh-token $REFRESH_TOKEN`
     - `npx chrome-webstore-upload-cli publish --extension-id $EXTENSION_ID ...`
  5. Create GitHub Release with the tag name and zip attached

**`scripts/zip.sh`:**
```bash
#!/bin/bash
# Build clean extension zip for Chrome Web Store
zip -r extension.zip manifest.json src/ popup/ options/ icons/ \
  -x "*.DS_Store" -x "*/.git/*"
```

**Release workflow:**
```
git tag v1.0.0
git push origin v1.0.0
→ GitHub Action triggers
→ Zips extension, uploads to Chrome Web Store, creates GitHub Release
```

**Testing checklist:**
- [ ] `scripts/zip.sh` produces a valid zip that loads as unpacked extension
- [ ] GitHub Action YAML is valid (lint with `actionlint` or check in Actions tab)
- [ ] Dry run: push a tag → Action runs → zip artifact created in GitHub Release
- [ ] Full run (after store setup): push tag → extension published to Chrome Web Store
- [ ] Verify published extension installs and works from the store

**Sign-off gate:** CI/CD pipeline verified end-to-end. Extension auto-publishes on tagged releases. Ready for production use.

---

## Risks

1. **DOM selectors are fragile** — both claude.ai and chatgpt.com can change their DOM at any time, breaking anchored injection. The floating fallback mitigates this.
2. **Protocol handler detection is impossible** — we can't know if the desktop app is installed. The 1.5s timeout + clipboard fallback is best-effort.
3. **ChatGPT stale-thread bug** (upstream, openai/codex#30916) — deep link may silently fail if ChatGPT desktop has that thread cached. Documented in README, not fixable from extension side.
4. **Content Security Policy** — some sites may restrict injected scripts. MV3 content scripts run in an isolated world, so this should be fine, but worth verifying.

---

## Local Testing Procedure (every phase)

No preview/staging environment. All testing is done locally by loading the unpacked extension in Chrome.

### Setup (one-time)
1. Open `chrome://extensions` in Chrome/Edge/Brave
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked** → select the project folder (`continue-on-desktop-app/`)
4. Pin the extension to the toolbar for easy access

### After each code change
1. Go to `chrome://extensions` → click the **reload** button (circular arrow) on the extension card
2. Reload any open claude.ai / chatgpt.com tabs (Cmd+R) so the new content script injects
3. Check the extension card — no red error badge

### Per-phase local test script

**Phase 1 — Scaffold:**
```
1. Load unpacked → verify no errors on extension card
2. Open DevTools console on any page
3. Verify ContinueOnDesktop namespace exists (may need to test on claude.ai/chatgpt.com where content script runs)
4. Check deep-link mapping returns correct values for all URL patterns
```

**Phase 2 — Content script + button:**
```
1. Navigate to claude.ai → open/create a chat conversation
2. Verify button appears in header area (or floating fallback)
3. Click button → verify claude:// protocol fires (Claude Desktop opens to that chat)
4. If Claude Desktop not installed → verify clipboard copy + toast notification
5. Navigate to a different conversation → verify button updates (SPA test)
6. Toggle dark/light mode → verify button styling adapts
7. Navigate to claude.ai homepage (no chat ID) → verify NO button appears
8. Repeat steps 1-7 on chatgpt.com/c/{id} with chatgpt:// protocol
9. Check DevTools console → no errors from extension
```

**Phase 3 — Popup + options:**
```
1. On a claude.ai chat page → click toolbar icon → verify popup shows correct deep link
2. Click "Open in Desktop App" in popup → verify protocol fires
3. Click "Copy Link" in popup → paste somewhere → verify correct deep link
4. Navigate to google.com → click toolbar icon → verify "Not on a supported page"
5. Right-click extension → Options → toggle claude.ai OFF → save
6. Navigate to claude.ai chat → verify button does NOT appear
7. Toggle back ON → reload tab → verify button reappears
8. Repeat for chatgpt.com toggle
9. Remove and re-add extension → verify defaults are both ON
```

**Phase 4 — Final E2E:**
```
1. Remove extension completely from chrome://extensions
2. Load unpacked fresh → verify clean install (no errors, defaults set)
3. Full walkthrough: claude.ai chat → button → click → app opens
4. Full walkthrough: chatgpt.com chat → button → click → app opens
5. Test popup on both sites
6. Test options toggles
7. Test clipboard fallback
8. Test dark mode on both sites
9. Check DevTools console on both sites → zero errors from extension
10. Verify README install steps match actual process
```

### What "done" looks like before any production push
- All Phase 4 E2E checks pass
- Zero console errors from the extension on both sites
- Extension loads cleanly from fresh install with correct defaults
- README accurately describes install + usage
- No secrets, API keys, or personal data in the codebase
- `.gitignore` excludes build artifacts and OS files
- Only then: zip for Chrome Web Store submission (separate step, user-driven)
