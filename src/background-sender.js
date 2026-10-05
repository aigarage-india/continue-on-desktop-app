var TIMEOUT_MS = 10000;
var RETRY_DELAY_MS = 1500;

function buildBody(payload, format) {
  if (format === "markdown") {
    return {
      body: payload.markdown || "",
      // n8n's Webhook node only auto-parses a fixed set of content types
      // (json, text/plain, form-data, xml...) — an unrecognized one like
      // text/markdown falls back to treating the body as binary data.
      // Markdown is plain text, so text/plain parses it correctly.
      contentType: "text/plain",
    };
  }
  return {
    body: JSON.stringify(payload),
    contentType: "application/json",
  };
}

function postOnce(url, body, contentType, authHeaderName, authHeaderValue) {
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, TIMEOUT_MS);

  var headers = { "Content-Type": contentType };
  if (authHeaderName && authHeaderValue) {
    headers[authHeaderName] = authHeaderValue;
  }

  return fetch(url, {
    method: "POST",
    headers: headers,
    body: body,
    // Extension fetches to a host_permissions-granted origin send cookies
    // for that domain by default (a webhook host the user is also logged
    // into in their browser would otherwise leak its session/tracking
    // cookies into every request) — explicitly opt out.
    credentials: "omit",
    signal: controller.signal,
  }).finally(function () {
    clearTimeout(timer);
  });
}

function delay(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function sendToN8n(payload) {
  return new Promise(function (resolve) {
    chrome.storage.local.get(
      { n8nWebhookUrl: "", n8nAuthHeaderName: "", n8nAuthHeaderValue: "" },
      function (localSettings) {
        if (!localSettings.n8nWebhookUrl) {
          resolve({ ok: false, error: "No n8n webhook URL configured." });
          return;
        }

        chrome.storage.sync.get({ n8nExportFormat: "json" }, function (syncSettings) {
          var built = buildBody(payload, syncSettings.n8nExportFormat);

          attempt(
            localSettings.n8nWebhookUrl,
            built.body,
            built.contentType,
            localSettings.n8nAuthHeaderName,
            localSettings.n8nAuthHeaderValue,
            true
          ).then(resolve);
        });
      }
    );
  });
}

function friendlyErrorForStatus(status, hasAuthHeader) {
  if (status === 401 || status === 403) {
    return hasAuthHeader
      ? "n8n rejected the request (" + status + ") — the auth header name/value in Options doesn't match the credential configured on the webhook."
      : "n8n rejected the request (" + status + ") — this webhook requires an auth header. Add the header name/value in Options to match its n8n credential.";
  }
  if (status === 404) {
    return "Webhook not found (404) — check the URL in Options is correct and the workflow is active in n8n.";
  }
  if (status >= 500) {
    return "n8n server error (" + status + ") — check the workflow's execution log in n8n for details.";
  }
  return "n8n returned an error (status " + status + ").";
}

function attempt(url, body, contentType, authHeaderName, authHeaderValue, allowRetry) {
  return postOnce(url, body, contentType, authHeaderName, authHeaderValue)
    .then(function (res) {
      if (res.ok) return { ok: true, status: res.status };
      return {
        ok: false,
        status: res.status,
        error: friendlyErrorForStatus(res.status, !!(authHeaderName && authHeaderValue)),
      };
    })
    .catch(function (err) {
      var isNetworkError = err.name === "AbortError" || err.name === "TypeError";
      if (isNetworkError && allowRetry) {
        return delay(RETRY_DELAY_MS).then(function () {
          return attempt(url, body, contentType, authHeaderName, authHeaderValue, false);
        });
      }
      return { ok: false, error: err.message || String(err) };
    });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || message.type !== "SEND_TO_N8N") return false;

  sendToN8n(message.payload).then(sendResponse);
  return true;
});
