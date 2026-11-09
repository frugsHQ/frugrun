import { TUNING } from './motion';

export const PERFORMANCE = { maxSteps: 10, gapMs: 250, dprCap: 1.5, desktopWidth: 1920, desktopHeight: 1080, mobileLongSide: 1280 } as const;
export function accumulateFrame(accumulator: number, gap: number) {
  const accepted = gap > PERFORMANCE.gapMs ? 0 : Math.max(0, gap);
  const total = accumulator + accepted;
  const steps = Math.min(PERFORMANCE.maxSteps, Math.floor(total / TUNING.stepMs));
  // Retain the fractional phase, never let a stalled tab create an endless backlog.
  return { steps, remainder: (total - steps * TUNING.stepMs) % TUNING.stepMs, accepted };
}
export function bufferDpr(width: number, height: number, deviceDpr: number, mobile: boolean, quality: number) {
  return Math.min(deviceDpr, PERFORMANCE.dprCap,
    mobile ? PERFORMANCE.mobileLongSide / Math.max(width, height) : Math.min(PERFORMANCE.desktopWidth / width, PERFORMANCE.desktopHeight / height)) * Math.pow(0.85, quality);
}
export class PerformanceMeter {
  private samples = Array.from({ length: 1600 }, () => ({ time: 0, frame: 0, update: 0, render: 0, dom: 0, speed: 0, expected: 0, variance: 0, steps: 0 }));
  private cursor = 0;
  private count = 0;
  private slow = 0;
  private fast = 0;
  private qualityWindow = 0;
  private qualityFrames = 0;
  quality = 0;
  record(time: number, frame: number, update: number, render: number, dom: number, steps: number, distance: number, expectedDistance: number, active: boolean) {
    const p = this.samples[this.cursor];
    p.time = time; p.frame = frame; p.update = update; p.render = render; p.dom = dom; p.steps = steps;
    p.speed = active && frame > 0 ? distance * 1000 / frame : 0;
    p.expected = active && frame > 0 ? expectedDistance * 1000 / frame : 0;
    p.variance = p.expected > 0 ? Math.abs(p.speed / p.expected - 1) : 0;
    this.cursor = (this.cursor + 1) % this.samples.length; this.count = Math.min(this.count + 1, this.samples.length);
    this.qualityWindow += frame; this.qualityFrames++;
    if (this.qualityWindow >= 1000) {
      this.slow = this.qualityWindow / this.qualityFrames > 18 ? this.qualityWindow : 0;
      this.qualityWindow = 0; this.qualityFrames = 0;
    }
    this.fast = frame < 17.5 ? this.fast + frame : 0;
    const old = this.quality;
    if (this.slow >= 1000 && this.quality < 2) { this.quality++; this.slow = 0; this.fast = 0; this.qualityWindow = 0; this.qualityFrames = 0; }
    if (this.fast >= 10000 && this.quality > 0) { this.quality--; this.fast = 0; }
    return old !== this.quality;
  }
  summary(now: number) {
    const rows = this.samples.slice(0, this.count).filter(p => now - p.time <= 5000 && p.frame > 0);
    const frames = rows.map(p => p.frame).sort((a, b) => a - b);
    const mean = (key: 'frame' | 'update' | 'render' | 'dom') => rows.reduce((sum, p) => sum + p[key], 0) / Math.max(1, rows.length);
    const p95 = frames[Math.min(frames.length - 1, Math.floor(frames.length * .95))] ?? 0;
    const worst = frames[frames.length - 1] ?? 0;
    let distance = 0, expected = 0;
    for (const p of rows) { distance += p.speed * p.frame; expected += p.expected * p.frame; }
    const variance = expected ? Math.abs(distance / expected - 1) * 100 : 0;
    const last = this.samples[(this.cursor + this.samples.length - 1) % this.samples.length];
    const maxDeviation = this.samples.slice(0, this.count).filter(p => now - p.time <= 10000 && p.expected > 0).reduce((max, p) => Math.max(max, p.variance * 100), 0);
    return { maxDeviation, fps: last.frame ? 1000 / last.frame : 0, avgFps: mean('frame') ? 1000 / mean('frame') : 0, minFps: worst ? 1000 / worst : 0, p95Fps: p95 ? 1000 / p95 : 0,
      avgMs: mean('frame'), p95Ms: p95, worstMs: worst, update: mean('update'), render: mean('render'), dom: mean('dom'), steps: last.steps, variance,
      speed: rows.reduce((sum, p) => sum + p.speed, 0) / Math.max(1, rows.filter(p => p.expected > 0).length), graph: rows.filter(p => p.expected > 0).slice(-60).map(p => p.speed) };
  }
  report(now: number, dpr: number) {
    const s = this.summary(now);
    return `Frug Run (last 5s)\nFPS avg/min/p95: ${s.avgFps.toFixed(1)}/${s.minFps.toFixed(1)}/${s.p95Fps.toFixed(1)}\nFrame avg/p95/worst: ${s.avgMs.toFixed(1)}/${s.p95Ms.toFixed(1)}/${s.worstMs.toFixed(1)} ms\nUpdate/render/DOM: ${s.update.toFixed(2)}/${s.render.toFixed(2)}/${s.dom.toFixed(2)} ms\nWorld speed: ${s.speed.toFixed(1)} px/s; variance: ${s.variance.toFixed(2)}%; max deviation (10s): ${s.maxDeviation.toFixed(2)}%\nQuality: ${this.quality}; DPR used/device: ${dpr.toFixed(2)}/${window.devicePixelRatio}\n${navigator.userAgent}`;
  }
}