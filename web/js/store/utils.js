export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency || "EUR" }).format(amount);
  } catch (e) {
    return (amount || 0).toFixed(2) + " " + (currency || "EUR");
  }
}

export function formatPercent(pct) {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function toDate(iso) {
  return new Date(iso + "T00:00:00");
}

export function toISO(d) {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
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

export function formatDate(iso) {
  const d = toDate(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

// ---- Rangos de periodo: semana / mes / trimestre / año ----

export function currentWeekRange() {
  const today = toDate(todayISO());
  const dow = (today.getDay() + 6) % 7; // lunes = 0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toISO(monday), end: toISO(sunday) };
}

export function currentMonthRange() {
  const today = toDate(todayISO());
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: toISO(start), end: toISO(end) };
}

export function currentQuarterRange() {
  const today = toDate(todayISO());
  const qStartMonth = Math.floor(today.getMonth() / 3) * 3;
  const start = new Date(today.getFullYear(), qStartMonth, 1);
  const end = new Date(today.getFullYear(), qStartMonth + 3, 0);
  return { start: toISO(start), end: toISO(end) };
}

export function currentYearRange() {
  const today = toDate(todayISO());
  return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` };
}

export function rangeForPeriod(period) {
  if (period === "week") return currentWeekRange();
  if (period === "quarter") return currentQuarterRange();
  if (period === "year") return currentYearRange();
  return currentMonthRange();
}

// Frase preposicional ya contraída ("de" + "el" = "del"), lista para
// usar directamente detrás de "Balance " / "Por categoría ".
export function periodLabel(period) {
  if (period === "week") return "de la semana";
  if (period === "quarter") return "del trimestre";
  if (period === "year") return "del año";
  return "del mes";
}

export function rangeLabel(range) {
  const start = toDate(range.start);
  const end = toDate(range.end);
  const fmt = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function inRange(dateISO, range) {
  return dateISO >= range.start && dateISO <= range.end;
}
