import { store, initStore, newId } from "./store.js";
import {
  CATEGORIES, LOCATIONS, CUISINES, categoryById, cuisineEmoji, guessEmoji, guessCategory,
  guessMode, guessLocation, makeMatcher, isOptional, coreTokens,
} from "./foods.js";
import { scanReceipt, importRecipe, resizeImage, getApiKey, setApiKey } from "./ai.js";

// ---------- helpers ----------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sameName = (a, b) => coreTokens(a).join(" ") === coreTokens(b).join(" ");
const today = () => new Date(new Date().toDateString());
const daysUntil = (iso) => Math.round((new Date(iso + "T00:00") - today()) / 86400000);
const isoPlus = (days) => { const d = today(); d.setDate(d.getDate() + days); return d.toLocaleDateString("en-CA"); };
const byName = (a, b) => a.name.localeCompare(b.name);
const save = (p) => p.catch((e) => showToast(`Couldn't save: ${e.message}`)); // writes never block the UI

const prefs = (() => { try { return JSON.parse(localStorage.getItem("kitchen-prefs")) || {}; } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem("kitchen-prefs", JSON.stringify(prefs)); } catch {} };

const ui = { tab: prefs.tab || "fridge", loc: "all", filter: null, search: "", cuisine: "All" };

// Level steps for "amount left" items (milk, rice…), as percent.
const LEVELS = [0, 10, 25, 50, 75, 100];
const LEVEL_LABEL = { 0: "Empty", 10: "Almost out", 25: "¼ left", 50: "Half", 75: "¾ left", 100: "Full" };
const levelColor = (l) => (l <= 25 ? "var(--bad)" : l <= 50 ? "var(--warn)" : "var(--good)");
const isLow = (it) => (it.mode === "level" ? it.level <= 25 : (it.qty ?? 1) <= 1);
const isExpiring = (it) => it.expires && daysUntil(it.expires) <= 3;

// ---------- toast ----------

let toastTimer;
function showToast(msg, actions = [], ms = 5000) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>${actions.map((a, i) => `<button data-i="${i}">${esc(a.label)}</button>`).join("")}`;
  t.hidden = false;
  $$("button", t).forEach((b) => (b.onclick = () => { t.hidden = true; actions[b.dataset.i].fn(); }));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

// ---------- bottom sheet ----------

function openSheet(html, onMount) {
  const sheet = $("#sheet");
  sheet.innerHTML = `<div class="sheet-grip"></div>${html}`;
  sheet.hidden = false;
  $("#sheetBackdrop").hidden = false;
  document.body.classList.add("sheet-open");
  sheet.scrollTop = 0;
  $$("[data-close]", sheet).forEach((b) => (b.onclick = closeSheet));
  onMount?.(sheet);
}
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheetBackdrop").hidden = true;
  document.body.classList.remove("sheet-open");
  $("#sheet").innerHTML = "";
}
$("#sheetBackdrop").onclick = closeSheet;

const segmented = (name, options, value) => `
  <div class="segmented" data-seg="${name}">
    ${options.map(([v, label]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(value) ? "on" : ""}">${label}</button>`).join("")}
  </div>`;
function bindSegmented(root, name, onChange) {
  const seg = $(`[data-seg="${name}"]`, root);
  seg.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("button", seg).forEach((x) => x.classList.toggle("on", x === b));
    onChange(b.dataset.v);
  };
  return () => $("button.on", seg)?.dataset.v;
}
const categoryOptions = (sel) => CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${c.emoji} ${c.label}</option>`).join("");

// ---------- rendering ----------

const TITLES = { fridge: "Fridge & Pantry", groceries: "Groceries", recipes: "Recipes" };

function render() {
  const view = $("#view");
  const needsAuth = store.mode === "cloud" && store.ready && !store.user;
  document.body.classList.toggle("auth-mode", needsAuth);
  $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === ui.tab));
  $("#title").textContent = needsAuth ? "Kitchen" : TITLES[ui.tab];
  $("#topActions").innerHTML = "";
  if (needsAuth) { view.innerHTML = authView(); bindAuth(); return; }
  if (!store.ready) { view.innerHTML = `<div class="empty"><div class="spinner"></div><p>Loading your kitchen…</p></div>`; return; }

  // Keep the cursor in the search box across re-renders.
  const active = view.contains(document.activeElement) ? document.activeElement : null;
  const focused = active?.id;
  const value = active?.value;
  const caret = active?.selectionStart;
  view.innerHTML = { fridge: fridgeView, groceries: groceriesView, recipes: recipesView }[ui.tab]();
  const el = focused && $(`#${focused}`, view);
  if (el) {
    if (value != null) el.value = value;
    el.focus();
    if (caret != null) el.setSelectionRange(caret, caret);
  }
}

$$(".tabbar button").forEach((b) => (b.onclick = () => {
  ui.tab = prefs.tab = b.dataset.tab; savePrefs();
  ui.search = ""; render(); window.scrollTo(0, 0);
}));
$("#fab").onclick = () => ({ fridge: () => fridgeItemSheet(), groceries: () => groceryItemSheet(), recipes: () => recipeFormSheet() })[ui.tab]();
$("#settingsBtn").onclick = settingsSheet;

// ======================================================================
// FRIDGE
// ======================================================================

