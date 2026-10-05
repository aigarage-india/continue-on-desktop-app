# Continue on Desktop App by AI Garage

Chrome extension that adds a small control to [claude.ai](https://claude.ai) and [chatgpt.com](https://chatgpt.com) for opening the current conversation in the native desktop app with one click, or sending it to your own [n8n](https://n8n.io) webhook for further processing (saving to a database, summarizing, cleaning up, etc.) — see [Send to n8n](#send-to-n8n) below.

## Features

- One-click switch from browser to desktop app mid-conversation
- Works on Claude (chats, Projects, Code sessions, Cowork sessions) and ChatGPT (chats, Projects)
- Anchored control in Claude's/ChatGPT Project's header; floating control next to the input box on ChatGPT chats
- SPA-aware — control updates automatically when you switch conversations
- Clipboard fallback if the desktop app isn't installed
- Per-site enable/disable toggles
- Toolbar popup with quick open + copy link
- Dark mode support
- Optional: send a Claude/ChatGPT chat, a Claude Project's docs, a ChatGPT Project's instructions/files, or a Claude Code/Cowork session's transcript, to your own n8n webhook as JSON or Markdown

## Install (developer mode)

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome, Edge, or Brave
3. Enable **Developer mode** (toggle, top-right)
4. Click **Load unpacked** and select the project folder
5. Pin the extension to your toolbar

## Usage

1. Open a conversation on claude.ai or chatgpt.com
2. In the injected control, pick **Open in** from the first dropdown, then **Desktop** from the second
3. The conversation opens in the desktop app

Alternatively, click the extension icon in the toolbar to see the deep link, open in the app, or copy the link.

## Deep-link mapping

| Web URL | Desktop deep link |
|---------|-------------------|
| `claude.ai/chat/{id}` | `claude://claude.ai/chat/{id}` |
| `claude.ai/project/{id}` | `claude://claude.ai/project/{id}` |
| `chatgpt.com/c/{id}` | `chatgpt://chatgpt.com/threads/{id}` |

## Settings

Right-click the extension icon → **Options** (opens as a full tab) to enable or disable the control per site, and to configure n8n export.

## Send to n8n

Disabled by default. To turn it on:

1. Open **Options**, go to the "Send to n8n" panel.
2. Enter your n8n webhook URL and click **Save** — Chrome will prompt you to grant that specific URL's origin permission (nothing broader).
3. Toggle on "Enable 'Send to n8n' button".

The injected control then offers **Send to** as an action. Picking it reveals a destination dropdown (currently just **n8n**, with more destinations planned), then a format dropdown (**JSON** / **MD**) — selecting a format fires the send immediately:

- On a Claude or ChatGPT chat: extracts the full conversation (messages, roles, timestamps) and sends it as either a structured JSON object or a flattened Markdown document.
- On a Claude Project: sends the project's docs/knowledge files only (not every chat inside the project).
- On a ChatGPT Project: sends the project's instructions and any attached files.
- On a Claude Code or Cowork session: sends the session transcript (same message/role shape as a chat).

Extraction reads claude.ai's and chatgpt.com's own same-origin API endpoints (the same ones their web apps use), with your existing session cookies — nothing is fetched from, or sent to, any third-party or AI Garage server. The only network destination is the webhook URL you configure. These endpoints are not publicly documented and can change without notice; if extraction ever breaks, that's the likely cause.

## Known limitations

- **Desktop app required** — the deep link only works if the corresponding desktop app (Claude Desktop or ChatGPT Desktop) is installed. If it's not installed, the link is copied to your clipboard instead.
- **ChatGPT stale-thread bug** — the ChatGPT desktop deep link can silently fail to navigate if the app is already running with that thread cached from an earlier session. Workaround: quit and relaunch the ChatGPT desktop app. This is an upstream issue, not fixable from the extension side.
- **Protocol handler detection** — there's no reliable browser API to detect whether a desktop app's protocol handler is registered. The extension uses a timeout-based fallback to clipboard copy.

## Tech stack

- Manifest V3 (Chrome/Edge/Brave compatible)
- Vanilla JavaScript, no build step, no dependencies

## Privacy

**Open in Desktop:** collects and transmits nothing. It reads only the current tab's URL to generate a desktop app deep link. Preferences (per-site toggles) are stored locally in Chrome's `chrome.storage.sync` and never leave your browser.

**Send to n8n (opt-in, off by default):** when you enable it and complete the Send to → n8n → format dropdown chain, the full content of the current chat, project, or session — including message text — is sent to the webhook URL you configured, in the format you chose (JSON or Markdown). This only happens on an explicit selection; nothing is sent automatically or in the background. No conversation content is ever stored by the extension itself — it's read, sent once, and discarded. Make sure you trust whatever is on the other end of the webhook URL you enter, since that destination receives your conversation content in full.

**Webhook URL handling:** since a webhook URL often works like a de-facto secret (anyone with it can trigger your n8n workflow), it's stored in `chrome.storage.local` — device-only, never synced via your Google account like the other preferences. The Options page masks it like a password field (with a show/hide toggle), and you'll see a warning if you enter a plain `http://` URL (other than localhost), since that would send conversation content over the network unencrypted. The webhook request itself is sent with `credentials: "omit"`, so no browser cookies for the webhook's domain (session, analytics, tracking) are ever attached to it — only the conversation payload and, if configured, your auth header.

**Optional auth header:** on the "Send to n8n" panel, below the webhook URL, there's an optional header name/value pair. Leave both blank and nothing changes. Fill both in and that header is sent on every request to your webhook — so anyone who gets hold of just the URL (a leaked link, browser history, a screenshot) still can't trigger your workflow without the secret too. This maps directly onto n8n's built-in **Header Auth** credential:

1. In n8n, open your webhook node → **Authentication** → **Header Auth**.
2. Create a credential with a header name (e.g. `X-Webhook-Secret`) and a secret value of your choice.
3. In this extension's Options, enter that same header name and value, then Save.

Both fields are stored the same way as the webhook URL (`chrome.storage.local`, masked value field).

## License

MIT
