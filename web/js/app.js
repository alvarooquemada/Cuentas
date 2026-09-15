import {
  Store,
  formatMoney,
  formatPercent,
  todayISO,
  monthKey,
  monthLabel,
  rangeForPeriod,
  periodLabel,
  inRange,
  OPERATION_TYPES,
  INVESTMENT_TYPES,
  WATCHLIST_STATUSES,
  GOAL_KINDS,
} from "./store/index.js";
import { drawDonut, drawBars, drawLine } from "./charts.js";
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "./firebase.js";

const INVESTMENT_TYPE_COLORS = {
  etf: "#4f6f8f",
  fondo: "#3f8f86",
  accion: "#a1527a",
  liquidez: "#4fb3c4",
  otro: "#6b6759",
};
const LIQUIDITY_COLOR = "#4fb3c4";
const INVESTMENTS_COLOR = "#b98b3d";

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
  editingAccountId: null,
  editingInvestmentId: null,
  editingOperationId: null,
  operationInvestmentId: null,
  currentInvestmentId: null,
  editingGoalId: null,
  editingWatchlistId: null,
  editingIdeaId: null,
  watchlistStatusFilter: "all",
  createInvestmentThenOperation: false,
  walletTab: "general",
  portfolioHorizon: "all",
  editingDebtId: null,
  listRangeFilter: "all",
  listAccountFilter: "all",
  listSort: "date-desc",
};

// ---------- Navigation ----------
const titles = {
  dashboard: "Resumen",
  list: "Movimientos",
  add: "Nuevo movimiento",
  wallet: "Cartera",
  "investment-detail": "Inversión",
  settings: "Ajustes",
  accounts: "Cuentas",
  debts: "Deudas",
};

