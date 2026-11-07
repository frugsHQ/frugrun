// ── Core gameplay constants ────────────────────────────────
export const GROUND_RATIO = 0.82;
export const FROG_W_RATIO = 0.14;
export const FROG_ASPECT = 1.0; // new sprite frames are square
// Fraction of frogH to shift the sprite down (visually sits on ground better)
export const FROG_Y_OFFSET = 0.03;
export const GRAVITY = 0.0018;
export const JUMP_VEL = -0.85;

// ── Endless-mode difficulty ramp config ────────────────────
export const DIFFICULTY = {
  startSpeed: 0.28,
  startMinSpawn: 1000,
  startMaxSpawn: 1900,
  maxSpeed: 0.60,
  minMinSpawn: 350,
  minMaxSpawn: 700,
  speedRamp: 0.000015,
  spawnRamp: 0.008,
  capTime: 150_000,
} as const;

// ── Obstacle types ─────────────────────────────────────────
export type ObstacleKind = "spikes" | "totem";

// ── Coins & lives ──────────────────────────────────────────
export const COIN_POINTS = 10;      // each coin adds 10 points
export const COIN_SIZE_RATIO = 0.42; // coin size relative to frog width
export const START_LIVES = 3;
export const HIT_INVULN_MS = 1200;   // grace time after losing a heart

// ── Scoring config ─────────────────────────────────────────
export const SCORING = {
  // Points awarded per obstacle cleared (base, before multiplier)
  baseObstaclePoints: 10,
  // Points per second of survival
  survivalPointsPerSec: 1,
  // Combo multiplier: grows by this much per obstacle cleared without dying
  comboStep: 0.1,
  // Maximum combo multiplier
  maxCombo: 3.0,
} as const;

// ── Milestone messages (triggered at score thresholds) ─────
export const MILESTONES = [
  { score: 50, text: "🏃 Run, Frug, Run!" },
  { score: 150, text: "⚡ Speed increasing!" },
  { score: 300, text: "🔥 What the Frug! You got this!" },
  { score: 500, text: "💪 Watch out!" },
  { score: 800, text: "🌟 Incredible!" },
  { score: 1200, text: "👑 Unstoppable!" },
  { score: 2000, text: "🐸 Frog legend!" },
] as const;
