export const COLORS = {
  navy950: "#030329",
  navy900: "#060556",
  navy800: "#0a0a6e",
  navy700: "#14128f",
  navy600: "#211ea8",
  cream100: "#fdf3e4",
  cream200: "#fbe7cc",
  cream300: "#f4d9ae",
  gold400: "#f7c873",
  gold500: "#f0a93e",
  gold600: "#d68a1f",
  amber500: "#ff9d42",
  coral500: "#ff6b5b",
  teal400: "#45d9c0",
  danger500: "#ff5c5c",
  white: "#ffffff",
};

export function sparklePath(ctx, cx, cy, r, points = 8, rotation = 0, innerRatio = 0.38) {
  ctx.beginPath();
  const step = (Math.PI * 2) / (points * 2);
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * innerRatio;
    const angle = rotation + i * step - Math.PI / 2;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawGlow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexToRgba(color, alpha));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function rand(min, max) { return min + Math.random() * (max - min); }
export function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