function fridgeView() {
  const all = store.state.fridge;
  const counts = Object.fromEntries(LOCATIONS.map((l) => [l.id, all.filter((i) => i.location === l.id).length]));
  const low = all.filter(isLow).length;
  const expiring = all.filter(isExpiring).length;
  const q = ui.search.toLowerCase();
  const items = all
    .filter((i) => ui.loc === "all" || i.location === ui.loc)
    .filter((i) => ui.filter !== "low" || isLow(i))
    .filter((i) => ui.filter !== "expiring" || isExpiring(i))
    .filter((i) => !q || i.name.toLowerCase().includes(q));

  const groups = CATEGORIES.map((c) => [c, items.filter((i) => (i.category || "other") === c.id).sort(byName)]).filter(([, l]) => l.length);

  return `
    <div class="loc-cards">
      <button class="loc-card ${ui.loc === "all" ? "on" : ""}" data-loc="all"><span class="loc-emoji">🏠</span><b>${all.length}</b><small>All</small></button>
      ${LOCATIONS.map((l) => `<button class="loc-card ${ui.loc === l.id ? "on" : ""}" data-loc="${l.id}"><span class="loc-emoji">${l.emoji}</span><b>${counts[l.id]}</b><small>${l.label}</small></button>`).join("")}
    </div>
    <div class="chips">
      <button class="chip ${ui.filter === "expiring" ? "on" : ""}" data-filter="expiring">⏰ Expiring soon <b>${expiring}</b></button>
      <button class="chip ${ui.filter === "low" ? "on" : ""}" data-filter="low">📉 Running low <b>${low}</b></button>
    </div>
    <input class="search" id="fridgeSearch" type="search" placeholder="Search your kitchen…" value="${esc(ui.search)}">
    ${all.length === 0 ? `<div class="empty"><div class="big">🧺</div><p>Your fridge is empty.<br>Tap <b>＋</b> to add what you have, or scan a receipt on the Groceries tab.</p></div>`
      : groups.length === 0 ? `<div class="empty"><p>Nothing matches.</p></div>`
      : groups.map(([c, list]) => `
        <section class="group">
          <h2>${c.emoji} ${c.label} <span class="count">${list.length}</span></h2>
          <div class="tiles">${list.map(fridgeTile).join("")}</div>
        </section>`).join("")}
  `;
}

function fridgeTile(it) {
  const days = it.expires ? daysUntil(it.expires) : null;
  const exp = days == null ? "" : days < 0 ? `<span class="badge bad">Expired</span>` : days === 0 ? `<span class="badge bad">Today</span>` : days <= 3 ? `<span class="badge warn">${days}d left</span>` : "";
  const loc = LOCATIONS.find((l) => l.id === it.location);
  let amount;
  if (it.mode === "level") {
    amount = `
      <div class="gauge" aria-label="${LEVEL_LABEL[it.level] || it.level + "%"}"><div style="width:${it.level}%;background:${levelColor(it.level)}"></div></div>
      <div class="amount-row"><button class="step" data-act="dec" aria-label="Less">−</button><span class="amount-label">${LEVEL_LABEL[it.level] || it.level + "%"}</span><button class="step" data-act="inc" aria-label="More">＋</button></div>`;
  } else {
    const n = it.qty ?? 1;
    const dots = n <= 6 ? `<span class="dots">${(it.emoji || "•").repeat(Math.max(0, n))}</span>` : `<span class="dots">${(it.emoji || "•").repeat(5)}<small>+${n - 5}</small></span>`;
    amount = `
      ${dots}
      <div class="amount-row"><button class="step" data-act="dec" aria-label="One less">−</button><span class="amount-label">${n}${it.unit ? " " + esc(it.unit) : ""}</span><button class="step" data-act="inc" aria-label="One more">＋</button></div>`;
  }
  return `
    <article class="tile ${isLow(it) ? "low" : ""}" data-id="${it.id}">
      <button class="tile-main" data-act="edit">
        <span class="tile-emoji">${it.emoji || guessEmoji(it.name)}</span>
        <span class="tile-name">${esc(it.name)}</span>
        <span class="tile-meta">${loc ? loc.emoji : ""} ${exp}</span>
      </button>
      ${amount}
    </article>`;
}

$("#view").addEventListener("click", (e) => {
  const t = e.target;
  if (ui.tab === "fridge") {
    const loc = t.closest("[data-loc]");
    if (loc) { ui.loc = loc.dataset.loc; return render(); }
    const f = t.closest("[data-filter]");
    if (f) { ui.filter = ui.filter === f.dataset.filter ? null : f.dataset.filter; return render(); }
    const act = t.closest("[data-act]");
    const tile = t.closest(".tile");
    if (act && tile) {
      const it = store.state.fridge.find((x) => x.id === tile.dataset.id);
      if (!it) return;
      if (act.dataset.act === "edit") return fridgeItemSheet(it);
      return stepFridgeItem(it, act.dataset.act === "inc" ? 1 : -1);
    }
  }
  if (ui.tab === "groceries") return groceriesClick(e);
  if (ui.tab === "recipes") return recipesClick(e);
});
$("#view").addEventListener("input", (e) => {
  if (e.target.id === "fridgeSearch") { ui.search = e.target.value; render(); }
});

function stepFridgeItem(it, dir) {
  if (it.mode === "level") {
    const idx = LEVELS.findIndex((l) => l >= it.level);
    const next = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (idx < 0 ? LEVELS.length - 1 : idx) + dir))];
    if (next === 0) return itemGone(it, "used up");
    save(store.update("fridge", it.id, { level: next }));
  } else {
    const next = (it.qty ?? 1) + dir;
    if (next <= 0) return itemGone(it, "used up");
    save(store.update("fridge", it.id, { qty: next }));
  }
}

// Remove an item, then offer to put it on the grocery list (and undo).
function itemGone(it, why) {
  save(store.remove("fridge", it.id));
  const onList = store.state.groceries.some((g) => !g.checked && sameName(g.name, it.name));
  const actions = [{ label: "Undo", fn: () => save(store.add("fridge", it)) }];
  if (!onList) actions.unshift({ label: "＋ Groceries", fn: () => addGrocery(it.name, it.category) });
  showToast(`${it.name} ${why}`, actions, 7000);
}

