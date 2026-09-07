export function drawDonut(canvas, slices) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth || 220;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.62;

  if (total <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(148,163,184,0.25)";
    ctx.fill();
    return;
  }

  let start = -Math.PI / 2;
  slices.forEach((s) => {
    const angle = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    start += angle;
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

export function drawBars(canvas, bars, opts = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 160;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (!bars.length) return;

  const max = Math.max(1, ...bars.map((b) => Math.max(b.income, b.expense)));
  const padding = 28;
  const groupWidth = (width - padding) / bars.length;
  const barWidth = Math.min(16, groupWidth / 3);
  const chartH = height - 24;

  ctx.font = "11px -apple-system, system-ui, sans-serif";
  ctx.fillStyle = opts.labelColor || "#94a3b8";
  ctx.textAlign = "center";

  bars.forEach((b, i) => {
    const gx = padding / 2 + i * groupWidth + groupWidth / 2;
    const incH = (b.income / max) * chartH;
    const expH = (b.expense / max) * chartH;

    ctx.fillStyle = "#1fa971";
    ctx.fillRect(gx - barWidth - 2, chartH - incH, barWidth, incH);

    ctx.fillStyle = "#e5548c";
    ctx.fillRect(gx + 2, chartH - expH, barWidth, expH);

    ctx.fillStyle = opts.labelColor || "#94a3b8";
    ctx.fillText(b.label, gx, height - 6);
  });
}
