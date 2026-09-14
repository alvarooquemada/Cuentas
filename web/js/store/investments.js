import { getState, persist } from "./state.js";
import { uid, round2 } from "./utils.js";

export const OPERATION_TYPES = [
  { id: "compra", label: "Compra" },
  { id: "venta", label: "Venta" },
  { id: "aportacion", label: "Aportación" },
  { id: "retirada", label: "Retirada" },
  { id: "dividendo", label: "Dividendo" },
  { id: "interes", label: "Interés" },
  { id: "comision", label: "Comisión" },
  { id: "valoracion", label: "Valoración" },
];

export const INVESTMENT_TYPES = [
  { id: "etf", label: "ETF" },
  { id: "fondo", label: "Fondo" },
  { id: "accion", label: "Acción" },
  { id: "liquidez", label: "Liquidez" },
  { id: "otro", label: "Otro" },
];

export function getInvestments() {
  return getState().investments;
}

export function getInvestment(id) {
  return getState().investments.find((i) => i.id === id);
}

export function addInvestment({ name, ticker, isin, type, broker }) {
  const inv = {
    id: uid(),
    name,
    ticker: ticker || "",
    isin: isin || "",
    type: type || "otro",
    broker: broker || "",
    createdAt: Date.now(),
    operations: [],
  };
  getState().investments.push(inv);
  persist();
  return inv;
}

export function updateInvestment(id, patch) {
  const inv = getInvestment(id);
  if (!inv) return;
  Object.assign(inv, patch);
  persist();
}

export function deleteInvestment(id) {
  const state = getState();
  state.investments = state.investments.filter((i) => i.id !== id);
  persist();
}

export function addOperation(investmentId, { type, date, quantity, price, amount, fees, notes }) {
  const inv = getInvestment(investmentId);
  if (!inv) return null;
  const op = {
    id: uid(),
    type,
    date,
    quantity: quantity != null && quantity !== "" ? Number(quantity) : null,
    price: price != null && price !== "" ? Number(price) : null,
    amount: round2(amount),
    fees: fees ? round2(fees) : 0,
    notes: notes || "",
    createdAt: Date.now(),
  };
  inv.operations.push(op);
  persist();
  return op;
}

export function updateOperation(investmentId, operationId, patch) {
  const inv = getInvestment(investmentId);
  if (!inv) return;
  const op = inv.operations.find((o) => o.id === operationId);
  if (!op) return;
  Object.assign(op, patch);
  if (patch.amount !== undefined) op.amount = round2(patch.amount);
  persist();
}

export function deleteOperation(investmentId, operationId) {
  const inv = getInvestment(investmentId);
  if (!inv) return;
  inv.operations = inv.operations.filter((o) => o.id !== operationId);
  persist();
}

// Cálculos derivados. Nunca se guardan: se recalculan siempre desde el
// libro de operaciones para que no puedan desincronizarse.
//
// - aportado: capital neto metido (compra/aportación suman, venta/retirada restan).
// - valorActual: importe de la última operación de tipo "valoración". Si
//   todavía no hay ninguna, asumimos valor = aportado (ganancia 0) en vez
//   de inventar una cifra.
// - dividendos/comisiones: se sostienen aparte de aportado y entran en la
//   rentabilidad, no en tus ingresos de Movimientos (decisión del usuario).
export function computeInvestment(inv) {
  let aportado = 0;
  let dividendos = 0;
  let comisiones = 0;
  const valoraciones = [];

  inv.operations.forEach((op) => {
    switch (op.type) {
      case "compra":
      case "aportacion":
        aportado += op.amount;
        break;
      case "venta":
      case "retirada":
        aportado -= op.amount;
        break;
      case "dividendo":
      case "interes":
        dividendos += op.amount;
        break;
      case "comision":
        comisiones += op.amount;
        break;
      case "valoracion":
        valoraciones.push(op);
        break;
    }
    if (op.type !== "comision" && op.fees) comisiones += op.fees;
  });

  valoraciones.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const lastValuation = valoraciones[valoraciones.length - 1];
  const valorActual = lastValuation ? lastValuation.amount : round2(aportado);

  const netIncome = round2(dividendos - comisiones);
  const ganancia = round2(valorActual - aportado + netIncome);
  const rentabilidad = aportado > 0 ? (ganancia / aportado) * 100 : 0;

  return {
    aportado: round2(aportado),
    valorActual: round2(valorActual),
    dividendos: round2(dividendos),
    comisiones: round2(comisiones),
    ganancia,
    rentabilidad,
    valuationHistory: valoraciones.map((v) => ({ date: v.date, amount: v.amount })),
    hasValuation: !!lastValuation,
  };
}

export function getTotalInvestmentsValue() {
  return round2(getInvestments().reduce((s, inv) => s + computeInvestment(inv).valorActual, 0));
}
