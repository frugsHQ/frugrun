// ── Core gameplay constants ────────────────────────────────
export const GROUND_RATIO = 0.82;
export const FROG_W_RATIO = 0.14;
export const FROG_ASPECT = 1.1;
// Fraction of frogH to shift the sprite down (visually sits on ground better)
export const FROG_Y_OFFSET = 0.12;
export const GRAVITY = 0.0018;
export const JUMP_VEL = -0.85;

// ── Parallax background layers ─────────────────────────────
export const PARALLAX_LAYERS = [
  { count: 25, speedFactor: 0.08, yMin: 0.15, yMax: 0.55, alpha: 0.08, lenMin: 30, lenMax: 80 },
  { count: 20, speedFactor: 0.15, yMin: 0.25, yMax: 0.65, alpha: 0.12, lenMin: 20, lenMax: 60 },
  { count: 15, speedFactor: 0.25, yMin: 0.35, yMax: 0.75, alpha: 0.18, lenMin: 15, lenMax: 45 },
];

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
export type ObstacleKind = "rock" | "snake";

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
