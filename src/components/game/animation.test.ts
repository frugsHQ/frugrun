import { describe, expect, it } from 'vitest';
import { clearTransientEffects, damageHidden, poseBlend, runCycle } from './animation';
import { DIFFICULTY } from './constants';
import { TUNING } from './motion';
import { accumulateFrame } from './performance';
import { interpolate, worldDistance } from './scroll';

describe('Focused animation regressions', () => {
  it('never hides the menu character, but preserves gameplay damage blinking', () => {
    for (let invuln = 0; invuln <= 1200; invuln += 10) {
      expect(damageHidden('start', invuln)).toBe(false);
      expect(damageHidden('leaderboard', invuln)).toBe(false);
    }
    expect(damageHidden('playing', 1080)).toBe(true);
    expect(damageHidden('playing', 1170)).toBe(false);
  });
  it('releases floating pickups and particles when entering preview', () => {
    const popups = [{ life: 500 }], particles = [{ life: 350 }, { life: 400 }];
    clearTransientEffects(popups, particles);
    expect(popups[0].life).toBe(0);
    expect(particles.map(p => p.life)).toEqual([0, 0]);
  });
  it('keeps every frame valid across all four-frame loop boundaries', () => {
    expect([0, 25, 50, 75, 100].map(d => runCycle(d, 4).frame)).toEqual([0, 1, 2, 3, 0]);
    for (let distance = -200; distance < 20000; distance += 0.7) {
      const cycle = runCycle(distance, 4);
      expect(cycle.frame).toBeGreaterThanOrEqual(0);
      expect(cycle.frame).toBeLessThan(4);
    }
  });
  for (const hz of [30, 60, 120, 144]) {
    it(`keeps constant-speed displacement and run cadence even at ${hz}Hz`, () => {
      let remainder = 0, world = 0, prior = 0, last = 0, transitions = 0, lastFrame = 0;
      const gap = 1000 / hz;
      for (let i = 0; i < hz * 60; i++) {
        const advance = accumulateFrame(remainder, gap); remainder = advance.remainder;
        for (let n = 0; n < advance.steps; n++) { prior = world; world += DIFFICULTY.startSpeed * TUNING.stepMs; }
        const rendered = interpolate(prior, world, remainder / TUNING.stepMs);
        if (i > 2) expect(rendered - last).toBeCloseTo(DIFFICULTY.startSpeed * gap, 7);
        const frame = runCycle(rendered, 4).frame;
        if (frame !== lastFrame) transitions++;
        lastFrame = frame; last = rendered;
      }
      expect(transitions).toBe(671);
      expect(worldDistance(60000)).toBeGreaterThan(DIFFICULTY.startSpeed * 60000);
    });
    it(`pose easing has the same result after one second at ${hz}Hz`, () => {
      let value = 0;
      for (let i = 0; i < hz; i++) value += (1 - value) * poseBlend(0.2, 1000 / hz);
      expect(value).toBeCloseTo(1 - Math.pow(0.8, 60), 12);
    });
  }
});