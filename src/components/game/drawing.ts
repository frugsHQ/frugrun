// ── Scene drawing helpers (jungle temple art) ──────────────
import type { ObstacleKind } from "./constants";
import { TUNING } from "./motion";
import type { Coin } from "./types";
import { normalizeFrame, prepareObstacle } from './sprites';

import bgSrc from "@/assets/jungle-bg-frog.jpg";
export { bgSrc as BACKGROUND_SRC };
import groundSrc from "@/assets/ground-tile.jpg";
import spikesSrc from "@/assets/obstacle-spikes.png";
import totemSrc from "@/assets/obstacle-totem.png";
import coinSrc from "@/assets/frug-coin.png";
import run1 from "@/assets/frug-run1.png";
import run2 from "@/assets/frug-run2.png";
import run3 from "@/assets/frug-run3.png";
import jumpSrc from "@/assets/frug-jump.png";
import fallSrc from "@/assets/frug-fall.png";

/** All images used by the game, loaded once. */
export interface GameImages {
  bg: HTMLImageElement;
  ground: HTMLImageElement;
  spikes: HTMLImageElement;
  totem: HTMLImageElement;
  coin: HTMLImageElement;
  run: (HTMLImageElement | HTMLCanvasElement)[]; // normalized run cycle frames
  jump: HTMLImageElement | HTMLCanvasElement;
  fall: HTMLImageElement | HTMLCanvasElement;
}

function load(src: string) {
  const img = new Image();
  img.src = src;
  return img;
}

export function loadGameImages(): GameImages {
  const r1 = load(run1), r2 = load(run2), r3 = load(run3);
  return {
    bg: load(bgSrc),
    ground: load(groundSrc),
    spikes: load(spikesSrc),
    totem: load(totemSrc),
    coin: load(coinSrc),
    // 4-step cycle: stride → pass → other stride → pass
    run: [r1, r3, r2, r3],
    jump: load(jumpSrc),
    fall: load(fallSrc),
  };
}

export async function decodeGameImages(images: GameImages) {
  await Promise.all([images.bg, images.ground, images.spikes, images.totem, images.coin, ...images.run, images.jump, images.fall].map(async img => {
    if (!(img instanceof HTMLImageElement)) return;
    const source = img.src;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await img.decode(); return; }
      catch { if (!attempt) img.src = source + (source.includes('?') ? '&' : '?') + 'retry=1'; }
    }
    console.error(`[Frug Run] Failed to decode asset after retry: ${source}`);
  }));
}

const ready = (img: HTMLImageElement | HTMLCanvasElement) => img instanceof HTMLCanvasElement ? img.width > 0 : img.complete && img.naturalWidth > 0;

export function prepareGameSprites(images: GameImages) {
  const cache = new Map<HTMLImageElement, HTMLImageElement | HTMLCanvasElement>();
  const normalized = (frame: HTMLImageElement | HTMLCanvasElement) => {
    if (frame instanceof HTMLCanvasElement) return frame;
    const existing = cache.get(frame); if (existing) return existing;
    const result = normalizeFrame(frame); cache.set(frame, result); return result;
  };
  images.run = images.run.map(normalized); images.jump = normalized(images.jump); images.fall = normalized(images.fall);
  prepareObstacle(images.spikes, true); prepareObstacle(images.totem, false);
}

export const LETTERBOX_BLUR = 18;
export const LETTERBOX_BRIGHTNESS = 0.38;
const letterboxCache = new Map<string, HTMLCanvasElement>();
export function drawLetterbox(ctx: CanvasRenderingContext2D, imgs: GameImages, width: number, height: number, offset: number) {
  if (!ready(imgs.bg)) return;
  const key = `${imgs.bg.src}:${width}:${height}`;
  let cached = letterboxCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas'); cached.width = Math.ceil(width); cached.height = Math.ceil(height);
    const off = cached.getContext('2d'); if (!off) return;
    off.filter = `blur(${LETTERBOX_BLUR}px) brightness(${LETTERBOX_BRIGHTNESS})`;
    off.drawImage(imgs.bg, -LETTERBOX_BLUR * 2, -LETTERBOX_BLUR * 2, width + LETTERBOX_BLUR * 4, height + LETTERBOX_BLUR * 4);
    if (letterboxCache.size > 4) letterboxCache.clear(); letterboxCache.set(key, cached);
  }
  void offset;
  ctx.drawImage(cached, 0, 0, width, height);
}

