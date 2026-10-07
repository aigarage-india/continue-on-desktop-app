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
| 14 | n8n extraction + send core (shipped) | Phase 6 | Feature |
| 15 | n8n hardening: local storage, masking, auth header (shipped) | Phase 7 | Feature |
| 16 | Claude Code session export + send-to-n8n (shipped) | Phase 8a | Feature |
| 17 | Claude Cowork session export + send-to-n8n (shipped) | Phase 8b | Feature |
| 18 | Perplexity extraction + send-to-n8n | Phase 9a | Feature |
| 19 | DeepSeek extraction + send-to-n8n | Phase 9b | Feature |
| 20 | Gemini extraction + send-to-n8n | Phase 9c | Feature |
| 21 | "Save as" action (clipboard, JSON/MD) | Phase 10a | Feature |
| 22 | Local download fallback on send failure | Phase 10b | Feature |
| 23 | Batch send / send history (deferred) | Phase 10c | Optional |
| 24 | ChatGPT Projects export (shipped) | Phase 11 | Feature |

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

## Phases 6-7: n8n Export (completed, shipped)

Built conversationally (not originally written to this file) across several
sessions; recorded here for continuity before extending the plan further.

- **Phase 6 — Extraction + send-to-n8n core:** `src/extractors/claude.js`,
  `src/extractors/chatgpt.js` (same-origin internal API extraction for chats
  and Claude Project docs), `src/background-sender.js` (POST to configured
  webhook, 10s timeout, one retry on network-level failure only), "Send to
  n8n" button + JSON/Markdown format picker in content script, popup, and a
  full-tab Options page (`options/`).
- **Phase 7 — Hardening + polish:** branding/spacing polish; README privacy
  accuracy; webhook URL moved to `chrome.storage.local` (not `sync`, since it
  behaves like a secret) with a one-time migration in `src/background.js`;
  masked input + show/hide toggle; non-blocking warning on plain `http://`
  URLs; optional auth-header (name + value) sent on every webhook request,
  matching n8n's built-in Header Auth credential — opt-in, blank by default.

**Status:** shipped and pushed to `claude/clever-davinci-iy1j54`. No open
items.

---

## Phase 8 (reordered — was Phase 10): Claude Cowork & Claude Code session export

**Raised by:** "what about claude cowork & code??" — referring to
`claude.ai/cowork/{id}` and `claude.ai/code/{id}` session URLs (e.g.
`claude.ai/cowork/cse_01YH3R7ssEFeKw5e4TrNtqd8`,
`claude.ai/code/session_01B3DABLd8EbJTNh927naUAo`).

**Why this is its own phase, not folded in with Phase 9's sites:** the
content script already loads on these pages today (manifest matches
`https://claude.ai/*` broadly), but `ContinueOnDesktop.getSiteInfo()` in
`src/utils.js` only recognizes `/chat/{id}` and `/project/{id}` — so no
buttons currently appear on Cowork/Code pages, by design, not by bug. A
Cowork or Code session isn't a plain message list the way a chat is — it
includes tool calls, file diffs, command output, possibly multi-agent
sub-turns — so this needs its own extraction logic, not a copy-paste of
`extractChat`.

**No desktop deep-link in scope** — same reasoning as Phase 9: Code sessions
here are cloud/web sessions of the Claude Code CLI product, Cowork is
browser-only; neither has a registered protocol handler for a specific
session. `getSiteInfo()` returns `deepLink: null` for both — extraction +
send-to-n8n only.

**URL patterns (confirmed from real URLs above):**
- Code: `^https:\/\/claude\.ai\/code\/([a-zA-Z0-9_-]+)` → id like
  `session_01B3DABLd8EbJTNh927naUAo`
- Cowork: `^https:\/\/claude\.ai\/cowork\/([a-zA-Z0-9_-]+)` → id like
  `cse_01YH3R7ssEFeKw5e4TrNtqd8`

