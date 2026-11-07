// ── Game Types ─────────────────────────────────────────────
import type { ObstacleKind } from "./constants";

/** A spinning collectible coin */
export interface Coin {
  x: number;
  y: number;      // center
  phase: number;  // spin offset so coins don't spin in sync
}

/** A dust/landing particle */
export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/** An obstacle the frog must jump over */
export interface Obstacle {
  x: number;
  w: number;
  h: number;
  kind: ObstacleKind;
}

/** All possible screen states */
export type GameState = "start" | "playing" | "over" | "leaderboard";

/** A milestone message shown briefly on screen */
export interface MilestoneMsg {
  text: string;
  life: number;   // ms remaining
  maxLife: number;
}