/** Obstacle height/width ratio per kind (matches the art). */
export const OBSTACLE_ASPECT: Record<ObstacleKind, number> = {
  spikes: 256 / 158,
  totem: 256 / 199,
};

const tileCache = new Map<string, HTMLCanvasElement>();

// ── Draw an image tiled horizontally, mirroring every other tile so seams match ──
function drawMirroredTiles(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  offset: number, y: number, tileW: number, tileH: number, W: number,
  snapped = true, foliage = -1,
) {
  // Cache a mirrored pair at its final logical size. No large image resampling per frame.
  const repeats = Math.max(1, Math.ceil(W / (tileW * 2)));
  const transform = ctx.getTransform();
  const ratio = Math.hypot(transform.a, transform.b) || 1;
  const physicalTileW = Math.max(1, Math.round(tileW * ratio));
  const pairWidth = physicalTileW * 2;
  const key = `${img.src}:${physicalTileW}:${tileH * ratio}:${repeats}:${foliage}`;
  let cached = tileCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas'); cached.width = pairWidth * repeats; cached.height = Math.ceil(tileH * ratio);
    const off = cached.getContext('2d');
    if (off) {
      off.imageSmoothingQuality = 'high';
      for (let i = 0; i < repeats; i++) { off.save(); off.translate(i * pairWidth, 0); off.drawImage(img, 0, 0, physicalTileW + 1, cached.height); off.translate(pairWidth, 0); off.scale(-1, 1); off.drawImage(img, 0, 0, physicalTileW + 1, cached.height); off.restore(); }
      if (foliage >= 0) {
        // Bake the original four feathered strips once, not eight full-scene clips every frame.
        const H = W === 0 ? 600 : TUNING.logicalHeight;
        const top = H * (foliage === 0 ? .65 : .78), bottom = H * TUNING.groundRatio;
        const feather = (bottom - top) / 4;
        off.globalCompositeOperation = 'destination-in';
        const mask = document.createElement('canvas'); mask.width = 1; mask.height = cached.height;
        const m = mask.getContext('2d');
        if (m) for (let strip = 0; strip < 4; strip++) { m.fillStyle = `rgba(0,0,0,${(strip + 1) * (foliage === 0 ? .07 : .04)})`; m.fillRect(0, (top + feather * strip - y) * ratio, 1, feather * ratio + 1); }
        off.drawImage(mask, 0, 0, cached.width, cached.height);
      }
    }
    if (tileCache.size > 12) tileCache.clear(); tileCache.set(key, cached);
  }
  const period = pairWidth * repeats;
  const raw = -((offset * ratio % period) + period) % period;
  const start = snapped ? Math.round(raw) : raw;
  // Device-sized sources and destinations: scrolling does not resample the painting.
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(cached, start + transform.e, y * ratio + transform.f);
  ctx.drawImage(cached, start + period + transform.e - 1, y * ratio + transform.f);
  ctx.restore();
}