**Files to create/modify:**
- `src/utils.js` — extend `ContinueOnDesktop.getSiteInfo()`: recognize both
  patterns, return `{site: "claude", type: "code"|"cowork", conversationId,
  deepLink: null}` (adding a `type` field alongside the existing implicit
  "is this a project" check keeps `content-script.js` and the extractor
  dispatch from needing their own one-off URL regexes, which is how
  `isClaudeProjectUrl()` works today — worth folding that into the same
  `type` field while here, as a small cleanup, not scope creep).
- `src/extractors/claude.js` — add `extractCodeSession(id)` and
  `extractCoworkSession(id)`, alongside the existing `extractChat`/
  `extractProject`. Same normalized payload shape
  (`{source, type, id, url, title, exported_at, messages, markdown}`), but
  the Markdown flattening needs new handling for tool-call turns (render as
  `tool: <name>` + condensed args, then result — not raw JSON dumped inline)
  since a real session can contain large outputs (full file contents,
  command stdout).
- `src/content-script.js` — branch button label on `info.type` ("Send this
  session to n8n" for code/cowork, matching the existing project-page
  wording pattern); may need new `LANDMARK_SELECTORS` entries if these
  pages' header DOM differs from a regular chat (confirm live, don't guess).
- `options/options.html` / README — add a stronger warning specifically for
  Code/Cowork sends: unlike a chat, a session transcript can include full
  file contents and command output from your own machine, so what you're
  sending to the webhook is a superset of a normal chat export.

**8a status: API confirmed, extraction implemented.** The same-origin API
was confirmed via live Network-tab capture (two requests, against a real
Code session):
- `GET /v1/code/sessions/{id}` → session metadata (title, model, git repo,
  tags, system prompt) — used for the export's title.
- `GET /v1/code/sessions/{id}/events?limit=200&sort_order=desc` → flat event
  log (`control_request`, `system`, `assistant`, `user`, `result`, etc. —
  not a nested conversation object like regular chats). Each `user`/
  `assistant` event's `payload.message.content` is either a plain string
  (real human input) or a content-block array (`text`, `thinking`,
  `tool_use`, `tool_result`) — close to Claude's own Messages API shape.

`extractCodeSession(sessionId)` (in `src/extractors/claude.js`) fetches
both, sorts events by `sequence_num` for chronological order, keeps only
`user`/`assistant` events, and flattens content blocks the same way
`extractChat()` already does (text kept, tool_use/tool_result collapsed to
short placeholders, thinking dropped) — reusing `buildMarkdown()` by
normalizing role to `human`/`assistant`. Logic unit-tested against sample
events mirroring the real captured shape (chronological ordering,
thinking-only turns dropped, tool_use/tool_result rendered) — not yet
tested against a live page in a real browser.

**Known limitation (8a):** fetches one page (200 events) — a session with
more history than that only exports its most recent 200. Pagination is a
follow-up if this turns out to matter.

**8a — live-tested, working, confirmed twice.** Button anchored correctly,
send succeeded end-to-end to a real webhook on two separate live sessions,
payload has correct chronological order and correct human/assistant role
mapping. Three real issues found and fixed during testing:
- Both `/v1/code/sessions/{id}` endpoints reject requests missing an
  `anthropic-version: 2023-06-01` header (the `/api/organizations/...`
  endpoints never needed one) — added, scoped to just these two calls.
- Session title came back empty — the metadata response can be wrapped
  under a `response_shape` key rather than flat; now falls back to that.
- Bare `[tool use: X]` / `[tool result]` placeholders judged too terse —
  replaced with tool name + condensed args (preferred keys like
  `file_path`/`command`/`query`, truncated) and condensed/truncated result
  text (e.g. `[tool: Read] file_path: /root/.claude/uploads/.../x.md` and
  `[tool result — error] File content (899.3KB) exceeds maximum allowed
  size...`) — confirmed working in a second live payload.

**Still open for 8a:**
- [ ] Spot-check a session with a large tool output (long command run, big
      file read) doesn't silently break the send
- [ ] Confirm the 200-event-limit caveat is acceptable, or decide pagination
      is needed sooner

