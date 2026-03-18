// ── Game Types ─────────────────────────────────────────────
import type { ObstacleKind } from "./constants";

/** A single parallax background line */
export interface ParallaxLine {
  x: number;
  y: number;
  len: number;
  layer: number;
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
