import { PARALLAX_LAYERS } from "./constants";
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

// ── Obstacle (tree stump) ──────────────────────────────────
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, w: number, h: number,
) {
  ctx.fillStyle = "#8B4513";
  ctx.fillRect(x, groundY - h, w, h);
  ctx.fillStyle = "#654321";
  ctx.beginPath();
  ctx.moveTo(x, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h - h * 0.3);
  ctx.lineTo(x + w, groundY - h);
  ctx.fill();
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

// ── Clouds (fixed direction: drift RIGHT-to-LEFT, with parallax) ──
export function drawClouds(ctx: CanvasRenderingContext2D, w: number, time: number) {
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 4; i++) {
    // Parallax: back clouds (higher i) move slower
    const speedFactor = 0.015 * (1 - i * 0.2); // 0.015, 0.012, 0.009, 0.006
    const baseX = i * w * 0.3;
    // Clouds drift left: start from right, wrap around
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
