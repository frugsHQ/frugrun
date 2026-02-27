import { useRef, useEffect, useCallback, useState } from "react";
import frugSprite from "@/assets/frug-sprite.png";

// ── Constants ──────────────────────────────────────────────
const GROUND_RATIO = 0.82;
const FROG_W_RATIO = 0.14;
const FROG_ASPECT = 1.1;
const GRAVITY = 0.0018;
const JUMP_VEL = -0.85;
const BASE_OBS_SPEED = 0.35;
const MIN_SPAWN = 700;
const MAX_SPAWN = 1600;
const SPEED_INCREASE = 0.00002;
const SPAWN_DECREASE = 0.005;

// ── Parallax config ────────────────────────────────────────
const PARALLAX_LAYERS = [
  { count: 25, speedFactor: 0.08, yMin: 0.15, yMax: 0.55, alpha: 0.08, lenMin: 30, lenMax: 80 },
  { count: 20, speedFactor: 0.15, yMin: 0.25, yMax: 0.65, alpha: 0.12, lenMin: 20, lenMax: 60 },
  { count: 15, speedFactor: 0.25, yMin: 0.35, yMax: 0.75, alpha: 0.18, lenMin: 15, lenMax: 45 },
];

interface ParallaxLine {
  x: number;
  y: number;
  len: number;
  layer: number;
}

function initParallaxLines(w: number, h: number): ParallaxLine[] {
  const lines: ParallaxLine[] = [];
  PARALLAX_LAYERS.forEach((cfg, layer) => {
    for (let i = 0; i < cfg.count; i++) {
      lines.push({
        x: Math.random() * (w + 200),
        y: h * cfg.yMin + Math.random() * h * (cfg.yMax - cfg.yMin),
        len: cfg.lenMin + Math.random() * (cfg.lenMax - cfg.lenMin),
        layer,
      });
    }
  });
  return lines;
}

// ── Types ──────────────────────────────────────────────────
interface Obstacle {
  x: number;
  w: number;
  h: number;
}

type GameState = "start" | "playing" | "over";

// ── Drawing helpers ────────────────────────────────────────
function drawFrogFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.fillStyle = "#3cb043";
  ctx.beginPath();
  const r = w * 0.3;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  w: number,
  h: number
) {
  ctx.fillStyle = "#8B4513";
  ctx.fillRect(x, groundY - h, w, h);
  ctx.fillStyle = "#654321";
  ctx.beginPath();
  ctx.moveTo(x, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h - h * 0.3);
  ctx.lineTo(x + w, groundY - h);
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, groundY: number, h: number) {
  ctx.fillStyle = "#5a3e1b";
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = "#4a7c24";
  ctx.fillRect(0, groundY - 3, w, 6);
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, groundY: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, groundY);
  grad.addColorStop(0, "#87CEEB");
  grad.addColorStop(1, "#d4f0ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, groundY);
}

