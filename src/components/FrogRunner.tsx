import { accumulateFrame, bufferDpr, PerformanceMeter } from "./game/performance";
import { worldDistance, interpolate, layerCoverage } from './game/scroll';
import { startRun } from "./game/leaderboard";
import { useRef, useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize } from "lucide-react";
import { MusicPlayer } from "./game/music";
import { TUNING, advanceJump, jumpVelocity, difficultyAt, safeSpawnInterval } from "./game/motion";
export { TUNING } from "./game/motion";
import logoSrc from "@/assets/frugrun-logo.png";
import { BACKGROUND_SRC as backgroundSrc } from "./game/drawing";
import { drawFrug, warmFrugLayers } from "./game/sprites";
import { spriteInfo, transformBox, rectangle, sweptOverlap, canDamage, BODY_ANCHOR, FOOT_BASELINE, COIN_PICKUP_SCALE, type Point, type Pose } from "./game/spriteGeometry";
import coinIconSrc from "@/assets/frug-coin.png";

// ── Modular imports ────────────────────────────────────────
import {
  FROG_ASPECT, DIFFICULTY, SCORING, MILESTONES,
  COIN_POINTS, COIN_SIZE_RATIO, START_LIVES, HIT_INVULN_MS,
} from "./game/constants";
import type { ObstacleKind } from "./game/constants";
import type { DustParticle, Obstacle, GameState, MilestoneMsg, Coin } from "./game/types";
import {
  loadGameImages, decodeGameImages, drawObstacle, drawCoin,
  drawFrogFallback, imageReady, OBSTACLE_ASPECT, prepareGameSprites, drawLetterbox, makeCompositedLayers, type GameImages,
} from "./game/drawing";
import { playSfxJump, playSfxScore, playSfxGameOver, playSfxCoin, playSfxHit } from "./game/sfx";
import { StartOverlay, GameOverOverlay, LeaderboardOverlay } from "./game/overlays";

// Run-cycle timing: each of the 4 frames shows for this long (ms)
const RUN_FRAME_MS = TUNING.runStride; // logical distance per running cycle

