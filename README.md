# Continue on Desktop App by AI Garage

Chrome extension that adds a **Desktop** button on [claude.ai](https://claude.ai) and [chatgpt.com](https://chatgpt.com), letting you open the current conversation in the native desktop app with one click. Optionally, it can also send a chat or Claude Project to your own [n8n](https://n8n.io) webhook for further processing (saving to a database, summarizing, cleaning up, etc.) — see [Send to n8n](#send-to-n8n) below.

## Features

- One-click switch from browser to desktop app mid-conversation
- Works on both Claude and ChatGPT
- Anchored button in Claude's chat header; floating button on ChatGPT
- SPA-aware — button updates automatically when you switch conversations
- Clipboard fallback if the desktop app isn't installed
- Per-site enable/disable toggles
- Toolbar popup with quick open + copy link
- Dark mode support
- Optional: send a Claude/ChatGPT chat, or a Claude Project's docs, to your own n8n webhook as JSON or Markdown

## Install (developer mode)

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome, Edge, or Brave
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked** and select the project folder
5. Pin the extension to your toolbar

## Usage

1. Open a conversation on claude.ai or chatgpt.com
2. Click the **Desktop** button in the chat header (Claude) or top-left (ChatGPT)
3. The conversation opens in the desktop app

Alternatively, click the extension icon in the toolbar to see the deep link, open in the app, or copy the link.

## Deep-link mapping

| Web URL | Desktop deep link |
|---------|-------------------|
| `claude.ai/chat/{id}` | `claude://claude.ai/chat/{id}` |
| `claude.ai/project/{id}` | `claude://claude.ai/project/{id}` |
| `chatgpt.com/c/{id}` | `chatgpt://chatgpt.com/threads/{id}` |

## Settings

Right-click the extension icon → **Options** (opens as a full tab) to enable or disable the Desktop button per site, and to configure n8n export.

## Send to n8n

Disabled by default. To turn it on:

1. Open **Options**, go to the "Send to n8n" panel.
2. Enter your n8n webhook URL and click **Save** — Chrome will prompt you to grant that specific URL's origin permission (nothing broader).
3. Toggle on "Enable 'Send to n8n' button".

A **Send to n8n** button then appears next to the Desktop button on claude.ai and chatgpt.com, with a JSON/Markdown format picker next to it. Clicking it:

- On a Claude or ChatGPT chat: extracts the full conversation (messages, roles, timestamps) and sends it as either a structured JSON object or a flattened Markdown document.
- On a Claude Project: sends the project's docs/knowledge files only (not every chat inside the project).

Extraction reads claude.ai's and chatgpt.com's own same-origin API endpoints (the same ones their web apps use), with your existing session cookies — nothing is fetched from, or sent to, any third-party or AI Garage server. The only network destination is the webhook URL you configure. These endpoints are not publicly documented and can change without notice; if extraction ever breaks, that's the likely cause.

## Known limitations

- **Desktop app required** — the deep link only works if the corresponding desktop app (Claude Desktop or ChatGPT Desktop) is installed. If it's not installed, the link is copied to your clipboard instead.
- **ChatGPT stale-thread bug** — the ChatGPT desktop deep link can silently fail to navigate if the app is already running with that thread cached from an earlier session. Workaround: quit and relaunch the ChatGPT desktop app. This is an upstream issue, not fixable from the extension side.
- **Protocol handler detection** — there's no reliable browser API to detect whether a desktop app's protocol handler is registered. The extension uses a timeout-based fallback to clipboard copy.

## Tech stack

- Manifest V3 (Chrome/Edge/Brave compatible)
- Vanilla JavaScript, no build step, no dependencies

## Privacy

**Desktop button:** collects and transmits nothing. It reads only the current tab's URL to generate a desktop app deep link. Preferences (per-site toggles) are stored locally in Chrome's `chrome.storage.sync` and never leave your browser.

**Send to n8n (opt-in, off by default):** when you enable it and click "Send to n8n", the full content of the current chat or Claude Project — including message text — is sent to the webhook URL you configured, in the format you chose (JSON or Markdown). This only happens on an explicit click; nothing is sent automatically or in the background. No conversation content is ever stored by the extension itself — it's read, sent once, and discarded. Make sure you trust whatever is on the other end of the webhook URL you enter, since that destination receives your conversation content in full.

**Webhook URL handling:** since a webhook URL often works like a de-facto secret (anyone with it can trigger your n8n workflow), it's stored in `chrome.storage.local` — device-only, never synced via your Google account like the other preferences. The Options page masks it like a password field (with a show/hide toggle), and you'll see a warning if you enter a plain `http://` URL (other than localhost), since that would send conversation content over the network unencrypted.

## License

MIT
