import { getState, persist } from "./state.js";
import { round2, todayISO } from "./utils.js";
import { getTotalLiquidity } from "./accounts.js";
import { getTotalInvestmentsValue } from "./investments.js";
import { getTotalDebts } from "./debts.js";

export function computeNetWorth() {
  const liquidity = getTotalLiquidity();
  const investments = getTotalInvestmentsValue();
  const debts = getTotalDebts();
  return { liquidity, investments, debts, total: round2(liquidity + investments - debts) };
}

export function getNetWorthHistory() {
  return getState().netWorthSnapshots.slice().sort((a, b) => a.date.localeCompare(b.date));
}

// Se llama explícitamente tras cualquier acción que pueda cambiar el
// patrimonio (movimiento, transferencia, cuenta u operación de
// inversión). Un punto por día: si ya se guardó hoy, se sustituye por el
// valor actual en vez de acumular duplicados.
export function recordNetWorthSnapshot() {
  const { liquidity, investments, debts, total } = computeNetWorth();
  const state = getState();
  const today = todayISO();
  const idx = state.netWorthSnapshots.findIndex((s) => s.date === today);
  const point = { date: today, total, liquidity, investments, debts };
  if (idx >= 0) state.netWorthSnapshots[idx] = point;
  else state.netWorthSnapshots.push(point);
  persist();
}

export function netWorthChangeSince(days) {
  const history = getNetWorthHistory();
  if (!history.length) return null;
  const latest = history[history.length - 1];
  const target = new Date(latest.date + "T00:00:00");
  target.setDate(target.getDate() - days);
  const targetISO = target.toISOString().slice(0, 10);
  const past = history.find((h) => h.date >= targetISO);
  if (!past || past.date === latest.date) return null;
  const diff = round2(latest.total - past.total);
  const pct = past.total ? (diff / Math.abs(past.total)) * 100 : 0;
  return { diff, pct, from: past, to: latest };
}
