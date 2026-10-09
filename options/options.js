document.addEventListener("DOMContentLoaded", function () {
  var toggleClaude = document.getElementById("toggle-claude");
  var toggleChatGPT = document.getElementById("toggle-chatgpt");
  var saveStatus = document.getElementById("save-status");

  chrome.storage.sync.get({ enableClaude: true, enableChatGPT: true }, function (settings) {
    toggleClaude.checked = settings.enableClaude;
    toggleChatGPT.checked = settings.enableChatGPT;
  });

  toggleClaude.addEventListener("change", function () {
    save({ enableClaude: toggleClaude.checked }, saveStatus);
  });

  toggleChatGPT.addEventListener("change", function () {
    save({ enableChatGPT: toggleChatGPT.checked }, saveStatus);
  });

  function save(data, statusEl) {
    chrome.storage.sync.set(data, function () {
      statusEl.textContent = "Saved";
      statusEl.classList.add("visible");
      setTimeout(function () {
        statusEl.classList.remove("visible");
      }, 1500);
    });
  }

  initRedactionSection(save);
  initN8nSection();
});

function initRedactionSection(save) {
  var toggleRedaction = document.getElementById("toggle-redaction");
  var redactionSaveStatus = document.getElementById("redaction-save-status");

  chrome.storage.sync.get({ redactionEnabled: true }, function (settings) {
    toggleRedaction.checked = settings.redactionEnabled;
  });

  toggleRedaction.addEventListener("change", function () {
    save({ redactionEnabled: toggleRedaction.checked }, redactionSaveStatus);
  });
}

function initN8nSection() {
  var toggleExport = document.getElementById("toggle-n8n-export");
  var webhookUrlInput = document.getElementById("webhook-url");
  var toggleWebhookVisibility = document.getElementById("toggle-webhook-visibility");
  var authHeaderNameInput = document.getElementById("auth-header-name");
  var authHeaderValueInput = document.getElementById("auth-header-value");
  var toggleAuthHeaderVisibility = document.getElementById("toggle-auth-header-visibility");
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

  chrome.storage.local.get(
    { n8nWebhookUrl: "", n8nAuthHeaderName: "", n8nAuthHeaderValue: "" },
    function (settings) {
      webhookUrlInput.value = settings.n8nWebhookUrl;
      authHeaderNameInput.value = settings.n8nAuthHeaderName;
      authHeaderValueInput.value = settings.n8nAuthHeaderValue;

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
    }
  );

  toggleWebhookVisibility.addEventListener("click", function () {
    var showing = webhookUrlInput.type === "text";
    webhookUrlInput.type = showing ? "password" : "text";
    toggleWebhookVisibility.textContent = showing ? "Show" : "Hide";
    toggleWebhookVisibility.setAttribute(
      "aria-label",
      showing ? "Show webhook URL" : "Hide webhook URL"
    );
  });

  toggleAuthHeaderVisibility.addEventListener("click", function () {
    var showing = authHeaderValueInput.type === "text";
    authHeaderValueInput.type = showing ? "password" : "text";
    toggleAuthHeaderVisibility.textContent = showing ? "Show" : "Hide";
    toggleAuthHeaderVisibility.setAttribute(
      "aria-label",
      showing ? "Show header value" : "Hide header value"
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
    var headerName = authHeaderNameInput.value.trim();
    var headerValue = authHeaderValueInput.value.trim();

    if (!!headerName !== !!headerValue) {
      showWebhookStatus(
        "Auth header needs both a name and a value — or leave both blank.",
        "error"
      );
      return;
    }

    if (!url) {
      chrome.storage.local.set({
        n8nWebhookUrl: "",
        n8nAuthHeaderName: headerName,
        n8nAuthHeaderValue: headerValue,
      });
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
      chrome.storage.local.set(
        {
          n8nWebhookUrl: url,
          n8nAuthHeaderName: headerName,
          n8nAuthHeaderValue: headerValue,
        },
        function () {
          if (isInsecureUrl(url)) {
            showWebhookStatus(
              "Webhook URL saved. Warning: this is an unencrypted http:// URL — your conversation content will travel in plain text.",
              "error"
            );
          } else {
            showWebhookStatus("Webhook URL saved.", "success");
          }
        }
      );
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
      var headers = { "Content-Type": "application/json" };
      var headerName = authHeaderNameInput.value.trim();
      var headerValue = authHeaderValueInput.value.trim();
      if (headerName && headerValue) {
        headers[headerName] = headerValue;
      }

      fetch(url, {
        method: "POST",
        headers: headers,
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
