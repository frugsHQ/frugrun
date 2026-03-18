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

/** All possible screen states (simplified for endless mode) */
export type GameState = "start" | "playing" | "over";