**8b (Claude Cowork) — live-tested, working.** Live capture of a real
Cowork session (`cse_...` id) showed it hits the exact same
`/v1/code/sessions/{id}` + `/events` API as Code sessions — same
`response_shape` wrapper, same flat `title` field, same event log shape —
and the existing header selector already anchors the n8n button there
with no changes. So `extractCoworkSession()` reuses `extractCodeSession()`'s
logic (refactored into shared `extractCodeLikeSession(sessionId, type)`).
Send succeeded end-to-end, correct title, correct message order/roles.

One bug found and fixed: a backend-injected `<system-reminder>...</system-reminder>`
block (timezone boilerplate, not something the user typed) was coming
through as its own synthetic "user" event and showing up as a fake human
message in the export. Now filtered out in `codeEventToText()` — applies
to both 8a and 8b since they share the same extraction path.

**Sign-off: 8a and 8b both done.** Phase 8 complete.

---

## Phase 9 (reordered — was Phase 8): Additional chat sites — Gemini, Perplexity, DeepSeek

**Goal:** Extend the existing "Send to n8n" extraction pattern to
gemini.google.com, perplexity.ai, and chat.deepseek.com. Desktop deep-link
button is **not** in scope for any of the three this phase — see research
below.

**Research findings (desktop deep-link protocols):**

| Site | Desktop app exists? | Deep-link-to-specific-conversation confirmed? |
|------|---------------------|------------------------------------------------|
| Gemini | Yes (native Mac + Windows app, 2026) | No — no documented `gemini://`-style protocol handler for opening a specific conversation. Unconfirmed either way; would need live testing against the installed app. |
| Perplexity | Yes (Mac app) | Only a generic `perplexity-app://search?q=...` scheme for *new* searches has public documentation — nothing showing it can open an *existing* thread by ID. |
| DeepSeek | No real native app — official "desktop" option is a browser-wrapper shortcut, not an installed app with its own protocol handler | N/A |

Conclusion: ship extraction-only for all three in Phase 9. If a user later
confirms (via testing) that Gemini's or Perplexity's installed app actually
opens a specific conversation from a URL, add the Desktop button for that
site as a small follow-up — don't block Phase 9 on it.

**Files to create/modify:**
- `src/extractors/gemini.js`, `src/extractors/perplexity.js`,
  `src/extractors/deepseek.js` — new, one per site, following the shape of
  `src/extractors/claude.js` / `src/extractors/chatgpt.js` (normalized
  `{source, type, id, url, title, exported_at, messages, markdown}` payload).
- `src/utils.js` — extend `ContinueOnDesktop.getSiteInfo()` with URL patterns
  for each site's conversation URL (exact pattern TBD per site during
  investigation — e.g. Gemini's `gemini.google.com/app/{id}`-style path,
  Perplexity's `perplexity.ai/search/{slug}-{id}`, DeepSeek's
  `chat.deepseek.com/a/chat/s/{id}`); patterns need confirming against live
  URLs, not guessed.
- `manifest.json` — add `host_permissions` + a `content_scripts` block per
  new site (mirroring the existing claude.ai/chatgpt.com blocks).
- `src/content-script.js` — extend `LANDMARK_SELECTORS` with a header anchor
  per site (fall back to floating if none found, same as today).
- `src/background-sender.js` — no change (site-agnostic already).

**Unavoidable investigation step (same method used for claude.ai/chatgpt.com):**
each site's internal conversation API is undocumented. For each site this
phase needs, together with you:
1. Open a real conversation, inspect Network tab for the same-origin request
   that fetches message history (same technique that found
   `/api/organizations/{org}/chat_conversations/{id}` for Claude and
   `/backend-api/conversation/{id}` for ChatGPT).
2. Confirm response JSON shape (message roles, text fields, timestamps).
3. Confirm the header/anchor selector for button placement.

**Suggested order (smallest unknown first):** Perplexity → DeepSeek → Gemini,
based on how actively each site changes its frontend (more churn = more
selector risk) — open to reordering based on which you use most.

**Testing checklist (per site):**
- [ ] Extraction returns correct messages for a multi-turn chat (console test)
- [ ] "Send to n8n" button appears (anchored or floating) on a real
      conversation page
