document.addEventListener("DOMContentLoaded", async () => {
  const DEFAULT_OPTIONS = {
    domain: "twitter.com",
    thresholdMinutes: 15,
    discordWebhookUrl: "",
    enableDiscord: false,
    enableLocalNotif: true,
    enableOverlay: true,
    trackingEnabled: true
  };

  const domainInput = document.getElementById("domain");
  const thresholdInput = document.getElementById("thresholdMinutes");
  const discordWebhookInput = document.getElementById("discordWebhookUrl");
  const enableDiscordCheckbox = document.getElementById("enableDiscord");
  const enableLocalNotifCheckbox = document.getElementById("enableLocalNotif");
  const enableOverlayCheckbox = document.getElementById("enableOverlay");
  const trackingEnabledCheckbox = document.getElementById("trackingEnabled");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");
  const refreshStatusBtn = document.getElementById("refreshStatus");

  chrome.storage.local.get(DEFAULT_OPTIONS, (res) => {
    domainInput.value = res.domain || DEFAULT_OPTIONS.domain;
    thresholdInput.value = res.thresholdMinutes || DEFAULT_OPTIONS.thresholdMinutes;
    discordWebhookInput.value = res.discordWebhookUrl || DEFAULT_OPTIONS.discordWebhookUrl;
    enableDiscordCheckbox.checked = !!res.enableDiscord;
    enableLocalNotifCheckbox.checked = !!res.enableLocalNotif;
    enableOverlayCheckbox.checked = !!res.enableOverlay;
    trackingEnabledCheckbox.checked = !!res.trackingEnabled;
  });

  saveBtn.addEventListener("click", () => {
    const newOptions = {
      domain: domainInput.value.trim(),
      thresholdMinutes: parseFloat(thresholdInput.value) || 15,
      discordWebhookUrl: discordWebhookInput.value.trim(),
      enableDiscord: enableDiscordCheckbox.checked,
      enableLocalNotif: enableLocalNotifCheckbox.checked,
      enableOverlay: enableOverlayCheckbox.checked,
      trackingEnabled: trackingEnabledCheckbox.checked
    };

    chrome.storage.local.set(newOptions, () => {
      statusDiv.textContent = "設定を保存しました！";
      setTimeout(() => { statusDiv.textContent = ""; }, 2000);

      if (newOptions.enableDiscord && newOptions.discordWebhookUrl) {
        const message = [
          "🔔 TimeWarner設定を更新しました！",
          `📌 監視対象: ${newOptions.domain}`,
          `⏰ 通知までの時間: ${newOptions.thresholdMinutes}分`,
          `🚨 通知設定:`,
          `　・ローカル通知: ${newOptions.enableLocalNotif ? "オン" : "オフ"}`,
          `　・画面オーバーレイ: ${newOptions.enableOverlay ? "オン" : "オフ"}`,
          `　・Discord通知: ${newOptions.enableDiscord ? "オン" : "オフ"}`,
          `📊 時間計測: ${newOptions.trackingEnabled ? "有効" : "無効"}`
        ].join("\n");

        fetch(newOptions.discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: message })
        }).catch(err => console.error("Discord設定通知エラー:", err));
      }
    });
  });

  async function updateStatus() {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
      if (response) {
        document.getElementById("trackingStatus").textContent = 
          response.trackingEnabled ? "有効" : "無効";
        document.getElementById("currentDomainStatus").textContent = 
          response.currentDomain || "-";
        document.getElementById("sessionStartStatus").textContent = 
          response.sessionStartTime ? new Date(response.sessionStartTime).toLocaleTimeString() : "-";
        document.getElementById("nextAlarmStatus").textContent = 
          response.nextAlarm ? `${Math.round((response.nextAlarm - Date.now()) / 1000 / 60)}分後` : "-";
      }
    });
  }

  refreshStatusBtn.addEventListener("click", updateStatus);
  updateStatus();
}); 