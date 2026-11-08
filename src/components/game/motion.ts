// All motion is measured in logical pixels and milliseconds, never screen pixels.
export const GRAVITY = 0.0025;
export const FALL_GRAVITY_SCALE = 1.05;
export const APEX_HANG_THRESHOLD = 0.08;
export const APEX_GRAVITY_SCALE = 0.5;
export const JUMP_VELOCITY = -Math.sqrt(2 * GRAVITY * 88 * 2.4);
export const JUMP_CUT = 0.6;
export const TARGET_AIRTIME = { tap: 550, held: 850 } as const;
export const MIN_OBSTACLE_RECOVERY_MS = 140;
export function safeSpawnInterval(interval: number, speed: number, obstacleWidth: number) {
  return Math.max(interval, TARGET_AIRTIME.held + MIN_OBSTACLE_RECOVERY_MS + obstacleWidth / speed);
}
export const TUNING = {
  logicalHeight: 600, desktopWidth: 1000, portraitWidth: 340, landscapeMinWidth: 800,
  stepMs: 1000 / 60, maxFrameMs: 50, dprCap: 2, hudMs: 100,
  frogSize: 88, groundRatio: 0.86, grassOverlap: 8,
  shortHopHeights: 1.2, bigHopHeights: 2.4, holdMs: 180,
  jumpCut: JUMP_CUT, fallGravity: FALL_GRAVITY_SCALE, holdGravity: 1,
  coyoteMs: 90, bufferMs: 110, landingMs: 100, hudClearance: 150,
  gravity: GRAVITY, runStride: 100, deathMs: 250, deathSlowdown: 0.25,
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
export function jumpVelocity() { return JUMP_VELOCITY; }
export function advanceJump(y: number, velocity: number, rest: number, held: boolean, heldMs: number, dt: number) {
  // A release cuts velocity once in the input handler; gravity never cuts it again.
  void held; void heldMs;
  const gravity = GRAVITY * (Math.abs(velocity) < APEX_HANG_THRESHOLD ? APEX_GRAVITY_SCALE : velocity > 0 ? FALL_GRAVITY_SCALE : 1);
  let vy = velocity + gravity * dt;
  let next = y + vy * dt;
  const apex = Math.max(TUNING.hudClearance, rest - TUNING.frogSize * TUNING.bigHopHeights);
  if (next < apex) { next = apex; vy = Math.max(0, vy); }
  if (next >= rest) return { y: rest, velocity: 0, grounded: true };
  return { y: next, velocity: vy, grounded: false };
}
