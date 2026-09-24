chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      enableClaude: true,
      enableChatGPT: true,
    });
  }
});
