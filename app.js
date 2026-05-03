const APPS = [
  { id: "outlook", name: "Outlook", icon: "O", color: "#2563eb" },
  { id: "onedrive", name: "OneDrive", icon: "D", color: "#0ea5e9" },
  { id: "powerpoint", name: "PowerPoint", icon: "P", color: "#f97316" },
  { id: "zoom", name: "Zoom", icon: "Z", color: "#3b82f6" },
  { id: "teams", name: "Teams", icon: "T", color: "#6366f1" },
  { id: "library", name: "University Library", icon: "L", color: "#111827" },
  { id: "chatgpt", name: "ChatGPT Edu", icon: "AI", color: "#10b981" },
  { id: "beachnexus", name: "BeachNexus", icon: "BN", color: "#0f172a" },
  { id: "events", name: "Events & Orgs", icon: "E", color: "#ca8a04" },
  { id: "canvas", name: "Canvas", icon: "C", color: "#f59e0b" },
  { id: "studentcenter", name: "MyCSULB Student Center", icon: "SC", color: "#111827" },
  { id: "careerlink", name: "CareerLink", icon: "CL", color: "#111827" },
  { id: "calendar", name: "Calendar", icon: "Cal", color: "#0284c7" },
  { id: "copilot", name: "Copilot", icon: "Co", color: "#22c55e" }
];

const PIN_KEY = "csulb.pinnedApps";

const allAppsGrid = document.getElementById("allAppsGrid");
const pinnedGrid = document.getElementById("pinnedGrid");
const pinnedEmpty = document.getElementById("pinnedEmpty");
const searchInput = document.getElementById("searchInput");
const clearPins = document.getElementById("clearPins");

function getPins() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function savePins(set) {
  localStorage.setItem(PIN_KEY, JSON.stringify([...set]));
}

function appCard(app, pinnedSet) {
  const card = document.createElement("article");
  card.className = "app-card";

  const top = document.createElement("div");
  top.className = "card-top";

  const pin = document.createElement("button");
  pin.className = "pin-btn" + (pinnedSet.has(app.id) ? " pinned" : "");
  pin.type = "button";
  pin.title = pinnedSet.has(app.id) ? "Unpin app" : "Pin app";
  pin.textContent = "📌";
  pin.addEventListener("click", () => {
    const next = getPins();
    if (next.has(app.id)) next.delete(app.id);
    else next.add(app.id);
    savePins(next);
    render();
  });

  top.appendChild(pin);

  const icon = document.createElement("div");
  icon.className = "app-icon";
  icon.style.background = app.color;
  icon.textContent = app.icon;

  const name = document.createElement("div");
  name.className = "app-name";
  name.textContent = app.name;

  card.appendChild(top);
  card.appendChild(icon);
  card.appendChild(name);
  return card;
}

function render() {
  const pins = getPins();
  const q = (searchInput?.value || "").trim().toLowerCase();
  const filtered = APPS.filter(a => a.name.toLowerCase().includes(q));

  pinnedGrid.innerHTML = "";
  allAppsGrid.innerHTML = "";

  const pinnedApps = filtered.filter(a => pins.has(a.id));
  const others = filtered.filter(a => !pins.has(a.id));

  pinnedApps.forEach(app => pinnedGrid.appendChild(appCard(app, pins)));
  others.forEach(app => allAppsGrid.appendChild(appCard(app, pins)));

  pinnedEmpty.style.display = pinnedApps.length ? "none" : "block";
}

searchInput?.addEventListener("input", render);
clearPins?.addEventListener("click", () => {
  localStorage.removeItem(PIN_KEY);
  render();
});

render();
