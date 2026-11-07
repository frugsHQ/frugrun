import { useRef, useEffect, useCallback, useState } from "react";
import bgMusicSrc from "@/assets/bg-music.mp3";
import logoSrc from "@/assets/frugrun-logo.png";
import panelSrc from "@/assets/wood-panel.png";
import coinIconSrc from "@/assets/frug-coin.png";

// ── Modular imports ────────────────────────────────────────
import {
  GROUND_RATIO, FROG_W_RATIO, FROG_ASPECT, FROG_Y_OFFSET,
  GRAVITY, JUMP_VEL, DIFFICULTY, SCORING, MILESTONES,
  COIN_POINTS, COIN_SIZE_RATIO, START_LIVES, HIT_INVULN_MS,
} from "./game/constants";
import type { ObstacleKind } from "./game/constants";
import type { DustParticle, Obstacle, GameState, MilestoneMsg, Coin } from "./game/types";
import {
  loadGameImages, drawBackground, drawGround, drawObstacle, drawCoin,
  drawFrogFallback, imageReady, OBSTACLE_ASPECT, type GameImages,
} from "./game/drawing";
import { playSfxJump, playSfxScore, playSfxGameOver, playSfxCoin, playSfxHit } from "./game/sfx";
import { StartOverlay, GameOverOverlay, LeaderboardOverlay } from "./game/overlays";

// Run-cycle timing: each of the 4 frames shows for this long (ms)
const RUN_FRAME_MS = 85;

