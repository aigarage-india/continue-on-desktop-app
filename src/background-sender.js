var TIMEOUT_MS = 10000;
var RETRY_DELAY_MS = 1500;

function buildBody(payload, format) {
  if (format === "markdown") {
    return {
      body: payload.markdown || "",
      contentType: "text/markdown",
    };
  }
  return {
    body: JSON.stringify(payload),
    contentType: "application/json",
  };
}

function postOnce(url, body, contentType) {
  var controller = new AbortController();
  var timer = setTimeout(function () {
    controller.abort();
  }, TIMEOUT_MS);

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: body,
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
    chrome.storage.sync.get(
      { n8nWebhookUrl: "", n8nExportFormat: "json" },
      function (settings) {
        if (!settings.n8nWebhookUrl) {
          resolve({ ok: false, error: "No n8n webhook URL configured." });
          return;
        }

        var built = buildBody(payload, settings.n8nExportFormat);

        attempt(settings.n8nWebhookUrl, built.body, built.contentType, true)
          .then(resolve);
      }
    );
  });
}

function attempt(url, body, contentType, allowRetry) {
  return postOnce(url, body, contentType)
    .then(function (res) {
      return { ok: res.ok, status: res.status };
    })
    .catch(function (err) {
      var isNetworkError = err.name === "AbortError" || err.name === "TypeError";
      if (isNetworkError && allowRetry) {
        return delay(RETRY_DELAY_MS).then(function () {
          return attempt(url, body, contentType, false);
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
