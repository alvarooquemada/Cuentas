import { getState, persist } from "./state.js";
import { uid, round2 } from "./utils.js";

export function getMovements() {
  return getState().movements.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function getMovement(id) {
  return getState().movements.find((m) => m.id === id);
}

export function addMovement({ type, amount, categoryId, concept, date, accountId }) {
  const mv = {
    id: uid(),
    type,
    amount: round2(amount),
    categoryId: categoryId || null,
    accountId: accountId || null,
    concept: concept || "",
    date,
    createdAt: Date.now(),
  };
  getState().movements.push(mv);
  persist();
  return mv;
}

export function updateMovement(id, patch) {
  const mv = getMovement(id);
  if (!mv) return;
  Object.assign(mv, patch);
  if (patch.amount !== undefined) mv.amount = round2(patch.amount);
  persist();
}

export function deleteMovement(id) {
  const state = getState();
  state.movements = state.movements.filter((m) => m.id !== id);
  persist();
}
