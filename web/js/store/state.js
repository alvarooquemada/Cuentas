import { uid, todayISO, round2 } from "./utils.js";

const STORAGE_KEY = "cuentas.v1";
const SCHEMA_VERSION = 3;

export const DEFAULT_CATEGORIES = [
  { id: "comida", name: "Comida", icon: "🍽️", color: "#c1694f" },
  { id: "alojamiento", name: "Alojamiento", icon: "🏠", color: "#4f6f8f" },
  { id: "transporte", name: "Transporte", icon: "🚌", color: "#3f8f86" },
  { id: "ocio", name: "Ocio", icon: "🎉", color: "#a1527a" },
  { id: "viajes", name: "Viajes", icon: "✈️", color: "#b98b3d" },
  { id: "facturas", name: "Facturas", icon: "🧾", color: "#7d7650" },
  { id: "salario", name: "Salario / Ingreso", icon: "💶", color: "#1f8a63" },
  { id: "otros", name: "Otros", icon: "📦", color: "#6b6759" },
];

// Colores de la primera versión (paleta web genérica). Si una categoría de
// serie sigue con uno de estos colores es que el usuario no la ha
// personalizado, así que al cargar la migramos a la paleta nueva.
const LEGACY_DEFAULT_COLORS = {
  comida: "#f28b30",
  alojamiento: "#4f7cff",
  transporte: "#7a5cff",
  ocio: "#e5548c",
  viajes: "#17a5c9",
  facturas: "#c9a417",
  salario: "#1fa971",
  otros: "#8a94a6",
};

function migrateCategoryColors(categories) {
  const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));
  return categories.map((c) => {
    const legacy = LEGACY_DEFAULT_COLORS[c.id];
    const fresh = byId.get(c.id);
    if (legacy && fresh && c.color === legacy) return { ...c, color: fresh.color };
    return c;
  });
}

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    settings: { currency: "EUR" },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    movements: [],
    accounts: [],
    transfers: [],
    investments: [],
    watchlist: [],
    ideas: [],
    goals: [],
    netWorthSnapshots: [],
  };
}

// Convierte el wallet.cash / wallet.banks / wallet.investments de la
// versión anterior (v2, saldo editado a mano) al modelo nuevo (v3,
// cuentas + inversiones con libro de operaciones). No inventamos fechas
// pasadas que no conocemos: las operaciones sintéticas quedan fechadas
// hoy y marcadas como migradas, para que quede claro que no son un
// histórico real.
function migrateV2ToV3(parsed) {
  const accounts = [];
  const investments = [];
  const today = todayISO();

  const wallet = parsed.wallet || {};
  if (typeof wallet.cash === "number" && wallet.cash !== 0) {
    accounts.push({
      id: uid(),
      name: "Efectivo",
      type: "cash",
      openingBalance: round2(wallet.cash),
      openingDate: today,
      createdAt: Date.now(),
    });
  } else {
    accounts.push({ id: uid(), name: "Efectivo", type: "cash", openingBalance: 0, openingDate: today, createdAt: Date.now() });
  }

  (Array.isArray(wallet.banks) ? wallet.banks : []).forEach((b) => {
    accounts.push({
      id: uid(),
      name: b.name,
      type: "bank",
      openingBalance: round2(b.balance),
      openingDate: today,
      createdAt: Date.now(),
    });
  });

  (Array.isArray(wallet.investments) ? wallet.investments : []).forEach((inv) => {
    const ops = [];
    if (inv.invested) {
      ops.push({
        id: uid(),
        type: "aportacion",
        date: today,
        amount: round2(inv.invested),
        notes: "Migrado automáticamente desde el registro anterior (fecha real desconocida)",
        createdAt: Date.now(),
      });
    }
    if (typeof inv.currentValue === "number") {
      ops.push({
        id: uid(),
        type: "valoracion",
        date: today,
        amount: round2(inv.currentValue),
        notes: "Migrado automáticamente desde el registro anterior",
        createdAt: Date.now(),
      });
    }
    investments.push({
      id: uid(),
      name: inv.name,
      ticker: "",
      isin: "",
      type: "otro",
      broker: inv.bank || "",
      createdAt: Date.now(),
      operations: ops,
    });
  });

  return { accounts, investments };
}

function normalizeArray(v) {
  return Array.isArray(v) ? v : [];
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();

    const fromVersion = parsed.version || 1;
    const categories = normalizeArray(parsed.categories).length
      ? migrateCategoryColors(parsed.categories)
      : defaultState().categories;

    let accounts = normalizeArray(parsed.accounts);
    let investments = normalizeArray(parsed.investments);

    if (fromVersion < 3) {
      const migrated = migrateV2ToV3(parsed);
      if (!accounts.length) accounts = migrated.accounts;
      if (!investments.length) investments = migrated.investments;
    }

    const movements = normalizeArray(parsed.movements).map((m) => ({
      accountId: null,
      ...m,
    }));

    return {
      version: SCHEMA_VERSION,
      settings: { ...defaultState().settings, ...(parsed.settings || {}) },
      categories,
      movements,
      accounts,
      transfers: normalizeArray(parsed.transfers),
      investments,
      watchlist: normalizeArray(parsed.watchlist),
      ideas: normalizeArray(parsed.ideas),
      goals: normalizeArray(parsed.goals),
      netWorthSnapshots: normalizeArray(parsed.netWorthSnapshots),
    };
  } catch (e) {
    console.error("Error leyendo datos, se restablece almacenamiento local", e);
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

export function getState() {
  return state;
}

export function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceState(newState) {
  state = newState;
  persist();
}

export function resetState() {
  state = defaultState();
  persist();
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  const base = defaultState();
  replaceState({
    version: SCHEMA_VERSION,
    settings: { ...base.settings, ...(parsed.settings || {}) },
    categories: normalizeArray(parsed.categories).length ? parsed.categories : base.categories,
    movements: normalizeArray(parsed.movements).map((m) => ({ accountId: null, ...m })),
    accounts: normalizeArray(parsed.accounts),
    transfers: normalizeArray(parsed.transfers),
    investments: normalizeArray(parsed.investments),
    watchlist: normalizeArray(parsed.watchlist),
    ideas: normalizeArray(parsed.ideas),
    goals: normalizeArray(parsed.goals),
    netWorthSnapshots: normalizeArray(parsed.netWorthSnapshots),
  });
}
