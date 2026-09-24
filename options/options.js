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
});
