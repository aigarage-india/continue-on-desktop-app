(function () {
  "use strict";

  var BUTTON_ID = "cod-continue-btn";
  var N8N_BUTTON_ID = "cod-n8n-btn";
  var N8N_FORMAT_ID = "cod-n8n-format";
  var N8N_ROW_ID = "cod-n8n-row";
  var TOAST_ID = "cod-toast";
  var POLL_INTERVAL = 500;
  var HEADER_WAIT_MS = 2000;
  var PROTOCOL_TIMEOUT_MS = 1500;

  var lastUrl = "";
  var pollTimer = null;
  var enabled = true;
  var n8nReady = false;
  var n8nSending = false;
  var n8nFormat = "json";

  var LANDMARK_SELECTORS = {
    claude: [
      'button[aria-label*="rename chat"]',
      'button[aria-label*="rename conversation"]',
    ],
  };

  function init() {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    if (!info.site) return;

    var storageKey = info.site === "claude" ? "enableClaude" : "enableChatGPT";
    chrome.storage.sync.get(
      {
        enableClaude: true,
        enableChatGPT: true,
        n8nExportEnabled: false,
        n8nWebhookUrl: "",
        n8nExportFormat: "json",
      },
      function (settings) {
        enabled = settings[storageKey];
        n8nReady = !!(settings.n8nExportEnabled && settings.n8nWebhookUrl);
        n8nFormat = settings.n8nExportFormat;
        if (!enabled) return;

        lastUrl = window.location.href;
        handleUrlChange();
        startPolling();
      }
    );
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleUrlChange();
      } else if (!document.getElementById(BUTTON_ID)) {
        var info = ContinueOnDesktop.getSiteInfo(window.location.href);
        if (info.deepLink) {
          tryAnchoredInjection(info);
        }
      }
      updateChatGPTButtonPosition();
    }, POLL_INTERVAL);
  }

  function handleUrlChange() {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    var existing = document.getElementById(BUTTON_ID);

    if (!info.deepLink) {
      if (existing) existing.remove();
      removeN8nElements();
      return;
    }

    if (existing) {
      existing.setAttribute("data-deep-link", info.deepLink);
      return;
    }

    tryAnchoredInjection(info);
  }

  function updateChatGPTButtonPosition() {
    var btn = document.getElementById(BUTTON_ID);
    if (!btn || btn.getAttribute("data-site") !== "chatgpt") return;

    var main = document.querySelector("main");
    var header = document.querySelector('header[data-app-shell-titlebar]');

    var left = main ? main.getBoundingClientRect().left + 12 : 60;
    var top = header ? header.getBoundingClientRect().bottom + 8 : 12;

    btn.style.left = left + "px";
    btn.style.top = top + "px";

    var n8nRow = document.getElementById(N8N_ROW_ID);
    if (n8nRow) {
      var btnRect = btn.getBoundingClientRect();
      n8nRow.style.left = btnRect.left + "px";
      n8nRow.style.top = (btnRect.bottom + 8) + "px";
    }
  }

  function tryAnchoredInjection(info) {
    if (info.site === "chatgpt") {
      injectButton(info, null, true, null);
      updateChatGPTButtonPosition();
      return;
    }

    var selectors = LANDMARK_SELECTORS[info.site] || [];
    var result = findAnchorPoint(selectors);

    if (result) {
      injectButton(info, result.container, false, result.reference);
      return;
    }

    var observer = new MutationObserver(function () {
      result = findAnchorPoint(selectors);
      if (result) {
        observer.disconnect();
        injectButton(info, result.container, false, result.reference);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
      if (!document.getElementById(BUTTON_ID)) {
        injectButton(info, null, true, null);
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

  function createButtonElement(info) {
    var btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.setAttribute("data-deep-link", info.deepLink);
    btn.setAttribute("data-site", info.site);
    btn.title = "Open in " + (info.site === "claude" ? "Claude" : "ChatGPT") + " desktop app";

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "none");
    svg.innerHTML =
      '<path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M9 2h5v5M14 2L7 9" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';

    var span = document.createElement("span");
    span.textContent = "Desktop";

    btn.appendChild(svg);
    btn.appendChild(span);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var deepLink = btn.getAttribute("data-deep-link");
      openDeepLink(deepLink);
    });

    return btn;
  }

  function injectButton(info, container, floating, reference) {
    if (document.getElementById(BUTTON_ID)) return;

    var btn = createButtonElement(info);
    btn.classList.add("cod-action-btn");

    if (floating) {
      btn.classList.add("cod-floating");
      document.body.appendChild(btn);
    } else {
      btn.classList.add("cod-anchored");
      if (reference && reference.nextSibling) {
        container.insertBefore(btn, reference.nextSibling);
      } else {
        container.appendChild(btn);
      }
    }

    if (n8nReady) {
      injectN8nButton(info, container, floating, btn);
    }
  }

  function isClaudeProjectUrl(url) {
    return /^https:\/\/claude\.ai\/project\//.test(url);
  }

  function createN8nButtonElement(info) {
    var btn = document.createElement("button");
    btn.id = N8N_BUTTON_ID;
    btn.setAttribute("data-site", info.site);
    var projectPage = info.site === "claude" && isClaudeProjectUrl(window.location.href);
    btn.title = "Send this " + (projectPage ? "project" : "chat") + " to your n8n webhook";

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("fill", "none");
    svg.innerHTML =
      '<circle cx="3.5" cy="4" r="1.6" fill="currentColor"/>' +
      '<circle cx="12.5" cy="4" r="1.6" fill="currentColor"/>' +
      '<circle cx="8" cy="12.5" r="1.6" fill="currentColor"/>' +
      '<path d="M4.9 5.2L7.3 11M11.1 5.2L8.7 11" ' +
      'stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';

    var span = document.createElement("span");
    span.textContent = "Send to n8n";

    btn.appendChild(svg);
    btn.appendChild(span);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      triggerN8nSend(btn);
    });

    return btn;
  }

  function createN8nFormatSelect() {
    var select = document.createElement("select");
    select.id = N8N_FORMAT_ID;
    select.title = "Format to send to n8n";

    var jsonOpt = document.createElement("option");
    jsonOpt.value = "json";
    jsonOpt.textContent = "JSON";

    var mdOpt = document.createElement("option");
    mdOpt.value = "markdown";
    mdOpt.textContent = "MD";

    select.appendChild(jsonOpt);
    select.appendChild(mdOpt);
    select.value = n8nFormat;

    select.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    select.addEventListener("change", function () {
      n8nFormat = select.value;
      chrome.storage.sync.set({ n8nExportFormat: select.value });
    });

    return select;
  }

  function removeN8nElements() {
    var row = document.getElementById(N8N_ROW_ID);
    if (row) {
      row.remove();
      return;
    }
    var btn = document.getElementById(N8N_BUTTON_ID);
    if (btn) btn.remove();
    var select = document.getElementById(N8N_FORMAT_ID);
    if (select) select.remove();
  }

  function injectN8nButton(info, container, floating, afterElement) {
    if (document.getElementById(N8N_BUTTON_ID)) return;

    var select = createN8nFormatSelect();
    var btn = createN8nButtonElement(info);
    btn.classList.add("cod-action-btn");

    if (floating) {
      var row = document.createElement("div");
      row.id = N8N_ROW_ID;
      row.className = "cod-n8n-floating-row";
      row.appendChild(btn);
      row.appendChild(select);
      document.body.appendChild(row);

      if (info.site === "chatgpt") {
        row.classList.add("cod-n8n-floating-row-chatgpt");
        updateChatGPTButtonPosition();
      }
    } else {
      select.classList.add("cod-anchored-select");
      btn.classList.add("cod-anchored");
      if (afterElement.nextSibling) {
        container.insertBefore(btn, afterElement.nextSibling);
        container.insertBefore(select, btn.nextSibling);
      } else {
        container.appendChild(btn);
        container.appendChild(select);
      }
    }
  }

  function triggerN8nSend(btn) {
    if (n8nSending) return;
    n8nSending = true;

    btn.classList.remove("cod-success");
    btn.classList.add("cod-loading");
    var span = btn.querySelector("span");
    var originalText = span ? span.textContent : "";
    if (span) span.textContent = "Sending...";

    extractAndSend(function (result) {
      n8nSending = false;
      btn.classList.remove("cod-loading");

      if (result && result.ok) {
        btn.classList.add("cod-success");
        if (span) span.textContent = "✓ Sent";
        showToast("Sent to n8n.");
        setTimeout(function () {
          btn.classList.remove("cod-success");
          if (span) span.textContent = originalText;
        }, 1800);
      } else {
        if (span) span.textContent = originalText;
        var errMsg = (result && result.error) || "Failed (status " + (result && result.status) + ")";
        showToast("Send to n8n failed: " + errMsg);
      }
    });
  }

  function extractAndSend(callback) {
    var info = ContinueOnDesktop.getSiteInfo(window.location.href);
    if (!info.site || !info.conversationId) {
      callback({ ok: false, error: "No conversation detected on this page." });
      return;
    }

    var extractPromise;
    if (info.site === "claude") {
      var projectPage = isClaudeProjectUrl(window.location.href);
      extractPromise = projectPage
        ? ClaudeExtractor.extractProject(info.conversationId)
        : ClaudeExtractor.extractChat(info.conversationId);
    } else if (info.site === "chatgpt") {
      extractPromise = ChatGPTExtractor.extractChat(info.conversationId);
    } else {
      callback({ ok: false, error: "Unsupported site." });
      return;
    }

    extractPromise
      .then(function (payload) {
        chrome.runtime.sendMessage({ type: "SEND_TO_N8N", payload: payload }, function (result) {
          callback(result);
        });
      })
      .catch(function (err) {
        callback({ ok: false, error: err.message || String(err) });
      });
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || message.type !== "POPUP_SEND_TO_N8N") return false;
    extractAndSend(sendResponse);
    return true;
  });

  function openDeepLink(deepLink) {
    var btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.classList.add("cod-loading");
      var span = btn.querySelector("span");
      if (span) span.textContent = "Opening...";
    }

    window.location.href = deepLink;

    setTimeout(function () {
      if (btn) {
        btn.classList.remove("cod-loading");
        var span = btn.querySelector("span");
        if (span) span.textContent = "Open in App";
      }
      copyToClipboard(deepLink);
    }, PROTOCOL_TIMEOUT_MS);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () {
      showToast("Link copied to clipboard! Paste in browser or open the desktop app manually.");
    }).catch(function () {
      showToast("Deep link: " + text);
    });
  }

  function showToast(message) {
    var existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.id = TOAST_ID;
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
    }, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