// ── Painted jungle background (slow parallax) ──────────────
export function drawBackground(
  ctx: CanvasRenderingContext2D, imgs: GameImages, W: number, H: number, offset: number,
) {
  if (!ready(imgs.bg)) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3fa9f5");
    g.addColorStop(1, "#2e7d4f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // Cover the full height, keep aspect ratio
  const tileH = Math.max(H, W * imgs.bg.naturalHeight / imgs.bg.naturalWidth);
  const tileW = (imgs.bg.naturalWidth / imgs.bg.naturalHeight) * tileH;
  drawMirroredTiles(ctx, imgs.bg, offset, H - tileH, tileW, tileH, W, false);
  // Reuse near foliage from the original painting, feathered into the far layer.
  // No replacement artwork: these cached bands create restrained depth.
  for (let layer = 0; layer < 2; layer++) {
    drawMirroredTiles(ctx, imgs.bg, offset * (layer === 0 ? TUNING.parallaxMid : TUNING.parallaxNear) / TUNING.parallaxFar, H - tileH, tileW, tileH, W, false, layer);
  }
}

// ── Mossy carved-stone ground (moves with obstacles) ───────
export function drawGround(
  ctx: CanvasRenderingContext2D, imgs: GameImages, W: number, groundY: number, H: number, offset: number,
) {
  // The tile's grass top sits slightly above groundY so feet sink into the moss
  const grassLift = 8;
  const tileH = H - groundY + grassLift;
  if (!ready(imgs.ground)) {
    ctx.fillStyle = "#7a6a4f";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = "#6cc22b";
    ctx.fillRect(0, groundY - 6, W, 12);
    return;
  }
  const tileW = (imgs.ground.naturalWidth / imgs.ground.naturalHeight) * tileH;
  drawMirroredTiles(ctx, imgs.ground, offset, groundY - grassLift, tileW, tileH, W);
}

// ── Obstacle sprite ────────────────────────────────────────
export function drawObstacle(
  ctx: CanvasRenderingContext2D, imgs: GameImages,
  x: number, groundY: number, w: number, h: number, kind: ObstacleKind,
) {
  const img = kind === "spikes" ? imgs.spikes : imgs.totem;
  // Sink the base a little into the moss
  const sink = h * 0.06;
  if (ready(img)) {
    ctx.drawImage(img, x, groundY - h + sink, w, h);
  } else {
    ctx.fillStyle = "#5b4a33";
    ctx.fillRect(x, groundY - h + sink, w, h);
  }
}

// ── Spinning coin: squeeze width with cos() for a 360° flip ──
export function drawCoin(
  ctx: CanvasRenderingContext2D, imgs: GameImages, coin: Coin, size: number, time: number, renderX = coin.x,
) {
  const angle = time * 0.005 + coin.phase;
  const c = Math.cos(angle);
  const w = Math.max(size * 0.08, size * Math.abs(c)); // never fully vanish (coin edge)
  const x = renderX - w / 2;
  const y = coin.y - size / 2;
  ctx.save();
  if (ready(imgs.coin)) {
    ctx.drawImage(imgs.coin, x, y, w, size);
    // Back face looks a bit darker
    if (c < 0) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#7a4a00";
      ctx.beginPath();
      ctx.ellipse(renderX, coin.y, w / 2, size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#ffcc22";
    ctx.beginPath();
    ctx.ellipse(renderX, coin.y, w / 2, size / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gold edge when seen side-on
  if (Math.abs(c) < 0.25) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c98a00";
    ctx.fillRect(renderX - size * 0.04, y + size * 0.05, size * 0.08, size * 0.9);
  }
  ctx.restore();
}

// ── Frug fallback (only before images load) ────────────────
export function drawFrogFallback(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
) {
  ctx.fillStyle = "#6cc22b";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.65, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b2fb3";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.4);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.75, y + h * 0.4);
  ctx.fill();
}

export { ready as imageReady };

/** Reuse the top strip of the existing ground art in front of the feet. */
export function drawForegroundGrass(ctx: CanvasRenderingContext2D, imgs: GameImages, W: number, groundY: number, H: number, offset: number) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, groundY - 3, W, 12); ctx.clip();
  drawGround(ctx, imgs, W, groundY, H, offset); ctx.restore();
}

/** Warm the tile caches before removing the loading screen. */
export function warmSceneCache(imgs: GameImages, W: number, H: number) {
  const offscreen = document.createElement('canvas'); offscreen.width = Math.ceil(W); offscreen.height = Math.ceil(H);
  const ctx = offscreen.getContext('2d'); if (!ctx) return;
  drawBackground(ctx, imgs, W, H, 0); drawGround(ctx, imgs, W, H * TUNING.groundRatio, H, 0);
}

/** Static device-sized artwork; only the compositor's translation changes during play. */
export function makeCompositedLayers(imgs: GameImages, W: number, H: number, ratio: number, coverageWidth = W) {
  const bgReady = ready(imgs.bg), groundReady = ready(imgs.ground);
  const bgAspect = bgReady ? imgs.bg.naturalWidth / imgs.bg.naturalHeight : 1600 / 907;
  const bgH = Math.max(H, W / bgAspect);
  const bgW = Math.round(bgAspect * bgH * ratio) / ratio;
  const groundY = H * TUNING.groundRatio, groundH = H - groundY + 8;
  const groundW = Math.round((groundReady ? imgs.ground.naturalWidth / imgs.ground.naturalHeight : 2) * groundH * ratio) / ratio;
  return [TUNING.parallaxFar, TUNING.parallaxMid, TUNING.parallaxNear, 1].map((fraction, index) => {
    const tileW = index === 3 ? groundW : bgW, tileH = index === 3 ? groundH : bgH;
    // One mirrored pair is the repeat period. Paint the ENTIRE backing strip,
    // not just W: translating a partially painted strip exposed transparent gaps.
    const physicalTileW = Math.max(2, Math.round(tileW * ratio));
    const stride = physicalTileW - 1;
    const period = stride * 2 / ratio;
    const c = document.createElement('canvas'); c.width = Math.ceil((period + coverageWidth + 2 / ratio) * ratio); c.height = Math.ceil(H * ratio);
    const ctx = c.getContext('2d');
    if (ctx) {
      const image = index === 3 ? imgs.ground : imgs.bg;
      const y = (index === 3 ? groundY - 8 : H - bgH) * ratio;
      if (ready(image)) {
        for (let x = 0, tile = 0; x < c.width; x += stride, tile++) {
          ctx.save(); ctx.translate(x + (tile % 2 ? physicalTileW : 0), y);
          if (tile % 2) ctx.scale(-1, 1);
          ctx.drawImage(image, 0, 0, physicalTileW, tileH * ratio); ctx.restore();
        }
      } else {
        ctx.scale(ratio, ratio);
        if (index === 3) drawGround(ctx, imgs, c.width / ratio, groundY, H, 0);
        else drawBackground(ctx, imgs, c.width / ratio, H, 0);
      }
      if (index === 1 || index === 2) {
        const top = H * (index === 1 ? .65 : .78), feather = (groundY - top) / 4;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-in';
        const mask = document.createElement('canvas'); mask.width = 1; mask.height = c.height;
        const m = mask.getContext('2d');
        if (m) for (let strip = 0; strip < 4; strip++) { m.fillStyle = `rgba(0,0,0,${(strip + 1) * (index === 1 ? .07 : .04)})`; m.fillRect(0, (top + strip * feather) * ratio, 1, feather * ratio + 1); }
        ctx.drawImage(mask, 0, 0, c.width, c.height);
      }
    }
    const top = index === 3 ? groundY - 8 : index === 1 ? H * .65 : index === 2 ? H * .78 : 0;
    const bottom = index === 1 || index === 2 ? groundY : H;
    const cropped = document.createElement('canvas'); cropped.width = c.width; cropped.height = Math.ceil((bottom - top) * ratio);
    cropped.getContext('2d')?.drawImage(c, 0, -top * ratio);
    return { canvas: cropped, period, fraction, width: cropped.width / ratio, top, height: cropped.height / ratio };
  });
}
