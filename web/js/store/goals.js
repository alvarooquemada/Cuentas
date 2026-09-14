import { getState, persist } from "./state.js";
import { uid } from "./utils.js";
import { currentMonthRange, todayISO, toDate, inRange } from "./utils.js";
import { getMovements } from "./movements.js";
import { getInvestments } from "./investments.js";

export const GOAL_KINDS = [
  { id: "ahorro_mensual", label: "Ahorro mensual" },
  { id: "gasto_diario", label: "Gasto diario" },
  { id: "inversion", label: "Aportación a inversión" },
];

export function getGoals() {
  return getState().goals;
}

export function getGoal(id) {
  return getState().goals.find((g) => g.id === id);
}

export function addGoal({ kind, name, targetAmount }) {
  const goal = { id: uid(), kind, name, targetAmount: Number(targetAmount) || 0, createdAt: Date.now() };
  getState().goals.push(goal);
  persist();
  return goal;
}

export function updateGoal(id, patch) {
  const goal = getGoal(id);
  if (!goal) return;
  Object.assign(goal, patch);
  if (patch.targetAmount !== undefined) goal.targetAmount = Number(patch.targetAmount) || 0;
  persist();
}

export function deleteGoal(id) {
  const state = getState();
  state.goals = state.goals.filter((g) => g.id !== id);
  persist();
}

// Progreso calculado siempre en vivo desde movimientos/inversiones reales,
// nunca guardado, para que no se desincronice.
export function computeGoalProgress(goal) {
  const range = currentMonthRange();
  const movements = getMovements().filter((m) => inRange(m.date, range));

  if (goal.kind === "ahorro_mensual") {
    const income = movements.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0);
    const expense = movements.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);
    const current = income - expense;
    return { current, target: goal.targetAmount, pct: goal.targetAmount ? (current / goal.targetAmount) * 100 : 0 };
  }

  if (goal.kind === "gasto_diario") {
    const expense = movements.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);
    const dayOfMonth = toDate(todayISO()).getDate();
    const current = dayOfMonth ? expense / dayOfMonth : 0;
    return { current, target: goal.targetAmount, pct: goal.targetAmount ? (current / goal.targetAmount) * 100 : 0 };
  }

  if (goal.kind === "inversion") {
    let aportado = 0;
    getInvestments().forEach((inv) => {
      inv.operations.forEach((op) => {
        if ((op.type === "aportacion" || op.type === "compra") && inRange(op.date, range)) aportado += op.amount;
      });
    });
    return { current: aportado, target: goal.targetAmount, pct: goal.targetAmount ? (aportado / goal.targetAmount) * 100 : 0 };
  }

  return { current: 0, target: goal.targetAmount, pct: 0 };
}
