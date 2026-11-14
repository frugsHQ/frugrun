import { TUNING } from './motion';
import type { GameState } from './types';

/** One distance-driven cycle shared by frame selection, bob, hat and cape. */
export function runCycle(distance: number, frameCount: number) {
  const cycle = ((distance / TUNING.runStride) % 1 + 1) % 1;
  return { frame: Math.min(Math.max(0, frameCount - 1), Math.floor(cycle * frameCount)), phase: cycle * Math.PI * 2 };
}

/** Preserve the existing 60Hz easing, without making it depend on display Hz. */
export function poseBlend(amount: number, elapsedMs: number) {
  return 1 - Math.pow(1 - amount, Math.max(0, elapsedMs) / TUNING.stepMs);
}

export function isPreview(state: GameState) {
  return state === 'start' || state === 'leaderboard';
}

export function damageHidden(state: GameState, invulnerabilityMs: number) {
  return !isPreview(state) && invulnerabilityMs > 0 && Math.floor(invulnerabilityMs / 90) % 2 === 0;
}

/** Reset pooled effects too: emptied lists alone do not release their slots. */
export function clearTransientEffects(...pools: { life: number }[][]) {
  for (const pool of pools) for (const effect of pool) effect.life = 0;
}