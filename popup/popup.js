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
