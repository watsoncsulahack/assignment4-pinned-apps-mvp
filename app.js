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
let pendingGroupFlashKey = null;

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
  } catch {
    return [];
  }
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
    for (const id of raw) {
      if (known.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    for (const id of fallback) if (!seen.has(id)) out.push(id);
    return out;
  } catch {
    return fallback;
  }
}
function saveOrder(order) { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }

function findGroupByAppId(groups, appId) {
  return groups.find(g => (g.appIds || []).includes(appId)) || null;
}

function groupPinned(groups, pins, group) {
  if (pins.has(`group:${group.id}`)) return true;
  return (group.appIds || []).some(id => pins.has(id));
}

function getEntityFromKey(key, groups) {
  const [type, id] = (key || "").split(":");
  if (type === "app") {
    const app = appById(id);
    return app ? { type: "app", key, app } : null;
  }
  if (type === "group") {
    const group = groups.find(g => g.id === id);
    return group ? { type: "group", key, group } : null;
  }
  return null;
}

function keyToAppIds(key, groups) {
  const entity = getEntityFromKey(key, groups);
  if (!entity) return [];
  if (entity.type === "app") return [entity.app.id];
  return [...(entity.group.appIds || [])];
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
      return e.group.name.toLowerCase().includes(q)
        || (e.group.appIds || []).some(id => appById(id)?.name.toLowerCase().includes(q));
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
      if (inGroup) {
        alert("This app is in a group. Ungroup it before unpinning.");
      } else {
        nextPins.delete(app.id);
      }
    } else {
      nextPins.add(app.id);
    }
    savePins(nextPins);
    closeMenu();
    rerender();
  };

  menu.append(pinBtn);
  return menu;
}

function createGroupMenu(entity, pins, groups, rerender) {
  const group = entity.group;
  const menu = document.createElement("div");
  menu.className = "menu hidden";

  const pinned = groupPinned(groups, pins, group);
  const pinBtn = document.createElement("button");
  pinBtn.textContent = pinned ? "Unpin group" : "Pin group";
  pinBtn.onclick = () => {
    if (pinned) {
      alert("Ungroup apps before unpinning grouped apps.");
      return;
    }
    const nextPins = getPins();
    nextPins.add(`group:${group.id}`);
    savePins(nextPins);
    closeMenu();
    rerender();
  };

  menu.append(pinBtn);
  return menu;
}

function clearDropClasses() {
  document.querySelectorAll(".app-card").forEach(c => {
    c.classList.remove("drop-before", "drop-after", "drop-group");
  });
}

function reorderByEntity(draggedKey, targetKey, placement = "before") {
  if (!draggedKey || !targetKey || draggedKey === targetKey) return;

  const order = getOrder();
  const groups = getGroups();

  const draggedIds = keyToAppIds(draggedKey, groups);
  const targetIds = keyToAppIds(targetKey, groups);
  if (!draggedIds.length || !targetIds.length) return;

  const next = order.filter(id => !draggedIds.includes(id));
  const targetStart = next.indexOf(targetIds[0]);
  if (targetStart === -1) return;

  let insertAt = targetStart;
  if (placement === "after") {
    const targetSet = new Set(targetIds);
    let targetEnd = targetStart;
    while (targetEnd + 1 < next.length && targetSet.has(next[targetEnd + 1])) targetEnd++;
    insertAt = targetEnd + 1;
  }

  next.splice(insertAt, 0, ...draggedIds);
  saveOrder(next);
}

function nextGroupName(groups) {
  let n = 1;
  const names = new Set(groups.map(g => g.name.toLowerCase()));
  while (names.has(`group ${n}`)) n++;
  return `Group ${n}`;
}

function createGroupFromPair(targetAppId, draggedAppId) {
  const groups = getGroups();
  if (findGroupByAppId(groups, targetAppId) || findGroupByAppId(groups, draggedAppId)) return;

  const groupId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  groups.push({
    id: groupId,
    name: nextGroupName(groups),
    appIds: [targetAppId, draggedAppId]
  });
  saveGroups(groups);
  pendingGroupFlashKey = `group:${groupId}`;
}

function addAppToExistingGroup(draggedAppId, targetGroupId) {
  const groups = getGroups();
  if (findGroupByAppId(groups, draggedAppId)) return;
  const g = groups.find(x => x.id === targetGroupId);
  if (!g) return;

  const order = getOrder();
  const nextOrder = order.filter(id => id !== draggedAppId);
  let lastIndex = -1;
  for (const id of g.appIds || []) {
    const i = nextOrder.indexOf(id);
    if (i > lastIndex) lastIndex = i;
  }
  const insertAt = lastIndex >= 0 ? lastIndex + 1 : nextOrder.length;
  nextOrder.splice(insertAt, 0, draggedAppId);
  saveOrder(nextOrder);

  g.appIds = [...(g.appIds || []), draggedAppId];
  saveGroups(groups);
  pendingGroupFlashKey = `group:${g.id}`;
}

