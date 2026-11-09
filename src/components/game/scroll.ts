import { DIFFICULTY } from './constants';

/** Integral of the existing smoothstep ramp, in logical pixels. */
export function worldDistance(elapsedMs: number) {
  const time = Math.max(0, elapsedMs);
  const t = Math.min(time / DIFFICULTY.capTime, 1);
  return DIFFICULTY.startSpeed * time + (DIFFICULTY.maxSpeed - DIFFICULTY.startSpeed) *
    (DIFFICULTY.capTime * (t ** 3 - t ** 4 / 2) + Math.max(0, time - DIFFICULTY.capTime));
}
export const interpolate = (previous: number, current: number, alpha: number) => previous + (current - previous) * alpha;
export function layerCoverage(width: number, period: number, stageWidth: number, offset: number) {
  const left = -((offset % period + period) % period);
  const right = left + width;
  return { left, right, gap: left > 0.01 || right < stageWidth - 0.01 };
}