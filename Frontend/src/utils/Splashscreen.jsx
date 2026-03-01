import React, { useState, useEffect, useRef, useCallback } from 'react';
import Splashlogo from '../assets/logo.svg';

/* ─────────────────────────────────────────────────────────────────────────────
   AUDIO — singleton, plays once per session
───────────────────────────────────────────────────────────────────────────── */

let _audioCtx = null;
let _hasPlayed = false;

function playChime() {
  if (_hasPlayed) return;
  _hasPlayed = true;

  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = _audioCtx;
    const master = ctx.createGain();
    master.gain.value = 0.7;

    // Reverb via convolver
    const convolver = ctx.createConvolver();
    const reverbLen  = ctx.sampleRate * 2.5;
    const reverbBuf  = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = reverbBuf.getChannelData(c);
      for (let i = 0; i < reverbLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLen, 2.5);
      }
    }
    convolver.buffer = reverbBuf;

    const dryGain = ctx.createGain();  dryGain.gain.value  = 0.5;
    const wetGain = ctx.createGain();  wetGain.gain.value  = 0.45;
    master.connect(dryGain);  dryGain.connect(ctx.destination);
    master.connect(convolver); convolver.connect(wetGain); wetGain.connect(ctx.destination);

    const note = (freq, start, dur, vol = 0.3, type = 'sine') => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.frequency.value = freq;
      osc.type = type;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start); osc.stop(start + dur + 0.1);
    };

    const now = ctx.currentTime;
    // Liquid ascending arpeggio: Dm7 → Fmaj7 → Cadd9 vibes
    note(293.66, now,        1.6, 0.18);  // D4
    note(369.99, now + 0.08, 1.5, 0.16);  // F#4
    note(440.00, now + 0.16, 1.4, 0.20);  // A4
    note(587.33, now + 0.26, 1.8, 0.22);  // D5  (octave)
    note(659.25, now + 0.38, 2.2, 0.14);  // E5  (9th shimmer)
    // Sub bass pulse
    note(73.42,  now,        0.4, 0.30, 'triangle'); // D2 thump
    note(73.42,  now + 0.5,  0.3, 0.15, 'triangle');
  } catch (_) { /* silently skip */ }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS — injected once as a style tag
───────────────────────────────────────────────────────────────────────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400&display=swap');

/* ── Reset ── */
.lb-splash *, .lb-splash *::before, .lb-splash *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Root ── */
.lb-splash {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  background: #07080A;
  overflow: hidden;
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ── Noise grain overlay ── */
.lb-splash::before {
  content: '';
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  background-repeat: repeat; background-size: 180px;
  opacity: 0.6; mix-blend-mode: overlay;
}

/* ── Mesh gradient orbs ── */
.lb-orb {
  position: absolute; border-radius: 50%; filter: blur(80px);
  pointer-events: none; will-change: transform, opacity;
}
.lb-orb-1 {
  width: 520px; height: 520px;
  background: radial-gradient(circle, rgba(29,185,84,0.22) 0%, transparent 70%);
  top: -160px; left: -160px;
  animation: orbDrift1 8s ease-in-out infinite alternate;
}
.lb-orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(0,200,150,0.14) 0%, transparent 70%);
  bottom: -120px; right: -100px;
  animation: orbDrift2 10s ease-in-out infinite alternate;
}
.lb-orb-3 {
  width: 260px; height: 260px;
  background: radial-gradient(circle, rgba(100,255,180,0.09) 0%, transparent 70%);
  top: 50%; left: 50%; transform: translate(-50%,-50%);
  animation: orbPulse 3s ease-in-out infinite;
}
@keyframes orbDrift1  { from{transform:translate(0,0)} to{transform:translate(40px,30px)} }
@keyframes orbDrift2  { from{transform:translate(0,0)} to{transform:translate(-30px,-20px)} }
@keyframes orbPulse   { 0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.7;transform:translate(-50%,-50%) scale(1.15)} }

