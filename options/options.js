document.addEventListener("DOMContentLoaded", function () {
  var toggleClaude = document.getElementById("toggle-claude");
  var toggleChatGPT = document.getElementById("toggle-chatgpt");
  var saveStatus = document.getElementById("save-status");

  chrome.storage.sync.get({ enableClaude: true, enableChatGPT: true }, function (settings) {
    toggleClaude.checked = settings.enableClaude;
    toggleChatGPT.checked = settings.enableChatGPT;
  });

  toggleClaude.addEventListener("change", function () {
    save({ enableClaude: toggleClaude.checked });
  });

  toggleChatGPT.addEventListener("change", function () {
    save({ enableChatGPT: toggleChatGPT.checked });
  });

  function save(data) {
    chrome.storage.sync.set(data, function () {
      saveStatus.textContent = "Saved";
      saveStatus.classList.add("visible");
      setTimeout(function () {
        saveStatus.classList.remove("visible");
      }, 1500);
    });
  }

  initN8nSection();
});

function initN8nSection() {
  var toggleExport = document.getElementById("toggle-n8n-export");
  var webhookUrlInput = document.getElementById("webhook-url");
  var toggleWebhookVisibility = document.getElementById("toggle-webhook-visibility");
  var saveWebhookBtn = document.getElementById("save-webhook-btn");
  var exportFormatSelect = document.getElementById("export-format");
  var testConnectionBtn = document.getElementById("test-connection-btn");
  var webhookStatus = document.getElementById("webhook-status");

  chrome.storage.sync.get(
    { n8nExportEnabled: false, n8nExportFormat: "json" },
    function (settings) {
      toggleExport.checked = settings.n8nExportEnabled;
      exportFormatSelect.value = settings.n8nExportFormat;
    }
  );

  chrome.storage.local.get({ n8nWebhookUrl: "" }, function (settings) {
    webhookUrlInput.value = settings.n8nWebhookUrl;

    if (settings.n8nWebhookUrl) {
      checkPermissionGranted(settings.n8nWebhookUrl, function (granted) {
        if (!granted) {
          showWebhookStatus(
            "Permission for this URL was revoked. Click Save to re-grant it.",
            "error"
          );
        }
      });
    }
  });

  toggleWebhookVisibility.addEventListener("click", function () {
    var showing = webhookUrlInput.type === "text";
    webhookUrlInput.type = showing ? "password" : "text";
    toggleWebhookVisibility.textContent = showing ? "Show" : "Hide";
    toggleWebhookVisibility.setAttribute(
      "aria-label",
      showing ? "Show webhook URL" : "Hide webhook URL"
    );
  });

  exportFormatSelect.addEventListener("change", function () {
    chrome.storage.sync.set({ n8nExportFormat: exportFormatSelect.value });
  });

  toggleExport.addEventListener("change", function () {
    chrome.storage.sync.set({ n8nExportEnabled: toggleExport.checked });
  });

  saveWebhookBtn.addEventListener("click", function () {
    var url = webhookUrlInput.value.trim();
    if (!url) {
      chrome.storage.local.set({ n8nWebhookUrl: "" });
      showWebhookStatus("Webhook URL cleared.", "success");
      return;
    }

    var origin = getOrigin(url);
    if (!origin) {
      showWebhookStatus("Enter a valid URL (must start with http:// or https://).", "error");
      return;
    }

    chrome.permissions.request({ origins: [origin + "/*"] }, function (granted) {
      if (!granted) {
        showWebhookStatus("Permission denied — webhook URL not saved.", "error");
        return;
      }
      chrome.storage.local.set({ n8nWebhookUrl: url }, function () {
        if (isInsecureUrl(url)) {
          showWebhookStatus(
            "Webhook URL saved. Warning: this is an unencrypted http:// URL — your conversation content will travel in plain text.",
            "error"
          );
        } else {
          showWebhookStatus("Webhook URL saved.", "success");
        }
      });
    });
  });

  testConnectionBtn.addEventListener("click", function () {
    var url = webhookUrlInput.value.trim();
    if (!url) {
      showWebhookStatus("Enter and save a webhook URL first.", "error");
      return;
    }

    var origin = getOrigin(url);
    if (!origin) {
      showWebhookStatus("Enter a valid URL (must start with http:// or https://).", "error");
      return;
    }

    checkPermissionGranted(url, function (granted) {
      if (!granted) {
        showWebhookStatus("Save the webhook URL first to grant permission.", "error");
        return;
      }

      showWebhookStatus("Testing...", "pending");
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true, source: "continue-on-desktop-app" }),
      })
        .then(function (res) {
          if (res.ok) {
            showWebhookStatus("Test succeeded (status " + res.status + ").", "success");
          } else {
            showWebhookStatus("Webhook responded with status " + res.status + ".", "error");
          }
        })
        .catch(function (err) {
          showWebhookStatus("Test failed: " + err.message, "error");
        });
    });
  });

  function checkPermissionGranted(url, callback) {
    var origin = getOrigin(url);
    if (!origin) {
      callback(false);
      return;
    }
    chrome.permissions.contains({ origins: [origin + "/*"] }, callback);
  }

  function getOrigin(url) {
    try {
      var parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.origin;
    } catch (e) {
      return null;
    }
  }

  function isInsecureUrl(url) {
    try {
      var parsed = new URL(url);
      if (parsed.protocol !== "http:") return false;
      var host = parsed.hostname;
      return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
    } catch (e) {
      return false;
    }
  }

  function showWebhookStatus(text, kind) {
    webhookStatus.textContent = text;
    webhookStatus.className = "webhook-status visible " + kind;
  }
}
