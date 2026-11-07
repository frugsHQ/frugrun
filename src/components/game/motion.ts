// All motion is measured in logical pixels and milliseconds, never screen pixels.
export const TUNING = {
  logicalHeight: 600, desktopWidth: 1000, portraitWidth: 340, landscapeMinWidth: 800,
  stepMs: 1000 / 60, maxFrameMs: 50, dprCap: 2, hudMs: 100,
  frogSize: 88, groundRatio: 0.86, grassOverlap: 8,
  shortHopHeights: 1.2, bigHopHeights: 2.4, holdMs: 180,
  jumpCut: 0.45, fallGravity: 1.4, holdGravity: 0.38,
  coyoteMs: 90, bufferMs: 110, landingMs: 100, hudClearance: 150,
  gravity: 0.0036, runStride: 100, deathMs: 250,
  obstaclePool: 40, coinPool: 120, particlePool: 160,
  playerWidth: 0.52, playerHeight: 0.60,
  playerPadX: 0.30, playerPadY: 0.35, obstacleInset: 0.10,
  parallaxFar: 0.08, parallaxMid: 0.14, parallaxNear: 0.25,
} as const;
export function difficultyAt(elapsed: number, config: { capTime: number; startSpeed: number; maxSpeed: number; startMinSpawn: number; minMinSpawn: number; startMaxSpawn: number; minMaxSpawn: number }) {
  const t = Math.max(0, Math.min(elapsed / config.capTime, 1));
  const ease = t * t * (3 - 2 * t);
  return { speed: config.startSpeed + (config.maxSpeed - config.startSpeed) * ease,
    minSpawn: config.startMinSpawn + (config.minMinSpawn - config.startMinSpawn) * ease,
    maxSpawn: config.startMaxSpawn + (config.minMaxSpawn - config.startMaxSpawn) * ease };
}
export function jumpVelocity() { return -Math.sqrt(2 * TUNING.gravity * TUNING.frogSize * TUNING.shortHopHeights); }
export function advanceJump(y: number, velocity: number, rest: number, held: boolean, heldMs: number, dt: number) {
  const gravity = TUNING.gravity * (velocity > 0 ? TUNING.fallGravity : held && heldMs < TUNING.holdMs ? TUNING.holdGravity : 1);
  let vy = velocity + gravity * dt;
  let next = y + vy * dt;
  const apex = Math.max(TUNING.hudClearance, rest - TUNING.frogSize * TUNING.bigHopHeights);
  if (next < apex) { next = apex; vy = Math.max(0, vy); }
  if (next >= rest) return { y: rest, velocity: 0, grounded: true };
  return { y: next, velocity: vy, grounded: false };
}
