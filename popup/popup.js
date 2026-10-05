document.addEventListener("DOMContentLoaded", function () {
  var openBtn = document.getElementById("open-btn");
  var copyBtn = document.getElementById("copy-btn");
  var status = document.getElementById("status");
  var supportedView = document.getElementById("supported-view");
  var unsupportedView = document.getElementById("unsupported-view");
  var siteLabel = document.getElementById("site-label");
  var deepLinkText = document.getElementById("deep-link-text");

  var currentDeepLink = null;
  var currentTabId = null;
  var n8nActions = document.getElementById("n8n-actions");
  var sendN8nBtn = document.getElementById("send-n8n-btn");
  var n8nFormatSelect = document.getElementById("n8n-format-select");
  var sendN8nLabel = document.getElementById("send-n8n-label");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) {
      showUnsupported();
      return;
    }

    var tab = tabs[0];
    currentTabId = tab.id;
    var info = ContinueOnDesktop.getSiteInfo(tab.url);

    if (!info.deepLink) {
      showUnsupported();
      return;
    }

    currentDeepLink = info.deepLink;
    siteLabel.textContent = info.site === "claude" ? "Claude" : "ChatGPT";
    siteLabel.setAttribute("data-site", info.site);
    deepLinkText.textContent = currentDeepLink;
    supportedView.style.display = "block";

    chrome.storage.sync.get(
      { n8nExportEnabled: false, n8nWebhookUrl: "", n8nExportFormat: "json" },
      function (settings) {
        n8nFormatSelect.value = settings.n8nExportFormat;
        if (settings.n8nExportEnabled && settings.n8nWebhookUrl) {
          n8nActions.style.display = "flex";
        }
      }
    );
  });

  n8nFormatSelect.addEventListener("change", function () {
    chrome.storage.sync.set({ n8nExportFormat: n8nFormatSelect.value });
  });

  sendN8nBtn.addEventListener("click", function () {
    if (!currentTabId) return;
    sendN8nBtn.disabled = true;
    sendN8nBtn.classList.remove("btn-success");
    showStatus("Sending to n8n...");

    chrome.tabs.sendMessage(currentTabId, { type: "POPUP_SEND_TO_N8N" }, function (result) {
      sendN8nBtn.disabled = false;
      if (chrome.runtime.lastError) {
        showStatus("Failed: " + chrome.runtime.lastError.message);
        return;
      }
      if (result && result.ok) {
        sendN8nBtn.classList.add("btn-success");
        sendN8nLabel.textContent = "✓ Sent";
        showStatus("Sent to n8n.");
        setTimeout(function () {
          sendN8nBtn.classList.remove("btn-success");
          sendN8nLabel.textContent = "Send to n8n";
        }, 1800);
      } else {
        var errMsg = (result && result.error) || "Failed (status " + (result && result.status) + ")";
        showStatus("Failed: " + errMsg);
      }
    });
  });

  openBtn.addEventListener("click", function () {
    if (!currentDeepLink || !currentTabId) return;
    showStatus("Opening...");
    chrome.tabs.update(currentTabId, { url: currentDeepLink });
    setTimeout(function () {
      showStatus("Link also copied to clipboard");
      navigator.clipboard.writeText(currentDeepLink).catch(function () {});
    }, 500);
  });

  copyBtn.addEventListener("click", function () {
    if (!currentDeepLink) return;
    navigator.clipboard.writeText(currentDeepLink).then(function () {
      showStatus("Copied!");
      setTimeout(function () { clearStatus(); }, 2000);
    }).catch(function () {
      showStatus("Failed to copy");
    });
  });

  function showUnsupported() {
    unsupportedView.style.display = "block";
  }

  function showStatus(text) {
    status.textContent = text;
    status.style.display = "block";
  }

  function clearStatus() {
    status.textContent = "";
    status.style.display = "none";
  }
});