function fridgeItemSheet(item) {
  const editing = !!item;
  const it = item || { name: "", category: "", location: "fridge", mode: "count", qty: 1, unit: "", level: 100, expires: "" };
  let categoryTouched = editing;
  openSheet(`
    <form class="form" id="fridgeForm">
      <div class="sheet-head"><h2>${editing ? "Edit item" : "Add to kitchen"}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="name-row">
        <span class="emoji-preview" id="emojiPreview">${it.emoji || guessEmoji(it.name) }</span>
        <input name="name" required placeholder="e.g. Milk, Tomatoes" value="${esc(it.name)}" autocomplete="off" list="knownNames" ${editing ? "" : "autofocus"}>
        <datalist id="knownNames">${[...new Set([...store.state.groceries, ...store.state.fridge].map((x) => x.name))].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      </div>
      <div class="field"><span>Where</span>
        ${segmented("location", LOCATIONS.map((l) => [l.id, `${l.emoji} ${l.label}`]), it.location)}
      </div>
      <label>Category <select name="category">${categoryOptions(it.category || "other")}</select></label>
      <div class="field"><span>Track by</span>
        ${segmented("mode", [["count", "🔢 Count"], ["level", "🥛 Amount left"]], it.mode)}
      </div>
      <div id="countFields" ${it.mode === "count" ? "" : "hidden"}>
        <div class="row">
          <div class="stepper"><button type="button" data-q="-1">−</button><input name="qty" type="number" min="1" inputmode="numeric" value="${it.qty ?? 1}"><button type="button" data-q="1">＋</button></div>
          <input name="unit" placeholder="unit (optional: lbs, cans…)" value="${esc(it.unit || "")}">
        </div>
      </div>
      <div id="levelFields" ${it.mode === "level" ? "" : "hidden"}>
        ${segmented("level", LEVELS.slice(1).reverse().map((l) => [l, LEVEL_LABEL[l]]), it.level ?? 100)}
      </div>
      <div class="field"><span>Expires <span class="hint">(optional)</span></span>
        <div class="row">
          <input name="expires" type="date" value="${esc(it.expires || "")}">
          <button type="button" class="chip" data-exp="3">+3d</button>
          <button type="button" class="chip" data-exp="7">+1w</button>
          <button type="button" class="chip" data-exp="">None</button>
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" type="submit">${editing ? "Save" : "Add"}</button>
        ${editing ? "" : `<button class="btn" type="button" id="saveAnother">Add & another</button>`}
      </div>
      ${editing ? `<div class="actions">
        <button class="btn" type="button" id="usedUp">✅ Used it up</button>
        <button class="btn danger" type="button" id="wentBad">🗑️ Went bad</button>
      </div>` : ""}
    </form>`, (root) => {
    const form = $("#fridgeForm", root);
    const getLoc = bindSegmented(root, "location", () => {});
    const getMode = bindSegmented(root, "mode", (m) => {
      $("#countFields", root).hidden = m !== "count";
      $("#levelFields", root).hidden = m !== "level";
    });
    const getLevel = bindSegmented(root, "level", () => {});
    form.category.onchange = () => (categoryTouched = true);
    form.name.oninput = () => {
      const n = form.name.value;
      $("#emojiPreview", root).textContent = guessEmoji(n);
      if (editing) return;
      if (!categoryTouched) form.category.value = guessCategory(n);
      // Pre-pick sensible defaults as you type (milk → amount left, in the fridge).
      const mode = guessMode(n);
      $(`[data-seg="mode"] [data-v="${mode}"]`, root).click();
      $(`[data-seg="location"] [data-v="${guessLocation(n, form.category.value)}"]`, root).click();
    };
    $$("[data-q]", root).forEach((b) => (b.onclick = () => (form.qty.value = Math.max(1, (+form.qty.value || 1) + +b.dataset.q))));
    $$("[data-exp]", root).forEach((b) => (b.onclick = () => (form.expires.value = b.dataset.exp ? isoPlus(+b.dataset.exp) : "")));

    const collect = () => {
      const name = form.name.value.trim();
      if (!name) { form.name.focus(); return null; }
      const mode = getMode();
      return {
        ...(editing ? { id: it.id, addedAt: it.addedAt } : { addedAt: Date.now() }),
        name, emoji: guessEmoji(name), category: form.category.value, location: getLoc(), mode,
        qty: mode === "count" ? Math.max(1, +form.qty.value || 1) : 1,
        unit: mode === "count" ? form.unit.value.trim() : "",
        level: mode === "level" ? +getLevel() : 100,
        expires: form.expires.value || "",
      };
    };
    const commit = () => {
      const data = collect(); if (!data) return false;
      if (editing) {
        const { id, ...patch } = data;
        save(store.update("fridge", id, patch));
      } else {
        const existing = store.state.fridge.find((x) => sameName(x.name, data.name) && x.location === data.location);
        if (existing && existing.mode === "count" && data.mode === "count") {
          save(store.update("fridge", existing.id, { qty: (existing.qty ?? 1) + data.qty }));
        } else {
          save(store.add("fridge", data));
        }
      }
      return true;
    };
    form.onsubmit = (e) => { e.preventDefault(); if (commit()) closeSheet(); };
    $("#saveAnother", root)?.addEventListener("click", () => {
      if (!commit()) return;
      showToast(`Added ${form.name.value.trim()}`, [], 2000);
      form.name.value = ""; form.qty.value = 1; form.unit.value = ""; form.expires.value = "";
      categoryTouched = false; form.name.focus();
    });
    $("#usedUp", root)?.addEventListener("click", () => { closeSheet(); itemGone(it, "used up"); });
    $("#wentBad", root)?.addEventListener("click", () => { closeSheet(); itemGone(it, "tossed"); });
    if (!editing) setTimeout(() => form.name.focus(), 50);
  });
}

// ======================================================================
// GROCERIES
// ======================================================================

