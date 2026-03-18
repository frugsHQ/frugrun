import type { LevelDef } from "./types";

// ── Core gameplay constants ────────────────────────────────
export const GROUND_RATIO = 0.82;
export const FROG_W_RATIO = 0.14;
export const FROG_ASPECT = 1.1;
export const GRAVITY = 0.0018;
export const JUMP_VEL = -0.85;
export const SPEED_INCREASE = 0.00002;
export const SPAWN_DECREASE = 0.005;

// ── Parallax background layers ─────────────────────────────
export const PARALLAX_LAYERS = [
  { count: 25, speedFactor: 0.08, yMin: 0.15, yMax: 0.55, alpha: 0.08, lenMin: 30, lenMax: 80 },
  { count: 20, speedFactor: 0.15, yMin: 0.25, yMax: 0.65, alpha: 0.12, lenMin: 20, lenMax: 60 },
  { count: 15, speedFactor: 0.25, yMin: 0.35, yMax: 0.75, alpha: 0.18, lenMin: 15, lenMax: 45 },
];

// ── Level definitions (5 levels) ───────────────────────────
// Each level gets harder: faster obstacles, shorter spawn gaps, more to clear.
export const LEVELS: LevelDef[] = [
  {
    level: 1,
    title: "Green Meadow",
    subtitle: "A gentle start — get the hang of jumping!",
    targetScore: 5,
    baseSpeed: 0.30,
    minSpawn: 900,
    maxSpawn: 1800,
  },
  {
    level: 2,
    title: "Rocky Path",
    subtitle: "Things are picking up speed…",
    targetScore: 8,
    baseSpeed: 0.35,
    minSpawn: 750,
    maxSpawn: 1600,
  },
  {
    level: 3,
    title: "Dense Forest",
    subtitle: "Obstacles come thick and fast!",
    targetScore: 12,
    baseSpeed: 0.40,
    minSpawn: 600,
    maxSpawn: 1400,
  },
  {
    level: 4,
    title: "Mountain Pass",
    subtitle: "Only the bold survive up here.",
    targetScore: 15,
    baseSpeed: 0.45,
    minSpawn: 500,
    maxSpawn: 1200,
  },
  {
    level: 5,
    title: "The Summit",
    subtitle: "Final challenge — give it everything!",
    targetScore: 20,
    baseSpeed: 0.50,
    minSpawn: 400,
    maxSpawn: 1000,
  },
];
