import { getState, persist } from "./state.js";
import { uid, round2 } from "./utils.js";

export function getTransfers() {
  return getState().transfers.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function addTransfer({ fromAccountId, toAccountId, amount, date, concept }) {
  const tr = {
    id: uid(),
    fromAccountId,
    toAccountId,
    amount: round2(amount),
    date,
    concept: concept || "",
    createdAt: Date.now(),
  };
  getState().transfers.push(tr);
  persist();
  return tr;
}

export function deleteTransfer(id) {
  const state = getState();
  state.transfers = state.transfers.filter((t) => t.id !== id);
  persist();
}
