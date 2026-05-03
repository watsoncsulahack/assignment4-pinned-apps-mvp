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

let openMenuEl = null;
let dragEntityKey = null;

function appById(id) {
  return APPS.find(a => a.id === id) || null;
}

function getPins() {
  try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]")); }
  catch { return new Set(); }
}
function savePins(set) { localStorage.setItem(PIN_KEY, JSON.stringify([...set])); }

function getGroups() {
  try {
    const v = JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveGroups(groups) { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }

function getOrder() {
  const fallback = APPS.map(a => a.id);
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
    if (!Array.isArray(raw) || !raw.length) return fallback;
    const known = new Set(fallback);
    const seen = new Set();
    const out = [];
    for (const id of raw) if (known.has(id) && !seen.has(id)) { seen.add(id); out.push(id); }
    for (const id of fallback) if (!seen.has(id)) out.push(id);
    return out;
  } catch { return fallback; }
}
function saveOrder(order) { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }

function findGroupByAppId(groups, appId) {
  return groups.find(g => (g.appIds || []).includes(appId)) || null;
}

function groupPinned(groups, pins, group) {
  if (pins.has(`group:${group.id}`)) return true;
  return (group.appIds || []).some(id => pins.has(id));
}

function buildEntities(order, groups, pins) {
  const out = [];
  const consumed = new Set();

  for (const appId of order) {
    if (consumed.has(appId)) continue;
    const group = findGroupByAppId(groups, appId);
    if (group) {
      for (const id of group.appIds || []) consumed.add(id);
      out.push({ type: "group", id: group.id, group, key: `group:${group.id}` });
    } else {
      consumed.add(appId);
      const app = appById(appId);
      if (app) out.push({ type: "app", id: app.id, app, key: `app:${app.id}` });
    }
  }

  const q = (searchInput?.value || "").trim().toLowerCase();
  const filtered = q
    ? out.filter(e => {
        if (e.type === "app") return e.app.name.toLowerCase().includes(q);
        return e.group.name.toLowerCase().includes(q) || (e.group.appIds || []).some(id => appById(id)?.name.toLowerCase().includes(q));
      })
    : out;

  const pinned = filtered.filter(e => {
    if (e.type === "app") return pins.has(e.app.id);
    return groupPinned(groups, pins, e.group);
  });
  const unpinned = filtered.filter(e => !pinned.includes(e));

  return { pinned, unpinned, qActive: !!q };
}

function closeMenu() {
  if (openMenuEl) openMenuEl.classList.add("hidden");
  openMenuEl = null;
}

function buildFolderPreview(group) {
  const box = document.createElement("div");
  box.className = "folder-preview";
  const members = (group.appIds || []).slice(0, 4).map(appById).filter(Boolean);
  members.forEach(app => {
    const m = document.createElement("div");
    m.className = "mini-icon";
    m.style.background = app.color;
    m.textContent = app.icon;
    box.appendChild(m);
  });
  return box;
}

function createAppMenu(entity, pins, groups, rerender) {
  const app = entity.app;
  const menu = document.createElement("div");
  menu.className = "menu hidden";

  const inGroup = !!findGroupByAppId(groups, app.id);
  const isPinned = pins.has(app.id) || inGroup;

  const pinBtn = document.createElement("button");
  pinBtn.textContent = isPinned ? "Unpin app" : "Pin app";
  pinBtn.onclick = () => {
    const nextPins = getPins();
    if (isPinned) {
      if (inGroup) alert("This app is in a group. Ungroup it before unpinning.");
      else nextPins.delete(app.id);
    } else {
      nextPins.add(app.id);
    }
    savePins(nextPins);
    closeMenu();
    rerender();
  };

  const createGroupBtn = document.createElement("button");
  createGroupBtn.textContent = "Create group";
  createGroupBtn.onclick = () => {
    if (inGroup) {
      alert("App already in a group.");
      return;
    }
    const name = prompt("Group name:", `${app.name} Group`);
    if (!name || !name.trim()) return;
    const groupsNow = getGroups();
    groupsNow.push({ id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name: name.trim(), appIds: [app.id] });
    saveGroups(groupsNow);
    closeMenu();
    rerender();
  };

  const addToGroupBtn = document.createElement("button");
  addToGroupBtn.textContent = "Add to group";
  addToGroupBtn.onclick = () => {
    if (inGroup) {
      alert("App already in a group.");
      return;
    }
    const groupsNow = getGroups();
    if (!groupsNow.length) {
      alert("No groups exist yet. Use Create group first.");
      return;
    }
    const names = groupsNow.map(g => g.name).join(", ");
    const chosen = prompt(`Type group name (${names}):`, groupsNow[0].name);
    if (!chosen) return;
    const g = groupsNow.find(x => x.name.toLowerCase() === chosen.trim().toLowerCase());
    if (!g) {
      alert("Group not found.");
      return;
    }
    g.appIds = Array.from(new Set([...(g.appIds || []), app.id]));
    saveGroups(groupsNow);
    closeMenu();
    rerender();
  };

  const removeGroupBtn = document.createElement("button");
  removeGroupBtn.textContent = "Remove from group";
  removeGroupBtn.onclick = () => {
    let groupsNow = getGroups();
    groupsNow = groupsNow.map(g => ({ ...g, appIds: (g.appIds || []).filter(id => id !== app.id) }));
    groupsNow = groupsNow.filter(g => (g.appIds || []).length > 0);
    saveGroups(groupsNow);
    closeMenu();
    rerender();
  };

  menu.append(pinBtn, createGroupBtn, addToGroupBtn);
  if (inGroup) menu.append(removeGroupBtn);
  return menu;
}

function createGroupMenu(entity, pins, groups, rerender) {
  const group = entity.group;
  const menu = document.createElement("div");
  menu.className = "menu hidden";

  const ungroupBtn = document.createElement("button");
  ungroupBtn.textContent = "Ungroup apps";
  ungroupBtn.onclick = () => {
    const groupsNow = getGroups().filter(g => g.id !== group.id);
    saveGroups(groupsNow);
    closeMenu();
    rerender();
  };

  const pinBtn = document.createElement("button");
  pinBtn.textContent = "Pin group";
  pinBtn.onclick = () => {
    const nextPins = getPins();
    nextPins.add(`group:${group.id}`);
    savePins(nextPins);
    closeMenu();
    rerender();
  };

  const unpinBtn = document.createElement("button");
  unpinBtn.textContent = "Unpin group";
  unpinBtn.onclick = () => {
    alert("Ungroup apps to unpin grouped apps.");
  };

  menu.append(pinBtn, unpinBtn, ungroupBtn);
  return menu;
}

function reorderByEntity(draggedKey, targetKey) {
  if (!draggedKey || !targetKey || draggedKey === targetKey) return;
  const order = getOrder();
  const groups = getGroups();

  const keyToAppIds = (key) => {
    const [type, id] = key.split(":");
    if (type === "app") return [id];
    const g = groups.find(x => x.id === id);
    return g ? [...(g.appIds || [])] : [];
  };

  const draggedIds = keyToAppIds(draggedKey);
  const targetIds = keyToAppIds(targetKey);
  if (!draggedIds.length || !targetIds.length) return;

  const next = order.filter(id => !draggedIds.includes(id));
  const insertAt = next.indexOf(targetIds[0]);
  if (insertAt === -1) return;
  next.splice(insertAt, 0, ...draggedIds);
  saveOrder(next);
}

function makeCard(entity, pins, groups, qActive, rerender) {
  const card = document.createElement("article");
  card.className = "app-card";
  card.dataset.entityKey = entity.key;
  card.draggable = !qActive;

  card.addEventListener("dragstart", (e) => {
    dragEntityKey = entity.key;
    e.dataTransfer.setData("text/plain", entity.key);
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => {
    dragEntityKey = null;
    card.classList.remove("dragging");
  });
  card.addEventListener("dragover", (e) => {
    if (!dragEntityKey || qActive) return;
    e.preventDefault();
    card.classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", (e) => {
    if (!dragEntityKey || qActive) return;
    e.preventDefault();
    card.classList.remove("drag-over");
    const dragged = e.dataTransfer.getData("text/plain") || dragEntityKey;
    reorderByEntity(dragged, entity.key);
    rerender();
  });

  const top = document.createElement("div");
  top.className = "card-top";
  const wrap = document.createElement("div");
  wrap.className = "menu-wrap";
  const btn = document.createElement("button");
  btn.className = "menu-btn";
  btn.textContent = "⋮";

  const menu = entity.type === "app"
    ? createAppMenu(entity, pins, groups, rerender)
    : createGroupMenu(entity, pins, groups, rerender);

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (openMenuEl && openMenuEl !== menu) openMenuEl.classList.add("hidden");
    menu.classList.toggle("hidden");
    openMenuEl = menu.classList.contains("hidden") ? null : menu;
  });

  wrap.append(btn, menu);
  top.appendChild(wrap);
  card.appendChild(top);

  if (entity.type === "app") {
    const icon = document.createElement("div");
    icon.className = "app-icon";
    icon.style.background = entity.app.color;
    icon.textContent = entity.app.icon;
    const name = document.createElement("div");
    name.className = "app-name";
    name.textContent = entity.app.name;
    card.append(icon, name);
  } else {
    const folder = buildFolderPreview(entity.group);
    const name = document.createElement("div");
    name.className = "app-name";
    name.textContent = entity.group.name;
    folder.addEventListener("click", () => {
      const names = (entity.group.appIds || []).map(id => appById(id)?.name).filter(Boolean).join(", ");
      alert(`Folder: ${entity.group.name}\nApps: ${names || "(none)"}`);
    });
    card.append(folder, name);
  }

  return card;
}

function render() {
  closeMenu();
  const pins = getPins();
  const groups = getGroups();
  const order = getOrder();

  const { pinned, unpinned, qActive } = buildEntities(order, groups, pins);

  pinnedGrid.innerHTML = "";
  allAppsGrid.innerHTML = "";

  const rerender = () => render();

  pinned.forEach(e => pinnedGrid.appendChild(makeCard(e, pins, groups, qActive, rerender)));
  unpinned.forEach(e => allAppsGrid.appendChild(makeCard(e, pins, groups, qActive, rerender)));

  pinnedEmpty.style.display = pinned.length ? "none" : "block";
}

searchInput?.addEventListener("input", render);
clearPinsBtn?.addEventListener("click", () => {
  localStorage.removeItem(PIN_KEY);
  render();
});

document.addEventListener("click", () => closeMenu());

render();
