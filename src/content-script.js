(function () {
  "use strict";

  var BUTTON_ID = "cod-continue-btn";
  var TOAST_ID = "cod-toast";
  var POLL_INTERVAL = 500;
  var HEADER_WAIT_MS = 2000;
  var PROTOCOL_TIMEOUT_MS = 1500;

  var lastUrl = "";
  var pollTimer = null;
  var enabled = true;

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
    chrome.storage.sync.get({ enableClaude: true, enableChatGPT: true }, function (settings) {
      enabled = settings[storageKey];
      if (!enabled) return;

      lastUrl = window.location.href;
      handleUrlChange();
      startPolling();
    });
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
    if (main) {
      var left = main.getBoundingClientRect().left + 12;
      btn.style.left = left + "px";
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
  }

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
