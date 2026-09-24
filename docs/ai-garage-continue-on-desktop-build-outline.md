# AI Garage — Continue on Desktop App — Build Outline

Project/repo name: `ai-garage-continue-on-desktop`
Store listing title: "AI Garage: Continue on Desktop App"

Purpose: browser extension adding "Continue on Desktop App" button on claude.ai and chatgpt.com chat pages, converting current URL into matching desktop deep link and launching Claude Desktop or ChatGPT Desktop straight to that conversation.

---

## 1. Scope, v1

- Manifest V3, Chrome/Edge/Brave compatible
- Detect active tab domain: claude.ai or chatgpt.com
- Inject button near chat header
- On click: build deep link per mapping below, trigger navigation to it
- Fallback: copy deep link to clipboard if protocol handler missing/blocked

## 2. Deep-link mapping (confirmed via testing)

| Site | Web URL pattern | Desktop deep link |
|---|---|---|
| Claude | `https://claude.ai/chat/{id}` | `claude://claude.ai/chat/{id}` |
| Claude | `https://claude.ai/project/{id}` | `claude://claude.ai/project/{id}` |
| ChatGPT | `https://chatgpt.com/c/{id}` | `chatgpt://chatgpt.com/threads/{id}` |

Known limitation to note in README: ChatGPT desktop deep link can silently fail to navigate if app already running with that thread cached from earlier — open upstream bug, tracked at openai/codex#30916. Workaround: quit and relaunch app. Not fixable from extension side.

## 3. Tech stack

- Vanilla JS + Manifest V3, no build step for v1 (keep it simple)
- No external dependencies required

## 4. Folder structure

```
ai-garage-continue-on-desktop/
├── manifest.json
├── src/
│   ├── content-script.js
│   ├── background.js       (service worker, optional)
│   └── styles.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                  (optional settings popup, v1.1)
│   ├── popup.html
│   └── popup.js
├── README.md
├── LICENSE
├── .gitignore
└── package.json            (optional, only if build tooling added later)
```

## 5. Core logic

1. `content-script.js` runs on `claude.ai/*` and `chatgpt.com/*`
2. Detect current URL pattern, build matching deep link per mapping table above
3. Insert floating button near chat title (site-aware styling, light/dark mode)
4. On click, set `window.location.href` to deep link
5. Optional (v1.1): options popup to toggle per-site enable/disable

## 6. manifest.json essentials

- `manifest_version: 3`
- `permissions: ["activeTab", "scripting"]`
- `host_permissions: ["https://claude.ai/*", "https://chatgpt.com/*"]`
- content_scripts matching both domains
- toolbar icon action as alternative manual trigger (click icon → deep-link current tab)

## 7. Build steps, hand to Claude Code

1. Scaffold folder structure and manifest.json above
2. Build content-script.js: URL detection + deep-link construction + button injection
3. Add styles.css matching each site's look, dark/light aware
4. Add toolbar icon action as alternate trigger
5. (Optional v1.1) Add options popup for per-site toggle
6. Test locally: `chrome://extensions` → enable Developer mode → Load unpacked
7. Write README.md: install steps, usage, known limitations section (ChatGPT stale-thread bug above)
8. Add LICENSE (MIT, or AI Garage's preferred license)
9. Add .gitignore: `node_modules/`, `dist/`, `.DS_Store`

## 8. Git steps, after build

```bash
cd ai-garage-continue-on-desktop
git init
git add .
git commit -m "Initial commit: v1 continue-on-desktop extension"
git branch -M main
# create empty repo under AI Garage GitHub org/account first, then:
git remote add origin git@github.com:<ai-garage-org>/ai-garage-continue-on-desktop.git
git push -u origin main
```

## 9. Publishing steps, Chrome Web Store under AI Garage developer account

1. Zip extension folder, exclude `.git`, `node_modules` if present
2. Chrome Web Store Developer Dashboard — one-time $5 registration if account not set up yet
3. Upload new item → select zip
4. Fill listing: name, description, screenshots (1280×800 or 640×400), promo tiles (128×128, 440×280 optional)
5. Set visibility: Unlisted for internal testing first, switch to Public once verified
6. Submit for review, typically 1–3 days for simple extensions
7. Once approved, note published extension ID + store link for AI Garage site/socials

## 10. Nice-to-haves, v2

- Firefox support via web-ext tooling (manifest v2/v3 hybrid)
- Explore safer injection point: share menu button instead of floating overlay, if DOM allows without breaking on site updates
- No reliable API exists to detect if desktop app is installed — keep clipboard-copy fallback rather than trying to detect
