import { Store, formatMoney, todayISO, monthKey, monthLabel, currentWeekRange, inRange } from "./store.js";
import { drawDonut, drawBars } from "./charts.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  view: "dashboard",
  editingId: null,
  addType: "expense",
  addCategoryId: null,
  listTypeFilter: "all",
  listCatFilter: "all",
  searchQuery: "",
  editingCategoryId: null,
  dashPeriod: "week",
  editingBankId: null,
  editingInvestmentId: null,
};

// ---------- Navigation ----------
const titles = {
  dashboard: "Resumen",
  list: "Movimientos",
  add: "Nuevo movimiento",
  wallet: "Cartera",
  settings: "Ajustes",
};

function setView(view) {
  state.view = view;
  $$(".view").forEach((v) => v.classList.remove("active"));
  $(`#view-${view}`).classList.add("active");
  $("#topbar-title").textContent = view === "add" && state.editingId ? "Editar movimiento" : titles[view];
  $$(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  if (view === "list") renderList();
  if (view === "wallet") renderWallet();
  if (view === "settings") renderSettings();
}

$$(".bottom-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view === "add") openAddForm(null);
    else setView(btn.dataset.view);
  });
});

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ---------- Dashboard ----------
$$("#period-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.dashPeriod = btn.dataset.period;
    renderDashboard();
  });
});

