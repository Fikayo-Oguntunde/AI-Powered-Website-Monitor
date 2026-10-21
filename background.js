const USAGE_ALARM = "usage-tick";
const FOCUS_ALARM = "focus-timer";
const DAY_MS = 24 * 60 * 60 * 1000;

let taskQueue = Promise.resolve();

function enqueue(task) {
  taskQueue = taskQueue.then(task, task).catch((error) => {
    console.error("Focus Monitor task failed:", error);
  });
  return taskQueue;
}

function dayKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

function domainForUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.hostname : null;
  } catch {
    return null;
  }
}

async function flushActiveTab() {
  const { activeTab, dailyUsage = {} } = await chrome.storage.local.get([
    "activeTab",
    "dailyUsage",
  ]);
  const now = Date.now();

  if (activeTab?.domain && activeTab.since < now) {
    let cursor = activeTab.since;
    while (cursor < now) {
      const day = dayKey(cursor);
      const end = Math.min(now, nextDay(cursor));
      dailyUsage[day] ??= {};
      dailyUsage[day][activeTab.domain] =
        (dailyUsage[day][activeTab.domain] || 0) + end - cursor;
      cursor = end;
    }
  }

  const cutoff = dayKey(now - 30 * DAY_MS);
  for (const day of Object.keys(dailyUsage)) {
    if (day < cutoff) delete dailyUsage[day];
  }

  await chrome.storage.local.set({
    dailyUsage,
    activeTab: activeTab?.domain ? { ...activeTab, since: now } : null,
  });
}

async function setActiveTabFromFocusedWindow() {
  await flushActiveTab();
  if ((await chrome.idle.queryState(60)) !== "active") {
    await chrome.storage.local.set({ activeTab: null });
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const domain = tab?.url ? domainForUrl(tab.url) : null;
  await chrome.storage.local.set({
    activeTab: domain ? { tabId: tab.id, domain, since: Date.now() } : null,
  });
}

async function startFocus() {
  const focusEnd = Date.now() + 25 * 60 * 1000;
  await chrome.storage.local.set({ focusEnd });
  await chrome.alarms.create(FOCUS_ALARM, { when: focusEnd });
}

async function stopFocus() {
  await chrome.alarms.clear(FOCUS_ALARM);
  await chrome.storage.local.remove("focusEnd");
}

async function initialize() {
  chrome.idle.setDetectionInterval(60);
  await chrome.alarms.create(USAGE_ALARM, { periodInMinutes: 1 });
  const { focusEnd } = await chrome.storage.local.get("focusEnd");
  if (focusEnd && focusEnd > Date.now()) {
    await chrome.alarms.create(FOCUS_ALARM, { when: focusEnd });
  } else {
    await stopFocus();
  }
  await setActiveTabFromFocusedWindow();
}

chrome.runtime.onInstalled.addListener(() => enqueue(initialize));
chrome.runtime.onStartup.addListener(() => enqueue(initialize));

chrome.tabs.onActivated.addListener(() => {
  enqueue(setActiveTabFromFocusedWindow);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    enqueue(async () => {
      if (tab.active) await setActiveTabFromFocusedWindow();
    });
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  enqueue(async () => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await flushActiveTab();
      await chrome.storage.local.set({ activeTab: null });
    } else {
      await setActiveTabFromFocusedWindow();
    }
  });
});

chrome.idle.onStateChanged.addListener((state) => {
  enqueue(async () => {
    if (state === "active") {
      await setActiveTabFromFocusedWindow();
    } else {
      await flushActiveTab();
      await chrome.storage.local.set({ activeTab: null });
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  enqueue(async () => {
    if (alarm.name === USAGE_ALARM) {
      await setActiveTabFromFocusedWindow();
    } else if (alarm.name === FOCUS_ALARM) {
      await stopFocus();
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "start-focus" || message.type === "stop-focus") {
    enqueue(async () => {
      if (message.type === "start-focus") {
        await startFocus();
      } else {
        await stopFocus();
      }
      sendResponse({ ok: true });
    });
    return true;
  }
});
