const STORAGE_KEY = "cuentas.v1";

const DEFAULT_CATEGORIES = [
  { id: "comida", name: "Comida", icon: "🍽️", color: "#f28b30" },
  { id: "alojamiento", name: "Alojamiento", icon: "🏠", color: "#4f7cff" },
  { id: "transporte", name: "Transporte", icon: "🚌", color: "#7a5cff" },
  { id: "ocio", name: "Ocio", icon: "🎉", color: "#e5548c" },
  { id: "viajes", name: "Viajes", icon: "✈️", color: "#17a5c9" },
  { id: "facturas", name: "Facturas", icon: "🧾", color: "#c9a417" },
  { id: "salario", name: "Salario / Ingreso", icon: "💶", color: "#1fa971" },
  { id: "otros", name: "Otros", icon: "📦", color: "#8a94a6" },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultWallet() {
  return {
    cash: 0,
    banks: [],
    investments: [],
  };
}

function defaultState() {
  return {
    version: 2,
    settings: { currency: "EUR", theme: "system" },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    movements: [],
    wallet: defaultWallet(),
  };
}

function normalizeWallet(raw) {
  const w = raw || {};
  return {
    cash: typeof w.cash === "number" ? w.cash : 0,
    banks: Array.isArray(w.banks) ? w.banks : [],
    investments: Array.isArray(w.investments) ? w.investments : [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();
    return {
      version: 2,
      settings: { ...defaultState().settings, ...(parsed.settings || {}) },
      categories: Array.isArray(parsed.categories) && parsed.categories.length
        ? parsed.categories
        : defaultState().categories,
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
      wallet: normalizeWallet(parsed.wallet),
    };
  } catch (e) {
    console.error("Error leyendo datos, se restablece almacenamiento local", e);
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((fn) => fn(state));
}

export const Store = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState() {
    return state;
  },
  getSettings() {
    return state.settings;
  },
  updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    persist();
  },
  getCategories() {
    return state.categories;
  },
  getCategory(id) {
    return state.categories.find((c) => c.id === id);
  },
  addCategory({ name, icon, color }) {
    const cat = { id: uid(), name, icon: icon || "🏷️", color: color || "#8a94a6" };
    state.categories.push(cat);
    persist();
    return cat;
  },
  updateCategory(id, patch) {
    const cat = state.categories.find((c) => c.id === id);
    if (!cat) return;
    Object.assign(cat, patch);
    persist();
  },
  deleteCategory(id) {
    state.categories = state.categories.filter((c) => c.id !== id);
    state.movements.forEach((m) => {
      if (m.categoryId === id) m.categoryId = null;
    });
    persist();
  },
  reorderCategories(orderedIds) {
    const byId = new Map(state.categories.map((c) => [c.id, c]));
    state.categories = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    persist();
  },
  getMovements() {
    return state.movements.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  },
  getMovement(id) {
    return state.movements.find((m) => m.id === id);
  },
  addMovement({ type, amount, categoryId, concept, date }) {
    const mv = {
      id: uid(),
      type,
      amount: Math.round(Number(amount) * 100) / 100,
      categoryId: categoryId || null,
      concept: concept || "",
      date,
      createdAt: Date.now(),
    };
    state.movements.push(mv);
    persist();
    return mv;
  },
  updateMovement(id, patch) {
    const mv = state.movements.find((m) => m.id === id);
    if (!mv) return;
    Object.assign(mv, patch);
    if (patch.amount !== undefined) mv.amount = Math.round(Number(patch.amount) * 100) / 100;
    persist();
  },
  deleteMovement(id) {
    state.movements = state.movements.filter((m) => m.id !== id);
    persist();
  },
  exportData() {
    return JSON.stringify(state, null, 2);
  },
  importData(json) {
    const parsed = JSON.parse(json);
    state = {
      version: 2,
      settings: { ...defaultState().settings, ...(parsed.settings || {}) },
      categories: Array.isArray(parsed.categories) && parsed.categories.length
        ? parsed.categories
        : defaultState().categories,
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
      wallet: normalizeWallet(parsed.wallet),
    };
    persist();
  },
  resetAll() {
    state = defaultState();
    persist();
  },

  // ---- Cartera (efectivo, bancos, inversiones) ----
  getWallet() {
    return state.wallet;
  },
  setCash(amount) {
    state.wallet.cash = Math.round(Number(amount) * 100) / 100 || 0;
    persist();
  },
  addBankAccount({ name, balance }) {
    const acc = { id: uid(), name, balance: Math.round(Number(balance) * 100) / 100 || 0 };
    state.wallet.banks.push(acc);
    persist();
    return acc;
  },
  updateBankAccount(id, patch) {
    const acc = state.wallet.banks.find((b) => b.id === id);
    if (!acc) return;
    Object.assign(acc, patch);
    if (patch.balance !== undefined) acc.balance = Math.round(Number(patch.balance) * 100) / 100;
    persist();
  },
  deleteBankAccount(id) {
    state.wallet.banks = state.wallet.banks.filter((b) => b.id !== id);
    persist();
  },
  addInvestment({ name, bank, invested, currentValue }) {
    const inv = {
      id: uid(),
      name,
      bank: bank || "",
      invested: Math.round(Number(invested) * 100) / 100 || 0,
      currentValue: Math.round(Number(currentValue) * 100) / 100 || 0,
    };
    state.wallet.investments.push(inv);
    persist();
    return inv;
  },
  updateInvestment(id, patch) {
    const inv = state.wallet.investments.find((i) => i.id === id);
    if (!inv) return;
    Object.assign(inv, patch);
    if (patch.invested !== undefined) inv.invested = Math.round(Number(patch.invested) * 100) / 100;
    if (patch.currentValue !== undefined) inv.currentValue = Math.round(Number(patch.currentValue) * 100) / 100;
    persist();
  },
  deleteInvestment(id) {
    state.wallet.investments = state.wallet.investments.filter((i) => i.id !== id);
    persist();
  },
};

export function formatMoney(amount, currency) {
  const cur = currency || state.settings.currency || "EUR";
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur }).format(amount);
  } catch (e) {
    return amount.toFixed(2) + " " + cur;
  }
}

export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function monthKey(dateISO) {
  return dateISO.slice(0, 7);
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toDate(iso) {
  return new Date(iso + "T00:00:00");
}

function toISO(d) {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export function currentWeekRange() {
  const today = toDate(todayISO());
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toISO(monday), end: toISO(sunday) };
}

export function weekLabel(range) {
  const start = toDate(range.start);
  const end = toDate(range.end);
  const fmt = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function inRange(dateISO, range) {
  return dateISO >= range.start && dateISO <= range.end;
}