- [ ] Button does NOT appear on non-conversation pages (homepage, settings)
- [ ] Send succeeds end-to-end to a test webhook, in both JSON and Markdown
- [ ] SPA navigation (switching conversations) updates/re-injects correctly
- [ ] Dark mode styling correct
- [ ] No console errors

**Sign-off gate:** each site signed off individually as it's completed (this
phase is naturally three sub-batches — 9a Perplexity, 9b DeepSeek, 9c
Gemini); don't start the next site until the current one is tested +
approved.

---

## Phase 10: Save as (clipboard) + download fallback, batch send / history deferred

Split from the original "Batch send, download fallback, send history"
grouping. 10a and 10b are scoped now; batch send and send history
(10c) stay deferred as originally discussed — revisit only if asked.

### 10a — "Save as" action, Clipboard destination (JSON/MD)

**Status: live-tested, working.** Confirmed on ChatGPT (Save as → Clipboard
→ JSON copied a correct, complete payload) and via the shared
`extractCurrentPayload` path exercised through Send to n8n on both
ChatGPT and Claude (n8n execution logs show full, correct payloads). One
Claude conversation 404'd on `extractChat()` — turned out to be an
isolated, pre-existing oddity unrelated to this phase (see note at the
end of 10b) — every other conversation tested extracted fine.

Extends the dropdown control with a third action alongside "Open in" /
"Send to": **"Save as" → "Clipboard" → JSON/MD**, copying the extracted
payload straight to the clipboard. No webhook or n8n config needed — this
works purely locally, so it's available on every page with a detected
conversation, regardless of whether n8n export is enabled or a deep link
exists. That's a real behavior change worth calling out: pages that
currently show no control at all (Code/Cowork/ChatGPT Project sessions
when n8n export is off) will start showing one, with just "Save as"
available.

**`src/content-script.js` changes:**
- `getAvailableActions(info)`: always include `"save"` (the function is
  only called once a conversation is already detected).
- `buildControlElement`: action dropdown gains a `"save"` → "Save as"
  option.
- `populateDestOptions`: new branch for `action === "save"` →
  `"clipboard"` → "Clipboard" + disabled "More destinations soon"
  (matches the existing n8n-destination placeholder pattern).
- `destSelect` change handler: `save` + `clipboard` → populate the format
  dropdown with the same JSON/MD options `send` already uses (shared
  `populateFormatOptions`).
- `formatSelect` change handler: now branches on `actionSelect.value` —
  `"send"` → existing `handleSendToN8n`, `"save"` → new `handleSaveAs`.
- Refactor extraction out of `extractAndSend` into a standalone
  `extractCurrentPayload(callback)` (same site/type branching, just
  stops short of the webhook send) — `extractAndSend` becomes a thin
  wrapper that extracts then sends. `handleSaveAs` reuses
  `extractCurrentPayload` directly, builds the text
  (`payload.markdown` for MD, `JSON.stringify(payload, null, 2)` for
  JSON), and `navigator.clipboard.writeText()`s it — same API already
  used for the deep-link-copy fallback, no new permission needed.
- Toast on success/failure, same color-coded pattern as the n8n send.

**Checklist:**
- [x] "Save as" shows up and works (tested on ChatGPT chat)
- [x] Clipboard content matches what a JSON/MD n8n send would have sent
- [ ] Sticky-selection behavior (action/destination stay picked after
      firing) still works correctly now that there are two terminal
      format-dropdown destinations (n8n vs clipboard) sharing one dropdown
      — not yet specifically tested switching between the two

### 10b — Local download fallback when "Send to n8n" fails

**Status: implemented — not yet live-tested.**

Right now a failed send just shows an error toast and the payload is
gone — nothing to retry with except clicking through the whole flow
again. On failure, auto-download the same payload as a local file
(`.json` or `.md` matching the format that was attempted), so nothing is
lost.

Every path that reaches a real send failure already implies n8n *was*
configured (the "Send to" action only appears when `n8nReady` is true),
so every failure here is a genuine one — network error, timeout, 401/403
auth mismatch, 404 wrong path, 5xx — worth a backup file every time, no
need to special-case "no webhook configured" separately.

**`src/content-script.js` changes:**
- `handleSendToN8n` restructured to capture the extracted `payload` (via
  `extractCurrentPayload`, same helper 10a introduces) before sending, so
  it's still available in the failure branch.
