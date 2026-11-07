import { useEffect, useRef, useState } from 'react';
import { Music2, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import life from '@/assets/frugs-life.mp3.asset.json';
import second from '@/assets/bg-music.mp3';
import { unlockSfx } from './sfx';

// Edit the playlist here. The existing uploaded MP3 is used for Track 2.
export const TRACKS = [
  { title: 'Frugs Life', src: life.url },
  { title: 'Frugs Track 2', src: second },
] as const;
export const AUDIO_TUNING = { defaultVolume: 0.4, sfxVolume: 0.7, duck: 0.7, fadeMs: 1000 };
export function MusicPlayer({ gameOver, mutedRef }: { gameOver: boolean; mutedRef: { current: boolean } }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const duck = useRef(gameOver);
  duck.current = gameOver;
  const manualPause = useRef(localStorage.getItem('frugMusicPaused') === '1');
  const volumeRef = useRef(Math.max(0, Math.min(1, Number(localStorage.getItem('frugMusicVolume') ?? AUDIO_TUNING.defaultVolume))));
  const [volume, setVolume] = useState(volumeRef.current);
  const [muted, setMuted] = useState(mutedRef.current);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [track, setTrack] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const fade = useRef(0);
  const fadingIn = useRef(false);
  function applyVolume() {
    if (audio.current) { audio.current.muted = mutedRef.current; audio.current.volume = volumeRef.current * (duck.current ? AUDIO_TUNING.duck : 1); }
  }
  function start() {
    const a = audio.current;
    if (!a || manualPause.current || document.hidden) return;
    const wasPaused = a.paused;
    a.play().then(() => { setBlocked(false); setPlaying(true);
      if (wasPaused && !fadingIn.current) { fadingIn.current = true; cancelAnimationFrame(fade.current); a.volume = 0;
        const began = performance.now(); const tick = (now: number) => { const t = Math.min(1, (now - began) / AUDIO_TUNING.fadeMs);
          a.volume = volumeRef.current * (duck.current ? AUDIO_TUNING.duck : 1) * t;
          if (t < 1) fade.current = requestAnimationFrame(tick); else fadingIn.current = false; }; fade.current = requestAnimationFrame(tick); }
    }).catch(() => { setBlocked(true); setPlaying(false); });
  }
  function toggleMute() {
    mutedRef.current = !mutedRef.current;
    localStorage.setItem('frogMuted', mutedRef.current ? '1' : '0');
    setMuted(mutedRef.current); applyVolume();
  }
  useEffect(() => {
    const a = new Audio(TRACKS[0].src); audio.current = a; a.preload = 'auto'; applyVolume();
    const update = () => { setTime(a.currentTime); setDuration(Number.isFinite(a.duration) ? a.duration : 0); };
    const next = () => setTrack(t => (t + 1) % TRACKS.length);
    a.addEventListener('timeupdate', update); a.addEventListener('loadedmetadata', update); a.addEventListener('ended', next);
    a.addEventListener('pause', () => setPlaying(false));
    const gesture = (e: Event) => { unlockSfx(); if (e.target instanceof HTMLElement && e.target.closest('[aria-label="Play music"], [aria-label="Pause music"]')) return; if (a.paused && !manualPause.current) start(); };
    const keys = (e: KeyboardEvent) => { if (e.code === 'KeyM' && !e.repeat && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleMute(); } };
    const visibility = () => { if (document.hidden) a.pause(); else start(); };
    window.addEventListener('pointerdown', gesture, true); window.addEventListener('keydown', gesture, true);
    window.addEventListener('keydown', keys); document.addEventListener('visibilitychange', visibility);
    start();
    return () => { cancelAnimationFrame(fade.current); a.pause(); a.src = ''; audio.current = null;
      window.removeEventListener('pointerdown', gesture, true); window.removeEventListener('keydown', gesture, true); window.removeEventListener('keydown', keys); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { const a = audio.current; if (!a) return; a.src = TRACKS[track].src; setTime(0); setDuration(0); start(); }, [track]);
  useEffect(() => {
    const a = audio.current; if (!a) return;
    cancelAnimationFrame(fade.current);
    fadingIn.current = false;
    const from = a.volume, target = volumeRef.current * (gameOver ? AUDIO_TUNING.duck : 1), began = performance.now();
    const tick = (now: number) => { const t = Math.min(1, (now - began) / AUDIO_TUNING.fadeMs); a.volume = from + (target - from) * t; if (t < 1) fade.current = requestAnimationFrame(tick); };
    fade.current = requestAnimationFrame(tick);
  }, [gameOver]);
  function toggle() { const a = audio.current; if (!a) return; manualPause.current = !a.paused;
    localStorage.setItem('frugMusicPaused', manualPause.current ? '1' : '0'); if (manualPause.current) { a.pause(); setPlaying(false); } else start(); }
  const control = (label: string, icon: React.ReactNode, fn: () => void) => <Button variant="ghost" size="icon" title={label} aria-label={label} onClick={e => { e.stopPropagation(); fn(); e.currentTarget.blur(); }}>{icon}</Button>;
  return <div className={`music-player ${expanded ? 'is-expanded' : ''}`} data-ui-button="music" onPointerDown={e => e.stopPropagation()}>
    <div className="music-bar">
      {control(expanded ? 'Collapse music player' : 'Expand music player', expanded ? <ChevronDown /> : <Music2 />, () => setExpanded(!expanded))}
      <div className="music-title"><small>Pond Radio</small><span>{TRACKS[track].title}</span></div>
      {control(playing ? 'Pause music' : 'Play music', playing ? <Pause /> : <Play />, toggle)}
      {control(muted ? 'Unmute' : 'Mute', muted ? <VolumeX /> : <Volume2 />, toggleMute)}
    </div>
    <div className="music-details">
      <div className="music-controls">{control('Previous track', <SkipBack />, () => setTrack(t => (t + TRACKS.length - 1) % TRACKS.length))}
      <input aria-label="Track progress" type="range" min={0} max={duration || 1} step="0.1" value={time} onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); }} />
      {control('Next track', <SkipForward />, () => setTrack(t => (t + 1) % TRACKS.length))}</div>
      <label className="music-volume">Volume<input aria-label="Music volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e => { const v = Number(e.target.value); volumeRef.current = v; setVolume(v); localStorage.setItem('frugMusicVolume', String(v)); applyVolume(); }} /></label>
    </div>
    {blocked && !manualPause.current && <span className="music-prompt">Tap to start music 🎵</span>}
  </div>;
}
