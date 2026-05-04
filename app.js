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

const toastEl = document.getElementById("toast");
const folderPopoverEl = document.getElementById("folderPopover");
const folderPopoverTitleEl = document.getElementById("folderPopoverTitle");
const folderPopoverAppsEl = document.getElementById("folderPopoverApps");
const folderPopoverCloseBtn = document.getElementById("folderPopoverClose");

let openMenuEl = null;
let dragEntityKey = null;
let pendingGroupFlashKey = null;
let domPreviewDirty = false;
let openFolderGroupId = null;
let openFolderAnchorKey = null;
let toastTimer = null;

const touchState = {
  active: false,
  pressTimer: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  draggedKey: null,
  lastTargetKey: null,
  lastIntent: null,
  ghostEl: null
};

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

function showToast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1300);
}

function closeFolderPopover() {
  openFolderGroupId = null;
  openFolderAnchorKey = null;
  folderPopoverEl?.classList.add("hidden");
}

function positionFolderPopover() {
  if (!folderPopoverEl || !openFolderAnchorKey) return;
  const anchor = findCardByKey(openFolderAnchorKey)?.querySelector(".folder-preview");
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const popW = Math.min(360, window.innerWidth - 24);
  const popH = Math.min(360, window.innerHeight - 24);

  let left = rect.left + (rect.width / 2) - (popW / 2);
  let top = rect.bottom + 10;

  if (left < 12) left = 12;
  if (left + popW > window.innerWidth - 12) left = window.innerWidth - 12 - popW;
  if (top + popH > window.innerHeight - 12) {
    top = rect.top - popH - 10;
    if (top < 12) top = 12;
  }

  folderPopoverEl.style.left = `${Math.round(left)}px`;
  folderPopoverEl.style.top = `${Math.round(top)}px`;
}

function renderFolderPopover() {
  if (!folderPopoverEl || !folderPopoverTitleEl || !folderPopoverAppsEl) return;
  if (!openFolderGroupId) {
    folderPopoverEl.classList.add("hidden");
    return;
  }

  const group = getGroups().find(g => g.id === openFolderGroupId);
  if (!group) {
    closeFolderPopover();
    return;
  }

  folderPopoverTitleEl.textContent = group.name;
  folderPopoverAppsEl.innerHTML = "";
  (group.appIds || []).map(appById).filter(Boolean).forEach(app => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "folder-app-btn";
    btn.textContent = app.name;
    btn.addEventListener("click", () => showToast(`Opening ${app.name}`));
    folderPopoverAppsEl.appendChild(btn);
  });

  folderPopoverEl.classList.remove("hidden");
  positionFolderPopover();
}

function toggleFolderPopover(groupId, anchorKey) {
  if (openFolderGroupId === groupId) {
    closeFolderPopover();
    return;
  }
  openFolderGroupId = groupId;
  openFolderAnchorKey = anchorKey;
  renderFolderPopover();
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
  document.querySelectorAll(".app-card").forEach(c => c.classList.remove("drop-group", "drop-reorder"));
}

