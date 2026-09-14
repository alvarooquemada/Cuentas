import { getState, persist } from "./state.js";
import { uid, round2, todayISO } from "./utils.js";

export function getAccounts() {
  return getState().accounts;
}

export function getAccount(id) {
  return getState().accounts.find((a) => a.id === id);
}

export function addAccount({ name, type, openingBalance }) {
  const acc = {
    id: uid(),
    name,
    type: type === "bank" ? "bank" : "cash",
    openingBalance: round2(openingBalance),
    openingDate: todayISO(),
    createdAt: Date.now(),
  };
  getState().accounts.push(acc);
  persist();
  return acc;
}

export function updateAccount(id, patch) {
  const acc = getAccount(id);
  if (!acc) return;
  Object.assign(acc, patch);
  persist();
}

export function deleteAccount(id) {
  const state = getState();
  state.accounts = state.accounts.filter((a) => a.id !== id);
  state.movements.forEach((m) => {
    if (m.accountId === id) m.accountId = null;
  });
  state.transfers = state.transfers.filter((t) => t.fromAccountId !== id && t.toAccountId !== id);
  persist();
}

// El saldo NUNCA se edita a mano: es siempre saldo inicial + movimientos
// asignados a la cuenta + transferencias. Para corregir una desviación
// frente al banco real se usa adjustAccountBalance, que registra un
// movimiento de ajuste con fecha (no reescribe el número sin más).
export function getAccountBalance(accountId) {
  const state = getState();
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  let balance = acc.openingBalance;
  state.movements.forEach((m) => {
    if (m.accountId === accountId) balance += m.type === "income" ? m.amount : -m.amount;
  });
  state.transfers.forEach((t) => {
    if (t.toAccountId === accountId) balance += t.amount;
    if (t.fromAccountId === accountId) balance -= t.amount;
  });
  return round2(balance);
}

export function getTotalLiquidity() {
  return round2(getAccounts().reduce((s, a) => s + getAccountBalance(a.id), 0));
}

export function adjustAccountBalance(accountId, targetBalance) {
  const state = getState();
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc) return;
  const current = getAccountBalance(accountId);
  const diff = round2(targetBalance - current);
  if (diff === 0) return;
  state.movements.push({
    id: uid(),
    type: diff > 0 ? "income" : "expense",
    amount: Math.abs(diff),
    categoryId: null,
    accountId,
    concept: "Ajuste de saldo",
    date: todayISO(),
    createdAt: Date.now(),
  });
  persist();
}
