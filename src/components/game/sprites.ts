import { ALPHA_THRESHOLD, BODY_ANCHOR, FOOT_BASELINE, NORMALIZED_SIZE, scanPixels, silhouetteBoxes, spriteInfo, CAPE_SWAY_AMOUNT, HAT_SWAY_AMOUNT, SWAY_LAG, type Pose } from './spriteGeometry';

function pixels(image: HTMLImageElement) {
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}

export function normalizeFrame(image: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  const source = pixels(image); if (!source) return image;
  const { width, height } = source.canvas;
  const opaque = scanPixels(source.data, width, height);
  const body = scanPixels(source.data, width, height, true);
  if (!body.bounds.h) return image;
  // Anchor to torso/hips, not asymmetrical stride, hat or cape extension.
  const centers: number[] = [];
  for (let y = Math.floor(body.bounds.y + body.bounds.h * 0.4); y < body.bounds.y + body.bounds.h * 0.68; y++) {
    let sum = 0, count = 0;
    for (let x = 0; x < width; x++) if (body.mask[y * width + x]) { sum += x; count++; }
    if (count) centers.push(sum / count);
  }
  centers.sort((a, b) => a - b);
  const anchor = centers[Math.floor(centers.length / 2)] ?? (body.bounds.x + body.bounds.w / 2);
  const foot = body.bounds.y + body.bounds.h;
  const dx = BODY_ANCHOR - anchor, dy = FOOT_BASELINE - foot;
  const canvas = document.createElement('canvas'); canvas.width = NORMALIZED_SIZE; canvas.height = NORMALIZED_SIZE;
  const ctx = canvas.getContext('2d'); if (!ctx) return image;
  // One-to-one scale for every frame; only translation changes.
  ctx.drawImage(image, dx, dy);
  const shifted = scanPixels(ctx.getImageData(0, 0, NORMALIZED_SIZE, NORMALIZED_SIZE).data, NORMALIZED_SIZE, NORMALIZED_SIZE, true);
  spriteInfo.set(canvas, { bounds: { ...opaque.bounds, x: opaque.bounds.x + dx, y: opaque.bounds.y + dy }, boxes: silhouetteBoxes(shifted.mask, NORMALIZED_SIZE, NORMALIZED_SIZE), anchor: BODY_ANCHOR, foot: FOOT_BASELINE });
  return canvas;
}

export function prepareObstacle(image: HTMLImageElement, spikes: boolean) {
  const source = pixels(image); if (!source) return;
  const { width, height } = source.canvas;
  const { bounds, mask } = scanPixels(source.data, width, height);
  spriteInfo.set(image, { bounds, boxes: spikes ? silhouetteBoxes(mask, width, height, 2) : [bounds], anchor: 0, foot: height });
}

export function drawFrug(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement | HTMLImageElement, pose: Pose, phase: number, speed: number, vy: number) {
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation); ctx.scale(pose.scaleX, pose.scaleY);
  // Overlapping feather-like strips preserve the original bitmap at the feet.
  // Only purple pixels in each cached regional layer move; the body stays fixed.
  const layers = regionalLayers(frame);
  ctx.drawImage(layers.body, -BODY_ANCHOR, -FOOT_BASELINE);
  for (const [name, amount, lag] of [['cape', CAPE_SWAY_AMOUNT, SWAY_LAG], ['hat', HAT_SWAY_AMOUNT, SWAY_LAG * 1.4]] as const) {
    const layer = layers[name];
    const offset = Math.sin(phase - lag) * amount + (name === 'cape' ? -Math.min(2, speed * 3) + Math.max(-1, Math.min(1, vy)) : -Math.max(-1, Math.min(1, vy)));
    const logicalToSource = 420 / 88;
    ctx.save(); ctx.transform(1, 0, offset * logicalToSource / 240, 1, offset * logicalToSource, 0);
    ctx.drawImage(layer, -BODY_ANCHOR, -FOOT_BASELINE); ctx.restore();
  }
  ctx.restore();
}

/** Warm color-separated layers before any running/jumping pose is first displayed. */
export function warmFrugLayers(frames: (HTMLCanvasElement | HTMLImageElement)[]) {
  for (const frame of frames) regionalLayers(frame);
}

const layerCache = new WeakMap<CanvasImageSource, { body: HTMLCanvasElement; cape: HTMLCanvasElement; hat: HTMLCanvasElement }>();
function regionalLayers(frame: HTMLCanvasElement | HTMLImageElement) {
  const cached = layerCache.get(frame); if (cached) return cached;
  const width = frame.width, height = frame.height;
  const make = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
  const body = make(), cape = make(), hat = make(); const ctx = body.getContext('2d');
  if (!ctx) return { body, cape, hat };
  ctx.drawImage(frame, 0, 0);
  const original = ctx.getImageData(0, 0, width, height);
  const ca = new ImageData(width, height), ha = new ImageData(width, height);
  for (let i = 0; i < original.data.length; i += 4) {
    const r = original.data[i], g = original.data[i + 1], b = original.data[i + 2];
    const x = (i / 4) % width, y = Math.floor(i / 4 / width);
    if (original.data[i + 3] < ALPHA_THRESHOLD || !(b > g * 1.3 && r > g * 1.1)) continue;
    const isHat = y < FOOT_BASELINE - 240, isCape = x < BODY_ANCHOR - 35 && y > FOOT_BASELINE - 240 && y < FOOT_BASELINE - 80;
    if (!isHat && !isCape) continue;
    const target = isHat ? ha : ca;
    for (let k = 0; k < 4; k++) target.data[i + k] = original.data[i + k];
    // Leave the base underneath; this 2–4px motion cannot open transparent gaps.
  }
  cape.getContext('2d')?.putImageData(ca, 0, 0); hat.getContext('2d')?.putImageData(ha, 0, 0);
  layerCache.set(frame, { body, cape, hat }); return { body, cape, hat };
}