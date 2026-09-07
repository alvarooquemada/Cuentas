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

function defaultState() {
  return {
    version: 1,
    settings: { currency: "EUR", theme: "system" },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    movements: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();
    return {
      version: 1,
      settings: { ...defaultState().settings, ...(parsed.settings || {}) },
      categories: Array.isArray(parsed.categories) && parsed.categories.length
        ? parsed.categories
        : defaultState().categories,
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
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
      version: 1,
      settings: { ...defaultState().settings, ...(parsed.settings || {}) },
      categories: Array.isArray(parsed.categories) && parsed.categories.length
        ? parsed.categories
        : defaultState().categories,
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
    };
    persist();
  },
  resetAll() {
    state = defaultState();
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