// ── Component ──────────────────────────────────────────────
export default function FrogRunner() {
  const layerRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const layers = useRef<ReturnType<typeof makeCompositedLayers>>([]);
  const foregroundRef = useRef<HTMLCanvasElement>(null);
  const letterboxRef = useRef<HTMLImageElement>(null);
  const meter = useRef(new PerformanceMeter());
  const graphRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<HTMLImageElement>(null);
  const countdownRemaining = useRef(0);
  const measurement = useRef({ world: 0, elapsed: 0, active: false });
  const coverage = useRef('');
  const coverageGap = useRef(false);
  const lastReport = useRef("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<GameImages | null>(null);
  const runFrameRef = useRef(0);
  const hitObstacles = useRef(new WeakSet<Obstacle>());
  const lastDrawn = useRef<{ pose: Pose; obstacles: Map<Obstacle, number>; polygons: Point[][] } | null>(null);
  const dustRef = useRef<DustParticle[]>([]);
  const sparkleRef = useRef<DustParticle[]>([]);
  const shakeRef = useRef(0);
  const milestoneRef = useRef<MilestoneMsg | null>(null);
  const triggeredMilestonesRef = useRef<Set<number>>(new Set());

  // HUD DOM refs (updated directly to avoid React re-renders each frame)
  const scoreElRef = useRef<HTMLSpanElement>(null);
  const coinsElRef = useRef<HTMLSpanElement>(null);
  const bestElRef = useRef<HTMLSpanElement>(null);
  const [lives, setLives] = useState(START_LIVES);

  const mutedRef = useRef(localStorage.getItem("frogMuted") === "1");
  const tileRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const pausedRef = useRef(false);
  
  const input = useRef({ held: false, heldMs: 0, buffer: 0, coyote: 0 });
  const comboTween = useRef(1);
  const clock = useRef({ accumulator: 0, last: 0, hud: 0, fps: 60, frameMs: 0 });
  const [debug, setDebug] = useState(false);
  const debugRef = useRef(false);
  const view = useRef({ width: 1000, height: 600, scale: 1, dpr: 1, x: 0, y: 0 });
  const previous = useRef({ frogY: 0, ground: 0, bg: 0, elapsed: 0 });
  const particlePool = useRef(Array.from({ length: TUNING.particlePool }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0 })));
  const obstaclePool = useRef(Array.from({ length: TUNING.obstaclePool }, () => ({ x: 0, w: 0, h: 0, kind: "spikes" as ObstacleKind, previousX: 0, worldX: 0 })));
  const coinPool = useRef(Array.from({ length: TUNING.coinPool }, () => ({ x: 0, y: 0, phase: 0, previousX: 0, worldX: 0 })));
  const popups = useRef(Array.from({ length: 12 }, () => ({ x: 0, y: 0, life: 0 })));
  const particle = (list: DustParticle[], value: DustParticle) => { if (meter.current.quality > 0 && list.length >= (meter.current.quality === 1 ? 20 : 8)) return; const p = particlePool.current.find(p => p.life <= 0); if (p) { Object.assign(p, value); list.push(p); } };
  const addObstacle = (x: number, w: number, h: number, kind: ObstacleKind) => { const p = obstaclePool.current.find(p => !stateRef.current.obstacles.includes(p)); if (p) { p.worldX = x + stateRef.current.groundOffset; p.x = x; p.previousX = x; p.w = w; p.h = h; p.kind = kind; hitObstacles.current.delete(p); stateRef.current.obstacles.push(p); } };
  const addCoin = (x: number, y: number, phase: number) => { const p = coinPool.current.find(p => !stateRef.current.coinList.includes(p)); if (p) { p.worldX = x + stateRef.current.groundOffset; p.x = x; p.previousX = x; p.y = y; p.phase = phase; stateRef.current.coinList.push(p); } };

  // ── Core game state (ref to avoid re-renders during loop) ──
  const stateRef = useRef({
    gameState: "start" as GameState,
    deathTimer: 0,
    score: 0,
    displayScore: 0,
    combo: 1.0,
    peakCombo: 1.0,
    coins: 0,
    lives: START_LIVES,
    invuln: 0,
    frogY: 0,
    frogVY: 0,
    onGround: true,
    wasOnGround: true,
    squashTimer: 0,
    obstacles: [] as Obstacle[],
    coinList: [] as Coin[],
    bestScore: parseInt(localStorage.getItem("frogBest") || "0", 10),
    elapsed: 0,
    survivalAccum: 0,
    spawnTimer: 0,
    nextSpawn: DIFFICULTY.startMaxSpawn as number,
    lastTime: 0,
    animId: 0,
    canvasW: 0,
    canvasH: 0,
    bgOffset: 0,
    groundOffset: 0,
  });

  // ── React-side state for overlays ──
  const [overlay, setOverlay] = useState<GameState>("start");
  const [displayScore, setDisplayScore] = useState(0);
  const [displayBest, setDisplayBest] = useState(stateRef.current.bestScore);
  const [displayCombo, setDisplayCombo] = useState(1.0);
  const [displayCoins, setDisplayCoins] = useState(0);

  // ── Load all images once ──
  useEffect(() => { let active = true; const images = loadGameImages();
    void decodeGameImages(images).then(() => {
      if (active) { prepareGameSprites(images); warmFrugLayers([...images.run, images.jump, images.fall]); imgsRef.current = images; resize(); setReady(true); }
    });
    // Re-bake the scene whenever a late image finishes loading (e.g. a slow first visit).
    const rebake = () => { if (active && imgsRef.current) resize(); };
    const late = [images.bg, images.ground].filter((img): img is HTMLImageElement => img instanceof HTMLImageElement);
    late.forEach(img => img.addEventListener('load', rebake));
    return () => { active = false; late.forEach(img => img.removeEventListener('load', rebake)); };
  }, []);

  // ── Resize canvas (sharp on high-DPI screens) ──
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = tileRef.current;
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = bufferDpr(w, h, window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches || w < 700, meter.current.quality);
    const portrait = w / h < 0.8;
    const logicalW = portrait ? TUNING.logicalHeight * w / h : TUNING.desktopWidth;
    const scale = Math.min(w / logicalW, h / TUNING.logicalHeight);
    view.current = { width: logicalW, height: TUNING.logicalHeight, scale, dpr, x: (w - logicalW * scale) / 2, y: (h - TUNING.logicalHeight * scale) / 2 };
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    ctx?.setTransform(dpr * scale, 0, 0, dpr * scale, view.current.x * dpr, view.current.y * dpr);
    if (ctx) ctx.imageSmoothingQuality = "high";
    stateRef.current.canvasW = logicalW; stateRef.current.canvasH = TUNING.logicalHeight;
    if (stateRef.current.onGround) stateRef.current.frogY = geom().restY;
    // A quality/DPR rebuild must not reset interpolation or airborne motion.
    if (stateRef.current.onGround) previous.current.frogY = stateRef.current.frogY;
    // Only bake the painted layers once the background and ground are actually decoded,
    // otherwise a blank/black frame would be cached until the next resize.
    if (imgsRef.current) {
      layers.current = makeCompositedLayers(imgsRef.current, logicalW, TUNING.logicalHeight, scale * dpr, w / scale);
      const paint = (el: HTMLCanvasElement | null, layer: typeof layers.current[number]) => {
        if (!el) return;
        el.width = layer.canvas.width; el.height = layer.canvas.height;
        el.getContext('2d')?.drawImage(layer.canvas, 0, 0);
        el.style.width = layer.width * scale + 'px'; el.style.height = layer.height * scale + 'px';
        el.style.left = '0px'; el.style.top = view.current.y + layer.top * scale + 'px';
      };
      for (let i = 0; i < layers.current.length; i++) paint(layerRefs.current[i], layers.current[i]);
      if (foregroundRef.current) { const layer = layers.current[3]; paint(foregroundRef.current, layer); foregroundRef.current.style.clipPath = `inset(${5 * scale}px 0 ${Math.max(0, layer.height - 17) * scale}px 0)`; }
      const backdrop = document.createElement('canvas'); backdrop.width = Math.ceil(w * dpr); backdrop.height = Math.ceil(h * dpr);
      const bgCtx = backdrop.getContext('2d');
      if (bgCtx) { drawLetterbox(bgCtx, imgsRef.current, backdrop.width, backdrop.height, 0); const src = backdrop.toDataURL('image/jpeg'); if (backdropRef.current) backdropRef.current.src = src; if (letterboxRef.current) letterboxRef.current.src = src; }
    }
  }, []);

  function getDifficulty(elapsed: number) { return difficultyAt(elapsed, DIFFICULTY); }

  function pickObstacleKind(elapsed: number): ObstacleKind {
    const spikeChance = Math.min(0.6, 0.3 + (elapsed / DIFFICULTY.capTime) * 0.3);
    return Math.random() < spikeChance ? "spikes" : "totem";
  }

  function checkMilestones(score: number) {
    for (const m of MILESTONES) {
      if (score >= m.score && !triggeredMilestonesRef.current.has(m.score)) {
        triggeredMilestonesRef.current.add(m.score);
        milestoneRef.current = { text: m.text, life: 2000, maxLife: 2000 };
        break;
      }
    }
  }

  // ── Frame geometry shared by update & draw ──
  function geom() {
    const s = stateRef.current;
    const W = s.canvasW, H = s.canvasH;
    const groundY = H * TUNING.groundRatio;
    const frogW = TUNING.frogSize;
    const frogH = frogW * FROG_ASPECT;
    const frogX = Math.max(24, W * 0.1);
    const restY = groundY - frogH + TUNING.grassOverlap;
    return { W, H, groundY, frogW, frogH, frogX, restY, scale: 1 };
  }

  // ── Draw the whole scene (used by both gameplay and the idle menu) ──
  const drawScene = useCallback((ctx: CanvasRenderingContext2D, alpha: number) => {
    const s = stateRef.current;
    const imgs = imgsRef.current;
    if (!imgs) return;
    const { W, H, groundY, frogW, frogH, frogX } = geom();

    const pixel = (n: number) => Math.round(n * view.current.scale * view.current.dpr) / (view.current.scale * view.current.dpr);
    const frogY = previous.current.frogY + (s.frogY - previous.current.frogY) * alpha;
    const groundOffset = interpolate(previous.current.ground, s.groundOffset, alpha);


    for (const ob of s.obstacles) drawObstacle(ctx, imgs, pixel((ob.previousX ?? ob.x) + (ob.x - (ob.previousX ?? ob.x)) * alpha), groundY, ob.w, ob.h, ob.kind);

    const coinSize = frogW * COIN_SIZE_RATIO;
    for (const c of s.coinList) drawCoin(ctx, imgs, c, coinSize, s.elapsed, pixel((c.previousX ?? c.x) + (c.x - (c.previousX ?? c.x)) * alpha));

    // ── Soft shadow under Frug (shrinks with height) ──
    const restY = groundY - frogH + TUNING.grassOverlap;
    const air = Math.max(0, restY - frogY);
    const shadowScale = Math.max(0.4, 1 - (air / (groundY * 0.5)) * 0.6);
    ctx.save();
    ctx.globalAlpha = meter.current.quality > 0 ? 0 : 0.3 * shadowScale;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(frogX + frogW * 0.5, groundY + 2, frogW * 0.32 * shadowScale, frogW * 0.05 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Pick sprite frame: run cycle on ground, jump/fall poses in air ──
    let frame: HTMLImageElement | HTMLCanvasElement;
    if (s.onGround) {
      runFrameRef.current = Math.floor((groundOffset % RUN_FRAME_MS) / RUN_FRAME_MS * imgs.run.length);
      frame = imgs.run[runFrameRef.current];
    } else {
      frame = s.frogVY < 0 ? imgs.jump : imgs.fall;
    }

    // ── Squash & stretch + small tilt ──
    let sx = 1, sy = 1, rot = 0;
    if (!s.onGround) {
      sx = 0.96; sy = 1.05;
      rot = Math.max(-0.12, Math.min(0.12, s.frogVY * 0.15));
    } else if (s.squashTimer > 0) {
      const t = s.squashTimer / 100;
      sx = 1 + 0.08 * t; sy = 1 - 0.07 * t;
    } else {
      // Tiny running bob
      sy = 1 + Math.sin(groundOffset / RUN_FRAME_MS * Math.PI * 4) * 0.012;
      rot = Math.sin(groundOffset / RUN_FRAME_MS * Math.PI * 2) * 0.012;
    }
    const pose: Pose = { x: pixel(frogX + frogW / 2), y: frogY + frogH, scaleX: frogW / 420 * sx, scaleY: frogH / 420 * sy, rotation: rot };
    const polygons = (spriteInfo.get(frame)?.boxes ?? []).map(box => transformBox(box, pose));
    let bodyMinX = Infinity, bodyMaxX = -Infinity, bodyMinY = Infinity, bodyMaxY = -Infinity;
    for (const poly of polygons) for (const p of poly) { bodyMinX = Math.min(bodyMinX, p.x); bodyMaxX = Math.max(bodyMaxX, p.x); bodyMinY = Math.min(bodyMinY, p.y); bodyMaxY = Math.max(bodyMaxY, p.y); }
    const obstaclePositions = new Map<Obstacle, number>();
    const obstaclePolygons: Point[][] = [];
    for (const ob of s.obstacles) {
      const x = pixel((ob.previousX ?? ob.x) + (ob.x - (ob.previousX ?? ob.x)) * alpha);
      obstaclePositions.set(ob, x);
      const prior = lastDrawn.current?.obstacles.get(ob) ?? x;
      // Broad phase skips distant silhouettes; narrow-phase geometry and tuning are unchanged.
      if (!debugRef.current && (Math.max(x, prior) + ob.w < bodyMinX || Math.min(x, prior) > bodyMaxX)) continue;
      const image = ob.kind === 'spikes' ? imgs.spikes : imgs.totem;
      const shapes = (spriteInfo.get(image)?.boxes ?? []).map(box => rectangle({ x: x + box.x * ob.w / image.naturalWidth, y: groundY - ob.h + ob.h * 0.06 + box.y * ob.h / image.naturalHeight, w: box.w * ob.w / image.naturalWidth, h: box.h * ob.h / image.naturalHeight }));
      obstaclePolygons.push(...shapes);
      if (s.gameState !== 'playing' || !canDamage(s.invuln, hitObstacles.current.has(ob))) continue;
      const last = lastDrawn.current;
      const priorX = last?.obstacles.get(ob) ?? x;
      const delta = { x: pose.x - (last?.pose.x ?? pose.x) - (x - priorX), y: pose.y - (last?.pose.y ?? pose.y) };
      const collision = polygons.some(poly => shapes.some(shape => sweptOverlap(poly, shape, { x: 0, y: 0 }))) ||
        (last?.polygons ?? polygons).some(poly => shapes.some(shape => {
          const priorShape = shape.map(p => ({ x: p.x + priorX - x, y: p.y }));
          return sweptOverlap(poly, priorShape, delta);
        }));
      if (collision) {
        hitObstacles.current.add(ob); s.lives -= 1; setLives(s.lives); s.combo = 1;
        s.invuln = HIT_INVULN_MS; shakeRef.current = 200; playSfxHit(mutedRef);
        if (s.lives <= 0) { s.gameState = 'dying'; s.deathTimer = TUNING.deathMs; shakeRef.current = 300; }
      }
    }
    lastDrawn.current = { pose, obstacles: obstaclePositions, polygons };
    // Pickups use the exact rendered body rectangles with a generous circular radius.
    const pickupRadius = coinSize * COIN_PICKUP_SCALE;
    if (s.gameState === 'playing') for (let i = s.coinList.length - 1; i >= 0; i--) {
      const coin = s.coinList[i];
      const x = pixel((coin.previousX ?? coin.x) + (coin.x - (coin.previousX ?? coin.x)) * alpha);
      if (x + pickupRadius < bodyMinX || x - pickupRadius > bodyMaxX || coin.y + pickupRadius < bodyMinY || coin.y - pickupRadius > bodyMaxY) continue;
      const touches = polygons.some(poly => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        return (x - Math.max(minX, Math.min(x, maxX))) ** 2 + (coin.y - Math.max(minY, Math.min(coin.y, maxY))) ** 2 <= pickupRadius ** 2;
      });
      if (!touches) continue;
      s.coinList.splice(i, 1); s.coins++; s.score += COIN_POINTS; checkMilestones(s.score); playSfxCoin(mutedRef);
      const popup = popups.current.find(p => p.life <= 0); if (popup) { popup.x = x; popup.y = coin.y; popup.life = 500; }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; particle(sparkleRef.current, { x, y: coin.y, vx: Math.cos(a) * 0.12, vy: Math.sin(a) * 0.12, life: 350, maxLife: 350, size: 2 + Math.random() * 2 }); }
    }
    const blinkHidden = s.invuln > 0 && Math.floor(s.invuln / 90) % 2 === 0;
    if (!blinkHidden) {
      if (imageReady(frame)) drawFrug(ctx, frame, pose, groundOffset / RUN_FRAME_MS * Math.PI * 2, getDifficulty(s.elapsed).speed, s.frogVY);
      else drawFrogFallback(ctx, frogX, frogY, frogW, frogH);
    }


    for (const popup of popups.current) { if (popup.life <= 0) continue;
      ctx.globalAlpha = popup.life / 500; ctx.font = '18px "Lilita One"'; ctx.fillStyle = canvasColors.current.coin;
      ctx.fillText('+1', pixel(popup.x), pixel(popup.y - (500 - popup.life) * 0.04)); }
    ctx.globalAlpha = 1;
    if (debugRef.current) {
      ctx.strokeStyle = canvasColors.current.debug;
      for (const poly of [...polygons, ...obstaclePolygons]) { ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); }
      for (const coin of s.coinList) { const x = pixel((coin.previousX ?? coin.x) + (coin.x - (coin.previousX ?? coin.x)) * alpha); ctx.beginPath(); ctx.arc(x, coin.y, pickupRadius, 0, Math.PI * 2); ctx.stroke(); }
      ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.rotation);
      ctx.beginPath(); ctx.moveTo(-frogW / 2, 0); ctx.lineTo(frogW / 2, 0); ctx.moveTo(0, -frogH); ctx.lineTo(0, 10); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    // ── Dust + coin sparkles ──
    for (const p of dustRef.current) {
      ctx.globalAlpha = (p.life / p.maxLife) * 0.6;
      ctx.fillStyle = "#f3ead2";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of sparkleRef.current) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = "#ffe66b";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── Milestone message ──
    if (milestoneRef.current) {
      const m = milestoneRef.current;
      const a = Math.min(1, (m.maxLife - m.life) / 300) * Math.min(1, m.life / 500);
      const fs = Math.min(26, W * 0.055);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `${fs}px "Lilita One", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#3a200c";
      ctx.strokeText(m.text, W / 2, H * 0.30);
      ctx.fillStyle = "#ffe14d";
      ctx.fillText(m.text, W / 2, H * 0.30);
      ctx.restore();
    }
  }, []);

  function updateParticles(list: DustParticle[], dt: number, move: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx * dt - move; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  // ── Game over ──
  const endGame = useCallback(() => {
    const s = stateRef.current;
    milestoneRef.current = null;
    s.gameState = "over";
    shakeRef.current = 300;
    playSfxGameOver(mutedRef);
    if (s.score > s.bestScore) {
      s.bestScore = s.score;
      localStorage.setItem("frogBest", String(s.bestScore));
    }

    setDisplayScore(s.score);
    setDisplayBest(s.bestScore);
    setDisplayCombo(s.peakCombo);
    setDisplayCoins(s.coins);
    setOverlay("over");
  }, []);

  // ── Main game loop ──
  const simulate = useCallback((dt: number) => {
    const s = stateRef.current;
    previous.current.frogY = s.frogY; previous.current.ground = s.groundOffset; previous.current.bg = s.bgOffset; previous.current.elapsed = s.elapsed;
    for (const ob of s.obstacles) ob.previousX = ob.x;
    for (const coin of s.coinList) coin.previousX = coin.x;
    const { W, groundY, frogW, frogH, frogX, restY, scale } = geom();
    if (s.gameState === 'dying') { const oldElapsed = s.elapsed; s.elapsed += dt; s.deathTimer -= dt;
      const move = worldDistance(s.elapsed) - worldDistance(oldElapsed);
      s.groundOffset += move; s.bgOffset = s.groundOffset * TUNING.parallaxFar;
      for (const ob of s.obstacles) ob.x = (ob.worldX ?? ob.x + s.groundOffset - move) - s.groundOffset; for (const coin of s.coinList) coin.x = (coin.worldX ?? coin.x + s.groundOffset - move) - s.groundOffset;
      if (s.deathTimer <= 0) endGame(); return; }
    if (s.gameState !== 'playing') { if (s.gameState === 'start' || s.gameState === 'leaderboard') {
      s.frogY = restY; previous.current.frogY = restY; s.onGround = true;
      s.groundOffset += DIFFICULTY.startSpeed * dt; s.bgOffset = s.groundOffset * TUNING.parallaxFar;
    } return; }
    const oldElapsed = s.elapsed;
    s.elapsed += dt;
    const diff = getDifficulty(s.elapsed);
    const speed = diff.speed * scale;

    // Scroll the world
    s.groundOffset += worldDistance(s.elapsed) - worldDistance(oldElapsed);
    s.bgOffset = s.groundOffset * TUNING.parallaxFar;

    // Survival score
    s.survivalAccum += (dt / 1000) * SCORING.survivalPointsPerSec * s.combo;
    if (s.survivalAccum >= 1) {
      const pts = Math.floor(s.survivalAccum);
      s.score += pts; s.survivalAccum -= pts;
      checkMilestones(s.score);
    }
    if (s.displayScore < s.score) {
      s.displayScore = Math.min(s.score, s.displayScore + Math.max(1, Math.ceil((s.score - s.displayScore) * 0.15)));
    }

    // Variable jump in logical pixels: a held press adds lift, release cuts ascent.
    const controls = input.current;
    controls.buffer = Math.max(0, controls.buffer - dt);
    controls.coyote = s.onGround ? TUNING.coyoteMs : Math.max(0, controls.coyote - dt);
    if (controls.buffer > 0 && (s.onGround || controls.coyote > 0)) {
      controls.buffer = 0; controls.coyote = 0; controls.heldMs = 0;
      s.frogVY = jumpVelocity() * (controls.held ? 1 : TUNING.jumpCut); s.onGround = false; playSfxJump(mutedRef);
    }
    controls.heldMs += dt;
    const motion = advanceJump(s.frogY, s.frogVY, restY, controls.held, controls.heldMs, dt);
    const landed = !s.onGround && motion.grounded;
    s.frogY = motion.y; s.frogVY = motion.velocity; s.onGround = motion.grounded;
    if (landed) { s.squashTimer = TUNING.landingMs;
      for (let i = 0; i < 7; i++) particle(dustRef.current, { x: frogX + frogW * (0.3 + Math.random() * 0.4), y: groundY,
        vx: (Math.random() - 0.5) * 0.18, vy: -Math.random() * 0.05, life: 400, maxLife: 400, size: 2 + Math.random() * 3 });
    }
    s.wasOnGround = s.onGround;
    if (s.squashTimer > 0) s.squashTimer = Math.max(0, s.squashTimer - dt);
    if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);

    // Running dust puffs behind the feet
    if (s.onGround && Math.random() < dt / 120) {
      particle(dustRef.current, {
        x: frogX + frogW * 0.3, y: groundY - 3,
        vx: -0.05 * scale - Math.random() * 0.05 * scale, vy: -Math.random() * 0.03 * scale,
        life: 350, maxLife: 350, size: 2 + Math.random() * 3,
      });
    }
    for (const popup of popups.current) popup.life = Math.max(0, popup.life - dt);
    updateParticles(dustRef.current, dt, speed * dt);
    updateParticles(sparkleRef.current, dt, speed * dt);

    if (milestoneRef.current) {
      milestoneRef.current.life -= dt;
      if (milestoneRef.current.life <= 0) milestoneRef.current = null;
    }

    // ── Spawn obstacles (and coins around them) ──
    s.spawnTimer += dt;
    if (s.spawnTimer >= s.nextSpawn) {
      s.spawnTimer -= s.nextSpawn;
      s.nextSpawn = diff.minSpawn + Math.random() * (diff.maxSpawn - diff.minSpawn);
      const kind = pickObstacleKind(s.elapsed);
      const oh = frogH * (0.5 + Math.random() * 0.4);
      const ow = oh / OBSTACLE_ASPECT[kind];
      const ox = W + 10;
      s.nextSpawn = safeSpawnInterval(s.nextSpawn, speed, ow);
      addObstacle(ox, ow, oh, kind);

      const coinSize = frogW * COIN_SIZE_RATIO;
      const r = Math.random();
      if (r < 0.55) {
        // Arc of 3 coins over the obstacle — rewards a good jump
        const peak = groundY - oh - coinSize * 1.1;
        for (let i = -1; i <= 1; i++) {
          addCoin(ox + ow / 2 + i * coinSize * 1.3, peak + Math.abs(i) * coinSize * 0.5, i * 0.6);
        }
      } else if (r < 0.85) {
        // Row of coins on the ground, halfway to the next obstacle
        const gap = speed * s.nextSpawn;
        if (gap > coinSize * 5) {
          const startX = ox + ow + gap * 0.5 - coinSize * 1.3;
          for (let i = 0; i < 3; i++) {
            addCoin(startX + i * coinSize * 1.3, groundY - coinSize * 0.75, i * 0.6);
          }
        }
      }
    }

    // ── Move obstacles & award clear points ──
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      s.obstacles[i].x = (s.obstacles[i].worldX ?? s.obstacles[i].x + s.groundOffset - speed * dt) - s.groundOffset;
      if (s.obstacles[i].x + s.obstacles[i].w < 0) {
        s.obstacles.splice(i, 1);
        s.score += Math.round(SCORING.baseObstaclePoints * s.combo);
        s.combo = Math.min(SCORING.maxCombo, s.combo + SCORING.comboStep);
        if (s.combo > s.peakCombo) s.peakCombo = s.combo;
        checkMilestones(s.score);
        playSfxScore(mutedRef);
      }
    }

    // Position updates stay fixed-step. Collision is evaluated against the
    // interpolated, pixel-snapped polygons that drawScene actually displays.
    const coinSize = frogW * COIN_SIZE_RATIO;
    for (let i = s.coinList.length - 1; i >= 0; i--) {
      s.coinList[i].x = (s.coinList[i].worldX ?? s.coinList[i].x + s.groundOffset - speed * dt) - s.groundOffset;
      if (s.coinList[i].x < -coinSize) s.coinList.splice(i, 1);
    }

  }, [endGame]);

  // One RAF loop for menus and gameplay. Simulation is always 60Hz; drawing interpolates.
  useEffect(() => {
    if (!ready) return;
    let id = 0;
    const tick = (time: number) => {
      const canvas = canvasRef.current; const ctx = canvas?.getContext('2d', { alpha: true, desynchronized: true });
      if (!ctx || !canvas) { id = requestAnimationFrame(tick); return; }
      const c = clock.current;
      const dt = c.last ? time - c.last : TUNING.stepMs;
      const began = performance.now();
      let steps = 0;
      const active = !pausedRef.current && (stateRef.current.gameState === "playing" || stateRef.current.gameState === "dying");
      c.last = time; c.frameMs = dt; c.fps += (1000 / Math.max(1, dt) - c.fps) * 0.05;
      if (countdownRemaining.current > 0 && !document.hidden) {
        const old = Math.ceil(countdownRemaining.current / 1000);
        countdownRemaining.current = Math.max(0, countdownRemaining.current - Math.min(dt, 250));
        const left = Math.ceil(countdownRemaining.current / 1000);
        if (left !== old) setCountdown(left || null);
        if (!left) { pausedRef.current = false; setPaused(false); c.accumulator = 0; }
      }
      if (!pausedRef.current) {
        const advance = accumulateFrame(c.accumulator, dt); steps = advance.steps; c.accumulator = advance.remainder;
        for (let i = 0; i < steps; i++) {
          simulate(TUNING.stepMs);
        }
      } else c.accumulator = 0;
      const updateMs = performance.now() - began; const renderStart = performance.now();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
      const alpha = pausedRef.current ? 1 : c.accumulator / TUNING.stepMs;
      const interpolatedWorld = interpolate(previous.current.ground, stateRef.current.groundOffset, alpha);
      const interpolatedElapsed = interpolate(previous.current.elapsed, stateRef.current.elapsed, alpha);
      const ranges: string[] = []; coverageGap.current = false;
      for (let i = 0; i < layers.current.length; i++) {
        const layer = layers.current[i], el = layerRefs.current[i];
        const range = layerCoverage(layer.width, layer.period, canvas.clientWidth / view.current.scale, interpolatedWorld * layer.fraction);
        coverageGap.current ||= range.gap;
        let offset = range.left * view.current.scale;
        if (i === 3) offset = Math.round(offset * view.current.dpr) / view.current.dpr;
        const transform = `translate3d(${offset}px,0,0)`;
        if (el) el.style.transform = transform;
        if (i === 3 && foregroundRef.current) foregroundRef.current.style.transform = transform;
        if (debugRef.current) {
          ranges.push(`${['Far', 'Mid', 'Near', 'Ground/grass'][i]} ${range.left.toFixed(0)}…${range.right.toFixed(0)}${range.gap ? ' GAP!' : ''}`);
          ctx.save(); ctx.strokeStyle = range.gap ? canvasColors.current.warning : canvasColors.current.debug;
          ctx.strokeRect(range.left - view.current.x / view.current.scale, layer.top + 2, layer.width, 4); ctx.restore();
        }
      }
      coverage.current = ranges.join('\n');
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, view.current.width, view.current.height); ctx.clip();
      if (shakeRef.current > 0 && !pausedRef.current) { shakeRef.current = Math.max(0, shakeRef.current - dt); const amplitude = shakeRef.current / 300 * 7;
        ctx.translate(Math.sin(time * 0.12) * amplitude, Math.cos(time * 0.15) * amplitude); }
      drawScene(ctx, pausedRef.current ? 1 : c.accumulator / TUNING.stepMs);
      if (stateRef.current.gameState === 'dying') { ctx.globalAlpha = stateRef.current.deathTimer / TUNING.deathMs * 0.22; ctx.fillStyle = canvasColors.current.coin; ctx.fillRect(0, 0, view.current.width, view.current.height); }
      ctx.restore();
      const renderMs = performance.now() - renderStart; const domStart = performance.now();
      c.hud += dt;
      if (c.hud >= TUNING.hudMs) { c.hud = 0; const s = stateRef.current;
        if (scoreElRef.current) scoreElRef.current.textContent = String(s.displayScore);
        if (coinsElRef.current) coinsElRef.current.textContent = String(s.coins);
        if (bestElRef.current) bestElRef.current.textContent = String(Math.max(s.bestScore, s.score));
        comboTween.current += (s.combo - comboTween.current) * 0.35;
        if (comboElRef.current) { comboElRef.current.textContent = '×' + comboTween.current.toFixed(1); comboElRef.current.style.setProperty('--combo-fill', String((comboTween.current - 1) / 2)); }
        if (debugElRef.current) {
          const m = meter.current.summary(time);
          debugElRef.current.textContent = `FPS now/avg/min: ${m.fps.toFixed(0)}/${m.avgFps.toFixed(0)}/${m.minFps.toFixed(0)}
Frame avg/p95: ${m.avgMs.toFixed(1)}/${m.p95Ms.toFixed(1)} ms · steps ${m.steps}
Update/render/DOM: ${m.update.toFixed(2)}/${m.render.toFixed(2)}/${m.dom.toFixed(2)} ms
Canvas ${canvas.width}×${canvas.height} · DPR ${view.current.dpr.toFixed(2)} · Q${meter.current.quality}
World ${m.speed.toFixed(1)} px/s · variance ${m.variance.toFixed(2)}% · max 10s ${m.maxDeviation.toFixed(2)}%
${coverage.current}${coverageGap.current ? '\nWARNING: uncovered stage' : ''}`;
          debugElRef.current.classList.toggle('speed-warning', m.variance > 3 || coverageGap.current);
          lastReport.current = meter.current.report(time, view.current.dpr);
          const graph = graphRef.current?.getContext('2d');
          if (graph) { graph.clearRect(0, 0, 240, 40); graph.strokeStyle = m.variance > 3 ? canvasColors.current.warning : canvasColors.current.debug; graph.beginPath(); const max = Math.max(1, ...m.graph); m.graph.forEach((speed, i) => { const x = i * 240 / Math.max(1, m.graph.length - 1), y = 38 - speed / max * 34; if (i) graph.lineTo(x, y); else graph.moveTo(x, y); }); graph.stroke(); }
        }
      }
      const measurable = active && measurement.current.active && dt <= 250;
      const measuredDistance = interpolatedWorld - measurement.current.world;
      const targetDistance = worldDistance(interpolatedElapsed) - worldDistance(measurement.current.elapsed);
      const changed = meter.current.record(time, dt, updateMs, renderMs, performance.now() - domStart, steps, measuredDistance, targetDistance, measurable);
      measurement.current.world = interpolatedWorld; measurement.current.elapsed = interpolatedElapsed; measurement.current.active = active;
      if (changed) resize();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id);
  }, [ready, simulate, drawScene, resize]);

  // ── Start / restart ──
  const startGame = useCallback(() => {
    void startRun();
    if (!ready) return;
    const s = stateRef.current;
    pausedRef.current = false; setPaused(false);
    s.gameState = "playing";
    s.score = 0; s.displayScore = 0;
    s.combo = 1.0; s.peakCombo = 1.0;
    s.coins = 0; s.lives = START_LIVES; s.invuln = 0;
    s.survivalAccum = 0;
    s.frogY = geom().restY; s.frogVY = 0;
    s.onGround = true; s.wasOnGround = true; s.squashTimer = 0;
    s.obstacles = []; s.coinList = []; hitObstacles.current = new WeakSet(); lastDrawn.current = null;
    dustRef.current = []; sparkleRef.current = [];
    milestoneRef.current = null;
    triggeredMilestonesRef.current = new Set();
    s.elapsed = 0; s.spawnTimer = 0;
    s.nextSpawn = DIFFICULTY.startMaxSpawn;
    s.lastTime = 0; previous.current.frogY = s.frogY; previous.current.ground = s.groundOffset; previous.current.elapsed = 0; measurement.current.active = false;
    for (const p of particlePool.current) p.life = 0;
    for (const p of popups.current) p.life = 0;
    input.current.held = false; input.current.buffer = 0;
    setLives(START_LIVES);
    setOverlay("playing");

    cancelAnimationFrame(s.animId);

  }, [ready]);

  const goToMenu = useCallback(() => {
    const s = stateRef.current;
    cancelAnimationFrame(s.animId);
    s.gameState = "start";
    s.obstacles = []; s.coinList = [];
    setOverlay("start");
  }, []);

  const showLeaderboard = useCallback(() => {
    stateRef.current.gameState = "leaderboard";
    setOverlay("leaderboard");
  }, []);

  const pauseGame = useCallback(() => {
    if (stateRef.current.gameState !== 'playing') return;
    pausedRef.current = true; input.current.held = false; input.current.buffer = 0;
    countdownRemaining.current = 0; setCountdown(null); setPaused(true);
  }, []);
  const resumeGame = useCallback(() => {
    if (countdownRemaining.current || document.hidden) return;
    countdownRemaining.current = 3000; setCountdown(3);
  }, []);
  const press = useCallback(() => {
    if (pausedRef.current) { resumeGame(); return; }
    const s = stateRef.current;
    if (s.gameState === 'start') { startGame(); return; }
    if (s.gameState !== 'playing') return;
    input.current.held = true; input.current.buffer = TUNING.bufferMs;
  }, [startGame, resumeGame]);
  const release = useCallback(() => {
    const s = stateRef.current; input.current.held = false;
    if (s.frogVY < 0 && input.current.heldMs < TUNING.holdMs) s.frogVY *= TUNING.jumpCut;
  }, []);
  useEffect(() => {
    resize(); const observer = new ResizeObserver(resize); if (tileRef.current) observer.observe(tileRef.current);
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable]');
    const keydown = (e: KeyboardEvent) => {
      if (editable(e.target) || e.repeat) return;
      if (e.code === 'KeyD') { debugRef.current = !debugRef.current; setDebug(debugRef.current); }
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (stateRef.current.gameState === 'over') startGame(); else press(); }
      if (e.code === 'Enter' && stateRef.current.gameState === 'over') { e.preventDefault(); startGame(); }
    };
    const keyup = (e: KeyboardEvent) => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && !editable(e.target)) { e.preventDefault(); release(); } };
    const hidden = () => { if (document.hidden) pauseGame(); else resize(); };
    // DPR can change without a ResizeObserver notification (moving between monitors).
    let dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const dprChanged = () => { resize(); dprQuery.removeEventListener('change', dprChanged); dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`); dprQuery.addEventListener('change', dprChanged); };
    dprQuery.addEventListener('change', dprChanged);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    window.addEventListener('blur', pauseGame); window.addEventListener('orientationchange', pauseGame);
    document.addEventListener('visibilitychange', hidden);
    return () => { observer.disconnect(); countdownRemaining.current = 0; dprQuery.removeEventListener('change', dprChanged); window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', pauseGame); window.removeEventListener('orientationchange', pauseGame); document.removeEventListener('visibilitychange', hidden); };
  }, [resize, press, release, pauseGame, startGame]);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest?.('[data-ui-button],button,input')) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); press();
  }, [press]);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { const change = () => setFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', change); return () => document.removeEventListener('fullscreenchange', change); }, []);
  const comboElRef = useRef<HTMLSpanElement>(null);
  const debugElRef = useRef<HTMLPreElement>(null);
  const canvasColors = useRef({ coin: '', debug: '', warning: '' });
  useEffect(() => { const styles = getComputedStyle(document.documentElement); canvasColors.current = { coin: `hsl(${styles.getPropertyValue('--accent')})`, debug: `hsl(${styles.getPropertyValue('--primary')})`, warning: `hsl(${styles.getPropertyValue('--destructive')})` }; }, []);

  const playing = overlay === "playing";

  // UI lives outside the simulation; music is never remounted on restart.
  return <main className="game-shell font-display">
    <img ref={backdropRef} className="game-backdrop" src={backgroundSrc} alt="" />
    <div ref={tileRef} className={`game-tile ${overlay === 'over' ? 'game-is-over' : ''}`} onPointerDown={handlePointerDown} onContextMenu={e => e.preventDefault()}>
      <img ref={letterboxRef} className="scene-letterbox" alt="" />
      {[0,1,2,3].map(i => <canvas key={i} ref={el => { layerRefs.current[i] = el; }} className="scene-layer" aria-hidden="true" />)}
      <canvas ref={canvasRef} className="game-canvas" aria-label="Frug Run endless runner" />
      <canvas ref={foregroundRef} className="scene-layer scene-foreground" aria-hidden="true" />
      <div className="game-hud">
        <div className="hud-stats" aria-label="Run statistics">
          <div className="hud-score"><img src={logoSrc} alt="Frug Run" /><span>Score <b ref={scoreElRef}>0</b></span></div>
          <div className="hud-coins"><img src={coinIconSrc} alt="Coins" /><b ref={coinsElRef}>0</b></div>
          <div className="hud-best">Best <b ref={bestElRef}>{displayBest}</b></div>
          <Button variant="ghost" size="icon" data-ui-button="fullscreen" aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen" onClick={e => { e.stopPropagation(); e.currentTarget.blur(); if (document.fullscreenElement) void document.exitFullscreen(); else void tileRef.current?.requestFullscreen?.().catch(() => {}); }}>{fullscreen ? <Minimize /> : <Maximize />}</Button>
        </div>
        {playing && <div className="hud-secondary"><span aria-label={`${lives} lives left`}>{Array.from({length: START_LIVES}, (_, i) => <span key={i} className={i < lives ? '' : 'opacity-25'}>❤️</span>)}</span><span ref={comboElRef}>×1.0</span></div>}
        <MusicPlayer gameOver={overlay === 'over'} mutedRef={mutedRef} />
      </div>
      {!ready && <div className="loading-scene">Loading Frug Run…</div>}
      {ready && overlay === 'start' && <StartOverlay onStart={startGame} onLeaderboard={showLeaderboard} />}
      {overlay === 'over' && <GameOverOverlay score={displayScore} best={displayBest} combo={displayCombo} coins={displayCoins} onRestart={startGame} onMenu={goToMenu} />}
      {overlay === 'leaderboard' && <LeaderboardOverlay onBack={goToMenu} />}
      {paused && <div className="pause-overlay" data-ui-button="resume"><Button onClick={resumeGame} className="wood-card">{countdown ?? 'Tap to resume'}</Button></div>}
      {debug && <div className="game-debug" data-ui-button="debug"><pre ref={debugElRef} /><canvas ref={graphRef} width={240} height={40} aria-label="Measured world speed graph" /><Button variant="secondary" size="sm" onClick={async e => { e.stopPropagation(); const button = e.currentTarget; try { await navigator.clipboard.writeText(lastReport.current); button.textContent = 'Copied'; } catch { if (debugElRef.current) debugElRef.current.textContent += '\nClipboard unavailable'; } }}>Copy report</Button></div>}
    </div>
  </main>;
}
