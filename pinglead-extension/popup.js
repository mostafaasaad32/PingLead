// ==============================================================================
// PingLead Copilot Popup Settings Script
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const userIdInput = document.getElementById("userId");
  const serverUrlInput = document.getElementById("serverUrl");
  const saveBtn = document.getElementById("saveBtn");
  const statusMsg = document.getElementById("statusMsg");

  // Load saved settings
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(["userId", "serverUrl"], (data) => {
      if (data.userId) userIdInput.value = data.userId;
      if (data.serverUrl) serverUrlInput.value = data.serverUrl;
      else serverUrlInput.value = "http://localhost:3000";
    });
  }

  saveBtn.addEventListener("click", () => {
    const userId = userIdInput.value.trim();
    const serverUrl = serverUrlInput.value.trim() || "http://localhost:3000";

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ userId, serverUrl }, () => {
        statusMsg.className = "status-msg status-success";
        statusMsg.innerText = "✓ تم حفظ الإعدادات بنجاح!";
        setTimeout(() => {
          statusMsg.innerText = "";
        }, 3000);
      });
    } else {
      localStorage.setItem("pl_userId", userId);
      localStorage.setItem("pl_serverUrl", serverUrl);
      statusMsg.className = "status-msg status-success";
      statusMsg.innerText = "✓ تم الحفظ!";
    }
  });
});