function ungroupById(groupId) {
  const groups = getGroups().filter(g => g.id !== groupId);
  saveGroups(groups);
}

function captureCardRects() {
  const map = new Map();
  document.querySelectorAll(".app-card").forEach(card => {
    const key = card.dataset.entityKey;
    if (key) map.set(key, card.getBoundingClientRect());
  });
  return map;
}

function animateReflow(prevRects) {
  const cards = [...document.querySelectorAll(".app-card")];
  cards.forEach(card => {
    const key = card.dataset.entityKey;
    const prev = prevRects.get(key);
    if (!prev) return;
    const now = card.getBoundingClientRect();
    const dx = prev.left - now.left;
    const dy = prev.top - now.top;
    if (!dx && !dy) return;
    card.style.transition = "none";
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      card.style.transition = "transform 220ms ease";
      card.style.transform = "";
    });
  });
}

function computeDropIntent(targetEntity, draggedEntity, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;

  if (draggedEntity?.type === "app") {
    if (x < 0.15) return "before";
    if (x > 0.85) return "after";
    if (targetEntity.type === "app" || targetEntity.type === "group") return "group";
  }

  return x < 0.5 ? "before" : "after";
}

function makeCard(entity, pins, groups, qActive, rerender) {
  const card = document.createElement("article");
  card.className = "app-card";
  card.dataset.entityKey = entity.key;
  card.draggable = !qActive;

  card.addEventListener("dragstart", (e) => {
    dragEntityKey = entity.key;
    e.dataTransfer.setData("text/plain", entity.key);
    closeMenu();
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    dragEntityKey = null;
    clearDropClasses();
    card.classList.remove("dragging");
  });

  card.addEventListener("dragover", (e) => {
    if (!dragEntityKey || qActive || dragEntityKey === entity.key) return;
    const draggedEntity = getEntityFromKey(dragEntityKey, getGroups());
    const intent = computeDropIntent(entity, draggedEntity, e);
    e.preventDefault();
    clearDropClasses();
    if (intent === "before") card.classList.add("drop-before");
    else if (intent === "after") card.classList.add("drop-after");
    else if (intent === "group") card.classList.add("drop-group");
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drop-before", "drop-after", "drop-group");
  });

  card.addEventListener("drop", (e) => {
    if (!dragEntityKey || qActive || dragEntityKey === entity.key) return;
    e.preventDefault();

    const groupsNow = getGroups();
    const draggedEntity = getEntityFromKey(dragEntityKey, groupsNow);
    if (!draggedEntity) return;

    const intent = computeDropIntent(entity, draggedEntity, e);
    clearDropClasses();

    if (intent === "group" && draggedEntity.type === "app") {
      if (entity.type === "app") {
        const ok = confirm(`Create group with ${draggedEntity.app.name} and ${entity.app.name}?`);
        if (ok) {
          reorderByEntity(dragEntityKey, entity.key, "after");
          createGroupFromPair(entity.app.id, draggedEntity.app.id);
          rerender();
        }
        return;
      }

      if (entity.type === "group") {
        addAppToExistingGroup(draggedEntity.app.id, entity.group.id);
        rerender();
        return;
      }
    }

    reorderByEntity(dragEntityKey, entity.key, intent === "after" ? "after" : "before");
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

    const ungroupBtn = document.createElement("button");
    ungroupBtn.className = "ungroup-btn";
    ungroupBtn.type = "button";
    ungroupBtn.textContent = "Ungroup";
    ungroupBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ungroupById(entity.group.id);
      rerender();
    });

    folder.addEventListener("click", () => {
      const names = (entity.group.appIds || []).map(id => appById(id)?.name).filter(Boolean).join(", ");
      alert(`Folder: ${entity.group.name}\nApps: ${names || "(none)"}`);
    });

    card.append(folder, name, ungroupBtn);
  }

  return card;
}

function render() {
  closeMenu();
  const prevRects = captureCardRects();

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

  requestAnimationFrame(() => {
    animateReflow(prevRects);
    if (pendingGroupFlashKey) {
      const target = [...document.querySelectorAll(".app-card")]
        .find(c => c.dataset.entityKey === pendingGroupFlashKey);
      if (target) {
        target.classList.add("group-created");
        setTimeout(() => target.classList.remove("group-created"), 500);
      }
      pendingGroupFlashKey = null;
    }
  });
}

searchInput?.addEventListener("input", render);
clearPinsBtn?.addEventListener("click", () => {
  localStorage.removeItem(PIN_KEY);
  render();
});

document.addEventListener("click", () => closeMenu());

render();
