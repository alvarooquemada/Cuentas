import { getState, persist } from "./state.js";
import { uid, todayISO } from "./utils.js";

export const WATCHLIST_STATUSES = [
  { id: "investigar", label: "Por investigar" },
  { id: "analisis", label: "En análisis" },
  { id: "candidato", label: "Candidato" },
  { id: "descartado", label: "Descartado" },
  { id: "invertido", label: "Invertido" },
];

export function getWatchlist() {
  return getState().watchlist;
}

export function getWatchlistItem(id) {
  return getState().watchlist.find((w) => w.id === id);
}

const FIELDS = [
  "name", "isin", "ticker", "type", "manager", "ter", "expectedReturn",
  "risk", "currency", "distribution", "comment", "thesis", "risks", "reason",
];

export function addWatchlistItem(data) {
  const item = { id: uid(), status: "investigar", analysisDate: todayISO(), createdAt: Date.now() };
  FIELDS.forEach((f) => (item[f] = data[f] || ""));
  Object.assign(item, data);
  getState().watchlist.push(item);
  persist();
  return item;
}

export function updateWatchlistItem(id, patch) {
  const item = getWatchlistItem(id);
  if (!item) return;
  Object.assign(item, patch);
  persist();
}

export function deleteWatchlistItem(id) {
  const state = getState();
  state.watchlist = state.watchlist.filter((w) => w.id !== id);
  persist();
}