function setView(view) {
  state.view = view;
  $$(".view").forEach((v) => v.classList.remove("active"));
  $(`#view-${view}`).classList.add("active");
  $("#topbar-title").textContent = view === "add" && state.editingId ? "Editar movimiento" : titles[view];
  $$(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  if (view === "list") renderList();
  if (view === "wallet") renderWalletTab(state.walletTab);
  if (view === "investment-detail") renderInvestmentDetail();
  if (view === "settings") renderSettings();
  if (view === "accounts") renderAccountsView();
  if (view === "debts") renderDebtsView();
}

$$(".bottom-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view === "add") openActionSheet();
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
  Store.recordNetWorthSnapshot();

  const settings = Store.getSettings();
  const currency = settings.currency;

  // ---- Patrimonio neto ----
  const nw = Store.computeNetWorth();
  $("#net-worth-amount").textContent = formatMoney(nw.total, currency);
  $("#nw-assets").textContent = formatMoney(nw.liquidity + nw.investments, currency);
  $("#nw-debts").textContent = formatMoney(nw.debts, currency);
  $("#nw-liquidity").textContent = formatMoney(nw.liquidity, currency);

  const nwChange = Store.netWorthChangeSince(30);
  const nwChangeEl = $("#net-worth-change");
  if (nwChange) {
    const sign = nwChange.diff > 0 ? "+" : "";
    nwChangeEl.textContent = `${sign}${formatMoney(nwChange.diff, currency)} (${formatPercent(nwChange.pct)}) últimos 30 días`;
    nwChangeEl.className = "wallet-total-sub " + (nwChange.diff >= 0 ? "up" : "down");
  } else {
    nwChangeEl.textContent = "Todavía no hay suficiente histórico";
    nwChangeEl.className = "wallet-total-sub";
  }

  // ---- Evolución patrimonial ----
  const history = Store.getNetWorthHistory();
  const points = history.map((h) => ({
    date: h.date,
    value: h.total,
    dateLabel: new Date(h.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
  }));
  drawLine($("#networth-chart"), points, { lineColor: "#c9a24a", fillColor: "rgba(201,162,74,0.15)", labelColor: "#94918c" });

  // ---- Distribución del patrimonio ----
  const wealthSlices = [];
  if (nw.liquidity > 0) wealthSlices.push({ value: nw.liquidity, color: LIQUIDITY_COLOR, name: "Liquidez", icon: "💧" });
  if (nw.investments > 0) wealthSlices.push({ value: nw.investments, color: INVESTMENTS_COLOR, name: "Inversiones", icon: "📈" });
  drawDonut($("#wealth-donut"), wealthSlices, { emptyColor: "rgba(154,151,140,0.18)" });
  const wealthLegend = $("#wealth-legend");
  wealthLegend.innerHTML = "";
  if (!wealthSlices.length) {
    wealthLegend.innerHTML = '<div class="empty-state" style="padding:8px 0">Añade cuentas o inversiones para ver la distribución.</div>';
  } else {
    wealthSlices.forEach((s) => {
      const row = document.createElement("div");
      row.className = "cat-legend-item";
      row.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="name">${s.icon} ${s.name}</span><span class="value">${formatMoney(s.value, currency)}</span>`;
      wealthLegend.appendChild(row);
    });
  }

  // ---- Ingresos / gastos / ahorro del periodo ----
  $$("#period-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.period === state.dashPeriod));

  const movements = Store.getMovements();
  const range = rangeForPeriod(state.dashPeriod);
  const periodMovs = movements.filter((m) => inRange(m.date, range));
  const label = periodLabel(state.dashPeriod);
  $("#dash-period-label").textContent = `Ahorro ${label}`;
  $("#dash-cat-title").textContent = `Por categoría ${label}`;

  const income = periodMovs.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0);
  const expense = periodMovs.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  $("#dash-balance").textContent = formatMoney(balance, currency);
  $("#dash-balance").classList.toggle("negative", balance < 0);
  $("#dash-income").textContent = formatMoney(income, currency);
  $("#dash-expense").textContent = formatMoney(expense, currency);
  $("#dash-savings-rate").textContent = formatPercent(savingsRate);
  $("#dash-savings-rate").className = "stat-value " + (savingsRate >= 0 ? "income" : "expense");

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

  drawDonut($("#dash-donut"), slices, { emptyColor: "rgba(154,151,140,0.18)" });
  const legend = $("#dash-legend");
  legend.innerHTML = "";
  if (!slices.length) {
    legend.innerHTML = `<div class="empty-state" style="padding:8px 0">Sin gastos ${label}</div>`;
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
    labelColor: "#9a978c",
    incomeColor: "#4bbf8a",
    expenseColor: "#d97a90",
  });

  const recent = $("#dash-recent");
  recent.innerHTML = "";
  const recentMovs = movements.slice(0, 5);
  if (!recentMovs.length) {
    recent.innerHTML = '<div class="empty-state">Todavía no hay movimientos.<br>Toca «Añadir» para registrar el primero.</div>';
  } else {
    recentMovs.forEach((m) => recent.appendChild(movementRow(m, currency)));
  }

  renderGoals();
}

// ---------- Objetivos ----------
function renderGoals() {
  const currency = Store.getSettings().currency;
  const list = $("#goals-list");
  list.innerHTML = "";
  const goals = Store.getGoals();
  if (!goals.length) {
    list.innerHTML = '<div class="empty-state" style="padding:12px 0">Sin objetivos todavía.</div>';
    return;
  }
  goals.forEach((g) => {
    const progress = Store.computeGoalProgress(g);
    const pct = Math.max(0, Math.min(100, progress.pct));
    const kindLabel = GOAL_KINDS.find((k) => k.id === g.kind)?.label || g.kind;
    const row = document.createElement("div");
    row.className = "card goal-card";
    row.innerHTML = `
      <div class="wallet-section-header">
        <div>
          <div style="font-weight:700;font-size:14px">${escapeHtml(g.name)}</div>
          <div class="wi-sub">${kindLabel}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800">${formatMoney(progress.current, currency)}</div>
          <div class="wi-sub">de ${formatMoney(progress.target, currency)}</div>
        </div>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
    `;
    row.addEventListener("click", () => openGoalModal(g.id));
    list.appendChild(row);
  });
}

$("#add-goal-btn").addEventListener("click", () => openGoalModal(null));

function openGoalModal(goalId) {
  state.editingGoalId = goalId;
  const kindSelect = $("#goal-kind-select");
  kindSelect.innerHTML = GOAL_KINDS.map((k) => `<option value="${k.id}">${k.label}</option>`).join("");
  if (goalId) {
    const g = Store.getGoal(goalId);
    $("#goal-modal-title").textContent = "Editar objetivo";
    kindSelect.value = g.kind;
    $("#goal-name-input").value = g.name;
    $("#goal-amount-input").value = g.targetAmount;
    $("#goal-delete-btn").hidden = false;
  } else {
    $("#goal-modal-title").textContent = "Nuevo objetivo";
    kindSelect.value = "ahorro_mensual";
    $("#goal-name-input").value = "";
    $("#goal-amount-input").value = "";
    $("#goal-delete-btn").hidden = true;
  }
  $("#goal-modal").hidden = false;
}

$("#goal-cancel-btn").addEventListener("click", () => ($("#goal-modal").hidden = true));
$("#goal-save-btn").addEventListener("click", () => {
  const name = $("#goal-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre al objetivo");
    return;
  }
  const kind = $("#goal-kind-select").value;
  const targetAmount = parseFloat($("#goal-amount-input").value) || 0;
  if (state.editingGoalId) {
    Store.updateGoal(state.editingGoalId, { kind, name, targetAmount });
  } else {
    Store.addGoal({ kind, name, targetAmount });
  }
  $("#goal-modal").hidden = true;
  renderGoals();
  showToast("Objetivo guardado");
});
$("#goal-delete-btn").addEventListener("click", () => {
  if (state.editingGoalId && confirm("¿Eliminar este objetivo?")) {
    Store.deleteGoal(state.editingGoalId);
    $("#goal-modal").hidden = true;
    renderGoals();
    showToast("Objetivo eliminado");
  }
});

// ---------- Movement row ----------
function movementRow(m, currency) {
  const cat = Store.getCategory(m.categoryId);
  const account = m.accountId ? Store.getAccount(m.accountId) : null;
  const row = document.createElement("div");
  row.className = "movement-row";
  const color = cat ? cat.color : "#8a94a6";
  const metaParts = [formatDate(m.date), cat ? cat.name : "Sin categoría"];
  if (account) metaParts.push(account.name);
  row.innerHTML = `
    <div class="icon" style="background:${color}22;color:${color}">${cat ? cat.icon : "❔"}</div>
    <div class="info">
      <div class="concept">${escapeHtml(m.concept || (cat ? cat.name : "Sin categoría"))}</div>
      <div class="meta">${metaParts.map(escapeHtml).join(" · ")}</div>
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

function renderAccountFilters() {
  const wrap = $("#account-filters");
  wrap.innerHTML = "";
  const accounts = Store.getAccounts();
  if (!accounts.length) return;
  const allChip = document.createElement("button");
  allChip.className = "chip" + (state.listAccountFilter === "all" ? " active" : "");
  allChip.textContent = "Todas las cuentas";
  allChip.addEventListener("click", () => {
    state.listAccountFilter = "all";
    renderList();
  });
  wrap.appendChild(allChip);
  accounts.forEach((a) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (state.listAccountFilter === a.id ? " active" : "");
    chip.textContent = a.name;
    chip.addEventListener("click", () => {
      state.listAccountFilter = a.id;
      renderList();
    });
    wrap.appendChild(chip);
  });
  const noneChip = document.createElement("button");
  noneChip.className = "chip" + (state.listAccountFilter === "none" ? " active" : "");
  noneChip.textContent = "Sin cuenta";
  noneChip.addEventListener("click", () => {
    state.listAccountFilter = "none";
    renderList();
  });
  wrap.appendChild(noneChip);
}

$$("#period-filters .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    state.listRangeFilter = chip.dataset.range;
    renderList();
  });
});

$("#sort-select").addEventListener("change", (e) => {
  state.listSort = e.target.value;
  renderList();
});

function renderList() {
  const currency = Store.getSettings().currency;
  renderCatFilters();
  renderAccountFilters();
  $$("#type-filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.type === state.listTypeFilter));
  $$("#period-filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.range === state.listRangeFilter));
  $("#sort-select").value = state.listSort;

  let movements = Store.getMovements();
  if (state.listTypeFilter !== "all") movements = movements.filter((m) => m.type === state.listTypeFilter);
  if (state.listCatFilter !== "all") movements = movements.filter((m) => m.categoryId === state.listCatFilter);
  if (state.listAccountFilter === "none") movements = movements.filter((m) => !m.accountId);
  else if (state.listAccountFilter !== "all") movements = movements.filter((m) => m.accountId === state.listAccountFilter);
  if (state.listRangeFilter !== "all") {
    const range = rangeForPeriod(state.listRangeFilter);
    movements = movements.filter((m) => inRange(m.date, range));
  }
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    movements = movements.filter((m) => {
      const cat = Store.getCategory(m.categoryId);
      return (m.concept || "").toLowerCase().includes(q) || (cat && cat.name.toLowerCase().includes(q));
    });
  }

  if (state.listSort === "date-asc") movements = movements.slice().reverse();
  else if (state.listSort === "amount-desc") movements = movements.slice().sort((a, b) => b.amount - a.amount);
  else if (state.listSort === "amount-asc") movements = movements.slice().sort((a, b) => a.amount - b.amount);

  const container = $("#movements-list");
  container.innerHTML = "";
  if (!movements.length) {
    container.innerHTML = '<div class="empty-state">No hay movimientos con estos filtros.</div>';
    return;
  }

  const groupByMonth = state.listSort === "date-desc" || state.listSort === "date-asc";
  if (!groupByMonth) {
    movements.forEach((m) => container.appendChild(movementRow(m, currency)));
    return;
  }

  const groups = new Map();
  movements.forEach((m) => {
    const key = monthKey(m.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });

  const keys = Array.from(groups.keys()).sort((a, b) => (state.listSort === "date-asc" ? a.localeCompare(b) : b.localeCompare(a)));
  keys.forEach((key) => {
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

function renderAccountSelect() {
  const select = $("#account-select");
  const accounts = Store.getAccounts();
  select.innerHTML = '<option value="">Sin cuenta</option>' +
    accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
}

function openAddForm(movementId) {
  state.editingId = movementId;
  renderAccountSelect();
  if (movementId) {
    const m = Store.getMovement(movementId);
    setAddType(m.type);
    state.addCategoryId = m.categoryId;
    $("#amount-input").value = m.amount;
    $("#concept-input").value = m.concept || "";
    $("#date-input").value = m.date;
    $("#account-select").value = m.accountId || "";
    $("#delete-movement-btn").hidden = false;
  } else {
    setAddType("expense");
    state.addCategoryId = null;
    $("#amount-input").value = "";
    $("#concept-input").value = "";
    $("#date-input").value = todayISO();
    $("#account-select").value = "";
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
    accountId: $("#account-select").value || null,
    date,
  };
  if (state.editingId) {
    Store.updateMovement(state.editingId, payload);
    showToast("Movimiento actualizado");
  } else {
    Store.addMovement(payload);
    showToast("Movimiento guardado");
  }
  Store.recordNetWorthSnapshot();
  state.editingId = null;
  setView("dashboard");
});

$("#delete-movement-btn").addEventListener("click", () => {
  if (state.editingId && confirm("¿Eliminar este movimiento?")) {
    Store.deleteMovement(state.editingId);
    Store.recordNetWorthSnapshot();
    state.editingId = null;
    showToast("Movimiento eliminado");
    setView("dashboard");
  }
});

// ---------- Settings ----------
function renderSettings() {
  const settings = Store.getSettings();
  $("#currency-select").value = settings.currency;
  $("#account-email-label").textContent = auth.currentUser ? auth.currentUser.email : "—";

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

$("#open-accounts-btn").addEventListener("click", () => setView("accounts"));
$("#open-debts-btn").addEventListener("click", () => setView("debts"));

// ---------- Wallet (Cartera) ----------
function accountTypeLabel(type) {
  return type === "bank" ? "Banco" : "Efectivo";
}

$$("#wallet-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.walletTab = btn.dataset.tab;
    renderWalletTab(state.walletTab);
  });
});

function renderWalletTab(tab) {
  $$("#wallet-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".wallet-panel").forEach((p) => p.classList.toggle("active", p.id === `wallet-panel-${tab}`));
  if (tab === "general") renderPortfolioGeneral();
  if (tab === "assets") renderInvestmentsList();
  if (tab === "watchlist") renderWatchlist();
  if (tab === "ideas") renderIdeas();
}

const HORIZONS = [
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "6m", label: "6M", days: 182 },
  { id: "1y", label: "1A", days: 365 },
  { id: "3y", label: "3A", days: 365 * 3 },
  { id: "5y", label: "5A", days: 365 * 5 },
  { id: "all", label: "Todo", days: null },
];

function renderPortfolioGeneral() {
  const currency = Store.getSettings().currency;
  const investments = Store.getInvestments();
  const computed = investments.map((inv) => Store.computeInvestment(inv));
  const aportado = computed.reduce((s, c) => s + c.aportado, 0);
  const valorActual = computed.reduce((s, c) => s + c.valorActual, 0);
  const ganancia = computed.reduce((s, c) => s + c.ganancia, 0);
  const rentabilidad = aportado > 0 ? (ganancia / aportado) * 100 : 0;

  $("#portfolio-value").textContent = formatMoney(valorActual, currency);
  $("#portfolio-return").textContent = `${formatPercent(rentabilidad)} rentabilidad total`;
  $("#portfolio-return").className = "wallet-total-sub " + (ganancia >= 0 ? "up" : "down");
  $("#portfolio-invested").textContent = formatMoney(aportado, currency);
  $("#portfolio-gain").textContent = formatMoney(ganancia, currency);
  $("#portfolio-gain").className = "stat-value " + (ganancia > 0 ? "income" : ganancia < 0 ? "expense" : "");

  const history = Store.getNetWorthHistory();
  const earliestDate = history.length ? history[0].date : null;
  const daysAvailable = earliestDate ? Math.floor((Date.now() - new Date(earliestDate + "T00:00:00").getTime()) / 86400000) : 0;

  const horizonWrap = $("#horizon-toggle");
  horizonWrap.innerHTML = "";
  HORIZONS.forEach((h) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (state.portfolioHorizon === h.id ? " active" : "");
    btn.textContent = h.label;
    const disabled = h.days !== null && daysAvailable < h.days && h.id !== "1m";
    if (disabled) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
    } else {
      btn.addEventListener("click", () => {
        state.portfolioHorizon = h.id;
        renderPortfolioGeneral();
      });
    }
    horizonWrap.appendChild(btn);
  });

  const horizon = HORIZONS.find((h) => h.id === state.portfolioHorizon) || HORIZONS[HORIZONS.length - 1];
  let filteredHistory = history;
  if (horizon.days !== null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - horizon.days);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    filteredHistory = history.filter((h) => h.date >= cutoffISO);
  }
  const points = filteredHistory.map((h) => ({
    date: h.date,
    value: h.investments,
    dateLabel: new Date(h.date + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
  }));
  drawLine($("#portfolio-chart"), points, { lineColor: "#c9a24a", fillColor: "rgba(201,162,74,0.15)", labelColor: "#94918c" });

  const byType = new Map();
  computed.forEach((c, i) => {
    const type = investments[i].type || "otro";
    byType.set(type, (byType.get(type) || 0) + c.valorActual);
  });
  const liquidity = Store.getTotalLiquidity();
  if (liquidity > 0) byType.set("liquidez", (byType.get("liquidez") || 0) + liquidity);

  const distSlices = Array.from(byType.entries())
    .filter(([, value]) => value > 0)
    .map(([type, value]) => ({
      value,
      color: INVESTMENT_TYPE_COLORS[type] || "#6b6759",
      name: type === "liquidez" ? "Liquidez" : (INVESTMENT_TYPES.find((t) => t.id === type)?.label || type),
    }))
    .sort((a, b) => b.value - a.value);

  drawDonut($("#portfolio-donut"), distSlices, { emptyColor: "rgba(154,151,140,0.18)" });
  const portfolioLegend = $("#portfolio-legend");
  portfolioLegend.innerHTML = "";
  const distTotal = distSlices.reduce((s, x) => s + x.value, 0);
  if (!distSlices.length) {
    portfolioLegend.innerHTML = '<div class="empty-state" style="padding:8px 0">Sin datos todavía.</div>';
  } else {
    distSlices.forEach((s) => {
      const pct = distTotal ? (s.value / distTotal) * 100 : 0;
      const row = document.createElement("div");
      row.className = "cat-legend-item";
      row.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="name">${s.name}</span><span class="value">${formatMoney(s.value, currency)} · ${pct.toFixed(0)}%</span>`;
      portfolioLegend.appendChild(row);
    });
  }
}

function renderInvestmentsList() {
  const currency = Store.getSettings().currency;
  const investments = Store.getInvestments();
  const invList = $("#investments-list");
  invList.innerHTML = "";
  $("#investments-total").textContent = formatMoney(Store.getTotalInvestmentsValue(), currency);
  if (!investments.length) {
    invList.innerHTML = '<div class="empty-state" style="padding:12px 0">Sin inversiones todavía.</div>';
  } else {
    investments.forEach((inv) => {
      const c = Store.computeInvestment(inv);
      const gainClass = c.ganancia > 0 ? "up" : c.ganancia < 0 ? "down" : "";
      const row = document.createElement("div");
      row.className = "wallet-item-row";
      row.innerHTML = `
        <div>
          <div class="wi-name">${escapeHtml(inv.name)}</div>
          <div class="wi-sub">${escapeHtml(inv.broker || "Sin broker")} · aportado ${formatMoney(c.aportado, currency)}</div>
        </div>
        <div>
          <div class="wi-value">${formatMoney(c.valorActual, currency)}</div>
          <div class="wi-gain ${gainClass}">${formatMoney(c.ganancia, currency)} (${formatPercent(c.rentabilidad)})</div>
        </div>
      `;
      row.addEventListener("click", () => {
        state.currentInvestmentId = inv.id;
        setView("investment-detail");
      });
      invList.appendChild(row);
    });
  }
}

// ---- Cuentas (Ajustes → Cuentas) ----
function renderAccountsView() {
  const currency = Store.getSettings().currency;
  $("#accounts-total").textContent = formatMoney(Store.getTotalLiquidity(), currency);
  const accounts = Store.getAccounts();
  const accountsList = $("#accounts-list");
  accountsList.innerHTML = "";
  if (!accounts.length) {
    accountsList.innerHTML = '<div class="empty-state" style="padding:12px 0">Sin cuentas todavía.</div>';
  } else {
    accounts.forEach((a) => {
      const balance = Store.getAccountBalance(a.id);
      const row = document.createElement("div");
      row.className = "wallet-item-row";
      row.innerHTML = `
        <div><div class="wi-name">${escapeHtml(a.name)}</div><div class="wi-sub">${accountTypeLabel(a.type)}</div></div>
        <div><div class="wi-value">${formatMoney(balance, currency)}</div></div>
      `;
      row.addEventListener("click", () => openAccountModal(a.id));
      accountsList.appendChild(row);
    });
  }
}

// ---- Deudas (Ajustes → Deudas) ----
function renderDebtsView() {
  const currency = Store.getSettings().currency;
  $("#debts-total").textContent = formatMoney(Store.getTotalDebts(), currency);
  const debts = Store.getDebts();
  const list = $("#debts-list");
  list.innerHTML = "";
  if (!debts.length) {
    list.innerHTML = '<div class="empty-state" style="padding:12px 0">Sin deudas registradas.</div>';
  } else {
    debts.forEach((d) => {
      const row = document.createElement("div");
      row.className = "wallet-item-row";
      row.innerHTML = `
        <div><div class="wi-name">${escapeHtml(d.name)}</div></div>
        <div><div class="wi-value expense">${formatMoney(d.amount, currency)}</div></div>
      `;
      row.addEventListener("click", () => openDebtModal(d.id));
      list.appendChild(row);
    });
  }
}
$("#add-debt-btn").addEventListener("click", () => openDebtModal(null));
function openDebtModal(debtId) {
  state.editingDebtId = debtId;
  if (debtId) {
    const d = Store.getDebt(debtId);
    $("#debt-modal-title").textContent = "Editar deuda";
    $("#debt-name-input").value = d.name;
    $("#debt-amount-input").value = d.amount;
    $("#debt-delete-btn").hidden = false;
  } else {
    $("#debt-modal-title").textContent = "Nueva deuda";
    $("#debt-name-input").value = "";
    $("#debt-amount-input").value = "";
    $("#debt-delete-btn").hidden = true;
  }
  $("#debt-modal").hidden = false;
}
$("#debt-cancel-btn").addEventListener("click", () => ($("#debt-modal").hidden = true));
$("#debt-save-btn").addEventListener("click", () => {
  const name = $("#debt-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre a la deuda");
    return;
  }
  const amount = parseFloat($("#debt-amount-input").value) || 0;
  if (state.editingDebtId) {
    Store.updateDebt(state.editingDebtId, { name, amount });
  } else {
    Store.addDebt({ name, amount });
  }
  Store.recordNetWorthSnapshot();
  $("#debt-modal").hidden = true;
  renderDebtsView();
  showToast("Deuda guardada");
});
$("#debt-delete-btn").addEventListener("click", () => {
  if (state.editingDebtId && confirm("¿Eliminar esta deuda?")) {
    Store.deleteDebt(state.editingDebtId);
    Store.recordNetWorthSnapshot();
    $("#debt-modal").hidden = true;
    renderDebtsView();
    showToast("Deuda eliminada");
  }
});

// ---- Cuentas ----
function openAccountModal(accountId) {
  state.editingAccountId = accountId;
  const openingField = $("#account-opening-field");
  if (accountId) {
    const a = Store.getAccount(accountId);
    $("#account-modal-title").textContent = "Editar cuenta";
    $("#account-name-input").value = a.name;
    $("#account-type-select").value = a.type;
    openingField.hidden = true;
    $("#account-delete-btn").hidden = false;
    $("#account-adjust-btn").hidden = false;
  } else {
    $("#account-modal-title").textContent = "Nueva cuenta";
    $("#account-name-input").value = "";
    $("#account-type-select").value = "cash";
    $("#account-opening-input").value = "";
    openingField.hidden = false;
    $("#account-delete-btn").hidden = true;
    $("#account-adjust-btn").hidden = true;
  }
  $("#account-modal").hidden = false;
}
$("#add-account-btn").addEventListener("click", () => openAccountModal(null));
$("#account-cancel-btn").addEventListener("click", () => ($("#account-modal").hidden = true));
$("#account-save-btn").addEventListener("click", () => {
  const name = $("#account-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre a la cuenta");
    return;
  }
  const type = $("#account-type-select").value;
  if (state.editingAccountId) {
    Store.updateAccount(state.editingAccountId, { name, type });
  } else {
    const openingBalance = parseFloat($("#account-opening-input").value) || 0;
    Store.addAccount({ name, type, openingBalance });
  }
  Store.recordNetWorthSnapshot();
  $("#account-modal").hidden = true;
  renderAccountsView();
  showToast("Cuenta guardada");
});
$("#account-delete-btn").addEventListener("click", () => {
  if (state.editingAccountId && confirm("¿Eliminar esta cuenta? Los movimientos asignados quedarán sin cuenta.")) {
    Store.deleteAccount(state.editingAccountId);
    Store.recordNetWorthSnapshot();
    $("#account-modal").hidden = true;
    renderAccountsView();
    showToast("Cuenta eliminada");
  }
});
$("#account-adjust-btn").addEventListener("click", () => {
  $("#account-modal").hidden = true;
  $("#adjust-input").value = Store.getAccountBalance(state.editingAccountId);
  $("#adjust-modal").hidden = false;
});
$("#adjust-cancel-btn").addEventListener("click", () => ($("#adjust-modal").hidden = true));
$("#adjust-save-btn").addEventListener("click", () => {
  const target = parseFloat($("#adjust-input").value);
  if (isNaN(target)) {
    showToast("Introduce un saldo válido");
    return;
  }
  Store.adjustAccountBalance(state.editingAccountId, target);
  Store.recordNetWorthSnapshot();
  $("#adjust-modal").hidden = true;
  renderAccountsView();
  showToast("Saldo ajustado");
});

// ---- Transferencias ----
function openTransferModal() {
  const accounts = Store.getAccounts();
  if (accounts.length < 2) {
    showToast("Necesitas al menos 2 cuentas para transferir");
    return;
  }
  const options = accounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  $("#transfer-from-select").innerHTML = options;
  $("#transfer-to-select").innerHTML = options;
  $("#transfer-to-select").selectedIndex = 1;
  $("#transfer-amount-input").value = "";
  $("#transfer-date-input").value = todayISO();
  $("#transfer-concept-input").value = "";
  $("#transfer-modal").hidden = false;
}
$("#transfer-cancel-btn").addEventListener("click", () => ($("#transfer-modal").hidden = true));
$("#transfer-save-btn").addEventListener("click", () => {
  const fromAccountId = $("#transfer-from-select").value;
  const toAccountId = $("#transfer-to-select").value;
  if (fromAccountId === toAccountId) {
    showToast("Elige dos cuentas distintas");
    return;
  }
  const amount = parseFloat($("#transfer-amount-input").value);
  if (!amount || amount <= 0) {
    showToast("Introduce un importe válido");
    return;
  }
  Store.addTransfer({
    fromAccountId,
    toAccountId,
    amount,
    date: $("#transfer-date-input").value || todayISO(),
    concept: $("#transfer-concept-input").value.trim(),
  });
  Store.recordNetWorthSnapshot();
  $("#transfer-modal").hidden = true;
  showToast("Transferencia registrada");
  setView("wallet");
});

// ---- Inversiones ----
function openInvestmentModal(investmentId) {
  state.editingInvestmentId = investmentId;
  const typeSelect = $("#inv-type-select");
  typeSelect.innerHTML = INVESTMENT_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
  if (investmentId) {
    const inv = Store.getInvestment(investmentId);
    $("#investment-modal-title").textContent = "Editar inversión";
    $("#inv-name-input").value = inv.name;
    typeSelect.value = inv.type;
    $("#inv-ticker-input").value = inv.ticker || "";
    $("#inv-isin-input").value = inv.isin || "";
    $("#inv-bank-input").value = inv.broker || "";
    $("#inv-delete-btn").hidden = false;
  } else {
    $("#investment-modal-title").textContent = "Nueva inversión";
    $("#inv-name-input").value = "";
    typeSelect.value = "etf";
    $("#inv-ticker-input").value = "";
    $("#inv-isin-input").value = "";
    $("#inv-bank-input").value = "";
    $("#inv-delete-btn").hidden = true;
  }
  $("#investment-modal").hidden = false;
}
$("#add-investment-btn").addEventListener("click", () => openInvestmentModal(null));
$("#inv-cancel-btn").addEventListener("click", () => ($("#investment-modal").hidden = true));
$("#inv-save-btn").addEventListener("click", () => {
  const name = $("#inv-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre a la inversión");
    return;
  }
  const payload = {
    name,
    type: $("#inv-type-select").value,
    ticker: $("#inv-ticker-input").value.trim(),
    isin: $("#inv-isin-input").value.trim(),
    broker: $("#inv-bank-input").value.trim(),
  };
  $("#investment-modal").hidden = true;
  if (state.editingInvestmentId) {
    Store.updateInvestment(state.editingInvestmentId, payload);
    showToast("Inversión actualizada");
    if (state.view === "wallet") renderWalletTab(state.walletTab);
    if (state.view === "investment-detail") renderInvestmentDetail();
  } else {
    const inv = Store.addInvestment(payload);
    showToast("Inversión creada");
    if (state.createInvestmentThenOperation) {
      state.createInvestmentThenOperation = false;
      openOperationModal(inv.id, null);
    } else if (state.view === "wallet") {
      renderWalletTab(state.walletTab);
    }
  }
});
$("#inv-delete-btn").addEventListener("click", () => {
  if (state.editingInvestmentId && confirm("¿Eliminar esta inversión y todas sus operaciones?")) {
    Store.deleteInvestment(state.editingInvestmentId);
    Store.recordNetWorthSnapshot();
    $("#investment-modal").hidden = true;
    state.walletTab = "assets";
    setView("wallet");
    showToast("Inversión eliminada");
  }
});

// ---- Detalle de inversión ----
function renderInvestmentDetail() {
  const inv = Store.getInvestment(state.currentInvestmentId);
  if (!inv) {
    state.walletTab = "assets";
    setView("wallet");
    return;
  }
  const currency = Store.getSettings().currency;
  const c = Store.computeInvestment(inv);
  const typeLabel = INVESTMENT_TYPES.find((t) => t.id === inv.type)?.label || inv.type;

  $("#inv-detail-name").textContent = inv.name;
  $("#inv-detail-sub").textContent = [typeLabel, inv.ticker, inv.broker].filter(Boolean).join(" · ");
  $("#inv-detail-invested").textContent = formatMoney(c.aportado, currency);
  $("#inv-detail-value").textContent = formatMoney(c.valorActual, currency);
  $("#inv-detail-gain").textContent = formatMoney(c.ganancia, currency);
  $("#inv-detail-gain").className = "stat-value " + (c.ganancia > 0 ? "income" : c.ganancia < 0 ? "expense" : "");
  $("#inv-detail-return").textContent = formatPercent(c.rentabilidad);

  const list = $("#inv-detail-ops-list");
  list.innerHTML = "";
  const ops = inv.operations.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (!ops.length) {
    list.innerHTML = '<div class="empty-state">Sin operaciones todavía.<br>Añade una compra, aportación o valoración.</div>';
  } else {
    ops.forEach((op) => {
      const label = OPERATION_TYPES.find((t) => t.id === op.type)?.label || op.type;
      const row = document.createElement("div");
      row.className = "wallet-item-row";
      row.innerHTML = `
        <div><div class="wi-name">${label}</div><div class="wi-sub">${formatDate(op.date)}${op.notes ? " · " + escapeHtml(op.notes) : ""}</div></div>
        <div><div class="wi-value">${formatMoney(op.amount, currency)}</div></div>
      `;
      row.addEventListener("click", () => openOperationModal(inv.id, op.id));
      list.appendChild(row);
    });
  }
}
$("#inv-detail-edit-btn").addEventListener("click", () => openInvestmentModal(state.currentInvestmentId));
$("#inv-detail-add-op-btn").addEventListener("click", () => openOperationModal(state.currentInvestmentId, null));

// ---- Operaciones ----
function openOperationModal(investmentId, operationId) {
  state.operationInvestmentId = investmentId;
  state.editingOperationId = operationId;
  const typeSelect = $("#op-type-select");
  typeSelect.innerHTML = OPERATION_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
  if (operationId) {
    const inv = Store.getInvestment(investmentId);
    const op = inv.operations.find((o) => o.id === operationId);
    $("#operation-modal-title").textContent = "Editar operación";
    typeSelect.value = op.type;
    $("#op-date-input").value = op.date;
    $("#op-amount-input").value = op.amount;
    $("#op-quantity-input").value = op.quantity ?? "";
    $("#op-price-input").value = op.price ?? "";
    $("#op-fees-input").value = op.fees || "";
    $("#op-notes-input").value = op.notes || "";
    $("#op-delete-btn").hidden = false;
  } else {
    $("#operation-modal-title").textContent = "Nueva operación";
    typeSelect.value = "compra";
    $("#op-date-input").value = todayISO();
    $("#op-amount-input").value = "";
    $("#op-quantity-input").value = "";
    $("#op-price-input").value = "";
    $("#op-fees-input").value = "";
    $("#op-notes-input").value = "";
    $("#op-delete-btn").hidden = true;
  }
  $("#operation-modal").hidden = false;
}
$("#op-cancel-btn").addEventListener("click", () => ($("#operation-modal").hidden = true));

function autoFillOperationAmount() {
  const qty = parseFloat($("#op-quantity-input").value);
  const price = parseFloat($("#op-price-input").value);
  if (qty && price && !$("#op-amount-input").value) {
    $("#op-amount-input").value = (qty * price).toFixed(2);
  }
}
$("#op-quantity-input").addEventListener("blur", autoFillOperationAmount);
$("#op-price-input").addEventListener("blur", autoFillOperationAmount);

$("#op-save-btn").addEventListener("click", () => {
  const amount = parseFloat($("#op-amount-input").value);
  if (!amount || amount <= 0) {
    showToast("Introduce un importe válido");
    return;
  }
  const payload = {
    type: $("#op-type-select").value,
    date: $("#op-date-input").value || todayISO(),
    amount,
    quantity: $("#op-quantity-input").value,
    price: $("#op-price-input").value,
    fees: parseFloat($("#op-fees-input").value) || 0,
    notes: $("#op-notes-input").value.trim(),
  };
  if (state.editingOperationId) {
    Store.updateOperation(state.operationInvestmentId, state.editingOperationId, payload);
    showToast("Operación actualizada");
  } else {
    Store.addOperation(state.operationInvestmentId, payload);
    showToast("Operación registrada");
  }
  Store.recordNetWorthSnapshot();
  $("#operation-modal").hidden = true;
  state.currentInvestmentId = state.operationInvestmentId;
  if (state.view === "investment-detail") renderInvestmentDetail();
  else setView("investment-detail");
});
$("#op-delete-btn").addEventListener("click", () => {
  if (state.editingOperationId && confirm("¿Eliminar esta operación?")) {
    Store.deleteOperation(state.operationInvestmentId, state.editingOperationId);
    Store.recordNetWorthSnapshot();
    $("#operation-modal").hidden = true;
    renderInvestmentDetail();
    showToast("Operación eliminada");
  }
});

// ---------- Hoja de acciones del botón + ----------
function openActionSheet() {
  $("#action-sheet-modal").hidden = false;
}
$("#action-sheet-cancel").addEventListener("click", () => ($("#action-sheet-modal").hidden = true));
$("#action-add-expense").addEventListener("click", () => {
  $("#action-sheet-modal").hidden = true;
  openAddForm(null);
  setAddType("expense");
});
$("#action-add-income").addEventListener("click", () => {
  $("#action-sheet-modal").hidden = true;
  openAddForm(null);
  setAddType("income");
});
$("#action-add-investment").addEventListener("click", () => {
  $("#action-sheet-modal").hidden = true;
  openInvestmentModal(null);
});
$("#action-add-transfer").addEventListener("click", () => {
  $("#action-sheet-modal").hidden = true;
  openTransferModal();
});
$("#action-add-operation").addEventListener("click", () => {
  $("#action-sheet-modal").hidden = true;
  const investments = Store.getInvestments();
  if (!investments.length) {
    $("#pick-investment-list").innerHTML = '<div class="empty-state">No tienes inversiones todavía.</div>';
    $("#pick-investment-modal").hidden = false;
    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.textContent = "+ Crear una inversión";
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => {
      $("#pick-investment-modal").hidden = true;
      state.createInvestmentThenOperation = true;
      openInvestmentModal(null);
    });
    $("#pick-investment-list").appendChild(btn);
    return;
  }
  $("#pick-investment-list").innerHTML = "";
  investments.forEach((inv) => {
    const btn = document.createElement("button");
    btn.className = "btn-secondary action-sheet-btn";
    btn.textContent = inv.name;
    btn.addEventListener("click", () => {
      $("#pick-investment-modal").hidden = true;
      openOperationModal(inv.id, null);
    });
    $("#pick-investment-list").appendChild(btn);
  });
  $("#pick-investment-modal").hidden = false;
});
$("#pick-investment-cancel").addEventListener("click", () => ($("#pick-investment-modal").hidden = true));

// ---------- Seguimiento (watchlist) ----------
function watchlistStatusLabel(id) {
  return WATCHLIST_STATUSES.find((s) => s.id === id)?.label || id;
}

function renderWatchlist() {
  const wrap = $("#watchlist-status-filters");
  wrap.innerHTML = "";
  const allChip = document.createElement("button");
  allChip.className = "chip" + (state.watchlistStatusFilter === "all" ? " active" : "");
  allChip.textContent = "Todas";
  allChip.addEventListener("click", () => {
    state.watchlistStatusFilter = "all";
    renderWatchlist();
  });
  wrap.appendChild(allChip);
  WATCHLIST_STATUSES.forEach((s) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (state.watchlistStatusFilter === s.id ? " active" : "");
    chip.textContent = s.label;
    chip.addEventListener("click", () => {
      state.watchlistStatusFilter = s.id;
      renderWatchlist();
    });
    wrap.appendChild(chip);
  });

  let items = Store.getWatchlist();
  if (state.watchlistStatusFilter !== "all") items = items.filter((w) => w.status === state.watchlistStatusFilter);

  const list = $("#watchlist-list");
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">Nada en seguimiento todavía.</div>';
    return;
  }
  items.forEach((w) => {
    const typeLabel = INVESTMENT_TYPES.find((t) => t.id === w.type)?.label || w.type || "";
    const row = document.createElement("div");
    row.className = "wallet-item-row";
    row.innerHTML = `
      <div><div class="wi-name">${escapeHtml(w.name)}</div><div class="wi-sub">${[typeLabel, w.ticker].filter(Boolean).join(" · ")}</div></div>
      <div><div class="wi-value" style="font-size:12px">${watchlistStatusLabel(w.status)}</div></div>
    `;
    row.addEventListener("click", () => openWatchlistModal(w.id));
    list.appendChild(row);
  });
}

$("#add-watchlist-btn").addEventListener("click", () => openWatchlistModal(null));

function openWatchlistModal(id) {
  state.editingWatchlistId = id;
  const statusSelect = $("#wl-status-select");
  statusSelect.innerHTML = WATCHLIST_STATUSES.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  const typeSelect = $("#wl-type-select");
  typeSelect.innerHTML = INVESTMENT_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");

  const fields = {
    "wl-name-input": "name",
    "wl-ticker-input": "ticker",
    "wl-isin-input": "isin",
    "wl-reason-input": "reason",
    "wl-manager-input": "manager",
    "wl-ter-input": "ter",
    "wl-currency-input": "currency",
    "wl-distribution-input": "distribution",
    "wl-risk-input": "risk",
    "wl-expectedreturn-input": "expectedReturn",
    "wl-thesis-input": "thesis",
    "wl-risks-input": "risks",
    "wl-comment-input": "comment",
  };

  if (id) {
    const w = Store.getWatchlistItem(id);
    $("#watchlist-modal-title").textContent = "Editar seguimiento";
    statusSelect.value = w.status;
    typeSelect.value = w.type || "etf";
    Object.entries(fields).forEach(([elId, key]) => ($(`#${elId}`).value = w[key] || ""));
    $("#wl-delete-btn").hidden = false;
    $("#wl-promote-btn").hidden = w.status === "invertido";
  } else {
    $("#watchlist-modal-title").textContent = "Nuevo seguimiento";
    statusSelect.value = "investigar";
    typeSelect.value = "etf";
    Object.keys(fields).forEach((elId) => ($(`#${elId}`).value = ""));
    $("#wl-delete-btn").hidden = true;
    $("#wl-promote-btn").hidden = true;
  }
  $("#watchlist-modal").hidden = false;
}

$("#wl-cancel-btn").addEventListener("click", () => ($("#watchlist-modal").hidden = true));
$("#wl-save-btn").addEventListener("click", () => {
  const name = $("#wl-name-input").value.trim();
  if (!name) {
    showToast("Ponle un nombre");
    return;
  }
  const data = {
    name,
    status: $("#wl-status-select").value,
    type: $("#wl-type-select").value,
    ticker: $("#wl-ticker-input").value.trim(),
    isin: $("#wl-isin-input").value.trim(),
    reason: $("#wl-reason-input").value.trim(),
    manager: $("#wl-manager-input").value.trim(),
    ter: $("#wl-ter-input").value.trim(),
    currency: $("#wl-currency-input").value.trim(),
    distribution: $("#wl-distribution-input").value.trim(),
    risk: $("#wl-risk-input").value.trim(),
    expectedReturn: $("#wl-expectedreturn-input").value.trim(),
    thesis: $("#wl-thesis-input").value.trim(),
    risks: $("#wl-risks-input").value.trim(),
    comment: $("#wl-comment-input").value.trim(),
  };
  if (state.editingWatchlistId) {
    Store.updateWatchlistItem(state.editingWatchlistId, data);
  } else {
    Store.addWatchlistItem(data);
  }
  $("#watchlist-modal").hidden = true;
  renderWatchlist();
  showToast("Guardado");
});
$("#wl-delete-btn").addEventListener("click", () => {
  if (state.editingWatchlistId && confirm("¿Eliminar este seguimiento?")) {
    Store.deleteWatchlistItem(state.editingWatchlistId);
    $("#watchlist-modal").hidden = true;
    renderWatchlist();
    showToast("Eliminado");
  }
});
$("#wl-promote-btn").addEventListener("click", () => {
  if (!state.editingWatchlistId) return;
  const w = Store.getWatchlistItem(state.editingWatchlistId);
  Store.addInvestment({ name: w.name, type: w.type || "otro", ticker: w.ticker, isin: w.isin, broker: w.manager });
  Store.updateWatchlistItem(state.editingWatchlistId, { status: "invertido" });
  $("#watchlist-modal").hidden = true;
  showToast("Inversión creada a partir del seguimiento");
  renderWatchlist();
});

// ---------- Ideas de inversión ----------
function renderIdeas() {
  const list = $("#ideas-list");
  list.innerHTML = "";
  const ideas = Store.getIdeas();
  if (!ideas.length) {
    list.innerHTML = '<div class="empty-state">Sin ideas todavía.</div>';
    return;
  }
  ideas.forEach((idea) => {
    const row = document.createElement("div");
    row.className = "wallet-item-row";
    row.innerHTML = `
      <div><div class="wi-name">${escapeHtml(idea.title)}</div><div class="wi-sub">${escapeHtml(idea.note || "")}</div></div>
    `;
    row.addEventListener("click", () => openIdeaModal(idea.id));
    list.appendChild(row);
  });
}

$("#add-idea-btn").addEventListener("click", () => openIdeaModal(null));

function openIdeaModal(id) {
  state.editingIdeaId = id;
  if (id) {
    const idea = Store.getIdea(id);
    $("#idea-modal-title").textContent = "Editar idea";
    $("#idea-title-input").value = idea.title;
    $("#idea-note-input").value = idea.note || "";
    $("#idea-delete-btn").hidden = false;
  } else {
    $("#idea-modal-title").textContent = "Nueva idea";
    $("#idea-title-input").value = "";
    $("#idea-note-input").value = "";
    $("#idea-delete-btn").hidden = true;
  }
  $("#idea-modal").hidden = false;
}

$("#idea-cancel-btn").addEventListener("click", () => ($("#idea-modal").hidden = true));
$("#idea-save-btn").addEventListener("click", () => {
  const title = $("#idea-title-input").value.trim();
  if (!title) {
    showToast("Ponle un título");
    return;
  }
  const note = $("#idea-note-input").value.trim();
  if (state.editingIdeaId) {
    Store.updateIdea(state.editingIdeaId, { title, note });
  } else {
    Store.addIdea({ title, note });
  }
  $("#idea-modal").hidden = true;
  renderIdeas();
  showToast("Idea guardada");
});
$("#idea-delete-btn").addEventListener("click", () => {
  if (state.editingIdeaId && confirm("¿Eliminar esta idea?")) {
    Store.deleteIdea(state.editingIdeaId);
    $("#idea-modal").hidden = true;
    renderIdeas();
    showToast("Idea eliminada");
  }
});
$("#idea-promote-btn").addEventListener("click", () => {
  if (!state.editingIdeaId) {
    showToast("Guarda la idea primero");
    return;
  }
  const idea = Store.getIdea(state.editingIdeaId);
  Store.addWatchlistItem({ name: idea.title, comment: idea.note, status: "investigar" });
  Store.deleteIdea(state.editingIdeaId);
  $("#idea-modal").hidden = true;
  showToast("Idea pasada a seguimiento");
  renderIdeas();
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

// ---------- Autenticación ----------
let authMode = "login";

$("#auth-toggle-btn").addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  $("#auth-submit-btn").textContent = authMode === "login" ? "Entrar" : "Crear cuenta";
  $("#auth-toggle-btn").textContent = authMode === "login" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Entrar";
  $("#auth-mode-sub").textContent = authMode === "login"
    ? "Inicia sesión para sincronizar tus datos entre dispositivos."
    : "Crea una cuenta para empezar a sincronizar tus datos entre dispositivos.";
  $("#auth-error").hidden = true;
});

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-email": "Ese email no es válido.",
  "auth/missing-password": "Introduce una contraseña.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese email. Prueba a iniciar sesión.",
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/wrong-password": "Email o contraseña incorrectos.",
  "auth/user-not-found": "No existe ninguna cuenta con ese email.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
  "auth/network-request-failed": "Sin conexión a internet. Comprueba tu wifi/datos.",
};

$("#auth-submit-btn").addEventListener("click", async () => {
  const email = $("#auth-email-input").value.trim();
  const password = $("#auth-password-input").value;
  $("#auth-error").hidden = true;
  if (!email || !password) {
    $("#auth-error").textContent = "Rellena email y contraseña.";
    $("#auth-error").hidden = false;
    return;
  }
  $("#auth-submit-btn").disabled = true;
  try {
    if (authMode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  } catch (e) {
    $("#auth-error").textContent = AUTH_ERROR_MESSAGES[e.code] || "No se pudo completar la operación.";
    $("#auth-error").hidden = false;
  } finally {
    $("#auth-submit-btn").disabled = false;
  }
});

$("#logout-btn").addEventListener("click", () => {
  if (confirm("¿Cerrar sesión? Tus datos se quedan guardados en la nube.")) {
    signOut(auth);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      await Store.connectCloud(user.uid, { db, doc, getDoc, setDoc, onSnapshot });
    } catch (e) {
      console.error("Error conectando con la nube", e);
    }
    $("#auth-screen").hidden = true;
    $("#app").hidden = false;
    $(".bottom-nav").hidden = false;
    $("#date-input").value = todayISO();
    setView("dashboard");
  } else {
    Store.disconnectCloud();
    $("#auth-screen").hidden = false;
    $("#app").hidden = true;
    $(".bottom-nav").hidden = true;
    $("#auth-email-input").value = "";
    $("#auth-password-input").value = "";
    authMode = "login";
    $("#auth-submit-btn").textContent = "Entrar";
    $("#auth-toggle-btn").textContent = "¿No tienes cuenta? Crear una";
    $("#auth-mode-sub").textContent = "Inicia sesión para sincronizar tus datos entre dispositivos.";
    $("#auth-error").hidden = true;
  }
});
