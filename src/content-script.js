(function () {
  "use strict";

  var CONTROL_ID = "cod-control";
  var TOAST_ID = "cod-toast";
  var POLL_INTERVAL = 500;
  var HEADER_WAIT_MS = 2000;
  var PROTOCOL_TIMEOUT_MS = 1500;

  var lastUrl = "";
  var pollTimer = null;
  var enabled = true;
  var n8nReady = false;
  var n8nSending = false;
  var redactionEnabled = true;

  var LANDMARK_SELECTORS = {
    claude: [
      'button[aria-label^="More options for"]:not([data-row-action])',
      'button[aria-label*="rename chat"]',
      'button[aria-label*="rename conversation"]',
    ],
    chatgptProject: [
      'button[aria-label="Project actions"]',
    ],
  };

  var CHATGPT_INPUT_SELECTORS = [
    "#prompt-textarea",
    'textarea[data-testid="chat-input-textarea"]',
    'form [contenteditable="true"]',
  ];

  function findChatGPTComposerRect() {
    // Scope to <main> and require a real on-screen size — an unscoped
    // query can match a hidden/zero-size element elsewhere in the page
    // (e.g. a sidebar search or rename field), which would otherwise park
    // the control at that element's (often top-left) position.
    var scope = document.querySelector("main") || document;
    for (var i = 0; i < CHATGPT_INPUT_SELECTORS.length; i++) {
      var el = scope.querySelector(CHATGPT_INPUT_SELECTORS[i]);
      if (el) {
        var form = el.closest("form");
        var rect = (form || el).getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return rect;
        }
      }
    }
    return null;
  }

  function init() {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    if (!info.site) return;

    var storageKey = info.site === "claude" ? "enableClaude" : "enableChatGPT";
    chrome.storage.sync.get(
      {
        enableClaude: true,
        enableChatGPT: true,
        n8nExportEnabled: false,
        redactionEnabled: true,
      },
      function (syncSettings) {
        enabled = syncSettings[storageKey];
        redactionEnabled = syncSettings.redactionEnabled;

        chrome.storage.local.get({ n8nWebhookUrl: "" }, function (localSettings) {
          n8nReady = !!(syncSettings.n8nExportEnabled && localSettings.n8nWebhookUrl);
          if (!enabled) return;

          lastUrl = window.location.href;
          handleUrlChange();
          startPolling();
        });
      }
    );
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      } else if (!document.getElementById(CONTROL_ID)) {
        var info = ContinueOnDesktop.getSiteInfo(window.location.href);
        if (info.conversationId) {
          tryAnchoredInjection(info);
        }
      }
      updateChatGPTControlPosition();
    }, POLL_INTERVAL);
  }

  function handleUrlChange() {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    var existing = document.getElementById(CONTROL_ID);

    if (existing) existing.remove();

    if (!info.conversationId) return;

    tryAnchoredInjection(info);
  }

  function updateChatGPTControlPosition() {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    if (info.site !== "chatgpt") return;

    var control = document.getElementById(CONTROL_ID);
    if (!control || !control.classList.contains("cod-floating")) return;

    var left, top;
    var composerRect = findChatGPTComposerRect();
    var controlHeight = control.offsetHeight || 32;
    var controlWidth = control.offsetWidth || 310;

    if (composerRect) {
      // Sit right above the input box, right-aligned to it — the control
      // is wide enough now (3 dropdowns) that squeezing it in beside the
      // input ran out of room whenever the composer spans most of the
      // viewport width, overlapping the input's own mic/send icons.
      left = Math.max(composerRect.right - controlWidth, composerRect.left);
      top = composerRect.top - controlHeight - 8;
    } else {
      // No composer found (e.g. a ChatGPT Project overview page with no
      // single chat input to anchor to) — fall back to bottom-right
      // instead of guessing a top-left spot that can land on the sidebar.
      left = window.innerWidth - controlWidth - 24;
      top = window.innerHeight - controlHeight - 24;
    }

    control.style.left = left + "px";
    control.style.top = top + "px";
  }

  function tryAnchoredInjection(info) {
    // Regular ChatGPT chats have no stable header landmark to anchor to —
    // float next to the composer instead. Project pages do have one (the
    // Share/"..." row), so they go through the same anchored path as Claude.
    if (info.site === "chatgpt" && info.type !== "project") {
      injectControl(info, null, true, null);
      updateChatGPTControlPosition();
      return;
    }

    var selectors = info.site === "chatgpt"
      ? LANDMARK_SELECTORS.chatgptProject
      : (LANDMARK_SELECTORS[info.site] || []);
    var result = findAnchorPoint(selectors);

    if (result) {
      injectControl(info, result.container, false, result.reference);
      return;
    }

    var observer = new MutationObserver(function () {
      result = findAnchorPoint(selectors);
      if (result) {
        observer.disconnect();
        injectControl(info, result.container, false, result.reference);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
      if (!document.getElementById(CONTROL_ID)) {
        injectControl(info, null, true, null);
        if (info.site === "chatgpt") updateChatGPTControlPosition();
      }
    }, HEADER_WAIT_MS);
  }

  function findAnchorPoint(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var landmark = document.querySelector(selectors[i]);
      if (landmark && landmark.parentElement) {
        return { container: landmark.parentElement, reference: landmark };
      }
    }
    return null;
  }

  function getAvailableActions(info) {
    var actions = [];
    if (info.deepLink) actions.push("open");
    if (n8nReady) actions.push("send");
    // Always available — purely local (clipboard), no webhook or deep
    // link needed, so it works even when nothing else is configured.
    actions.push("copy");
    return actions;
  }

  function appendOption(select, value, label) {
    var opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  function appendPlaceholderOption(select, label) {
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = label;
    opt.disabled = true;
    opt.selected = true;
    opt.hidden = true;
    select.appendChild(opt);
  }

  function appendDisabledOption(select, label) {
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = label;
    opt.disabled = true;
    select.appendChild(opt);
  }

  function resetDependentSelect(select, placeholderLabel) {
    select.innerHTML = "";
    appendPlaceholderOption(select, placeholderLabel);
    select.disabled = true;
  }

  function populateDestOptions(destSelect, action) {
    destSelect.innerHTML = "";
    appendPlaceholderOption(destSelect, "Destination");
    if (action === "open") {
      appendOption(destSelect, "desktop", "Desktop");
    } else if (action === "send") {
      appendOption(destSelect, "n8n", "n8n");
      appendDisabledOption(destSelect, "More destinations soon");
    } else if (action === "copy") {
      appendOption(destSelect, "clipboard", "Clipboard");
      appendDisabledOption(destSelect, "More destinations soon");
    }
  }

  function populateFormatOptions(formatSelect) {
    formatSelect.innerHTML = "";
    appendPlaceholderOption(formatSelect, "Format");
    appendOption(formatSelect, "json", "JSON");
    appendOption(formatSelect, "markdown", "MD");
    appendDisabledOption(formatSelect, "More formats soon");
  }

  // Only ever called to enter the busy state — each caller re-enables
  // exactly the selects it leaves usable once the action completes.
  function setControlBusy(wrap) {
    wrap.classList.add("cod-loading");
    var selects = wrap.querySelectorAll("select");
    for (var i = 0; i < selects.length; i++) {
      selects[i].disabled = true;
    }
  }

  // Action + destination stay at their picked values after firing (so
  // repeating the same send/open needs one fewer click) — only the
  // terminal dropdown that actually fired resets to its placeholder,
  // since re-picking an unchanged <select> value fires no change event.
  function handleOpenInDesktop(info, wrap, destSelect) {
    setControlBusy(wrap);
    window.location.href = info.deepLink;

    setTimeout(function () {
      wrap.classList.remove("cod-loading");
      wrap.querySelectorAll("select")[0].disabled = false;
      populateDestOptions(destSelect, "open");
      destSelect.disabled = false;
      copyToClipboard(info.deepLink);
    }, PROTOCOL_TIMEOUT_MS);
  }

  function redactionSuffix(count) {
    if (!count) return "";
    return " " + count + " item" + (count === 1 ? "" : "s") + " redacted.";
  }

  // Shared by every terminal-dropdown handler (send, copy): re-enable
  // action/destination and reset just the format dropdown back to its
  // placeholder, same sticky-selection behavior for both.
  function finishTerminalSelects(wrap, formatSelect) {
    wrap.classList.remove("cod-loading");
    var selects = wrap.querySelectorAll("select");
    selects[0].disabled = false;
    selects[1].disabled = false;
    populateFormatOptions(formatSelect);
    formatSelect.disabled = false;
  }

  function downloadPayloadAsFile(payload, format) {
    var isMarkdown = format === "markdown";
    var text = isMarkdown ? (payload.markdown || "") : JSON.stringify(payload, null, 2);
    var mime = isMarkdown ? "text/markdown" : "application/json";
    var ext = isMarkdown ? "md" : "json";
    var rawName = payload.title || payload.name || "conversation";
    var slug = rawName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "conversation";

    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = slug + "." + ext;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function handleSendToN8n(wrap, formatSelect) {
    if (n8nSending) return;
    n8nSending = true;
    var format = formatSelect.value;
    setControlBusy(wrap);

    extractCurrentPayload(function (extractResult) {
      if (!extractResult.ok) {
        n8nSending = false;
        finishTerminalSelects(wrap, formatSelect);
        showToast("Send to n8n failed: " + extractResult.error, "error");
        return;
      }

      var payload = extractResult.payload;
      chrome.runtime.sendMessage({ type: "SEND_TO_N8N", payload: payload }, function (result) {
        n8nSending = false;
        finishTerminalSelects(wrap, formatSelect);

        if (result && result.ok) {
          showToast("Sent to n8n." + redactionSuffix(extractResult.redactedCount), "success");
        } else {
          var errMsg = (result && result.error) || "Failed (status " + (result && result.status) + ")";
          downloadPayloadAsFile(payload, format);
          showToast("Send to n8n failed: " + errMsg + " — downloaded a backup copy.", "error");
        }
      });
    });
  }

  function handleCopyAs(wrap, formatSelect) {
    var format = formatSelect.value;
    setControlBusy(wrap);

    extractCurrentPayload(function (result) {
      finishTerminalSelects(wrap, formatSelect);

      if (!result.ok) {
        showToast("Copy failed: " + result.error, "error");
        return;
      }

      var text = format === "markdown"
        ? (result.payload.markdown || "")
        : JSON.stringify(result.payload, null, 2);

      navigator.clipboard.writeText(text).then(function () {
        var formatLabel = format === "markdown" ? "Markdown" : "JSON";
        showToast("Copied to clipboard (" + formatLabel + ")." + redactionSuffix(result.redactedCount), "success");
      }).catch(function () {
        showToast("Couldn't copy to clipboard — your browser may have blocked it.", "error");
      });
    });
  }

  function buildControlElement(info, actions) {
    var wrap = document.createElement("div");
    wrap.id = CONTROL_ID;
    wrap.className = "cod-control";
    wrap.setAttribute("data-site", info.site);

    var actionSelect = document.createElement("select");
    actionSelect.className = "cod-select";
    actionSelect.title = "Choose an action";
    appendPlaceholderOption(actionSelect, "Action");
    if (actions.indexOf("open") !== -1) appendOption(actionSelect, "open", "Open in");
    if (actions.indexOf("send") !== -1) appendOption(actionSelect, "send", "Send to");
    if (actions.indexOf("copy") !== -1) appendOption(actionSelect, "copy", "Copy as");

    var destSelect = document.createElement("select");
    destSelect.className = "cod-select";
    destSelect.title = "Choose a destination";
    destSelect.disabled = true;
    appendPlaceholderOption(destSelect, "Destination");

    var formatSelect = document.createElement("select");
    formatSelect.className = "cod-select";
    formatSelect.title = "Choose a format";
    formatSelect.disabled = true;
    appendPlaceholderOption(formatSelect, "Format");

    // "Copy as" -> "Clipboard" is the default on every load — it's always
    // available (no n8n config needed), so action and destination start
    // pre-picked. Format stays at its placeholder: re-picking an
    // already-selected <select> value fires no change event in any
    // browser, so the one dropdown that actually fires the action can
    // never be pre-filled, or there'd be no way to trigger it without
    // first picking something else and back again.
    actionSelect.value = "copy";
    populateDestOptions(destSelect, "copy");
    destSelect.value = "clipboard";
    destSelect.disabled = false;
    populateFormatOptions(formatSelect);
    formatSelect.disabled = false;

    [actionSelect, destSelect, formatSelect].forEach(function (sel) {
      sel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    });

    actionSelect.addEventListener("change", function () {
      var action = actionSelect.value;
      resetDependentSelect(formatSelect, "Format");
      populateDestOptions(destSelect, action);
      destSelect.disabled = !action;
    });

    destSelect.addEventListener("change", function (e) {
      e.stopPropagation();
      var action = actionSelect.value;
      var destination = destSelect.value;
      if (!destination) return;

      if (action === "open" && destination === "desktop") {
        handleOpenInDesktop(info, wrap, destSelect);
        return;
      }

      if ((action === "send" && destination === "n8n") || (action === "copy" && destination === "clipboard")) {
        populateFormatOptions(formatSelect);
        formatSelect.disabled = false;
      }
    });

    formatSelect.addEventListener("change", function (e) {
      e.stopPropagation();
      var format = formatSelect.value;
      if (!format) return;

      if (actionSelect.value === "copy") {
        handleCopyAs(wrap, formatSelect);
        return;
      }

      chrome.storage.sync.set({ n8nExportFormat: format });
      handleSendToN8n(wrap, formatSelect);
    });

    wrap.appendChild(actionSelect);
    wrap.appendChild(destSelect);
    wrap.appendChild(formatSelect);

    return wrap;
  }

  function injectControl(info, container, floating, reference) {
    if (document.getElementById(CONTROL_ID)) return;

    var actions = getAvailableActions(info);
    if (!actions.length) return;

    var control = buildControlElement(info, actions);
    control.classList.add(floating ? "cod-floating" : "cod-anchored");

    if (floating) {
      document.body.appendChild(control);
    } else if (reference && reference.nextSibling) {
      container.insertBefore(control, reference.nextSibling);
    } else {
      container.appendChild(control);
    }
  }

  function extractCurrentPayload(callback) {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    if (!info.site || !info.conversationId) {
      callback({ ok: false, error: "No conversation detected on this page." });
      return;
    }

    var extractPromise;
    if (info.site === "claude") {
      if (info.type === "project") {
        extractPromise = ClaudeExtractor.extractProject(info.conversationId);
      } else if (info.type === "code") {
        extractPromise = ClaudeExtractor.extractCodeSession(info.conversationId);
      } else if (info.type === "cowork") {
        extractPromise = ClaudeExtractor.extractCoworkSession(info.conversationId);
      } else {
        extractPromise = ClaudeExtractor.extractChat(info.conversationId);
      }
    } else if (info.site === "chatgpt") {
      extractPromise = info.type === "project"
        ? ChatGPTExtractor.extractProject(info.conversationId)
        : ChatGPTExtractor.extractChat(info.conversationId);
    } else {
      callback({ ok: false, error: "Unsupported site." });
      return;
    }

    extractPromise
      .then(function (payload) {
        // Single chokepoint for every consumer (n8n send, clipboard copy,
        // the download fallback) — redaction applies uniformly regardless
        // of destination, same toggle for all of them.
        if (!redactionEnabled) {
          callback({ ok: true, payload: payload, redactedCount: 0 });
          return;
        }
        var redacted = RedactionUtil.redactPayload(payload);
        callback({ ok: true, payload: redacted.payload, redactedCount: redacted.count });
      })
      .catch(function (err) {
        callback({ ok: false, error: err.message || String(err) });
      });
  }

  function extractAndSend(callback) {
    extractCurrentPayload(function (result) {
      if (!result.ok) {
        callback(result);
        return;
      }
      chrome.runtime.sendMessage({ type: "SEND_TO_N8N", payload: result.payload }, callback);
    });
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message) return false;

    if (message.type === "POPUP_SEND_TO_N8N") {
      extractAndSend(sendResponse);
      return true;
    }

    if (message.type === "POPUP_COPY_AS") {
      // Extraction (and redaction) must happen here, in the content
      // script, since it needs same-origin access to claude.ai/chatgpt.com.
      // The actual clipboard write happens back in the popup itself,
      // where the click that triggered this still has user-gesture
      // activation — a write from here, async from a cross-context
      // message, isn't guaranteed to be allowed.
      extractCurrentPayload(function (result) {
        if (!result.ok) {
          sendResponse({ ok: false, error: result.error });
          return;
        }
        var format = message.format;
        var text = format === "markdown"
          ? (result.payload.markdown || "")
          : JSON.stringify(result.payload, null, 2);
        sendResponse({ ok: true, text: text, redactedCount: result.redactedCount });
      });
      return true;
    }

    return false;
  });

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () {
      showToast("Link copied to clipboard! Paste in browser or open the desktop app manually.", "info");
    }).catch(function () {
      showToast("Deep link: " + text, "info");
    });
  }

  var TOAST_DURATIONS = { success: 3000, error: 8000, info: 3000 };

  function showToast(message, type) {
    var existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = type ? "cod-toast-" + type : "";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("cod-toast-visible");
    });

    setTimeout(function () {
      toast.classList.remove("cod-toast-visible");
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, TOAST_DURATIONS[type] || 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