function renderDashboard() {
  $$("#period-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.period === state.dashPeriod));

  const settings = Store.getSettings();
  const currency = settings.currency;
  const movements = Store.getMovements();
  const isWeek = state.dashPeriod === "week";

  let periodMovs;
  if (isWeek) {
    const range = currentWeekRange();
    periodMovs = movements.filter((m) => inRange(m.date, range));
    $("#dash-period-label").textContent = "Balance de la semana";
    $("#dash-cat-title").textContent = "Por categoría esta semana";
  } else {
    const currentMonth = monthKey(todayISO());
    periodMovs = movements.filter((m) => monthKey(m.date) === currentMonth);
    $("#dash-period-label").textContent = "Balance del mes";
    $("#dash-cat-title").textContent = "Por categoría este mes";
  }

  const income = periodMovs.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0);
  const expense = periodMovs.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);
  const balance = income - expense;

  $("#dash-balance").textContent = formatMoney(balance, currency);
  $("#dash-balance").classList.toggle("negative", balance < 0);
  $("#dash-income").textContent = formatMoney(income, currency);
  $("#dash-expense").textContent = formatMoney(expense, currency);

  const byCat = new Map();
  periodMovs.filter((m) => m.type === "expense").forEach((m) => {
    byCat.set(m.categoryId, (byCat.get(m.categoryId) || 0) + m.amount);
  });
  const slices = Array.from(byCat.entries())
    .map(([catId, value]) => {
      const cat = Store.getCategory(catId);
      return { value, color: cat ? cat.color : "#8a94a6", name: cat ? cat.name : "Sin categoría", icon: cat ? cat.icon : "❔" };
    })
    .sort((a, b) => b.value - a.value);

  const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  drawDonut($("#dash-donut"), slices, { emptyColor: isDark ? "rgba(154,151,140,0.18)" : "rgba(107,103,89,0.15)" });
  const legend = $("#dash-legend");
  legend.innerHTML = "";
  if (!slices.length) {
    legend.innerHTML = `<div class="empty-state" style="padding:8px 0">Sin gastos ${isWeek ? "esta semana" : "este mes"}</div>`;
  } else {
    slices.slice(0, 6).forEach((s) => {
      const row = document.createElement("div");
      row.className = "cat-legend-item";
      row.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="name">${s.icon} ${s.name}</span><span class="value">${formatMoney(s.value, currency)}</span>`;
      legend.appendChild(row);
    });
  }

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const movs = movements.filter((m) => monthKey(m.date) === key);
    months.push({
      label: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
      income: movs.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0),
      expense: movs.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0),
    });
  }
  drawBars($("#dash-bars"), months, {
    labelColor: isDark ? "#9a978c" : "#6b6759",
    incomeColor: isDark ? "#3ecf8e" : "#1f8a63",
    expenseColor: isDark ? "#ec7791" : "#b5455e",
  });

  const recent = $("#dash-recent");
  recent.innerHTML = "";
  const recentMovs = movements.slice(0, 5);
  if (!recentMovs.length) {
    recent.innerHTML = '<div class="empty-state">Todavía no hay movimientos.<br>Toca «Añadir» para registrar el primero.</div>';
  } else {
    recentMovs.forEach((m) => recent.appendChild(movementRow(m, currency)));
  }
}

// ---------- Movement row ----------
function movementRow(m, currency) {
  const cat = Store.getCategory(m.categoryId);
  const row = document.createElement("div");
  row.className = "movement-row";
  const color = cat ? cat.color : "#8a94a6";
  row.innerHTML = `
    <div class="icon" style="background:${color}22;color:${color}">${cat ? cat.icon : "❔"}</div>
    <div class="info">
      <div class="concept">${escapeHtml(m.concept || (cat ? cat.name : "Sin categoría"))}</div>
      <div class="meta">${formatDate(m.date)} · ${cat ? escapeHtml(cat.name) : "Sin categoría"}</div>
    </div>
    <div class="amount ${m.type}">${m.type === "income" ? "+" : "−"}${formatMoney(m.amount, currency)}</div>
    <button class="del-btn" title="Eliminar">✕</button>
  `;
  row.querySelector(".info").addEventListener("click", () => openAddForm(m.id));
  row.querySelector(".icon").addEventListener("click", () => openAddForm(m.id));
  row.querySelector(".amount").addEventListener("click", () => openAddForm(m.id));
  row.querySelector(".del-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (confirm("¿Eliminar este movimiento?")) {
      Store.deleteMovement(m.id);
      showToast("Movimiento eliminado");
      refreshCurrentView();
    }
  });
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

// ---------- List view ----------
function renderCatFilters() {
  const wrap = $("#cat-filters");
  wrap.innerHTML = "";
  const allChip = document.createElement("button");
  allChip.className = "chip" + (state.listCatFilter === "all" ? " active" : "");
  allChip.textContent = "Todas las categorías";
  allChip.addEventListener("click", () => {
    state.listCatFilter = "all";
    renderList();
  });
  wrap.appendChild(allChip);
  Store.getCategories().forEach((c) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (state.listCatFilter === c.id ? " active" : "");
    chip.textContent = `${c.icon} ${c.name}`;
    chip.addEventListener("click", () => {
      state.listCatFilter = c.id;
      renderList();
    });
    wrap.appendChild(chip);
  });
}

function renderList() {
  const currency = Store.getSettings().currency;
  renderCatFilters();
  $$("#type-filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.type === state.listTypeFilter));

  let movements = Store.getMovements();
  if (state.listTypeFilter !== "all") movements = movements.filter((m) => m.type === state.listTypeFilter);
  if (state.listCatFilter !== "all") movements = movements.filter((m) => m.categoryId === state.listCatFilter);
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    movements = movements.filter((m) => {
      const cat = Store.getCategory(m.categoryId);
      return (m.concept || "").toLowerCase().includes(q) || (cat && cat.name.toLowerCase().includes(q));
    });
  }

  const container = $("#movements-list");
  container.innerHTML = "";
  if (!movements.length) {
    container.innerHTML = '<div class="empty-state">No hay movimientos con estos filtros.</div>';
    return;
  }

  const groups = new Map();
  movements.forEach((m) => {
    const key = monthKey(m.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });

  Array.from(groups.keys())
    .sort((a, b) => b.localeCompare(a))
    .forEach((key) => {
      const items = groups.get(key);
      const balance = items.reduce((s, m) => s + (m.type === "income" ? m.amount : -m.amount), 0);
      const group = document.createElement("div");
      group.className = "month-group";
      const header = document.createElement("div");
      header.className = "month-header";
      header.innerHTML = `<span>${monthLabel(key)}</span><span class="balance">${formatMoney(balance, currency)}</span>`;
      group.appendChild(header);
      items.forEach((m) => group.appendChild(movementRow(m, currency)));
      container.appendChild(group);
    });
}

$("#search-input").addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  renderList();
});

$$("#type-filters .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    state.listTypeFilter = chip.dataset.type;
    renderList();
  });
});

// ---------- Add / Edit movement ----------
function renderCatGrid() {
  const grid = $("#cat-grid");
  grid.innerHTML = "";
  Store.getCategories().forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-pick" + (state.addCategoryId === c.id ? " selected" : "");
    btn.innerHTML = `<span class="emoji">${c.icon}</span><span>${escapeHtml(c.name)}</span>`;
    btn.addEventListener("click", () => {
      state.addCategoryId = c.id;
      renderCatGrid();
    });
    grid.appendChild(btn);
  });
}

function setAddType(type) {
  state.addType = type;
  $$(".type-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.type === type));
}

$$(".type-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => setAddType(btn.dataset.type));
});

$("#date-today").addEventListener("click", () => ($("#date-input").value = todayISO()));
$("#date-yesterday").addEventListener("click", () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  $("#date-input").value = d.toISOString().slice(0, 10);
});

function openAddForm(movementId) {
  state.editingId = movementId;
  if (movementId) {
    const m = Store.getMovement(movementId);
    setAddType(m.type);
    state.addCategoryId = m.categoryId;
    $("#amount-input").value = m.amount;
    $("#concept-input").value = m.concept || "";
    $("#date-input").value = m.date;
    $("#delete-movement-btn").hidden = false;
  } else {
    setAddType("expense");
    state.addCategoryId = null;
    $("#amount-input").value = "";
    $("#concept-input").value = "";
    $("#date-input").value = todayISO();
    $("#delete-movement-btn").hidden = true;
  }
  renderCatGrid();
  setView("add");
}

$("#save-movement-btn").addEventListener("click", () => {
  const amount = parseFloat($("#amount-input").value);
  if (!amount || amount <= 0) {
    showToast("Introduce un importe válido");
    return;
  }
  const date = $("#date-input").value || todayISO();
  const payload = {
    type: state.addType,
    amount,
    categoryId: state.addCategoryId,
    concept: $("#concept-input").value.trim(),
    date,
  };
  if (state.editingId) {
    Store.updateMovement(state.editingId, payload);
    showToast("Movimiento actualizado");
  } else {
    Store.addMovement(payload);
    showToast("Movimiento guardado");
  }
  state.editingId = null;
  setView("dashboard");
});

$("#delete-movement-btn").addEventListener("click", () => {
  if (state.editingId && confirm("¿Eliminar este movimiento?")) {
    Store.deleteMovement(state.editingId);
    state.editingId = null;
    showToast("Movimiento eliminado");
    setView("dashboard");
  }
});

// ---------- Settings ----------
function renderSettings() {
  const settings = Store.getSettings();
  $("#currency-select").value = settings.currency;

  const list = $("#category-manage-list");
  list.innerHTML = "";
  Store.getCategories().forEach((c) => {
    const row = document.createElement("div");
    row.className = "category-manage-row";
    row.innerHTML = `<span class="icon-swatch">${c.icon}</span><span style="flex:1">${escapeHtml(c.name)}</span>`;
    row.addEventListener("click", () => openCategoryModal(c.id));
    list.appendChild(row);
  });
}

$("#currency-select").addEventListener("change", (e) => {
  Store.updateSettings({ currency: e.target.value });
  showToast("Divisa actualizada");
});

$("#add-category-btn").addEventListener("click", () => openCategoryModal(null));

function openCategoryModal(categoryId) {
  state.editingCategoryId = categoryId;
  const modal = $("#category-modal");
  if (categoryId) {
    const c = Store.getCategory(categoryId);
    $("#category-modal-title").textContent = "Editar categoría";
    $("#cat-name-input").value = c.name;
    $("#cat-icon-input").value = c.icon;
    $("#cat-color-input").value = c.color;
    $("#cat-delete-btn").hidden = false;
  } else {
    $("#category-modal-title").textContent = "Nueva categoría";
    $("#cat-name-input").value = "";
    $("#cat-icon-input").value = "🏷️";
    $("#cat-color-input").value = "#8a94a6";
    $("#cat-delete-btn").hidden = true;
  }
  modal.hidden = false;
}

$("#cat-cancel-btn").addEventListener("click", () => ($("#category-modal").hidden = true));

$("#cat-save-btn").addEventListener("click", () => {
  const name = $("#cat-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre a la categoría");
    return;
  }
  const icon = $("#cat-icon-input").value.trim() || "🏷️";
  const color = $("#cat-color-input").value;
  if (state.editingCategoryId) {
    Store.updateCategory(state.editingCategoryId, { name, icon, color });
  } else {
    Store.addCategory({ name, icon, color });
  }
  $("#category-modal").hidden = true;
  renderSettings();
  showToast("Categoría guardada");
});

$("#cat-delete-btn").addEventListener("click", () => {
  if (state.editingCategoryId && confirm("¿Eliminar categoría? Sus movimientos pasarán a «Sin categoría».")) {
    Store.deleteCategory(state.editingCategoryId);
    $("#category-modal").hidden = true;
    renderSettings();
    showToast("Categoría eliminada");
  }
});

// ---------- Wallet (Cartera) ----------
function renderWallet() {
  const currency = Store.getSettings().currency;
  const wallet = Store.getWallet();

  const banksTotal = wallet.banks.reduce((s, b) => s + b.balance, 0);
  const investmentsTotal = wallet.investments.reduce((s, i) => s + i.currentValue, 0);
  const total = wallet.cash + banksTotal + investmentsTotal;

  $("#wallet-total").textContent = formatMoney(total, currency);
  $("#cash-amount").textContent = formatMoney(wallet.cash, currency);
  $("#banks-total").textContent = formatMoney(banksTotal, currency);
  $("#investments-total").textContent = formatMoney(investmentsTotal, currency);

  const banksList = $("#banks-list");
  banksList.innerHTML = "";
  if (!wallet.banks.length) {
    banksList.innerHTML = '<div class="empty-state" style="padding:12px 0">Sin cuentas bancarias todavía.</div>';
  } else {
    wallet.banks.forEach((b) => {
      const row = document.createElement("div");
      row.className = "wallet-item-row";
      row.innerHTML = `
        <div><div class="wi-name">${escapeHtml(b.name)}</div></div>
        <div><div class="wi-value">${formatMoney(b.balance, currency)}</div></div>
      `;
      row.addEventListener("click", () => openBankModal(b.id));
      banksList.appendChild(row);
    });
  }

  const invList = $("#investments-list");
  invList.innerHTML = "";
  if (!wallet.investments.length) {
    invList.innerHTML = '<div class="empty-state" style="padding:12px 0">Sin inversiones todavía.</div>';
  } else {
    wallet.investments.forEach((inv) => {
      const gain = inv.currentValue - inv.invested;
      const gainPct = inv.invested ? (gain / inv.invested) * 100 : 0;
      const gainClass = gain > 0 ? "up" : gain < 0 ? "down" : "";
      const sign = gain > 0 ? "+" : "";
      const row = document.createElement("div");
      row.className = "wallet-item-row";
      row.innerHTML = `
        <div>
          <div class="wi-name">${escapeHtml(inv.name)}</div>
          <div class="wi-sub">${escapeHtml(inv.bank || "Sin banco")} · invertido ${formatMoney(inv.invested, currency)}</div>
        </div>
        <div>
          <div class="wi-value">${formatMoney(inv.currentValue, currency)}</div>
          <div class="wi-gain ${gainClass}">${sign}${formatMoney(gain, currency)} (${sign}${gainPct.toFixed(1)}%)</div>
        </div>
      `;
      row.addEventListener("click", () => openInvestmentModal(inv.id));
      invList.appendChild(row);
    });
  }
}

$("#edit-cash-btn").addEventListener("click", () => {
  $("#cash-input").value = Store.getWallet().cash || "";
  $("#cash-modal").hidden = false;
});
$("#cash-cancel-btn").addEventListener("click", () => ($("#cash-modal").hidden = true));
$("#cash-save-btn").addEventListener("click", () => {
  const amount = parseFloat($("#cash-input").value) || 0;
  Store.setCash(amount);
  $("#cash-modal").hidden = true;
  renderWallet();
  showToast("Efectivo actualizado");
});

function openBankModal(bankId) {
  state.editingBankId = bankId;
  if (bankId) {
    const b = Store.getWallet().banks.find((x) => x.id === bankId);
    $("#bank-modal-title").textContent = "Editar cuenta bancaria";
    $("#bank-name-input").value = b.name;
    $("#bank-balance-input").value = b.balance;
    $("#bank-delete-btn").hidden = false;
  } else {
    $("#bank-modal-title").textContent = "Nueva cuenta bancaria";
    $("#bank-name-input").value = "";
    $("#bank-balance-input").value = "";
    $("#bank-delete-btn").hidden = true;
  }
  $("#bank-modal").hidden = false;
}
$("#add-bank-btn").addEventListener("click", () => openBankModal(null));
$("#bank-cancel-btn").addEventListener("click", () => ($("#bank-modal").hidden = true));
$("#bank-save-btn").addEventListener("click", () => {
  const name = $("#bank-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre al banco");
    return;
  }
  const balance = parseFloat($("#bank-balance-input").value) || 0;
  if (state.editingBankId) {
    Store.updateBankAccount(state.editingBankId, { name, balance });
  } else {
    Store.addBankAccount({ name, balance });
  }
  $("#bank-modal").hidden = true;
  renderWallet();
  showToast("Cuenta guardada");
});
$("#bank-delete-btn").addEventListener("click", () => {
  if (state.editingBankId && confirm("¿Eliminar esta cuenta bancaria?")) {
    Store.deleteBankAccount(state.editingBankId);
    $("#bank-modal").hidden = true;
    renderWallet();
    showToast("Cuenta eliminada");
  }
});

function openInvestmentModal(investmentId) {
  state.editingInvestmentId = investmentId;
  if (investmentId) {
    const inv = Store.getWallet().investments.find((x) => x.id === investmentId);
    $("#investment-modal-title").textContent = "Editar inversión";
    $("#inv-name-input").value = inv.name;
    $("#inv-bank-input").value = inv.bank || "";
    $("#inv-invested-input").value = inv.invested;
    $("#inv-current-input").value = inv.currentValue;
    $("#inv-delete-btn").hidden = false;
  } else {
    $("#investment-modal-title").textContent = "Nueva inversión";
    $("#inv-name-input").value = "";
    $("#inv-bank-input").value = "";
    $("#inv-invested-input").value = "";
    $("#inv-current-input").value = "";
    $("#inv-delete-btn").hidden = true;
  }
  $("#investment-modal").hidden = false;
}
$("#add-investment-btn").addEventListener("click", () => openInvestmentModal(null));
$("#inv-cancel-btn").addEventListener("click", () => ($("#investment-modal").hidden = true));
$("#inv-save-btn").addEventListener("click", () => {
  const name = $("#inv-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre al fondo");
    return;
  }
  const bank = $("#inv-bank-input").value.trim();
  const invested = parseFloat($("#inv-invested-input").value) || 0;
  const currentValue = parseFloat($("#inv-current-input").value) || 0;
  if (state.editingInvestmentId) {
    Store.updateInvestment(state.editingInvestmentId, { name, bank, invested, currentValue });
  } else {
    Store.addInvestment({ name, bank, invested, currentValue });
  }
  $("#investment-modal").hidden = true;
  renderWallet();
  showToast("Inversión guardada");
});
$("#inv-delete-btn").addEventListener("click", () => {
  if (state.editingInvestmentId && confirm("¿Eliminar esta inversión?")) {
    Store.deleteInvestment(state.editingInvestmentId);
    $("#investment-modal").hidden = true;
    renderWallet();
    showToast("Inversión eliminada");
  }
});

// ---------- Export / Import / Reset ----------
$("#export-btn").addEventListener("click", () => {
  const blob = new Blob([Store.exportData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cuentas-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

$("#import-btn").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Store.importData(reader.result);
      showToast("Datos importados");
      renderSettings();
    } catch (err) {
      showToast("El archivo no es válido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

$("#reset-btn").addEventListener("click", () => {
  if (confirm("Esto borra todos tus movimientos y categorías personalizadas. ¿Continuar?")) {
    Store.resetAll();
    showToast("Datos borrados");
    setView("dashboard");
  }
});

// ---------- Refresh helper ----------
function refreshCurrentView() {
  setView(state.view);
}

// ---------- Service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ---------- Init ----------
$("#date-input").value = todayISO();
setView("dashboard");
