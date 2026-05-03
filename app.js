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
const GROUPS_KEY = "csulb.appGroups";
const ORDER_KEY = "csulb.appOrder";

const allAppsGrid = document.getElementById("allAppsGrid");
const pinnedGrid = document.getElementById("pinnedGrid");
const pinnedEmpty = document.getElementById("pinnedEmpty");
const searchInput = document.getElementById("searchInput");
const clearPinsBtn = document.getElementById("clearPins");
const createGroupBtn = document.getElementById("createGroup");
const groupsList = document.getElementById("groupsList");
const groupsEmpty = document.getElementById("groupsEmpty");

let openMenuEl = null;
let dragAppId = null;

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

function getGroups() {
  try {
    const g = JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");
    return Array.isArray(g) ? g : [];
  } catch {
    return [];
  }
}

function saveGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function defaultOrder() {
  return APPS.map(a => a.id);
}

function getOrder() {
  try {
    const fromLS = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
    if (!Array.isArray(fromLS) || !fromLS.length) return defaultOrder();
    const known = new Set(APPS.map(a => a.id));
    const deduped = [];
    const seen = new Set();
    for (const id of fromLS) {
      if (known.has(id) && !seen.has(id)) {
        deduped.push(id);
        seen.add(id);
      }
    }
    for (const id of defaultOrder()) {
      if (!seen.has(id)) deduped.push(id);
    }
    return deduped;
  } catch {
    return defaultOrder();
  }
}

function saveOrder(order) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
}

function appById(id) {
  return APPS.find(a => a.id === id);
}

function orderedApps() {
  const order = getOrder();
  return order.map(appById).filter(Boolean);
}

function groupedAppIds(groups) {
  const out = new Set();
  groups.forEach(g => (g.appIds || []).forEach(id => out.add(id)));
  return out;
}

function groupsForApp(appId, groups) {
  return groups.filter(g => (g.appIds || []).includes(appId));
}

function closeMenu() {
  if (openMenuEl) openMenuEl.classList.add("hidden");
  openMenuEl = null;
}

function renderGroups(groups) {
  groupsList.innerHTML = "";
  if (!groups.length) {
    groupsEmpty.style.display = "block";
    return;
  }
  groupsEmpty.style.display = "none";

  for (const group of groups) {
    const card = document.createElement("article");
    card.className = "group-card";

    const top = document.createElement("div");
    top.className = "group-top";

    const title = document.createElement("div");
    title.className = "group-name";
    title.textContent = group.name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "link-btn";
    removeBtn.type = "button";
    removeBtn.textContent = "Delete";
    removeBtn.addEventListener("click", () => {
      const next = getGroups().filter(g => g.id !== group.id);
      saveGroups(next);
      render();
    });

    top.appendChild(title);
    top.appendChild(removeBtn);

    const chips = document.createElement("div");
    chips.className = "chips";
    const members = (group.appIds || []).map(appById).filter(Boolean);
    members.forEach(app => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = app.name;
      chips.appendChild(chip);
    });

    if (!members.length) {
      const empty = document.createElement("span");
      empty.className = "chip";
      empty.textContent = "(empty group)";
      chips.appendChild(empty);
    }

    card.appendChild(top);
    card.appendChild(chips);
    groupsList.appendChild(card);
  }
}

function createMenu(app, pins, groups, rerender) {
  const menu = document.createElement("div");
  menu.className = "menu hidden";

  const appGroups = groupsForApp(app.id, groups);
  const inGroup = appGroups.length > 0;
  const isPinned = pins.has(app.id) || inGroup;

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.textContent = isPinned ? "Unpin app" : "Pin app";
  pinBtn.addEventListener("click", () => {
    const nextPins = getPins();
    if (isPinned) {
      if (inGroup) {
        alert("This app is pinned through a group. Ungroup it to unpin.");
      } else {
        nextPins.delete(app.id);
        savePins(nextPins);
      }
    } else {
      nextPins.add(app.id);
      savePins(nextPins);
    }
    closeMenu();
    rerender();
  });

  const addToGroupBtn = document.createElement("button");
  addToGroupBtn.type = "button";
  addToGroupBtn.textContent = "Add to group";
  addToGroupBtn.addEventListener("click", () => {
    let groupsNow = getGroups();
    const names = groupsNow.map(g => g.name).join(", ");
    const input = prompt(
      names ? `Enter group name (${names}) or a new group name:` : "Enter new group name:",
      groupsNow[0]?.name || ""
    );
    if (!input) return;
    const name = input.trim();
    if (!name) return;

    let group = groupsNow.find(g => g.name.toLowerCase() === name.toLowerCase());
    if (!group) {
      group = { id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, appIds: [] };
      groupsNow.push(group);
    }
    group.appIds = Array.from(new Set([...(group.appIds || []), app.id]));
    saveGroups(groupsNow);
    closeMenu();
    rerender();
  });

  const removeFromGroupsBtn = document.createElement("button");
  removeFromGroupsBtn.type = "button";
  removeFromGroupsBtn.textContent = "Remove from group(s)";
  removeFromGroupsBtn.addEventListener("click", () => {
    let groupsNow = getGroups();
    groupsNow = groupsNow.map(g => ({ ...g, appIds: (g.appIds || []).filter(id => id !== app.id) }));
    saveGroups(groupsNow);
    closeMenu();
    rerender();
  });

  menu.appendChild(pinBtn);
  menu.appendChild(addToGroupBtn);
  if (inGroup) menu.appendChild(removeFromGroupsBtn);
  return menu;
}

