import { describe, it, expect } from 'vitest';
import { accumulateFrame, bufferDpr, PerformanceMeter } from './performance';
import { TUNING } from './motion';
describe('Real-time rendering boundaries', () => {
  it('catches up a 100ms frame with six 60Hz steps instead of clamping to 50ms', () => {
    const result = accumulateFrame(0, 100);
    expect(result.steps * TUNING.stepMs + result.remainder).toBeCloseTo(100);
    expect(result.steps).toBe(6);
  });
  it('caps catch-up at ten steps and drops gaps longer than 250ms', () => {
    expect(accumulateFrame(0, 250).steps).toBe(10);
    expect(accumulateFrame(0, 251).accepted).toBe(0);
  });
  it('caps DPR at 1.5, desktop buffers at 1920×1080 and mobile long side at 1280', () => {
    expect(bufferDpr(1000, 600, 3, false, 0)).toBe(1.5);
    const desktop = bufferDpr(2560, 1440, 2, false, 0);
    expect(2560 * desktop).toBeLessThanOrEqual(1920); expect(1440 * desktop).toBeLessThanOrEqual(1080);
    expect(844 * bufferDpr(390, 844, 3, true, 0)).toBeLessThanOrEqual(1280);
  });
  it('quality decreases after a slow second and never changes world-speed measurements', () => {
    const meter = new PerformanceMeter();
    for (let t = 20; t <= 1020; t += 20) meter.record(t, 20, 1, 1, 0, 1, 5.6, 5.6, true);
    expect(meter.quality).toBe(1); expect(meter.summary(1020).variance).toBe(0); expect(meter.summary(1020).speed).toBeCloseTo(280);
  });
});