const timer = document.querySelector("#timer");
const status = document.querySelector("#focus-status");
const focusButton = document.querySelector("#focus-button");
const totalTime = document.querySelector("#total-time");
const siteList = document.querySelector("#site-list");
const emptyState = document.querySelector("#empty-state");

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder >= 30 ? `${minutes + 1} min` : `${minutes} min`;
}

function renderTimer(focusEnd) {
  const remaining = focusEnd ? Math.max(0, focusEnd - Date.now()) : 25 * 60 * 1000;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  status.textContent = focusEnd
    ? "One step at a time. You’ve got this."
    : "Take 25 minutes to focus on what matters.";
  focusButton.textContent = focusEnd ? "End focus session" : "Start focus session";
  focusButton.setAttribute("aria-label", focusEnd ? "End focus session" : "Start 25-minute focus session");
}

function currentDayElapsed(activeTab, now) {
  if (!activeTab?.domain) return 0;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return Math.max(0, now - Math.max(activeTab.since, todayStart.getTime()));
}

function renderActivity(dailyUsage = {}, activeTab) {
  const today = todayKey();
  const sites = { ...(dailyUsage[today] || {}) };
  const now = Date.now();
  const elapsedToday = currentDayElapsed(activeTab, now);
  if (activeTab?.domain && elapsedToday) {
    sites[activeTab.domain] = (sites[activeTab.domain] || 0) + elapsedToday;
  }

  const rankedSites = Object.entries(sites)
    .filter(([, time]) => Number.isFinite(time) && time > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const total = Object.values(sites).reduce(
    (sum, time) => sum + (Number.isFinite(time) && time > 0 ? time : 0),
    0,
  );

  totalTime.textContent = total ? formatDuration(total) : "0 min";
  siteList.replaceChildren();
  emptyState.hidden = rankedSites.length > 0;

  for (const [domain, time] of rankedSites) {
    const row = document.createElement("li");
    row.className = "site-row";
    const name = document.createElement("span");
    name.className = "site-name";
    name.textContent = domain;
    const duration = document.createElement("span");
    duration.className = "site-time";
    duration.textContent = formatDuration(time);
    row.append(name, duration);
    siteList.append(row);
  }
}

async function refresh() {
  const { focusEnd, dailyUsage, activeTab } = await chrome.storage.local.get([
    "focusEnd",
    "dailyUsage",
    "activeTab",
  ]);
  renderTimer(focusEnd);
  renderActivity(dailyUsage, activeTab);
}

focusButton.addEventListener("click", async () => {
  const { focusEnd } = await chrome.storage.local.get("focusEnd");
  await chrome.runtime.sendMessage({ type: focusEnd ? "stop-focus" : "start-focus" });
  await refresh();
});

chrome.storage.onChanged.addListener(refresh);
refresh();
setInterval(refresh, 1000);