function addGrocery(name, category, qty = "") {
  name = name.trim(); if (!name) return;
  const dup = store.state.groceries.find((g) => !g.checked && sameName(g.name, name));
  if (dup) { showToast(`${dup.name} is already on the list`, [], 2500); return; }
  save(store.add("groceries", { name, qty: String(qty || ""), category: category || guessCategory(name), checked: false, addedAt: Date.now() }));
}

function groceriesView() {
  const list = store.state.groceries;
  const todo = list.filter((g) => !g.checked);
  const done = list.filter((g) => g.checked).sort(byName);
  const lowSuggestions = store.state.fridge
    .filter((f) => isLow(f) && !todo.some((g) => sameName(g.name, f.name)))
    .slice(0, 8);
  const groups = CATEGORIES.map((c) => [c, todo.filter((g) => (g.category || "other") === c.id).sort(byName)]).filter(([, l]) => l.length);

  return `
    <button class="scan-card" data-g="scan">
      <span class="scan-icon">🧾</span>
      <span><b>Scan a receipt</b><small>Snap a photo and the items get added automatically</small></span>
      <span class="chev">›</span>
    </button>
    <form class="quick-add" id="quickAdd">
      <input id="quickAddInput" placeholder="Add an item… e.g. eggs" autocomplete="off" enterkeyhint="done">
      <button class="btn primary" type="submit">Add</button>
    </form>
    ${lowSuggestions.length ? `
      <div class="suggest">
        <small>Running low at home:</small>
        <div class="chips">${lowSuggestions.map((f) => `<button class="chip" data-g="suggest" data-name="${esc(f.name)}" data-cat="${esc(f.category)}">＋ ${f.emoji || ""} ${esc(f.name)}</button>`).join("")}</div>
      </div>` : ""}
    ${list.length === 0 ? `<div class="empty"><div class="big">🛒</div><p>Your list is empty.<br>Add items above, or tap <b>＋ Groceries</b> when you finish something.</p></div>` : ""}
    ${groups.map(([c, items]) => `
      <section class="group">
        <h2>${c.emoji} ${c.label} <span class="count">${items.length}</span></h2>
        <ul class="checklist">${items.map(groceryRow).join("")}</ul>
      </section>`).join("")}
    ${done.length ? `
      <section class="group done">
        <h2>✅ In the cart <span class="count">${done.length}</span></h2>
        <ul class="checklist">${done.map(groceryRow).join("")}</ul>
      </section>
      <div class="cart-actions">
        <button class="btn primary" data-g="putaway">🧊 Put ${done.length} away in kitchen</button>
        <button class="btn" data-g="clear">Clear</button>
      </div>` : ""}
  `;
}

const groceryRow = (g) => `
  <li class="check-row ${g.checked ? "checked" : ""}" data-id="${g.id}">
    <button class="checkbox" data-g="toggle" aria-label="${g.checked ? "Uncheck" : "Check"} ${esc(g.name)}">${g.checked ? "✓" : ""}</button>
    <button class="check-text" data-g="edit"><span class="row-emoji">${guessEmoji(g.name)}</span>${esc(g.name)}${g.qty ? ` <small>× ${esc(g.qty)}</small>` : ""}</button>
    <button class="icon-btn subtle" data-g="delete" aria-label="Remove">✕</button>
  </li>`;

function groceriesClick(e) {
  const b = e.target.closest("[data-g]"); if (!b) return;
  const row = b.closest(".check-row");
  const g = row && store.state.groceries.find((x) => x.id === row.dataset.id);
  switch (b.dataset.g) {
    case "scan": return receiptSheet();
    case "suggest": return addGrocery(b.dataset.name, b.dataset.cat);
    case "toggle": return g && save(store.update("groceries", g.id, { checked: !g.checked }));
    case "edit": return g && groceryItemSheet(g);
    case "delete":
      if (!g) return;
      save(store.remove("groceries", g.id));
      return showToast(`Removed ${g.name}`, [{ label: "Undo", fn: () => save(store.add("groceries", g)) }]);
    case "putaway": {
      const done = store.state.groceries.filter((x) => x.checked);
      putAway(done.map((x) => ({ name: x.name, qty: parseInt(x.qty, 10) || 1, category: x.category })));
      done.forEach((x) => save(store.remove("groceries", x.id)));
      return showToast(`Put ${done.length} item${done.length > 1 ? "s" : ""} away 🧊`, [{ label: "View", fn: () => $('[data-tab="fridge"]').click() }]);
    }
    case "clear": {
      const done = store.state.groceries.filter((x) => x.checked);
      done.forEach((x) => save(store.remove("groceries", x.id)));
      return showToast("Cleared", [{ label: "Undo", fn: () => save(store.addMany("groceries", done)) }]);
    }
  }
}
$("#view").addEventListener("submit", (e) => {
  if (e.target.id !== "quickAdd") return;
  e.preventDefault();
  const input = $("#quickAddInput");
  const name = input.value;
  input.value = ""; // clear before adding so the re-render keeps it empty
  addGrocery(name);
});

// Move bought items into the fridge/pantry, topping up anything already there.
function putAway(items) {
  for (const { name, qty = 1, category } of items) {
    const existing = store.state.fridge.find((f) => sameName(f.name, name));
    if (existing) {
      save(store.update("fridge", existing.id, existing.mode === "level" ? { level: 100 } : { qty: (existing.qty ?? 1) + qty }));
      continue;
    }
    const cat = category || guessCategory(name);
    const mode = guessMode(name);
    save(store.add("fridge", {
      name, emoji: guessEmoji(name), category: cat, location: guessLocation(name, cat), mode,
      qty: mode === "count" ? qty : 1, unit: "", level: 100, expires: "", addedAt: Date.now(),
    }));
  }
}

