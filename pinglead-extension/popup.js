// ==============================================================================
// PingLead Copilot Popup Settings Script
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const serverUrlInput = document.getElementById("serverUrl");
  const saveBtn = document.getElementById("saveBtn");
  const statusMsg = document.getElementById("statusMsg");

  // Load saved settings
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(["apiKey", "serverUrl"], (data) => {
      if (data.apiKey) apiKeyInput.value = data.apiKey;
      serverUrlInput.value = data.serverUrl || "https://ping-lead.vercel.app";
    });
  }

  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const serverUrl = serverUrlInput.value.trim() || "https://ping-lead.vercel.app";

    if (apiKey && !apiKey.startsWith("plk_")) {
      statusMsg.className = "status-msg";
      statusMsg.innerText = "المفتاح لازم يبدأ بـ plk_ (من الإعدادات ← الملف الشخصي في PingLead)";
      return;
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ apiKey, serverUrl }, () => {
        statusMsg.className = "status-msg status-success";
        statusMsg.innerText = "✓ تم حفظ الإعدادات بنجاح!";
        setTimeout(() => {
          statusMsg.innerText = "";
        }, 3000);
      });
    } else {
      localStorage.setItem("pl_apiKey", apiKey);
      localStorage.setItem("pl_serverUrl", serverUrl);
      statusMsg.className = "status-msg status-success";
      statusMsg.innerText = "✓ تم الحفظ!";
    }
  });
});