- New `downloadPayloadAsFile(payload, format)`: builds a `Blob` (MIME
  `application/json` or `text/markdown`), `URL.createObjectURL`, a
  programmatic `<a download>` click, then `revokeObjectURL` shortly
  after — pure client-side, no `downloads` permission or manifest change
  needed. Filename derived from the payload's title/name, slugified.
- On send failure: call `downloadPayloadAsFile`, then show the existing
  error toast with ", downloaded a backup copy" appended.

**Checklist:**
- [x] Confirm success path is unaffected (no stray download on a
      successful send) — confirmed via n8n execution logs (94319, 95313)
- [ ] Trigger a real failure (e.g. temporarily wrong auth header against
      the test n8n workflow) and confirm a correctly-named `.json`/`.md`
      file downloads with the right content
- [ ] Chrome's "multiple downloads" permission prompt (if it appears)
      doesn't block the toast/UI reset

**Unrelated finding during testing (not a bug in this phase):** one
specific Claude conversation 404'd on `ClaudeExtractor.extractChat()`
(confirmed from a plain browser tab hitting the same claude.ai API
directly, independent of the extension — "chat_conversation_not_found").
Every other Claude conversation tested extracted fine. The failing one's
content pattern (title "Test", trivial one-word exchanges) closely
resembles the Cowork/Code test sessions used earlier in Phase 8 — open
theory is it's actually backed by the newer `/v1/code/sessions/{id}`
infrastructure despite rendering at a legacy-looking `/chat/{id}` URL,
meaning `extractChat()` would need a fallback to that endpoint. Not
pursued further since it's a single known-odd test conversation, not
representative of normal usage — revisit only if this turns out to
affect real conversations too.

### 10c — Batch send, send history (deferred)

| Item | What it means |
|------|----------------|
| Batch send | Select multiple chats (e.g. from a list view) and send all to n8n in one action, instead of opening each one individually. |
| Send history | A small local log (`chrome.storage.local`) of past sends — timestamp, chat title, success/fail, status — so you can check what was already sent without digging through n8n's own execution log. |

**Status:** not scheduled. No files/testing checklist written yet — this
gets fully planned if/when you decide to pick it up.

---

## Phase 11: ChatGPT Projects export

A ChatGPT Project overview page (`chatgpt.com/g/g-p-{id}/project`) lists
the chats and files inside a project — it's not a single chat, so the
current `/c/{id}`-only URL pattern correctly doesn't match it and no
button appears there today. Goal: add project-level export analogous to
Claude's existing project export (`extractProject()` in `claude.js`) —
send the project's files/instructions, not every chat inside it.

**Status: live-tested, working.** Live capture confirmed
`GET /backend-api/gizmos/g-p-{id}?include_file_limits=true` (bearer
token, same as `extractChat()`) returns `{ gizmo: { display: { name },
instructions, ... }, files: [...] }`. URL pattern added to `utils.js`
(`chatgpt.com/g/g-p-{id}/project` → type `project`, no deep link — no
confirmed desktop protocol handler for the project page itself).
`extractProject()` added to `chatgpt.js`: exports the project's
instructions plus any files, mirroring Claude's `docs[]`/markdown shape.

Tested against both an empty project (no instructions, no files — correctly
produced `docs: []`) and a project with a real file attached
(`LumaBoost.pdf`). The populated-file case confirmed the gizmo API returns
only file metadata (`name`, `created_at`), no inline content or download
URL — so the `f.content`/`f.text` fallback is necessary, not defensive
overkill, and is working as intended. Getting actual file content would
need a separate (currently unidentified) endpoint — out of scope unless
asked for.

Button position was iterated live on a real project page (Ritual Labs):
floating-next-to-composer looked wrong for this page type, so project
pages now use anchored injection into the header row next to Share/"..."
(`button[aria-label="Project actions"]` as landmark) — same approach as
Claude, instead of floating like regular ChatGPT chats.

**Sign-off: Phase 11 done.**

**Sign-off gate:** live-tested on a real project page before calling this
phase done.

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