function groceryItemSheet(item) {
  const editing = !!item;
  const g = item || { name: "", qty: "", category: "" };
  openSheet(`
    <form class="form" id="groceryForm">
      <div class="sheet-head"><h2>${editing ? "Edit item" : "Add to list"}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <label>Item <input name="name" required value="${esc(g.name)}" placeholder="e.g. Cilantro" autocomplete="off"></label>
      <div class="row">
        <label class="grow">How many <input name="qty" value="${esc(g.qty)}" placeholder="e.g. 2, 1 lb"></label>
        <label class="grow">Aisle <select name="category">${categoryOptions(g.category || guessCategory(g.name))}</select></label>
      </div>
      <div class="actions"><button class="btn primary" type="submit">${editing ? "Save" : "Add"}</button></div>
    </form>`, (root) => {
    const form = $("#groceryForm", root);
    let touched = editing;
    form.category.onchange = () => (touched = true);
    form.name.oninput = () => { if (!touched) form.category.value = guessCategory(form.name.value); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = { name: form.name.value.trim(), qty: form.qty.value.trim(), category: form.category.value };
      if (!data.name) return;
      if (editing) save(store.update("groceries", g.id, data));
      else save(store.add("groceries", { ...data, checked: false, addedAt: Date.now() }));
      closeSheet();
    };
    if (!editing) setTimeout(() => form.name.focus(), 50);
  });
}

// ---------- receipt scanning ----------

function receiptSheet() {
  const aiOn = !!getApiKey();
  openSheet(`
    <div class="form">
      <div class="sheet-head"><h2>🧾 Scan receipt</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div id="receiptStep">
        <label class="upload-box">
          <input type="file" accept="image/*" id="receiptFile" hidden>
          <span class="big">📸</span>
          <b>Take a photo or choose one</b>
          <small>Lay the receipt flat in good light</small>
        </label>
        <p class="hint">${aiOn ? "✨ Using Claude for accurate reading." : "Using on-device scanning (free, but reads abbreviations literally). For much better results, add a Claude API key in ⚙️ Settings."}</p>
      </div>
    </div>`, (root) => {
    $("#receiptFile", root).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const step = $("#receiptStep", root);
      step.innerHTML = `<div class="empty"><div class="spinner"></div><p id="scanStatus">Reading receipt…</p></div>`;
      try {
        const items = await scanReceipt(file, (msg) => { const s = $("#scanStatus", root); if (s) s.textContent = msg; });
        if (!$("#receiptStep", root)) return; // sheet was closed
        receiptReview(root, items);
      } catch (err) {
        step.innerHTML = `<div class="empty"><div class="big">😕</div><p>${esc(err.message || "Couldn't read that receipt.")}</p><button class="btn" id="retry">Try another photo</button></div>`;
        $("#retry", root).onclick = receiptSheet;
      }
    };
  });
}

function receiptReview(root, items) {
  const step = $("#receiptStep", root);
  if (!items.length) {
    step.innerHTML = `<div class="empty"><div class="big">🤔</div><p>No items found. Try a sharper, flatter photo.</p><button class="btn" id="retry">Try again</button></div>`;
    $("#retry", root).onclick = receiptSheet;
    return;
  }
  step.innerHTML = `
    <p class="hint">Found ${items.length} item${items.length > 1 ? "s" : ""}. Fix any names, untick anything you don't want.</p>
    <ul class="review-list">
      ${items.map((it, i) => `
        <li data-i="${i}">
          <input type="checkbox" checked aria-label="Include">
          <span class="row-emoji">${guessEmoji(it.name)}</span>
          <input class="r-name" value="${esc(it.name)}">
          <input class="r-qty" type="number" min="1" inputmode="numeric" value="${it.quantity || 1}" aria-label="Quantity">
        </li>`).join("")}
    </ul>
    <div class="field"><span>Add them to</span>
      ${segmented("dest", [["groceries", "🛒 Grocery list"], ["fridge", "🧊 Fridge & pantry"]], "groceries")}
    </div>
    <p class="hint" id="destHint">They'll be added to your shopping list.</p>
    <div class="actions"><button class="btn primary" id="addScanned">Add items</button></div>`;
  const getDest = bindSegmented(root, "dest", (d) => {
    $("#destHint", root).textContent = d === "fridge"
      ? "They'll be stocked in your kitchen, and crossed off your shopping list."
      : "They'll be added to your shopping list.";
  });
  $$(".r-name", root).forEach((inp) => (inp.oninput = () => (inp.previousElementSibling.textContent = guessEmoji(inp.value))));
  $("#addScanned", root).onclick = () => {
    const chosen = $$(".review-list li", root)
      .filter((li) => $("input[type=checkbox]", li).checked)
      .map((li) => {
        const name = $(".r-name", li).value.trim();
        const orig = items[li.dataset.i];
        return { name, qty: Math.max(1, +$(".r-qty", li).value || 1), category: orig.category || guessCategory(name) };
      })
      .filter((x) => x.name);
    if (!chosen.length) return closeSheet();
    if (getDest() === "fridge") {
      putAway(chosen);
      store.state.groceries
        .filter((g) => !g.checked && chosen.some((c) => sameName(c.name, g.name)))
        .forEach((g) => save(store.remove("groceries", g.id)));
      showToast(`Stocked ${chosen.length} items 🧊`);
    } else {
      const fresh = chosen.filter((c) => !store.state.groceries.some((g) => !g.checked && sameName(g.name, c.name)));
      save(store.addMany("groceries", fresh.map((c) => ({
        name: c.name, qty: c.qty > 1 ? String(c.qty) : "", category: c.category, checked: false, addedAt: Date.now(),
      }))));
      showToast(`Added ${fresh.length} items to your list 🛒`);
    }
    closeSheet();
  };
}

// ======================================================================
// RECIPES
// ======================================================================