/* ── Liquid bars (equalizer) ── */
.lb-bars {
  display: flex; align-items: flex-end; justify-content: center;
  gap: 5px; height: 48px;
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 0 0 18px;
  opacity: 0;
}
.lb-bars.visible { opacity: 1; }
.lb-bar {
  width: 4px; border-radius: 3px 3px 0 0;
  background: linear-gradient(to top, #1DB954, #23E065, #64FFB4);
  transform-origin: bottom;
  box-shadow: 0 0 8px rgba(29,185,84,0.5);
}

/* ── Center stage ── */
.lb-stage {
  position: relative; z-index: 10;
  display: flex; flex-direction: column;
  align-items: center; gap: 0;
}

/* ── Logo ring ── */
.lb-logo-ring {
  position: relative; display: flex; align-items: center; justify-content: center;
  width: 180px; height: 180px;
}
.lb-ring-svg {
  position: absolute; inset: 0; width: 100%; height: 100%;
}
.lb-ring-track {
  fill: none; stroke: rgba(29,185,84,0.10); stroke-width: 1.5;
}
.lb-ring-progress {
  fill: none; stroke: url(#ringGrad); stroke-width: 2; stroke-linecap: round;
  stroke-dasharray: 502; stroke-dashoffset: 502;
  transform-origin: center; transform: rotate(-90deg);
  transition: stroke-dashoffset 0.05s linear;
}
.lb-ring-glow {
  fill: none; stroke: rgba(100,255,180,0.15); stroke-width: 8; stroke-linecap: round;
  stroke-dasharray: 502; stroke-dashoffset: 502;
  transform-origin: center; transform: rotate(-90deg);
  transition: stroke-dashoffset 0.05s linear; filter: blur(4px);
}
.lb-logo-img {
  position: relative; z-index: 2;
  width: 96px; height: 96px;
  filter: drop-shadow(0 0 18px rgba(29,185,84,0.45));
}

/* ── Wordmark ── */
.lb-wordmark {
  font-family: 'Syne', sans-serif;
  font-size: 36px; font-weight: 800;
  letter-spacing: -0.03em;
  color: #fff;
  margin-top: 18px;
  line-height: 1;
  position: relative;
}
.lb-wordmark span.accent {
  background: linear-gradient(135deg, #23E065 0%, #1DB954 60%, #0BAF3F 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.lb-tagline {
  font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;
  color: rgba(255,255,255,0.28); margin-top: 10px;
  font-weight: 400;
}

/* ── Particle dots ── */
.lb-particle {
  position: absolute; border-radius: 50%; pointer-events: none; z-index: 5;
  background: rgba(29,185,84,0.7);
  box-shadow: 0 0 6px rgba(29,185,84,0.5);
}

/* ── Phase animations ── */

/* ENTRY — logo scales in from 0 + letterbox bars wipe in */
@keyframes logoEntry {
  0%   { opacity: 0; transform: scale(0.55) translateY(12px); }
  60%  { opacity: 1; transform: scale(1.04) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes wordmarkEntry {
  0%   { opacity: 0; transform: translateY(20px) skewX(-4deg); }
  100% { opacity: 1; transform: translateY(0) skewX(0deg); }
}
@keyframes taglineEntry {
  0%   { opacity: 0; transform: translateY(10px); letter-spacing: 0.35em; }
  100% { opacity: 0.28; transform: translateY(0); letter-spacing: 0.22em; }
}

/* HOLD — subtle breathe */
@keyframes breathe {
  0%,100% { transform: scale(1); }
  50%      { transform: scale(1.025); }
}

/* EXIT — everything contracts to a bright dot then fades */
@keyframes exitStage {
  0%   { opacity: 1; transform: scale(1); }
  40%  { opacity: 1; transform: scale(0.94); }
  70%  { opacity: 0.6; transform: scale(1.08); filter: brightness(2); }
  100% { opacity: 0; transform: scale(0.4); filter: brightness(3); }
}
@keyframes exitBg {
  0%   { opacity: 1; }
  60%  { opacity: 1; background: #07080A; }
  100% { opacity: 0; background: #1DB954; }
}
@keyframes particleFloat {
  0%   { opacity: 1; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: var(--tx) scale(0); }
}

/* States driven by data-phase attribute */
.lb-splash[data-phase='enter'] .lb-stage { animation: logoEntry 0.75s cubic-bezier(0.22,1,0.36,1) both; }
.lb-splash[data-phase='enter'] .lb-wordmark { animation: wordmarkEntry 0.6s cubic-bezier(0.22,1,0.36,1) 0.35s both; }
.lb-splash[data-phase='enter'] .lb-tagline  { animation: taglineEntry  0.5s ease 0.65s both; }

.lb-splash[data-phase='hold'] .lb-stage    { animation: breathe 2.2s ease-in-out infinite; }
.lb-splash[data-phase='hold'] .lb-wordmark { opacity: 1; }
.lb-splash[data-phase='hold'] .lb-tagline  { opacity: 0.28; }

.lb-splash[data-phase='exit'] {
  animation: exitBg 0.65s cubic-bezier(0.4,0,1,1) forwards;
  pointer-events: none;
}
.lb-splash[data-phase='exit'] .lb-stage {
  animation: exitStage 0.65s cubic-bezier(0.4,0,1,1) forwards;
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   PARTICLE BURST
───────────────────────────────────────────────────────────────────────────── */

function Particles({ active }) {
  const particles = React.useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const angle  = (i / 18) * 360 + (Math.random() * 20 - 10);
      const dist   = 80 + Math.random() * 100;
      const rad    = (angle * Math.PI) / 180;
      const tx     = `translate(${Math.cos(rad) * dist}px, ${Math.sin(rad) * dist}px) scale(0)`;
      const size   = 3 + Math.random() * 4;
      const delay  = Math.random() * 0.15;
      const dur    = 0.5 + Math.random() * 0.4;
      return { tx, size, delay, dur };
    });
  }, []);

  if (!active) return null;
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          className="lb-particle"
          style={{
            width: p.size, height: p.size,
            '--tx': p.tx,
            animation: `particleFloat ${p.dur}s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIQUID BARS (animated equalizer at bottom) — FIXED with cleanup
───────────────────────────────────────────────────────────────────────────── */

const BAR_COUNT = 32;
const BAR_KEYFRAMES = Array.from({ length: BAR_COUNT }, () =>
  Array.from({ length: 12 }, () => 8 + Math.random() * 38)
);

function LiquidBars({ visible }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const frameRef  = useRef(0);
  const mounted   = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!visible || !mounted.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const barW  = (W - (BAR_COUNT - 1) * 4) / BAR_COUNT;
    const gap   = 4;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function draw() {
      if (!mounted.current) return; // stop if unmounted
      ctx.clearRect(0, 0, W, H);
      const t    = frameRef.current / 6;
      const seg  = Math.floor(t) % 12;
      const frac = t - Math.floor(t);

      for (let i = 0; i < BAR_COUNT; i++) {
        const cur  = BAR_KEYFRAMES[i][seg];
        const next = BAR_KEYFRAMES[i][(seg + 1) % 12];
        const h    = lerp(cur, next, frac);
        const x    = i * (barW + gap);
        const y    = H - h;

        const grad = ctx.createLinearGradient(x, y, x, H);
        grad.addColorStop(0,   'rgba(100,255,180,0.9)');
        grad.addColorStop(0.4, 'rgba(29,185,84,1)');
        grad.addColorStop(1,   'rgba(11,175,63,0.6)');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, [2, 2, 0, 0]);
        ctx.fill();

        // Glow
        ctx.shadowColor  = 'rgba(29,185,84,0.55)';
        ctx.shadowBlur   = 10;
        ctx.fillStyle    = grad;
        ctx.fill();
        ctx.shadowBlur   = 0;
      }

      frameRef.current += 0.45;
      if (mounted.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    draw();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [visible]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        width: '100%', height: 64,
        opacity: visible ? 0.75 : 0,
        transition: 'opacity 0.6s ease',
        display: 'block',
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   RING PROGRESS
───────────────────────────────────────────────────────────────────────────── */

function RingProgress({ progress }) {
  // progress 0–1
  const circumference = 2 * Math.PI * 80; // r=80
  const offset = circumference * (1 - progress);
  return (
    <svg className="lb-ring-svg" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#64FFB4" />
          <stop offset="50%"  stopColor="#1DB954" />
          <stop offset="100%" stopColor="#0BAF3F" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx="90" cy="90" r="80" className="lb-ring-track" />
      {/* Glow layer */}
      <circle
        cx="90" cy="90" r="80"
        fill="none" stroke="rgba(100,255,180,0.12)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.04s linear', filter: 'blur(5px)' }}
      />
      {/* Main arc */}
      <circle
        cx="90" cy="90" r="80"
        fill="none" stroke="url(#ringGrad)" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.04s linear' }}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT — FIXED
───────────────────────────────────────────────────────────────────────────── */

const TIMELINE = {
  toHold:     750,
  toExit:     2000,
  toComplete: 2650,
};

export function SplashScreen({ onComplete }) {
  const [phase,    setPhase]    = useState('enter');
  const [progress, setProgress] = useState(0);
  const [particles, setParticles] = useState(false);
  const rafRef = useRef(null);
  const mounted = useRef(true);
  const startTime = useRef(null);

  // Animate ring from 0 → 1 over the hold phase duration
  const animateRing = useCallback(() => {
    const holdDur = TIMELINE.toExit - TIMELINE.toHold; // 1250ms
    const ringStart = performance.now();

    function tick(now) {
      if (!mounted.current) return; // stop if unmounted
      const elapsed = now - ringStart;
      const p = Math.min(elapsed / holdDur, 1);
      setProgress(1 - (1 - p) * (1 - p)); // ease out quad
      if (p < 1 && mounted.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    if (mounted.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    playChime();

    const t1 = setTimeout(() => {
      if (!mounted.current) return;
      setPhase('hold');
      animateRing();
    }, TIMELINE.toHold);

    const t2 = setTimeout(() => {
      if (!mounted.current) return;
      setParticles(true);
      setPhase('exit');
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setProgress(1);
    }, TIMELINE.toExit);

    const t3 = setTimeout(() => {
      if (mounted.current && onComplete) {
        onComplete();
      }
    }, TIMELINE.toComplete);

    return () => {
      mounted.current = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [animateRing, onComplete]);

  return (
    <>
      <style>{CSS}</style>

      <div className="lb-splash" data-phase={phase}>
        {/* Mesh orbs */}
        <div className="lb-orb lb-orb-1" />
        <div className="lb-orb lb-orb-2" />
        <div className="lb-orb lb-orb-3" />

        {/* Liquid bars canvas */}
        <LiquidBars visible={phase === 'hold' || phase === 'exit'} />

        {/* Center stage */}
        <div className="lb-stage">
          {/* Particle burst on exit */}
          <Particles active={particles} />

          {/* Logo + ring */}
          <div className="lb-logo-ring">
            <RingProgress progress={progress} />
            <img
              src={Splashlogo}
              alt="Liquid Bars"
              className="lb-logo-img"
              draggable={false}
            />
          </div>

          {/* Wordmark */}
          <h1 className="lb-wordmark">
            Liquid <span className="accent">Bars</span>
          </h1>

          {/* Tagline */}
          <p className="lb-tagline">Your music · anywhere</p>
        </div>
      </div>
    </>
  );
}

export default SplashScreen;
export { SplashScreen as VinylLoaderCSS };