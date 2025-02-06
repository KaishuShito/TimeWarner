const DEFAULT_OPTIONS = {
  domain: "twitter.com",
  thresholdMinutes: 15,
  discordWebhookUrl: "",
  enableDiscord: false,
  enableLocalNotif: true,
  enableOverlay: true,
  trackingEnabled: true
};

let currentTabId = null;
let currentDomain = null;
let sessionStartTime = null;
let domainTimes = {};
const ALARM_NAME = "TimeWarnerAlarm";

async function getOptions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_OPTIONS, (items) => {
      resolve(items);
    });
  });
}

async function handleTabActivated(tabId) {
  const opts = await getOptions();
  console.log("[TimeWarner] Tab activated:", tabId, "Tracking enabled:", opts.trackingEnabled);
  
  if (!opts.trackingEnabled) {
    console.log("[TimeWarner] Tracking disabled, clearing state");
    clearAlarm();
    currentTabId = null;
    currentDomain = null;
    sessionStartTime = null;
    return;
  }

  chrome.tabs.get(tabId, (tab) => {
    if (!tab || !tab.url) return;
    console.log("[TimeWarner] Active tab URL:", tab.url);

    endCurrentSession();

    currentTabId = tabId;
    currentDomain = extractDomain(tab.url);
    sessionStartTime = Date.now();
    console.log("[TimeWarner] New session started:", {
      currentDomain,
      sessionStartTime: new Date(sessionStartTime).toLocaleTimeString()
    });

    checkAndSetAlarm();
  });
}

function handleTabUpdated(tabId, changeInfo, tab) {
  if (tabId !== currentTabId) return;
  if (changeInfo.status === "complete" && tab.url) {
    endCurrentSession();
    currentDomain = extractDomain(tab.url);
    sessionStartTime = Date.now();
    checkAndSetAlarm();
  }
}

function handleWindowFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    endCurrentSession();
    clearAlarm();
    currentTabId = null;
    currentDomain = null;
    sessionStartTime = null;
  } else {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs.length > 0) {
        handleTabActivated(tabs[0].id);
      }
    });
  }
}

function handleTabRemoved(tabId, removeInfo) {
  if (tabId === currentTabId) {
    endCurrentSession();
    clearAlarm();
    currentTabId = null;
    currentDomain = null;
    sessionStartTime = null;
  }
}

async function checkAndSetAlarm() {
  const opts = await getOptions();
  if (!opts.trackingEnabled) return;

  const domainToWatch = opts.domain;
  console.log("[TimeWarner] Checking domain:", currentDomain, "against:", domainToWatch);
  
  if (currentDomain && currentDomain.includes(domainToWatch)) {
    console.log("[TimeWarner] Setting alarm for", opts.thresholdMinutes, "minutes");
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: parseFloat(opts.thresholdMinutes)
    });
  } else {
    console.log("[TimeWarner] Domain not matched, clearing alarm");
    clearAlarm();
  }
}

function clearAlarm() {
  chrome.alarms.clear(ALARM_NAME);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log("[TimeWarner] Alarm triggered:", alarm.name);

  const opts = await getOptions();
  if (!opts.trackingEnabled) return;

  if (currentDomain && currentDomain.includes(opts.domain)) {
    console.log("[TimeWarner] Sending notifications for domain:", currentDomain);
    if (opts.enableLocalNotif) {
      createLocalNotification(opts);
    }
    if (opts.enableDiscord && opts.discordWebhookUrl) {
      sendDiscordWebhook(opts);
    }
    if (opts.enableOverlay && currentTabId !== null) {
      chrome.tabs.sendMessage(currentTabId, { type: "TIME_EXCEEDED" });
    }
  }

  clearAlarm();
});

function createLocalNotification(opts) {
  chrome.notifications.create("timeWarnerNotification", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon48.png"),
    title: "連続閲覧警告",
    message: `${opts.domain} を ${opts.thresholdMinutes}分 以上見ています。休憩しませんか？`
  });
}

function sendDiscordWebhook(opts) {
  fetch(opts.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `警告: ${opts.domain}を${opts.thresholdMinutes}分以上連続閲覧中です！`
    })
  }).catch((err) => console.error("Discord送信エラー:", err));
}

function endCurrentSession() {
  if (!currentDomain || !sessionStartTime) return;
  const durationMs = Date.now() - sessionStartTime;
  const durationMin = Math.floor(durationMs / 1000 / 60);

  if (!domainTimes[currentDomain]) {
    domainTimes[currentDomain] = 0;
  }
  domainTimes[currentDomain] += durationMin;

  chrome.storage.local.set({ domainTimes });

  currentDomain = null;
  sessionStartTime = null;
}

function extractDomain(urlString) {
  try {
    const u = new URL(urlString);
    return u.hostname || "";
  } catch (e) {
    return "";
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("domainTimes", (res) => {
    domainTimes = res.domainTimes || {};
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get("domainTimes", (res) => {
    domainTimes = res.domainTimes || {};
  });
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  handleTabActivated(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handleTabUpdated(tabId, changeInfo, tab);
});

chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

chrome.tabs.onRemoved.addListener(handleTabRemoved);

// ステータス取得メッセージのハンドラを追加
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    // 次回アラーム時刻を取得
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      sendResponse({
        trackingEnabled: true, // 現在の設定から取得
        currentDomain,
        sessionStartTime,
        nextAlarm: alarm ? alarm.scheduledTime : null
      });
    });
    return true; // 非同期レスポンスのために true を返す
  }
}); 