// For each recipe: which required ingredients you already have and which you'd need to buy.
function analyzeRecipes() {
  const have = makeMatcher(store.state.fridge.map((f) => f.name));
  return store.state.recipes.map((r) => {
    const ings = (r.ingredients || []).map((text) => ({ text, optional: isOptional(text), have: have(text) }));
    const required = ings.filter((i) => !i.optional);
    const missing = required.filter((i) => !i.have);
    return { r, ings, missing, haveCount: required.length - missing.length, total: required.length };
  });
}
const byMissing = (a, b) => a.missing.length - b.missing.length || b.haveCount / (b.total || 1) - a.haveCount / (a.total || 1) || a.r.title.localeCompare(b.r.title);

function recipesView() {
  const all = analyzeRecipes().sort(byMissing);
  if (!all.length) {
    return `<div class="empty"><div class="big">📖</div><p>No recipes yet.<br>Tap <b>＋</b> to add one of your own, or paste a link to one online.</p>
      <button class="btn primary" data-r="add">＋ Add a recipe</button></div>`;
  }
  const cuisines = [...new Set(all.map((a) => a.r.cuisine || "Other"))].sort();
  if (ui.cuisine !== "All" && !cuisines.includes(ui.cuisine)) ui.cuisine = "All";
  const shown = all.filter((a) => ui.cuisine === "All" || (a.r.cuisine || "Other") === ui.cuisine);
  const ready = all.filter((a) => a.missing.length <= 1).slice(0, 10);

  return `
    <div class="chips scroll">
      ${["All", ...cuisines].map((c) => `<button class="chip ${ui.cuisine === c ? "on" : ""}" data-r="cuisine" data-c="${esc(c)}">${c === "All" ? "🍽️" : cuisineEmoji(c)} ${esc(c)}</button>`).join("")}
    </div>
    ${ui.cuisine === "All" && ready.length ? `
      <section class="group">
        <h2>🔥 Cook with what you have</h2>
        <div class="card-row">${ready.map((a) => recipeCard(a, true)).join("")}</div>
      </section>` : ""}
    ${(ui.cuisine === "All" ? cuisines : [ui.cuisine]).map((c) => {
      const list = shown.filter((a) => (a.r.cuisine || "Other") === c);
      return list.length ? `
        <section class="group">
          <h2>${cuisineEmoji(c)} ${esc(c)} <span class="count">${list.length}</span></h2>
          <div class="cards">${list.map((a) => recipeCard(a)).join("")}</div>
        </section>` : "";
    }).join("")}
    <p class="hint center">Sorted by fewest ingredients to buy.</p>`;
}

function recipeCard({ r, missing, haveCount, total }, compact = false) {
  const n = missing.length;
  const badge = n === 0 ? `<span class="badge good">✓ Ready to cook</span>` : `<span class="badge ${n <= 2 ? "warn" : "bad"}">Need ${n}</span>`;
  const cover = r.photo
    ? `<img src="${esc(r.photo)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover-fallback',textContent:'${cuisineEmoji(r.cuisine)}'}))">`
    : `<div class="cover-fallback">${cuisineEmoji(r.cuisine)}</div>`;
  return `
    <button class="card ${compact ? "compact" : ""}" data-r="open" data-id="${r.id}">
      <div class="cover">${cover}${badge}</div>
      <div class="card-body">
        <b>${esc(r.title)}</b>
        <small>${r.time ? `🕒 ${esc(r.time)} · ` : ""}${haveCount}/${total} ingredients</small>
      </div>
    </button>`;
}

function recipesClick(e) {
  const b = e.target.closest("[data-r]"); if (!b) return;
  if (b.dataset.r === "cuisine") { ui.cuisine = b.dataset.c; return render(); }
  if (b.dataset.r === "add") return recipeFormSheet();
  if (b.dataset.r === "open") return recipeDetailSheet(b.dataset.id);
}

