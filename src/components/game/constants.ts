// ── Core gameplay constants ────────────────────────────────
export const GROUND_RATIO = 0.82;
export const FROG_W_RATIO = 0.14;
export const FROG_ASPECT = 1.1;
export const GRAVITY = 0.0018;
export const JUMP_VEL = -0.85;

// ── Parallax background layers ─────────────────────────────
export const PARALLAX_LAYERS = [
  { count: 25, speedFactor: 0.08, yMin: 0.15, yMax: 0.55, alpha: 0.08, lenMin: 30, lenMax: 80 },
  { count: 20, speedFactor: 0.15, yMin: 0.25, yMax: 0.65, alpha: 0.12, lenMin: 20, lenMax: 60 },
  { count: 15, speedFactor: 0.25, yMin: 0.35, yMax: 0.75, alpha: 0.18, lenMin: 15, lenMax: 45 },
];

// ── Endless-mode difficulty ramp config ────────────────────
// All difficulty values in one place for easy tweaking.
export const DIFFICULTY = {
  // Starting values
  startSpeed: 0.28,       // initial obstacle speed multiplier
  startMinSpawn: 1000,    // initial min ms between spawns
  startMaxSpawn: 1900,    // initial max ms between spawns

  // Maximum difficulty caps
  maxSpeed: 0.60,         // fastest obstacle speed
  minMinSpawn: 350,       // fastest possible spawn interval
  minMaxSpawn: 700,       // cap for the max-spawn interval

  // How fast difficulty ramps (per ms of elapsed time)
  speedRamp: 0.000015,    // speed increase per ms
  spawnRamp: 0.008,       // spawn interval decrease per ms (applied to both min & max)

  // Time (ms) at which difficulty is fully capped (~2.5 min)
  capTime: 150_000,
} as const;

// ── Obstacle types ─────────────────────────────────────────
export type ObstacleKind = "rock" | "snake";