// ── Component ──────────────────────────────────────────────
export default function FrogRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<GameImages | null>(null);
  const runFrameRef = useRef(0);
  const runTimerRef = useRef(0);
  const dustRef = useRef<DustParticle[]>([]);
  const sparkleRef = useRef<DustParticle[]>([]);
  const shakeRef = useRef(0);
  const milestoneRef = useRef<MilestoneMsg | null>(null);
  const triggeredMilestonesRef = useRef<Set<number>>(new Set());
  const idleIdRef = useRef(0);

  // HUD DOM refs (updated directly to avoid React re-renders each frame)
  const scoreElRef = useRef<HTMLSpanElement>(null);
  const coinsElRef = useRef<HTMLSpanElement>(null);
  const bestElRef = useRef<HTMLSpanElement>(null);
  const [lives, setLives] = useState(START_LIVES);

  // ── Audio refs ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number>(0);
  const mutedRef = useRef(localStorage.getItem("frogMuted") === "1");
  const [muted, setMuted] = useState(mutedRef.current);

  useEffect(() => {
    const audio = new Audio(bgMusicSrc);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  const fadeAudioIn = useCallback(() => {
    cancelAnimationFrame(fadeRef.current);
    const audio = audioRef.current;
    if (!audio || mutedRef.current) return;
    audio.volume = 0;
    audio.play().catch(() => {});
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1000, 1);
      audio.volume = t * 0.4;
      if (t < 1) fadeRef.current = requestAnimationFrame(tick);
    };
    fadeRef.current = requestAnimationFrame(tick);
  }, []);

  const fadeAudioOut = useCallback(() => {
    cancelAnimationFrame(fadeRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    const startVol = audio.volume;
    if (startVol === 0) { audio.pause(); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1000, 1);
      audio.volume = startVol * (1 - t);
      if (t < 1) fadeRef.current = requestAnimationFrame(tick);
      else audio.pause();
    };
    fadeRef.current = requestAnimationFrame(tick);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    localStorage.setItem("frogMuted", next ? "1" : "0");
    const audio = audioRef.current;
    if (audio) {
      if (next) { audio.pause(); }
      else if (stateRef.current.gameState === "playing") {
        audio.volume = 0.4;
        audio.play().catch(() => {});
      }
    }
    setMuted(next);
  }, []);

  // ── Core game state (ref to avoid re-renders during loop) ──
  const stateRef = useRef({
    gameState: "start" as GameState,
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
  useEffect(() => { imgsRef.current = loadGameImages(); }, []);

  // ── Resize canvas (sharp on high-DPI screens) ──
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
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ctx) ctx.imageSmoothingQuality = "high";
    stateRef.current.canvasW = w;
    stateRef.current.canvasH = h;
  }, []);

  // ── Difficulty from elapsed time ──
  function getDifficulty(elapsed: number) {
    const D = DIFFICULTY;
    const t = Math.min(elapsed / D.capTime, 1);
    return {
      speed: D.startSpeed + (D.maxSpeed - D.startSpeed) * t,
      minSpawn: D.startMinSpawn - (D.startMinSpawn - D.minMinSpawn) * t,
      maxSpawn: D.startMaxSpawn - (D.startMaxSpawn - D.minMaxSpawn) * t,
    };
  }

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
    const groundY = H * GROUND_RATIO;
    const frogW = W * FROG_W_RATIO;
    const frogH = frogW * FROG_ASPECT;
    const frogX = W * 0.1;
    const restY = groundY - frogH + frogH * FROG_Y_OFFSET;
    return { W, H, groundY, frogW, frogH, frogX, restY, scale: W / 400 };
  }

  // ── Draw the whole scene (used by both gameplay and the idle menu) ──
  const drawScene = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const s = stateRef.current;
    const imgs = imgsRef.current;
    if (!imgs) return;
    const { W, H, groundY, frogW, frogH, frogX } = geom();

    drawBackground(ctx, imgs, W, H, s.bgOffset);
    drawGround(ctx, imgs, W, groundY, H, s.groundOffset);

    for (const ob of s.obstacles) drawObstacle(ctx, imgs, ob.x, groundY, ob.w, ob.h, ob.kind);

    const coinSize = frogW * COIN_SIZE_RATIO;
    for (const c of s.coinList) drawCoin(ctx, imgs, c, coinSize, performance.now());

    // ── Soft shadow under Frug (shrinks with height) ──
    const restY = groundY - frogH + frogH * FROG_Y_OFFSET;
    const air = Math.max(0, restY - s.frogY);
    const shadowScale = Math.max(0.4, 1 - (air / (groundY * 0.5)) * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.3 * shadowScale;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(frogX + frogW * 0.5, groundY + 2, frogW * 0.32 * shadowScale, frogW * 0.05 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Pick sprite frame: run cycle on ground, jump/fall poses in air ──
    let frame: HTMLImageElement;
    if (s.onGround) {
      runTimerRef.current += dt;
      // Legs move a bit faster as the game speeds up
      const frameMs = RUN_FRAME_MS * (DIFFICULTY.startSpeed / getDifficulty(s.elapsed).speed) ** 0.5;
      while (runTimerRef.current >= frameMs) {
        runTimerRef.current -= frameMs;
        runFrameRef.current = (runFrameRef.current + 1) % imgs.run.length;
      }
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
      sy = 1 + (runFrameRef.current % 2 === 0 ? 0.012 : -0.012);
    }
    const dw = frogW * sx, dh = frogH * sy;
    const dx = frogX + (frogW - dw) / 2;
    const dy = s.frogY + frogH - dh;

    // Blink while invulnerable after a hit
    const blinkHidden = s.invuln > 0 && Math.floor(s.invuln / 90) % 2 === 0;
    if (!blinkHidden) {
      ctx.save();
      ctx.translate(dx + dw / 2, dy + dh);
      ctx.rotate(rot);
      if (imageReady(frame)) ctx.drawImage(frame, -dw / 2, -dh, dw, dh);
      else drawFrogFallback(ctx, -dw / 2, -dh, dw, dh);
      ctx.restore();
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
      const fs = Math.max(22, W * 0.04);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `${fs}px "Lilita One", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#3a200c";
      ctx.strokeText(m.text, W / 2, H * 0.32);
      ctx.fillStyle = "#ffe14d";
      ctx.fillText(m.text, W / 2, H * 0.32);
      ctx.restore();
    }
  }, []);

  function updateParticles(list: DustParticle[], dt: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  // ── Game over ──
  const endGame = useCallback(() => {
    const s = stateRef.current;
    s.gameState = "over";
    shakeRef.current = 300;
    playSfxGameOver(mutedRef);
    if (s.score > s.bestScore) {
      s.bestScore = s.score;
      localStorage.setItem("frogBest", String(s.bestScore));
    }
    fadeAudioOut();
    setDisplayScore(s.score);
    setDisplayBest(s.bestScore);
    setDisplayCombo(s.peakCombo);
    setDisplayCoins(s.coins);
    setOverlay("over");
  }, [fadeAudioOut]);

  // ── Main game loop ──
  const loop = useCallback((time: number) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || s.gameState !== "playing") return;
    const ctx = canvas.getContext("2d")!;
    const dt = s.lastTime ? Math.min(time - s.lastTime, 50) : 16;
    s.lastTime = time;
    const { W, groundY, frogW, frogH, frogX, restY, scale } = geom();

    s.elapsed += dt;
    const diff = getDifficulty(s.elapsed);
    const speed = diff.speed * scale;

    // Scroll the world
    s.groundOffset += speed * dt;
    s.bgOffset += speed * dt * 0.08;

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

    // ── Frog physics (unchanged) ──
    // Velocity is in "phone-width" units and scaled once to pixels, so the
    // jump arc looks the same on any screen width (identical on phones).
    s.frogVY += GRAVITY * dt;
    s.frogY += s.frogVY * scale * dt;
    if (s.frogY >= restY) {
      const landed = !s.onGround;
      s.frogY = restY; s.frogVY = 0; s.onGround = true;
      if (landed && !s.wasOnGround) {
        s.squashTimer = 100;
        for (let i = 0; i < 7; i++) {
          dustRef.current.push({
            x: frogX + frogW * (0.3 + Math.random() * 0.4), y: groundY - Math.random() * 4,
            vx: (Math.random() - 0.5) * 0.18 * scale, vy: -Math.random() * 0.05 * scale,
            life: 350 + Math.random() * 150, maxLife: 500, size: 2 + Math.random() * 3.5,
          });
        }
      }
    }
    s.wasOnGround = s.onGround;
    if (s.squashTimer > 0) s.squashTimer = Math.max(0, s.squashTimer - dt);
    if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);

    // Running dust puffs behind the feet
    if (s.onGround && Math.random() < dt / 120) {
      dustRef.current.push({
        x: frogX + frogW * 0.3, y: groundY - 3,
        vx: -0.05 * scale - Math.random() * 0.05 * scale, vy: -Math.random() * 0.03 * scale,
        life: 350, maxLife: 350, size: 2 + Math.random() * 3,
      });
    }
    updateParticles(dustRef.current, dt);
    updateParticles(sparkleRef.current, dt);

    if (milestoneRef.current) {
      milestoneRef.current.life -= dt;
      if (milestoneRef.current.life <= 0) milestoneRef.current = null;
    }

    // ── Spawn obstacles (and coins around them) ──
    s.spawnTimer += dt;
    if (s.spawnTimer >= s.nextSpawn) {
      s.spawnTimer = 0;
      s.nextSpawn = diff.minSpawn + Math.random() * (diff.maxSpawn - diff.minSpawn);
      const kind = pickObstacleKind(s.elapsed);
      const oh = frogH * (0.5 + Math.random() * 0.4);
      const ow = oh / OBSTACLE_ASPECT[kind];
      const ox = W + 10;
      s.obstacles.push({ x: ox, w: ow, h: oh, kind });

      const coinSize = frogW * COIN_SIZE_RATIO;
      const r = Math.random();
      if (r < 0.55) {
        // Arc of 3 coins over the obstacle — rewards a good jump
        const peak = groundY - oh - coinSize * 1.1;
        for (let i = -1; i <= 1; i++) {
          s.coinList.push({
            x: ox + ow / 2 + i * coinSize * 1.3,
            y: peak + Math.abs(i) * coinSize * 0.5,
            phase: i * 0.6,
          });
        }
      } else if (r < 0.85) {
        // Row of coins on the ground, halfway to the next obstacle
        const gap = speed * s.nextSpawn;
        if (gap > coinSize * 5) {
          const startX = ox + ow + gap * 0.5 - coinSize * 1.3;
          for (let i = 0; i < 3; i++) {
            s.coinList.push({ x: startX + i * coinSize * 1.3, y: groundY - coinSize * 0.75, phase: i * 0.6 });
          }
        }
      }
    }

    // ── Move obstacles & award clear points ──
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      s.obstacles[i].x -= speed * dt;
      if (s.obstacles[i].x + s.obstacles[i].w < 0) {
        s.obstacles.splice(i, 1);
        s.score += Math.round(SCORING.baseObstaclePoints * s.combo);
        s.combo = Math.min(SCORING.maxCombo, s.combo + SCORING.comboStep);
        if (s.combo > s.peakCombo) s.peakCombo = s.combo;
        checkMilestones(s.score);
        playSfxScore(mutedRef);
      }
    }

    // ── Frug hitbox: body only (skip cape on the left, hat on top) ──
    const frogBox = {
      x: frogX + frogW * 0.3,
      y: s.frogY + frogH * 0.35,
      w: frogW * 0.52,
      h: frogH * 0.6,
    };

    // ── Coins: move + collect (+10 each) ──
    const coinSize = frogW * COIN_SIZE_RATIO;
    for (let i = s.coinList.length - 1; i >= 0; i--) {
      const c = s.coinList[i];
      c.x -= speed * dt;
      if (c.x < -coinSize) { s.coinList.splice(i, 1); continue; }
      const r = coinSize * 0.45;
      const nx = Math.max(frogBox.x, Math.min(c.x, frogBox.x + frogBox.w));
      const ny = Math.max(frogBox.y - frogH * 0.15, Math.min(c.y, frogBox.y + frogBox.h));
      if ((c.x - nx) ** 2 + (c.y - ny) ** 2 < r * r) {
        s.coinList.splice(i, 1);
        s.coins += 1;
        s.score += COIN_POINTS;
        checkMilestones(s.score);
        playSfxCoin(mutedRef);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          sparkleRef.current.push({
            x: c.x, y: c.y, vx: Math.cos(a) * 0.12 * scale, vy: Math.sin(a) * 0.12 * scale,
            life: 350, maxLife: 350, size: 2 + Math.random() * 2,
          });
        }
      }
    }

    // ── Obstacle collision → lose a heart ──
    if (s.invuln <= 0) {
      for (const ob of s.obstacles) {
        const padX = ob.w * (ob.kind === "spikes" ? 0.2 : 0.12);
        const padTop = ob.h * (ob.kind === "spikes" ? 0.15 : 0.1);
        const obBox = { x: ob.x + padX, y: groundY - ob.h + padTop, w: ob.w - padX * 2, h: ob.h - padTop };
        if (
          frogBox.x < obBox.x + obBox.w && frogBox.x + frogBox.w > obBox.x &&
          frogBox.y < obBox.y + obBox.h && frogBox.y + frogBox.h > obBox.y
        ) {
          s.lives -= 1;
          setLives(s.lives);
          s.combo = 1.0;
          if (s.lives <= 0) { endGame(); return; }
          s.invuln = HIT_INVULN_MS;
          shakeRef.current = 200;
          playSfxHit(mutedRef);
          break;
        }
      }
    }

    // ── Draw ──
    let shakeX = 0, shakeY = 0;
    if (shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - dt);
      const k = (shakeRef.current / 300) * 7;
      shakeX = (Math.random() - 0.5) * k;
      shakeY = (Math.random() - 0.5) * k;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawScene(ctx, dt);
    ctx.restore();

    // ── HUD text (direct DOM writes, no re-render) ──
    if (scoreElRef.current) scoreElRef.current.textContent = String(s.displayScore);
    if (coinsElRef.current) coinsElRef.current.textContent = String(s.coins);
    if (bestElRef.current) bestElRef.current.textContent = String(Math.max(s.bestScore, s.score));

    s.animId = requestAnimationFrame(loop);
  }, [drawScene, endGame]);

  // ── Idle menu loop: Frug runs in place over the scrolling jungle ──
  const idleLoop = useCallback((time: number) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (s.gameState === "playing") return;
    const ctx = canvas.getContext("2d")!;
    const dt = s.lastTime ? Math.min(time - s.lastTime, 50) : 16;
    s.lastTime = time;
    if (s.gameState === "start" || s.gameState === "leaderboard") {
      const { restY, scale } = geom();
      s.frogY = restY; s.onGround = true;
      s.groundOffset += DIFFICULTY.startSpeed * scale * dt * 0.6;
      s.bgOffset += DIFFICULTY.startSpeed * scale * dt * 0.05;
    }
    updateParticles(dustRef.current, dt);
    drawScene(ctx, s.gameState === "over" ? 0 : dt);
    idleIdRef.current = requestAnimationFrame(idleLoop);
  }, [drawScene]);

  // ── Start / restart ──
  const startGame = useCallback(() => {
    const s = stateRef.current;
    cancelAnimationFrame(idleIdRef.current);
    s.gameState = "playing";
    s.score = 0; s.displayScore = 0;
    s.combo = 1.0; s.peakCombo = 1.0;
    s.coins = 0; s.lives = START_LIVES; s.invuln = 0;
    s.survivalAccum = 0;
    s.frogY = geom().restY; s.frogVY = 0;
    s.onGround = true; s.wasOnGround = true; s.squashTimer = 0;
    s.obstacles = []; s.coinList = [];
    dustRef.current = []; sparkleRef.current = [];
    milestoneRef.current = null;
    triggeredMilestonesRef.current = new Set();
    s.elapsed = 0; s.spawnTimer = 0;
    s.nextSpawn = DIFFICULTY.startMaxSpawn;
    s.lastTime = 0;
    setLives(START_LIVES);
    setOverlay("playing");
    fadeAudioIn();
    cancelAnimationFrame(s.animId);
    s.animId = requestAnimationFrame(loop);
  }, [loop, fadeAudioIn]);

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

  // Keep the idle scene animating whenever we're not playing
  useEffect(() => {
    if (overlay === "playing") return;
    cancelAnimationFrame(idleIdRef.current);
    stateRef.current.lastTime = 0;
    idleIdRef.current = requestAnimationFrame(idleLoop);
    return () => cancelAnimationFrame(idleIdRef.current);
  }, [overlay, idleLoop]);

  // ── Jump ──
  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === "start") { startGame(); return; }
    if (s.gameState !== "playing" || !s.onGround) return;
    const { groundY, frogW, frogX, scale } = geom();
    s.frogVY = JUMP_VEL;
    s.onGround = false;
    playSfxJump(mutedRef);
    for (let i = 0; i < 5; i++) {
      dustRef.current.push({
        x: frogX + frogW * (0.3 + Math.random() * 0.4), y: groundY - Math.random() * 3,
        vx: (Math.random() - 0.5) * 0.12 * scale, vy: -Math.random() * 0.04 * scale,
        life: 250, maxLife: 300, size: 1.5 + Math.random() * 2.5,
      });
    }
  }, [startGame]);

  // ── Input ──
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); jump(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(stateRef.current.animId);
    };
  }, [resize, jump]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest?.("[data-ui-button]")) return;
    e.preventDefault();
    jump();
  }, [jump]);

  const playing = overlay === "playing";

  // ── Render ──
  return (
    <div className="fixed inset-0 overflow-hidden select-none font-display">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
      />

      {/* ── HUD: carved wooden signboards ── */}
      {playing && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between items-start gap-2 px-2 sm:px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
        >
          <div
            className="hud-panel flex items-center gap-2 sm:gap-4 px-[9%] h-14 sm:h-20 w-[48vw] max-w-[440px]"
            style={{ backgroundImage: `url(${panelSrc})` }}
          >
            <img src={logoSrc} alt="Frug Run" className="h-8 sm:h-12 w-auto" />
            <span className="hidden sm:block w-px self-stretch my-4 bg-card-foreground/40" />
            <span className="text-card-foreground text-outline text-base sm:text-2xl whitespace-nowrap">
              Score: <span ref={scoreElRef} className="text-accent">0</span>
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div
              className="hud-panel flex items-center gap-2 sm:gap-4 px-[10%] h-14 sm:h-20 w-[46vw] max-w-[400px]"
              style={{ backgroundImage: `url(${panelSrc})` }}
            >
              <img src={coinIconSrc} alt="" className="h-7 sm:h-10 w-auto" />
              <span ref={coinsElRef} className="text-card-foreground text-outline text-base sm:text-2xl">0</span>
              <span className="w-px self-stretch my-4 bg-card-foreground/40" />
              <span className="text-card-foreground text-outline text-base sm:text-2xl whitespace-nowrap">
                Best: <span ref={bestElRef} className="text-accent">{displayBest}</span>
              </span>
            </div>
            <div className="flex gap-1 pr-4 text-2xl sm:text-4xl" aria-label={`${lives} lives left`}>
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <span key={i} className={`drop-shadow transition-all duration-300 ${i < lives ? "" : "opacity-25 grayscale"}`}>
                  ❤️
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mute button */}
      <button
        data-ui-button="mute"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMute(); }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="absolute right-3 z-20 w-11 h-11 flex items-center justify-center rounded-full wood-card text-xl"
        style={{ top: playing ? "calc(env(safe-area-inset-top, 0px) + 140px)" : "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {overlay === "start" && <StartOverlay onStart={startGame} onLeaderboard={showLeaderboard} />}
      {overlay === "over" && (
        <GameOverOverlay
          score={displayScore}
          best={displayBest}
          combo={displayCombo}
          coins={displayCoins}
          onRestart={startGame}
          onMenu={goToMenu}
        />
      )}
      {overlay === "leaderboard" && <LeaderboardOverlay onBack={goToMenu} />}
    </div>
  );
}
