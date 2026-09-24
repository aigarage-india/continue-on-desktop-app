# Continue on Desktop App by AI Garage

Chrome extension that adds a **Desktop** button on [claude.ai](https://claude.ai) and [chatgpt.com](https://chatgpt.com), letting you open the current conversation in the native desktop app with one click.

## Features

- One-click switch from browser to desktop app mid-conversation
- Works on both Claude and ChatGPT
- Anchored button in Claude's chat header; floating button on ChatGPT
- SPA-aware — button updates automatically when you switch conversations
- Clipboard fallback if the desktop app isn't installed
- Per-site enable/disable toggles
- Toolbar popup with quick open + copy link
- Dark mode support

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

Right-click the extension icon → **Options** to enable or disable the button per site.

## Known limitations

- **Desktop app required** — the deep link only works if the corresponding desktop app (Claude Desktop or ChatGPT Desktop) is installed. If it's not installed, the link is copied to your clipboard instead.
- **ChatGPT stale-thread bug** — the ChatGPT desktop deep link can silently fail to navigate if the app is already running with that thread cached from an earlier session. Workaround: quit and relaunch the ChatGPT desktop app. This is an upstream issue, not fixable from the extension side.
- **Protocol handler detection** — there's no reliable browser API to detect whether a desktop app's protocol handler is registered. The extension uses a timeout-based fallback to clipboard copy.

## Tech stack

- Manifest V3 (Chrome/Edge/Brave compatible)
- Vanilla JavaScript, no build step, no dependencies

## License

MIT
