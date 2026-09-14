import { getState, persist } from "./state.js";
import { uid, round2 } from "./utils.js";

export function getDebts() {
  return getState().debts;
}

export function getDebt(id) {
  return getState().debts.find((d) => d.id === id);
}

export function addDebt({ name, amount }) {
  const debt = { id: uid(), name, amount: round2(amount), createdAt: Date.now() };
  getState().debts.push(debt);
  persist();
  return debt;
}

export function updateDebt(id, patch) {
  const debt = getDebt(id);
  if (!debt) return;
  Object.assign(debt, patch);
  if (patch.amount !== undefined) debt.amount = round2(patch.amount);
  persist();
}

export function deleteDebt(id) {
  const state = getState();
  state.debts = state.debts.filter((d) => d.id !== id);
  persist();
}

export function getTotalDebts() {
  return round2(getDebts().reduce((s, d) => s + d.amount, 0));
}
