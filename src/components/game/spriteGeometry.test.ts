import { describe, it, expect } from "vitest";
import {
  scanPixels,
  silhouetteBoxes,
  rectangle,
  sweptOverlap,
  transformBox,
  BODY_ANCHOR,
  FOOT_BASELINE,
  canDamage,
} from "./spriteGeometry";
import { HIT_INVULN_MS } from "./constants";
describe("Sprite-accurate collision rules", () => {
  it("ignores alpha at or below 40, including transparent padding", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    pixels[(1 * 4 + 2) * 4 + 3] = 41;
    pixels[3] = 40;
    expect(scanPixels(pixels, 4, 4).bounds).toEqual({ x: 2, y: 1, w: 1, h: 1 });
  });
  it("excludes purple cape and hat from the frog body", () => {
    const pixels = new Uint8ClampedArray([160, 30, 220, 255, 70, 180, 30, 255]);
    expect(scanPixels(pixels, 2, 1, true).bounds).toEqual({ x: 1, y: 0, w: 1, h: 1 });
  });
  it("spike boxes never enclose empty silhouette pixels", () => {
    const mask = new Uint8Array([0, 1, 0, 0, 1, 0, 1, 1, 1]);
    const boxes = silhouetteBoxes(mask, 3, 3, 1);
    for (const b of boxes)
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) expect(mask[y * 3 + x]).toBe(1);
    expect(boxes.length).toBeGreaterThan(0);
  });
  it("catches fast swept contact but does not hit a visually cleared obstacle", () => {
    const frog = rectangle({ x: 0, y: 0, w: 10, h: 10 });
    const rock = rectangle({ x: 30, y: 0, w: 5, h: 10 });
    expect(sweptOverlap(frog, rock, { x: 60, y: 0 })).toBe(true);
    expect(sweptOverlap(rectangle({ x: 0, y: -12, w: 10, h: 10 }), rock, { x: 60, y: 0 })).toBe(false);
  });
  it("keeps the normalized foot pivot fixed through rotation and squash", () => {
    const points = transformBox(
      { x: BODY_ANCHOR, y: FOOT_BASELINE, w: 1, h: 1 },
      { x: 70, y: 300, scaleX: 0.3, scaleY: 0.2, rotation: 0.12 },
    );
    expect(points[0]).toEqual({ x: 70, y: 300 });
  });
  it("provides 1.2 seconds invulnerability and never damages twice from one obstacle", () => {
    expect(HIT_INVULN_MS).toBe(2000);
    expect(canDamage(2000, false)).toBe(false);
    expect(canDamage(0, true)).toBe(false);
    expect(canDamage(0, false)).toBe(true);
  });
  it("does not hit an obstacle Frug cleared when he lands beside it", () => {
    const landed = rectangle({ x: 0, y: 0, w: 10, h: 10 });
    const behind = rectangle({ x: -8, y: 0, w: 5, h: 10 });
    expect(sweptOverlap(landed, behind, { x: 4, y: 0 })).toBe(false);
  });
  it("merges stacked silhouette rows into fewer collision boxes", () => {
    const mask = new Uint8Array(64 * 64);
    for (let y = 8; y < 40; y++) for (let x = 8; x < 40; x++) mask[y * 64 + x] = 1;
    expect(silhouetteBoxes(mask, 64, 64, 4)).toHaveLength(1);
  });
});