function drawClouds(ctx: CanvasRenderingContext2D, w: number, time: number) {
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 4; i++) {
    const cx = ((time * 0.015 * (i + 1) * 0.3 + i * w * 0.3) % (w + 120)) - 60;
    const cy = 40 + i * 35;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 50 + i * 10, 18 + i * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParallax(
  ctx: CanvasRenderingContext2D,
  lines: ParallaxLine[],
  speed: number,
  dt: number,
  w: number
) {
  for (const line of lines) {
    const cfg = PARALLAX_LAYERS[line.layer];
    line.x -= speed * cfg.speedFactor * dt;
    if (line.x + line.len < 0) {
      line.x = w + Math.random() * 100;
    }
    ctx.strokeStyle = `rgba(255,255,255,${cfg.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x + line.len, line.y);
    ctx.stroke();
  }
}

// ── Component ──────────────────────────────────────────────
export default function FrogRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const spriteLoadedRef = useRef(false);
  const parallaxRef = useRef<ParallaxLine[]>([]);

  const stateRef = useRef<{
    gameState: GameState;
    frogY: number;
    frogVY: number;
    onGround: boolean;
    obstacles: Obstacle[];
    score: number;
    bestScore: number;
    elapsed: number;
    spawnTimer: number;
    nextSpawn: number;
    lastTime: number;
    animId: number;
    canvasW: number;
    canvasH: number;
  }>({
    gameState: "start",
    frogY: 0,
    frogVY: 0,
    onGround: true,
    obstacles: [],
    score: 0,
    bestScore: parseInt(localStorage.getItem("frogBest") || "0", 10),
    elapsed: 0,
    spawnTimer: 0,
    nextSpawn: 1200,
    lastTime: 0,
    animId: 0,
    canvasW: 0,
    canvasH: 0,
  });

  const [overlay, setOverlay] = useState<GameState>("start");
  const [displayScore, setDisplayScore] = useState(0);
  const [displayBest, setDisplayBest] = useState(
    parseInt(localStorage.getItem("frogBest") || "0", 10)
  );

  // ── Load sprite once ──
  useEffect(() => {
    const img = new Image();
    img.src = frugSprite;
    img.onload = () => {
      spriteLoadedRef.current = true;
    };
    spriteRef.current = img;
  }, []);

  // ── Resize canvas ──
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
    stateRef.current.canvasW = w;
    stateRef.current.canvasH = h;
    parallaxRef.current = initParallaxLines(w, h);
  }, []);

  // ── Game loop ──
  const loop = useCallback((time: number) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || s.gameState !== "playing") return;
    const ctx = canvas.getContext("2d")!;
    const dt = s.lastTime ? Math.min(time - s.lastTime, 50) : 16;
    s.lastTime = time;

    const W = s.canvasW;
    const H = s.canvasH;
    const groundY = H * GROUND_RATIO;
    const frogW = W * FROG_W_RATIO;
    const frogH = frogW * FROG_ASPECT;
    const frogX = W * 0.1;
    const scale = W / 400;

    // ── Update frog ──
    s.frogVY += GRAVITY * scale * dt;
    s.frogY += s.frogVY * scale * dt;
    if (s.frogY >= groundY - frogH) {
      s.frogY = groundY - frogH;
      s.frogVY = 0;
      s.onGround = true;
    }

    // ── Obstacle speed & spawning ──
    s.elapsed += dt;
    const speed = (BASE_OBS_SPEED + SPEED_INCREASE * s.elapsed) * scale;
    s.spawnTimer += dt;
    if (s.spawnTimer >= s.nextSpawn) {
      s.spawnTimer = 0;
      const interval = Math.max(MIN_SPAWN, MAX_SPAWN - SPAWN_DECREASE * s.elapsed);
      s.nextSpawn = interval * (0.6 + Math.random() * 0.8);
      const ow = frogW * (0.5 + Math.random() * 0.5);
      const oh = frogH * (0.6 + Math.random() * 0.7);
      s.obstacles.push({ x: W + 10, w: ow, h: oh });
    }

    // ── Move obstacles ──
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      s.obstacles[i].x -= speed * dt;
      if (s.obstacles[i].x + s.obstacles[i].w < 0) {
        s.obstacles.splice(i, 1);
        s.score++;
      }
    }

    // ── Collision (AABB) – hitbox slightly smaller than sprite ──
    const hitboxShrink = 0.15;
    const frogBox = {
      x: frogX + frogW * hitboxShrink,
      y: s.frogY + frogH * hitboxShrink,
      w: frogW * (1 - hitboxShrink * 2),
      h: frogH * (1 - hitboxShrink * 2),
    };
    for (const ob of s.obstacles) {
      const obBox = { x: ob.x, y: groundY - ob.h, w: ob.w, h: ob.h };
      if (
        frogBox.x < obBox.x + obBox.w &&
        frogBox.x + frogBox.w > obBox.x &&
        frogBox.y < obBox.y + obBox.h &&
        frogBox.y + frogBox.h > obBox.y
      ) {
        s.gameState = "over";
        if (s.score > s.bestScore) {
          s.bestScore = s.score;
          localStorage.setItem("frogBest", String(s.bestScore));
        }
        setOverlay("over");
        setDisplayScore(s.score);
        setDisplayBest(s.bestScore);
        return;
      }
    }

    // ── Draw ──
    ctx.clearRect(0, 0, W, H);
    drawSky(ctx, W, groundY);
    drawParallax(ctx, parallaxRef.current, speed, dt, W);
    drawClouds(ctx, W, s.elapsed);
    drawGround(ctx, W, groundY, H);

    for (const ob of s.obstacles) {
      drawObstacle(ctx, ob.x, groundY, ob.w, ob.h);
    }

    // ── Draw frog (sprite or fallback) ──
    if (spriteLoadedRef.current && spriteRef.current) {
      ctx.drawImage(spriteRef.current, frogX, s.frogY, frogW, frogH);
    } else {
      drawFrogFallback(ctx, frogX, s.frogY, frogW, frogH);
    }

    // Score HUD
    const fontSize = Math.max(16, W * 0.04);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${s.score}`, 14, fontSize + 10);
    ctx.textAlign = "right";
    ctx.fillText(`Best: ${s.bestScore}`, W - 14, fontSize + 10);

    s.animId = requestAnimationFrame(loop);
  }, []);

  // ── Start / Restart ──
  const startGame = useCallback(() => {
    const s = stateRef.current;
    const H = s.canvasH;
    const groundY = H * GROUND_RATIO;
    const frogW = s.canvasW * FROG_W_RATIO;
    const frogH = frogW * FROG_ASPECT;

    s.gameState = "playing";
    s.frogY = groundY - frogH;
    s.frogVY = 0;
    s.onGround = true;
    s.obstacles = [];
    s.score = 0;
    s.elapsed = 0;
    s.spawnTimer = 0;
    s.nextSpawn = 1200;
    s.lastTime = 0;
    parallaxRef.current = initParallaxLines(s.canvasW, s.canvasH);
    setOverlay("playing");
    cancelAnimationFrame(s.animId);
    s.animId = requestAnimationFrame(loop);
  }, [loop]);

  // ── Jump ──
  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === "start") {
      startGame();
      return;
    }
    if (s.gameState !== "playing") return;
    if (!s.onGround) return;
    const scale = s.canvasW / 400;
    s.frogVY = JUMP_VEL * scale;
    s.onGround = false;
  }, [startGame]);

  // ── Input handlers ──
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(stateRef.current.animId);
    };
  }, [resize, jump]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      jump();
    },
    [jump]
  );

  // ── Render ──
  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
      />

      {overlay === "start" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
          <div className="text-center px-6">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">
              🐸 Frug Run
            </h1>
            <p className="text-lg text-white/80 mb-8">
              Tap anywhere or press Space to jump
            </p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              Tap to Start
            </button>
          </div>
        </div>
      )}

      {overlay === "over" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
          <div className="text-center px-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 drop-shadow-lg">
              Game Over
            </h2>
            <p className="text-2xl text-white mb-1">
              Score: <span className="font-bold text-accent">{displayScore}</span>
            </p>
            <p className="text-lg text-white/70 mb-8">
              Best: <span className="font-bold">{displayBest}</span>
            </p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
            >
              Restart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
