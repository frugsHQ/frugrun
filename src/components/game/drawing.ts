import { PARALLAX_LAYERS } from "./constants";
import type { ObstacleKind } from "./constants";
import type { ParallaxLine } from "./types";

// ── Initialise random parallax lines ───────────────────────
export function initParallaxLines(w: number, h: number): ParallaxLine[] {
  const lines: ParallaxLine[] = [];
  PARALLAX_LAYERS.forEach((cfg, layer) => {
    for (let i = 0; i < cfg.count; i++) {
      lines.push({
        x: Math.random() * (w + 200),
        y: h * cfg.yMin + Math.random() * h * (cfg.yMax - cfg.yMin),
        len: cfg.lenMin + Math.random() * (cfg.lenMax - cfg.lenMin),
        layer,
      });
    }
  });
  return lines;
}

// ── Green frog fallback (no sprite) ────────────────────────
export function drawFrogFallback(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
) {
  ctx.fillStyle = "#3cb043";
  ctx.beginPath();
  const r = w * 0.3;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

// ── Rock obstacle ──────────────────────────────────────────
function drawRock(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number) {
  // Main body — irregular polygon
  ctx.fillStyle = "#7a7a7a";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, groundY);
  ctx.lineTo(x, groundY - h * 0.5);
  ctx.lineTo(x + w * 0.2, groundY - h * 0.85);
  ctx.lineTo(x + w * 0.5, groundY - h);
  ctx.lineTo(x + w * 0.8, groundY - h * 0.9);
  ctx.lineTo(x + w, groundY - h * 0.4);
  ctx.lineTo(x + w * 0.9, groundY);
  ctx.closePath();
  ctx.fill();

  // Highlight edge
  ctx.fillStyle = "#9a9a9a";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, groundY - h * 0.85);
  ctx.lineTo(x + w * 0.5, groundY - h);
  ctx.lineTo(x + w * 0.8, groundY - h * 0.9);
  ctx.lineTo(x + w * 0.55, groundY - h * 0.7);
  ctx.closePath();
  ctx.fill();

  // Dark crevice line
  ctx.strokeStyle = "#5a5a5a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, groundY - h * 0.3);
  ctx.lineTo(x + w * 0.5, groundY - h * 0.6);
  ctx.lineTo(x + w * 0.65, groundY - h * 0.35);
  ctx.stroke();
}

// ── Snake obstacle (simple animated body) ──────────────────
function drawSnake(ctx: CanvasRenderingContext2D, x: number, groundY: number, w: number, h: number, time: number) {
  const bodyY = groundY - h * 0.35;

  // Coiled body (wavy line on ground)
  ctx.strokeStyle = "#2d8c2d";
  ctx.lineWidth = h * 0.22;
  ctx.lineCap = "round";
  ctx.beginPath();
  const segments = 6;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sx = x + t * w;
    // Gentle sine wave with time-based animation
    const sy = bodyY + Math.sin(t * Math.PI * 2.5 + time * 0.004) * h * 0.15;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Darker stripe
  ctx.strokeStyle = "#1a6b1a";
  ctx.lineWidth = h * 0.1;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const sx = x + t * w;
    const sy = bodyY + Math.sin(t * Math.PI * 2.5 + time * 0.004) * h * 0.15;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Head (left side — facing the frog)
  const headR = h * 0.18;
  const headX = x + headR;
  const headY = bodyY + Math.sin(time * 0.004) * h * 0.15;
  ctx.fillStyle = "#2d8c2d";
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#ff3333";
  ctx.beginPath();
  ctx.arc(headX - headR * 0.3, headY - headR * 0.3, headR * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Tongue flicker
  const tonguePhase = Math.sin(time * 0.008);
  if (tonguePhase > 0.3) {
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX - headR, headY);
    ctx.lineTo(headX - headR - w * 0.12, headY - 2);
    ctx.lineTo(headX - headR - w * 0.08, headY + 2);
    ctx.stroke();
  }
}

// ── Draw obstacle by kind ──────────────────────────────────
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, w: number, h: number,
  kind: ObstacleKind, time: number,
) {
  if (kind === "snake") {
    drawSnake(ctx, x, groundY, w, h, time);
  } else {
    drawRock(ctx, x, groundY, w, h);
  }
}

// ── Ground strip ───────────────────────────────────────────
export function drawGround(
  ctx: CanvasRenderingContext2D, w: number, groundY: number, h: number,
) {
  ctx.fillStyle = "#5a3e1b";
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = "#4a7c24";
  ctx.fillRect(0, groundY - 3, w, 6);
}

// ── Gradient sky ───────────────────────────────────────────
export function drawSky(ctx: CanvasRenderingContext2D, w: number, groundY: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, "#87CEEB");
  grad.addColorStop(1, "#d4f0ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, groundY);
}

// ── Clouds (drift right-to-left with parallax) ─────────────
export function drawClouds(ctx: CanvasRenderingContext2D, w: number, time: number) {
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 4; i++) {
    const speedFactor = 0.015 * (1 - i * 0.2);
    const baseX = i * w * 0.3;
    const cx = w - ((time * speedFactor + baseX) % (w + 120)) + 60;
    const cy = 40 + i * 35;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 50 + i * 10, 18 + i * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Parallax speed lines ───────────────────────────────────
export function drawParallax(
  ctx: CanvasRenderingContext2D,
  lines: ParallaxLine[],
  speed: number,
  dt: number,
  w: number,
) {
  for (const line of lines) {
    const cfg = PARALLAX_LAYERS[line.layer];
    line.x -= speed * cfg.speedFactor * dt;
    if (line.x + line.len < 0) {
      line.x = w + Math.random() * 100;
    }
    ctx.strokeStyle = `rgba(255,255,255,${cfg.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x + line.len, line.y);
    ctx.stroke();
  }
}
