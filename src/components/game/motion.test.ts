import { describe, expect, it } from 'vitest';
import { TUNING, advanceJump, jumpVelocity, difficultyAt } from './motion';
import { DIFFICULTY, COIN_POINTS } from './constants';
describe('Polish gameplay boundaries', () => {
  it('keeps each coin worth exactly 10 points', () => expect(COIN_POINTS).toBe(10));
  it('uses a 60Hz simulation and caps catch-up frames at 50ms', () => { expect(TUNING.stepMs).toBe(1000 / 60); expect(TUNING.maxFrameMs).toBe(50); });
  it('caps the held apex at 2.4 frog heights and keeps the full frog below the HUD', () => {
    const rest = 600 * TUNING.groundRatio - TUNING.frogSize + TUNING.grassOverlap;
    let y = rest, vy = jumpVelocity(), minimum = y;
    for (let t = 0; t < 1000; t += TUNING.stepMs) { const p = advanceJump(y, vy, rest, true, t, TUNING.stepMs); y = p.y; vy = p.velocity; minimum = Math.min(minimum, y); }
    expect(minimum).toBeGreaterThanOrEqual(TUNING.hudClearance); expect(rest - minimum).toBeLessThanOrEqual(2.4 * TUNING.frogSize);
  });
  it('hold produces a higher hop than a quick released press', () => {
    function apex(held: boolean) { let y = 436, v = jumpVelocity(), minimum = y; for (let t = 0; t < 1000; t += TUNING.stepMs) { if (!held && t === 0) v *= TUNING.jumpCut; const p = advanceJump(y, v, 436, held, t, TUNING.stepMs); y = p.y; v = p.velocity; minimum = Math.min(minimum, y); } return minimum; }
    expect(apex(true)).toBeLessThan(apex(false)); expect(TUNING.holdMs).toBe(180); expect(TUNING.bufferMs).toBe(110); expect(TUNING.coyoteMs).toBe(90);
  });
  it('never exceeds existing maximum difficulty', () => { const d = difficultyAt(1e9, DIFFICULTY); expect(d.speed).toBe(DIFFICULTY.maxSpeed); expect(d.minSpawn).toBe(DIFFICULTY.minMinSpawn); });
});