function findCardByKey(key) {
  return [...document.querySelectorAll(".app-card")].find(c => c.dataset.entityKey === key) || null;
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
    const prev = prevRects.get(card.dataset.entityKey);
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

function previewReorderInDOM(draggedKey, targetKey, placement) {
  const draggedCard = findCardByKey(draggedKey);
  const targetCard = findCardByKey(targetKey);
  if (!draggedCard || !targetCard || draggedCard === targetCard) return false;

  const parent = draggedCard.parentElement;
  if (!parent || parent !== targetCard.parentElement) return false;

  if (placement === "before" && draggedCard.nextElementSibling === targetCard) return false;
  if (placement === "after" && targetCard.nextElementSibling === draggedCard) return false;

  const prevRects = captureCardRects();
  if (placement === "after") parent.insertBefore(draggedCard, targetCard.nextSibling);
  else parent.insertBefore(draggedCard, targetCard);
  animateReflow(prevRects);
  return true;
}

function persistOrderFromDOM() {
  const groups = getGroups();
  const seen = new Set();
  const next = [];
  const cards = [...pinnedGrid.children, ...allAppsGrid.children];

  cards.forEach(card => {
    const key = card.dataset.entityKey;
    if (!key) return;
    keyToAppIds(key, groups).forEach(id => {
      if (!seen.has(id)) {
        seen.add(id);
        next.push(id);
      }
    });
  });

  getOrder().forEach(id => { if (!seen.has(id)) next.push(id); });
  saveOrder(next);
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
  groups.push({ id: groupId, name: nextGroupName(groups), appIds: [targetAppId, draggedAppId] });
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
  nextOrder.splice(lastIndex >= 0 ? lastIndex + 1 : nextOrder.length, 0, draggedAppId);
  saveOrder(nextOrder);

  g.appIds = [...(g.appIds || []), draggedAppId];
  saveGroups(groups);
  pendingGroupFlashKey = `group:${g.id}`;
}

function ungroupById(groupId) {
  const groups = getGroups().filter(g => g.id !== groupId);
  saveGroups(groups);
  if (openFolderGroupId === groupId) closeFolderPopover();
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

function executeDropAction(draggedKey, targetEntity, intent, rerender) {
  const groupsNow = getGroups();
  const draggedEntity = getEntityFromKey(draggedKey, groupsNow);
  if (!draggedEntity) return;

  clearDropClasses();

  if (intent === "group" && draggedEntity.type === "app") {
    if (targetEntity.type === "app") {
      persistOrderFromDOM();
      createGroupFromPair(targetEntity.app.id, draggedEntity.app.id);
      domPreviewDirty = false;
      rerender();
      return;
    }

    if (targetEntity.type === "group") {
      persistOrderFromDOM();
      addAppToExistingGroup(draggedEntity.app.id, targetEntity.group.id);
      domPreviewDirty = false;
      rerender();
      return;
    }
  }

  if (domPreviewDirty) persistOrderFromDOM();
  else reorderByEntity(draggedKey, targetEntity.key, intent === "after" ? "after" : "before");
  domPreviewDirty = false;
  rerender();
}

function removeTouchGhost() {
  if (touchState.ghostEl?.parentNode) touchState.ghostEl.parentNode.removeChild(touchState.ghostEl);
  touchState.ghostEl = null;
}

function moveTouchGhost(x, y) {
  if (!touchState.ghostEl) return;
  touchState.ghostEl.style.left = `${Math.round(x)}px`;
  touchState.ghostEl.style.top = `${Math.round(y)}px`;
}

function createTouchGhost(entity) {
  removeTouchGhost();
  const ghost = document.createElement("div");
  ghost.className = "touch-ghost";
  ghost.textContent = entity.type === "app" ? entity.app.name : entity.group.name;
  document.body.appendChild(ghost);
  touchState.ghostEl = ghost;
  moveTouchGhost(touchState.currentX || touchState.startX, touchState.currentY || touchState.startY);
}

function clearTouchState() {
  if (touchState.pressTimer) clearTimeout(touchState.pressTimer);
  removeTouchGhost();
  touchState.pressTimer = null;
  touchState.active = false;
  touchState.currentX = 0;
  touchState.currentY = 0;
  touchState.draggedKey = null;
  touchState.lastTargetKey = null;
  touchState.lastIntent = null;
}

function makeCard(entity, pins, groups, qActive, rerender) {
  const card = document.createElement("article");
  card.className = "app-card";
  card.dataset.entityKey = entity.key;
  card.draggable = !qActive;

  card.addEventListener("dragstart", (e) => {
    dragEntityKey = entity.key;
    domPreviewDirty = false;
    closeFolderPopover();
    e.dataTransfer.setData("text/plain", entity.key);
    closeMenu();
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    if (domPreviewDirty) {
      persistOrderFromDOM();
      domPreviewDirty = false;
      rerender();
    }
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
    if (intent === "group") {
      card.classList.add("drop-group");
      return;
    }

    card.classList.add("drop-reorder");

    if ((intent === "before" || intent === "after") && previewReorderInDOM(dragEntityKey, entity.key, intent)) {
      domPreviewDirty = true;
    }
  });

  card.addEventListener("dragleave", () => card.classList.remove("drop-group", "drop-reorder"));

  card.addEventListener("drop", (e) => {
    if (!dragEntityKey || qActive || dragEntityKey === entity.key) return;
    e.preventDefault();
    const draggedEntity = getEntityFromKey(dragEntityKey, getGroups());
    if (!draggedEntity) return;
    const intent = computeDropIntent(entity, draggedEntity, e);
    executeDropAction(dragEntityKey, entity, intent, rerender);
  });

  // Mobile touch-and-hold drag
  card.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || qActive) return;
    if (e.target.closest(".menu-wrap") || e.target.closest(".ungroup-btn")) return;

    touchState.startX = e.clientX;
    touchState.startY = e.clientY;
    touchState.currentX = e.clientX;
    touchState.currentY = e.clientY;
    touchState.draggedKey = entity.key;

    touchState.pressTimer = setTimeout(() => {
      touchState.active = true;
      dragEntityKey = entity.key;
      domPreviewDirty = false;
      closeFolderPopover();
      closeMenu();
      const draggedCard = findCardByKey(entity.key);
      if (draggedCard) draggedCard.classList.add("touch-dragging");
      createTouchGhost(entity);
    }, 230);
  });

  card.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "touch") return;

    touchState.currentX = e.clientX;
    touchState.currentY = e.clientY;

    if (!touchState.active) {
      const dx = Math.abs(e.clientX - touchState.startX);
      const dy = Math.abs(e.clientY - touchState.startY);
      if (dx > 10 || dy > 10) clearTouchState();
      return;
    }

    e.preventDefault();
    moveTouchGhost(e.clientX, e.clientY);

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetCard = el?.closest(".app-card");
    if (!targetCard) {
      clearDropClasses();
      touchState.lastTargetKey = null;
      touchState.lastIntent = null;
      return;
    }

    const targetKey = targetCard.dataset.entityKey;
    if (!targetKey || targetKey === touchState.draggedKey) return;

    const groupsNow = getGroups();
    const targetEntity = getEntityFromKey(targetKey, groupsNow);
    const draggedEntity = getEntityFromKey(touchState.draggedKey, groupsNow);
    if (!targetEntity || !draggedEntity) return;

    const intent = computeDropIntent(targetEntity, draggedEntity, { currentTarget: targetCard, clientX: e.clientX });
    touchState.lastTargetKey = targetKey;
    touchState.lastIntent = intent;

    clearDropClasses();
    if (intent === "group") {
      targetCard.classList.add("drop-group");
      return;
    }

    targetCard.classList.add("drop-reorder");

    if ((intent === "before" || intent === "after") && previewReorderInDOM(touchState.draggedKey, targetKey, intent)) {
      domPreviewDirty = true;
    }
  }, { passive: false });

  const finishTouchDrag = () => {
    if (!touchState.active) {
      clearTouchState();
      return;
    }

    const draggedCard = findCardByKey(touchState.draggedKey);
    if (draggedCard) draggedCard.classList.remove("touch-dragging");

    if (touchState.lastTargetKey) {
      const targetEntity = getEntityFromKey(touchState.lastTargetKey, getGroups());
      if (targetEntity) executeDropAction(touchState.draggedKey, targetEntity, touchState.lastIntent || "before", rerender);
      else if (domPreviewDirty) {
        persistOrderFromDOM();
        domPreviewDirty = false;
        rerender();
      }
    } else if (domPreviewDirty) {
      persistOrderFromDOM();
      domPreviewDirty = false;
      rerender();
    }

    dragEntityKey = null;
    clearDropClasses();
    clearTouchState();
  };

  card.addEventListener("pointerup", finishTouchDrag);
  card.addEventListener("pointercancel", finishTouchDrag);

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
      toggleFolderPopover(entity.group.id, entity.key);
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
  renderFolderPopover();

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

folderPopoverCloseBtn?.addEventListener("click", closeFolderPopover);

document.addEventListener("pointerdown", (e) => {
  if (!openFolderGroupId) return;
  const t = e.target;
  if (folderPopoverEl?.contains(t)) return;
  if (t?.closest?.(".folder-preview")) return;
  closeFolderPopover();
});

window.addEventListener("resize", positionFolderPopover);
window.addEventListener("scroll", positionFolderPopover, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeFolderPopover();
});

document.addEventListener("click", () => closeMenu());

render();
