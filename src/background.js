importScripts("background-sender.js");

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      enableClaude: true,
      enableChatGPT: true,
    });
  }

  if (details.reason === "install" || details.reason === "update") {
    migrateWebhookUrlToLocal();
  }
});

function migrateWebhookUrlToLocal() {
  chrome.storage.sync.get({ n8nWebhookUrl: "" }, function (syncSettings) {
    if (!syncSettings.n8nWebhookUrl) return;

    chrome.storage.local.get({ n8nWebhookUrl: "" }, function (localSettings) {
      if (!localSettings.n8nWebhookUrl) {
        chrome.storage.local.set({ n8nWebhookUrl: syncSettings.n8nWebhookUrl });
      }
      chrome.storage.sync.remove("n8nWebhookUrl");
    });
  });
}
