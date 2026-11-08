// Shared source-pixel geometry. Alpha, not transparent image padding, defines sprites.
export const ALPHA_THRESHOLD = 40;
export const CAPE_SWAY_AMOUNT = 3;
export const HAT_SWAY_AMOUNT = 2;
export const SWAY_LAG = 0.7;
export const NORMALIZED_SIZE = 512;
export const FOOT_BASELINE = 500;
export const BODY_ANCHOR = 256;
export const COIN_PICKUP_SCALE = 0.58;
export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Pose = { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
export type SpriteInfo = { bounds: Box; boxes: Box[]; anchor: number; foot: number };
export const spriteInfo = new WeakMap<CanvasImageSource, SpriteInfo>();

export function scanPixels(data: Uint8ClampedArray, width: number, height: number, bodyOnly = false) {
  const mask = new Uint8Array(width * height);
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // The supplied Frug art has green skin and pale yellow belly. Purple cape/hat
    // and gold accessories are deliberately absent from the body collision mask.
    const skin = g > r * 1.02 && g > b * 1.12;
    const belly = r > 185 && g > 175 && b < g * 0.9;
    if (data[i + 3] <= ALPHA_THRESHOLD || (bodyOnly && !(skin || belly))) continue;
    mask[y * width + x] = 1;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const bounds = right < left ? { x: 0, y: 0, w: 0, h: 0 } : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  return { mask, bounds };
}

// Interior-only small rectangles follow the silhouette without enclosing empty air.
export function silhouetteBoxes(mask: Uint8Array, width: number, height: number, cell = 4): Box[] {
  const result: Box[] = [];
  for (let y = 0; y < height; y += cell) {
    let start = -1;
    for (let x = 0; x <= width; x += cell) {
      let filled = x + cell <= width && y + cell <= height;
      for (let j = y; filled && j < y + cell; j++) for (let i = x; i < x + cell; i++) if (!mask[j * width + i]) { filled = false; break; }
      if (filled && start < 0) start = x;
      if (!filled && start >= 0) { result.push({ x: start, y, w: x - start, h: cell }); start = -1; }
    }
  }
  return result;
}

export function transformBox(box: Box, pose: Pose): Point[] {
  const c = Math.cos(pose.rotation), s = Math.sin(pose.rotation);
  return [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]].map(([x, y]) => {
    const px = (x - BODY_ANCHOR) * pose.scaleX, py = (y - FOOT_BASELINE) * pose.scaleY;
    return { x: pose.x + px * c - py * s, y: pose.y + px * s + py * c };
  });
}

export function rectangle(box: Box): Point[] { return [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }]; }

// Continuous separating-axis test: exact translation sweep, not enlarged endpoint boxes.
export function sweptOverlap(a: Point[], b: Point[], delta: Point): boolean {
  let entry = 0, exit = 1;
  for (let side = 0; side < 2; side++) { const poly = side === 0 ? a : b; for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ax = -(q.y - p.y), ay = q.x - p.x;
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (let k = 0; k < a.length; k++) { const v = a[k].x * ax + a[k].y * ay; amin = Math.min(amin, v); amax = Math.max(amax, v); }
    for (let k = 0; k < b.length; k++) { const v = b[k].x * ax + b[k].y * ay; bmin = Math.min(bmin, v); bmax = Math.max(bmax, v); }
    const speed = delta.x * ax + delta.y * ay;
    if (Math.abs(speed) < 1e-9) { if (amax <= bmin || amin >= bmax) return false; continue; }
    const first = (bmin - amax) / speed, last = (bmax - amin) / speed;
    entry = Math.max(entry, Math.min(first, last)); exit = Math.min(exit, Math.max(first, last));
    if (entry >= exit) return false;
  } }
  return entry < exit;
}

export function canDamage(invuln: number, alreadyHit: boolean) { return invuln <= 0 && !alreadyHit; }