function recipeDetailSheet(id) {
  const a = analyzeRecipes().find((x) => x.r.id === id); if (!a) return;
  const { r, ings, missing } = a;
  const notListed = missing.filter((m) => !store.state.groceries.some((g) => !g.checked && coreTokens(g.name).every((w) => coreTokens(m.text).includes(w))));
  openSheet(`
    <div class="recipe-detail">
      <div class="detail-cover">
        ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : `<div class="cover-fallback">${cuisineEmoji(r.cuisine)}</div>`}
        <button type="button" class="icon-btn floating" data-close aria-label="Close">✕</button>
      </div>
      <div class="form">
        <h2 class="detail-title">${esc(r.title)}</h2>
        <p class="meta">${cuisineEmoji(r.cuisine)} ${esc(r.cuisine || "Other")}${r.time ? ` · 🕒 ${esc(r.time)}` : ""}${r.servings ? ` · 🍽️ serves ${esc(r.servings)}` : ""}</p>
        ${r.sourceUrl ? `<p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">🔗 View original recipe</a></p>` : ""}
        <h3>Ingredients <small>${a.haveCount}/${a.total} in your kitchen</small></h3>
        <ul class="ing-list">
          ${ings.map((i) => `<li class="${i.have ? "have" : i.optional ? "opt" : "need"}"><span>${i.have ? "✓" : i.optional ? "–" : "○"}</span>${esc(i.text)}</li>`).join("")}
        </ul>
        ${notListed.length ? `<button class="btn primary" id="addMissing">🛒 Add ${notListed.length} missing to groceries</button>`
          : missing.length ? `<p class="hint">Everything you need is already on your grocery list.</p>`
          : `<p class="hint">🎉 You have everything for this one.</p>`}
        ${(r.steps || []).length ? `<h3>Steps</h3><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
        ${r.notes ? `<h3>Notes</h3><p class="notes">${esc(r.notes)}</p>` : ""}
        <div class="actions">
          <button class="btn" id="editRecipe">✏️ Edit</button>
          <button class="btn danger" id="deleteRecipe">🗑️ Delete</button>
        </div>
      </div>
    </div>`, (root) => {
    $("#addMissing", root)?.addEventListener("click", (e) => {
      notListed.forEach((m) => addGrocery(cleanIngredient(m.text)));
      e.target.outerHTML = `<p class="hint">✓ Added ${notListed.length} to your grocery list.</p>`;
    });
    $("#editRecipe", root).onclick = () => recipeFormSheet(r);
    $("#deleteRecipe", root).onclick = (e) => {
      if (e.target.dataset.armed) {
        closeSheet();
        save(store.remove("recipes", r.id));
        showToast(`Deleted ${r.title}`, [{ label: "Undo", fn: () => save(store.add("recipes", r)) }]);
      } else {
        e.target.dataset.armed = "1";
        e.target.textContent = "Tap again to delete";
      }
    };
  });
}

// "2 cups chopped tomatoes (optional)" → "Tomatoes" for the grocery list.
function cleanIngredient(text) {
  const words = coreTokens(text).join(" ") || text;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function recipeFormSheet(recipe) {
  const editing = !!recipe;
  const r = recipe || { title: "", cuisine: "", photo: "", sourceUrl: "", time: "", servings: "", ingredients: [], steps: [], notes: "" };
  const aiOn = !!getApiKey();
  const knownCuisines = [...new Set([...store.state.recipes.map((x) => x.cuisine).filter(Boolean), ...CUISINES])];
  let photo = r.photo || "";
  openSheet(`
    <form class="form" id="recipeForm">
      <div class="sheet-head"><h2>${editing ? "Edit recipe" : "New recipe"}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      ${editing ? "" : segmented("source", [["link", "🔗 From a link"], ["own", "✍️ My own"]], "link")}
      <div id="linkFields">
        <label>Recipe link <input name="sourceUrl" type="url" inputmode="url" placeholder="https://…" value="${esc(r.sourceUrl)}"></label>
        ${aiOn ? `<button type="button" class="btn" id="autofill">✨ Auto-fill from link</button><p class="hint" id="autofillStatus"></p>`
          : `<p class="hint">Paste the ingredients and steps below. (Add a Claude API key in ⚙️ Settings to auto-fill from links.)</p>`}
      </div>
      <label>Name <input name="title" required value="${esc(r.title)}" placeholder="e.g. Chana masala"></label>
      <div class="row">
        <label class="grow">Cuisine <input name="cuisine" list="cuisineList" value="${esc(r.cuisine)}" placeholder="e.g. Indian" required></label>
        <datalist id="cuisineList">${knownCuisines.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
        <label class="grow">Time <input name="time" value="${esc(r.time)}" placeholder="30 min"></label>
        <label class="small">Serves <input name="servings" value="${esc(r.servings)}" placeholder="4"></label>
      </div>
      <label>Cover photo</label>
      <div class="photo-pick">
        <div class="photo-preview" id="photoPreview">${photo ? `<img src="${esc(photo)}" alt="">` : "📷"}</div>
        <div class="photo-actions">
          <label class="btn"><input type="file" accept="image/*" id="photoFile" hidden>Choose photo</label>
          <input name="photoUrl" type="url" placeholder="…or paste an image link" value="${photo.startsWith("http") ? esc(photo) : ""}">
          ${photo ? `<button type="button" class="link-btn" id="removePhoto">Remove photo</button>` : ""}
        </div>
      </div>
      <label>Ingredients <span class="hint">one per line · add "(optional)" to skip it when sorting</span>
        <textarea name="ingredients" rows="7" placeholder="1 cup basmati rice&#10;2 tomatoes&#10;1 onion&#10;Cilantro (optional)">${esc((r.ingredients || []).join("\n"))}</textarea>
      </label>
      <label>Steps <span class="hint">one per line</span>
        <textarea name="steps" rows="6" placeholder="Rinse the rice…&#10;Sauté the onion…">${esc((r.steps || []).join("\n"))}</textarea>
      </label>
      <label>Notes <textarea name="notes" rows="2" placeholder="Tweaks, who likes it, etc.">${esc(r.notes || "")}</textarea></label>
      <div class="actions"><button class="btn primary" type="submit">${editing ? "Save" : "Add recipe"}</button></div>
    </form>`, (root) => {
    const form = $("#recipeForm", root);
    if (!editing) bindSegmented(root, "source", (v) => ($("#linkFields", root).hidden = v !== "link"));

    const setPhoto = (src) => {
      photo = src;
      $("#photoPreview", root).innerHTML = src ? `<img src="${esc(src)}" alt="">` : "📷";
    };
    $("#photoFile", root).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { setPhoto(await resizeImage(f, 900, 0.75)); form.photoUrl.value = ""; } catch (err) { showToast(err.message); }
    };
    form.photoUrl.oninput = () => setPhoto(form.photoUrl.value.trim());
    $("#removePhoto", root)?.addEventListener("click", (e) => { setPhoto(""); form.photoUrl.value = ""; e.target.remove(); });

    $("#autofill", root)?.addEventListener("click", async (e) => {
      const url = form.sourceUrl.value.trim();
      const status = $("#autofillStatus", root);
      if (!/^https?:\/\//.test(url)) { status.textContent = "Paste a full link first (starting with https://)."; return; }
      e.target.disabled = true;
      status.innerHTML = `<span class="spinner small"></span> Reading the recipe… (can take ~30s)`;
      try {
        const got = await importRecipe(url, knownCuisines);
        if (!form.isConnected) return;
        form.title.value = got.title || form.title.value;
        form.cuisine.value = got.cuisine || form.cuisine.value;
        form.time.value = got.time || form.time.value;
        form.servings.value = got.servings || form.servings.value;
        if (got.ingredients?.length) form.ingredients.value = got.ingredients.join("\n");
        if (got.steps?.length) form.steps.value = got.steps.join("\n");
        if (got.image_url && !photo) { form.photoUrl.value = got.image_url; setPhoto(got.image_url); }
        status.textContent = "✓ Filled in. Check it over, then save.";
      } catch (err) {
        status.textContent = `Couldn't auto-fill: ${err.message}. You can paste the details instead.`;
      } finally {
        e.target.disabled = false;
      }
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const lines = (s) => s.split("\n").map((x) => x.replace(/^\s*(\d+[.)]|[-*•])\s+/, "").trim()).filter(Boolean);
      const data = {
        title: form.title.value.trim(),
        cuisine: form.cuisine.value.trim().replace(/^\w/, (c) => c.toUpperCase()),
        time: form.time.value.trim(),
        servings: form.servings.value.trim(),
        sourceUrl: form.sourceUrl.value.trim(),
        photo,
        ingredients: form.ingredients.value.split("\n").map((x) => x.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean),
        steps: lines(form.steps.value),
        notes: form.notes.value.trim(),
      };
      if (editing) save(store.update("recipes", r.id, data));
      else save(store.add("recipes", { ...data, createdAt: Date.now() }));
      closeSheet();
      if (editing) setTimeout(() => recipeDetailSheet(r.id), 50);
      else showToast(`Added ${data.title}`, [], 2500);
    };
  });
}

// ======================================================================
// SETTINGS & AUTH
// ======================================================================

function settingsSheet() {
  const key = getApiKey();
  openSheet(`
    <div class="form">
      <div class="sheet-head"><h2>Settings</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <h3>Sync</h3>
      ${store.mode === "cloud"
        ? store.user ? `<p>☁️ Synced across your devices as <b>${esc(store.user.email)}</b>.</p><button class="btn" id="signOut">Sign out</button>` : `<p>Not signed in.</p>`
        : `<p>📱 Saved on this device only. Add your Firebase settings to <code>js/config.js</code> to sync between devices (see README).</p>`}
      <h3>Claude API key <small>(optional)</small></h3>
      <p class="hint">Makes receipt scanning much more accurate and lets you auto-fill recipes from a link. Stored only in this browser, never synced or uploaded. Each scan costs a few cents on your Anthropic account. Get a key at console.anthropic.com.</p>
      <div class="row">
        <input id="apiKey" type="password" placeholder="sk-ant-…" value="${esc(key)}" autocomplete="off">
        <button class="btn primary" id="saveKey">Save</button>
      </div>
      ${key ? `<button class="link-btn" id="removeKey">Remove key</button>` : ""}
      <h3>Backup</h3>
      <div class="row">
        <button class="btn" id="exportBtn">⬇️ Export</button>
        <label class="btn">⬆️ Import<input type="file" accept="application/json" id="importFile" hidden></label>
      </div>
      <p class="hint" id="importStatus"></p>
    </div>`, (root) => {
    $("#signOut", root)?.addEventListener("click", () => { closeSheet(); store.signOut(); });
    $("#saveKey", root).onclick = () => { setApiKey($("#apiKey", root).value.trim()); closeSheet(); showToast("Saved ✨", [], 2000); };
    $("#removeKey", root)?.addEventListener("click", () => { setApiKey(""); closeSheet(); showToast("Key removed", [], 2000); });
    $("#exportBtn", root).onclick = () => {
      const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `kitchen-backup-${new Date().toLocaleDateString("en-CA")}.json` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $("#importFile", root).onchange = async (e) => {
      const status = $("#importStatus", root);
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!["fridge", "groceries", "recipes"].some((c) => Array.isArray(data[c]))) throw new Error("Not a kitchen backup file");
        status.textContent = "Importing…";
        await store.replaceAll(data);
        closeSheet(); showToast("Backup restored");
      } catch (err) { status.textContent = `Import failed: ${err.message}`; }
    };
  });
}

let authMode = "signin";
function authView() {
  return `
    <form class="form auth" id="authForm">
      <div class="big">🥕🧀🍅</div>
      <h2>${authMode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <p class="hint">Sign in with the same account on your phone and laptop to share one kitchen.</p>
      <label>Email <input name="email" type="email" autocomplete="email" required></label>
      <label>Password <input name="password" type="password" autocomplete="${authMode === "signin" ? "current-password" : "new-password"}" minlength="6" required></label>
      <button class="btn primary" type="submit">${authMode === "signin" ? "Sign in" : "Create account"}</button>
      <p class="hint error" id="authError"></p>
      <button class="link-btn" type="button" id="authSwitch">${authMode === "signin" ? "First time? Create an account" : "Have an account? Sign in"}</button>
      ${authMode === "signin" ? `<button class="link-btn" type="button" id="authReset">Forgot password?</button>` : ""}
    </form>`;
}
function bindAuth() {
  const form = $("#authForm");
  const err = $("#authError");
  const friendly = (e) => ({
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "That email already has an account. Sign in instead.",
    "auth/weak-password": "Use at least 6 characters.",
    "auth/operation-not-allowed": "Email sign-in isn't enabled in Firebase yet (see README).",
    "auth/admin-restricted-operation": "New sign-ups are turned off for this app.",
    "auth/network-request-failed": "No connection. Try again.",
  })[e.code] || e.message;
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = "";
    try {
      if (authMode === "signin") await store.signIn(form.email.value, form.password.value);
      else await store.signUp(form.email.value, form.password.value);
    } catch (e2) { err.textContent = friendly(e2); }
  };
  $("#authSwitch").onclick = () => { authMode = authMode === "signin" ? "signup" : "signin"; render(); };
  $("#authReset")?.addEventListener("click", async () => {
    if (!form.email.value) { err.textContent = "Enter your email first."; return; }
    try { await store.resetPassword(form.email.value); err.textContent = "Reset email sent."; } catch (e2) { err.textContent = friendly(e2); }
  });
}

// ---------- start ----------

store.subscribe(render);
render();
initStore();