function moveBefore(order, draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return order;
  const next = [...order];
  const from = next.indexOf(draggedId);
  const to = next.indexOf(targetId);
  if (from === -1 || to === -1) return order;
  next.splice(from, 1);
  const adjustedTo = from < to ? to - 1 : to;
  next.splice(adjustedTo, 0, draggedId);
  return next;
}

function makeCard(app, pins, groups, q, rerender) {
  const card = document.createElement("article");
  card.className = "app-card";

  // Disable drag when searching to avoid confusing reorder behavior
  card.draggable = !q;
  card.dataset.appId = app.id;

  card.addEventListener("dragstart", () => {
    dragAppId = app.id;
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    dragAppId = null;
    card.classList.remove("dragging");
  });
  card.addEventListener("dragover", (e) => {
    if (!dragAppId || q) return;
    e.preventDefault();
    card.classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", (e) => {
    if (!dragAppId || q) return;
    e.preventDefault();
    card.classList.remove("drag-over");
    const next = moveBefore(getOrder(), dragAppId, app.id);
    saveOrder(next);
    rerender();
  });

  const top = document.createElement("div");
  top.className = "card-top";

  const menuWrap = document.createElement("div");
  menuWrap.className = "menu-wrap";

  const menuBtn = document.createElement("button");
  menuBtn.className = "menu-btn";
  menuBtn.type = "button";
  menuBtn.title = "App actions";
  menuBtn.textContent = "⋮";

  const menu = createMenu(app, pins, groups, rerender);
  menuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (openMenuEl && openMenuEl !== menu) openMenuEl.classList.add("hidden");
    menu.classList.toggle("hidden");
    openMenuEl = menu.classList.contains("hidden") ? null : menu;
  });

  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);
  top.appendChild(menuWrap);

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
  const pinsManual = getPins();
  const groups = getGroups();
  const grouped = groupedAppIds(groups);
  const q = (searchInput?.value || "").trim().toLowerCase();

  const all = orderedApps();
  const filtered = q ? all.filter(a => a.name.toLowerCase().includes(q)) : all;

  const isPinned = (id) => pinsManual.has(id) || grouped.has(id);
  const pinnedApps = filtered.filter(a => isPinned(a.id));
  const others = filtered.filter(a => !isPinned(a.id));

  renderGroups(groups);

  pinnedGrid.innerHTML = "";
  allAppsGrid.innerHTML = "";

  const rerender = () => render();

  pinnedApps.forEach(app => pinnedGrid.appendChild(makeCard(app, pinsManual, groups, q, rerender)));
  others.forEach(app => allAppsGrid.appendChild(makeCard(app, pinsManual, groups, q, rerender)));

  pinnedEmpty.style.display = pinnedApps.length ? "none" : "block";
}

searchInput?.addEventListener("input", render);
clearPinsBtn?.addEventListener("click", () => {
  // keep group-pinned apps in place as requested
  localStorage.removeItem(PIN_KEY);
  render();
});

createGroupBtn?.addEventListener("click", () => {
  const name = prompt("Enter new group name:", "");
  if (!name || !name.trim()) return;
  const groups = getGroups();
  if (groups.some(g => g.name.toLowerCase() === name.trim().toLowerCase())) {
    alert("Group name already exists.");
    return;
  }
  groups.push({ id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), appIds: [] });
  saveGroups(groups);
  render();
});

document.addEventListener("click", () => closeMenu());

render();
