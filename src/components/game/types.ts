// ── Game Types ─────────────────────────────────────────────

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
}

/** All possible screen states */
export type GameState = "start" | "levelStart" | "playing" | "levelComplete" | "over" | "victory";

/** Definition for a single level */
export interface LevelDef {
  level: number;
  title: string;
  subtitle: string;
  targetScore: number;
  baseSpeed: number;
  minSpawn: number;
  maxSpawn: number;
}
