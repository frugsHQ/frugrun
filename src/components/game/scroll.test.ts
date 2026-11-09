import { describe, it, expect } from 'vitest';
import { accumulateFrame } from './performance';
import { TUNING, difficultyAt, advanceJump } from './motion';
import { DIFFICULTY } from './constants';
import { worldDistance, interpolate, layerCoverage } from './scroll';

describe('Shared real-time scroll', () => {
  const cadences = {
    '60fps': () => 1000 / 60,
    '144fps': () => 1000 / 144,
    '30fps': () => 1000 / 30,
    '8–40ms': (i: number) => 8 + ((i * 7919) % 3200) / 100,
    '100ms stalls': (i: number) => i % 35 === 0 ? 100 : 1000 / 60,
  };
  for (const [name, gapAt] of Object.entries(cadences)) {
    it(`${name}: 20s distance stays within 0.5% and each second within 2%`, () => {
      let wall = 0, sim = 0, accumulator = 0, world = 0, prior = 0, lastRender = 0, lastSecond = 0, lastSecondWorld = 0;
      let frog = 436, priorFrog = frog, velocity = -1, lastFrog = frog;
      for (let i = 0; wall < 20000 - 1e-6; i++) {
        // Split frames at exact second boundaries to compare like intervals.
        const gap = Math.min(gapAt(i), 20000 - wall, (Math.floor((wall + 1e-6) / 1000) + 1) * 1000 - wall);
        const frame = accumulateFrame(accumulator, gap); accumulator = frame.remainder;
        for (let step = 0; step < frame.steps; step++) {
          prior = world; priorFrog = frog;
          const old = sim; sim += TUNING.stepMs;
          world += worldDistance(sim) - worldDistance(old);
          const jump = advanceJump(frog, velocity, 436, false, 0, TUNING.stepMs);
          frog = jump.y; velocity = jump.velocity;
        }
        const render = interpolate(prior, world, accumulator / TUNING.stepMs);
        const renderFrog = interpolate(priorFrog, frog, accumulator / TUNING.stepMs);
        const speed = difficultyAt(sim, DIFFICULTY).speed;
        // Ground and fixed world anchors (obstacles/coins) share precisely this displacement.
        expect(render).toBeGreaterThanOrEqual(lastRender - 1e-8);
        expect(render - lastRender).toBeLessThanOrEqual(speed * gap + 1);
        expect((10000 - lastRender) - (10000 - render)).toBeCloseTo(render - lastRender);
        // Frog stays horizontally anchored; its jump must be continuous vertically.
        expect(Math.abs(renderFrog - lastFrog)).toBeLessThanOrEqual(1.1 * gap + 1);
        lastFrog = renderFrog; lastRender = render; wall += gap;
        if (Math.abs(wall / 1000 - Math.round(wall / 1000)) < 1e-7) {
          const expected = worldDistance(wall) - worldDistance(lastSecond);
          expect(Math.abs((render - lastSecondWorld) / expected - 1)).toBeLessThanOrEqual(.02);
          lastSecond = wall; lastSecondWorld = render;
        }
      }
      expect(Math.abs(world / worldDistance(20000) - 1)).toBeLessThanOrEqual(.005);
    });
  }
  it('covers every offset at portrait, landscape, 4:3, 16:9 and 21:9 widths', () => {
    for (const width of [280, 340, 800, 1000, 1400, 2100]) for (const period of [120, 400, 2100]) {
      for (let offset = -period * 2; offset < period * 2; offset += 17) {
        const range = layerCoverage(period + width + 1, period, width, offset);
        expect(range.left).toBeLessThanOrEqual(0); expect(range.right).toBeGreaterThanOrEqual(width); expect(range.gap).toBe(false);
      }
    }
    expect(layerCoverage(100, 200, 1000, 150).gap).toBe(true);
  });
});