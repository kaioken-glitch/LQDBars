import React, { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Discord icon ── */
function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

/* ── Animated equaliser bars (matches app's wave component) ── */
function EqBars() {
  return (
    <div className="lb-eq">
      {[1,2,3,4,5].map(i => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
    </div>
  );
}

/* ── Google icon ── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.lb-login-root {
  --g:        #1DB954;
  --g2:       #23E065;
  --gdim:     rgba(29,185,84,0.15);
  --gglow:    rgba(29,185,84,0.3);
  --bg:       #07080A;
  --s1:       rgba(255,255,255,0.04);
  --s2:       rgba(255,255,255,0.07);
  --sh:       rgba(255,255,255,0.10);
  --b1:       rgba(255,255,255,0.08);
  --b2:       rgba(255,255,255,0.14);
  --t1:       #ffffff;
  --t2:       rgba(255,255,255,0.55);
  --t3:       rgba(255,255,255,0.28);
  --err:      #FF4B4B;
  --spring:   cubic-bezier(0.22, 1, 0.36, 1);
  --ease:     cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  width: 100vw;
  height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

/* ── Ambient background layers ── */
.lb-login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.lb-login-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.18;
  animation: orbFloat 8s ease-in-out infinite;
}
.lb-login-bg-orb.o1 {
  width: 600px; height: 600px;
  background: radial-gradient(circle, #1DB954, transparent 70%);
  top: -200px; left: -150px;
  animation-delay: 0s;
}
.lb-login-bg-orb.o2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #0d5c28, transparent 70%);
  bottom: -100px; right: -100px;
  animation-delay: 3s;
}
.lb-login-bg-orb.o3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #1DB954, transparent 70%);
  top: 50%; right: 20%;
  opacity: 0.08;
  animation-delay: 5s;
}

/* grain overlay */
.lb-login-grain {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px;
  opacity: 0.028;
  mix-blend-mode: screen;
}

/* subtle grid */
.lb-login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(29,185,84,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(29,185,84,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent);
}

@keyframes orbFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-30px) scale(1.05); }
}

/* ── Card ── */
.lb-login-card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 420px;
  padding: 44px 40px 40px;
  background: rgba(10,12,14,0.82);
  border: 1px solid var(--b1);
  border-radius: 28px;
  backdrop-filter: blur(40px);
  box-shadow:
    0 40px 100px rgba(0,0,0,0.6),
    0 0 0 1px rgba(255,255,255,0.04) inset,
    0 1px 0 rgba(255,255,255,0.08) inset;
  animation: cardIn .55s var(--spring) both;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(32px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Logo ── */
.lb-login-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}
.lb-login-logo-mark {
  width: 36px; height: 36px;
  background: var(--g);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 24px rgba(29,185,84,0.5);
  flex-shrink: 0;
}
.lb-login-logo-mark svg { display: block; }
.lb-login-logo-text {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--t1);
}
.lb-login-logo-text em {
  font-style: normal;
  color: var(--g);
}

/* ── Heading ── */
.lb-login-heading {
  font-family: 'Syne', sans-serif;
  font-size: clamp(26px, 4vw, 32px);
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--t1);
  line-height: 1.1;
  margin-bottom: 6px;
}
.lb-login-sub {
  font-size: 14px;
  color: var(--t3);
  margin-bottom: 28px;
  line-height: 1.5;
}

/* ── Tab switcher ── */
.lb-login-tabs {
  display: flex;
  gap: 4px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 28px;
}
.lb-login-tab {
  flex: 1;
  padding: 9px 0;
  border-radius: 9px;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .18s var(--ease), color .18s var(--ease), box-shadow .18s var(--ease);
  color: var(--t2);
  background: transparent;
}
.lb-login-tab.active {
  background: var(--g);
  color: #000;
  box-shadow: 0 4px 16px rgba(29,185,84,0.35);
}

/* ── Form fields ── */
.lb-field {
  margin-bottom: 14px;
}
.lb-field label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--t3);
  margin-bottom: 7px;
}
.lb-field input {
  width: 100%;
  padding: 12px 16px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 12px;
  color: var(--t1);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color .18s var(--ease), background .18s var(--ease), box-shadow .18s var(--ease);
}
.lb-field input::placeholder { color: var(--t3); }
.lb-field input:focus {
  border-color: rgba(29,185,84,.5);
  background: var(--s2);
  box-shadow: 0 0 0 3px rgba(29,185,84,.1);
}
.lb-field input.error {
  border-color: rgba(255,75,75,.5);
  box-shadow: 0 0 0 3px rgba(255,75,75,.1);
}

/* ── Error message ── */
.lb-login-err {
  font-size: 12px;
  color: var(--err);
  background: rgba(255,75,75,0.08);
  border: 1px solid rgba(255,75,75,0.2);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: errShake .35s var(--spring);
}
@keyframes errShake {
  0%,100% { transform: translateX(0); }
  25%      { transform: translateX(-6px); }
  75%      { transform: translateX(6px); }
}

/* ── Submit button ── */
.lb-login-btn {
  width: 100%;
  padding: 14px;
  background: var(--g);
  border: none;
  border-radius: 14px;
  color: #000;
  font-family: 'Syne', sans-serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  margin-top: 6px;
  position: relative;
  overflow: hidden;
  transition: background .15s var(--ease), transform .15s var(--spring), box-shadow .15s var(--ease);
  box-shadow: 0 6px 28px rgba(29,185,84,0.38);
}
.lb-login-btn:hover:not(:disabled) {
  background: var(--g2);
  transform: translateY(-1px);
  box-shadow: 0 10px 36px rgba(29,185,84,0.5);
}
.lb-login-btn:active:not(:disabled) { transform: translateY(1px); }
.lb-login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.lb-login-btn-shine {
  position: absolute;
  top: 0; left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: skewX(-20deg);
  animation: btnShine 3s ease-in-out infinite;
}
@keyframes btnShine {
  0%   { left: -100%; }
  40%  { left: 150%; }
  100% { left: 150%; }
}

/* ── Spinner inside button ── */
.lb-btn-spinner {
  display: inline-block;
  width: 16px; height: 16px;
  border: 2px solid rgba(0,0,0,0.3);
  border-top-color: #000;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  vertical-align: middle;
  margin-right: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Divider ── */
.lb-login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  color: var(--t3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.lb-login-divider::before,
.lb-login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--b1);
}

/* ── Google button ── */
.lb-google-btn {
  width: 100%;
  padding: 12px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 14px;
  color: var(--t1);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: background .15s var(--ease), border-color .15s var(--ease), transform .15s var(--spring);
}
.lb-google-btn:hover {
  background: var(--s2);
  border-color: var(--b2);
  transform: translateY(-1px);
}
.lb-google-btn:active { transform: translateY(1px); }

/* ── Equaliser ── */
.lb-eq {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
}
.lb-eq span {
  display: block;
  width: 3px;
  border-radius: 2px;
  background: var(--g);
  animation: eqBounce 1.2s ease-in-out infinite alternate;
}
.lb-eq span:nth-child(1) { height: 8px;  animation-delay: 0s; }
.lb-eq span:nth-child(2) { height: 16px; animation-delay: 0.12s; }
.lb-eq span:nth-child(3) { height: 12px; animation-delay: 0.24s; }
.lb-eq span:nth-child(4) { height: 20px; animation-delay: 0.36s; }
.lb-eq span:nth-child(5) { height: 10px; animation-delay: 0.48s; }
@keyframes eqBounce {
  from { transform: scaleY(0.4); opacity: 0.6; }
  to   { transform: scaleY(1);   opacity: 1;   }
}

/* ── Footer note ── */
.lb-login-footer {
  margin-top: 22px;
  text-align: center;
  font-size: 11px;
  color: var(--t3);
  line-height: 1.6;
}
.lb-login-footer a {
  color: var(--g);
  text-decoration: none;
  font-weight: 600;
}
.lb-login-footer a:hover { text-decoration: underline; }

/* ── Success flash ── */
.lb-login-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 0 8px;
  animation: cardIn .4s var(--spring) both;
}
.lb-login-success-ring {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: var(--gdim);
  border: 2px solid var(--g);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 32px var(--gglow);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,100% { box-shadow: 0 0 20px var(--gglow); }
  50%      { box-shadow: 0 0 48px var(--gglow); }
}
.lb-login-success h3 {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: var(--t1);
  letter-spacing: -0.03em;
}
.lb-login-success p {
  font-size: 13px;
  color: var(--t3);
}

/* ── Discord button accent on hover ── */
.lb-discord-btn:hover {
  border-color: rgba(88,101,242,0.4) !important;
  background: rgba(88,101,242,0.08) !important;
}

/* ── Mobile ── */
@media (max-width: 480px) {
  .lb-login-card {
    max-width: 100%;
    min-height: 100vh;
    border-radius: 0;
    padding: 48px 28px 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: none;
  }
}
`;

export default function Login({ onSuccess }) {
  const [mode,     setMode]     = useState('login');   // 'login' | 'signup'
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);

  const { signIn, signUp, signInWithGoogle, signInWithDiscord } = useAuth();

  const clearForm = () => {
    setName(''); setEmail(''); setPassword(''); setError('');
  };

  const switchMode = (m) => {
    setMode(m);
    clearForm();
  };

  const handleSubmit = useCallback(async () => {
    setError('');
    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Please enter your display name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) throw err;
        setSuccess(true);
        setTimeout(() => onSuccess?.(), 900);
      } else {
        const { error: err } = await signUp(email.trim(), password, name.trim());
        if (err) throw err;
        setSuccess(true);
        // For email confirmation flow — show success, don't auto-navigate
        // If email confirmation is OFF in Supabase, auto-navigate after short delay
        setTimeout(() => onSuccess?.(), 1200);
      }
    } catch (err) {
      const msg = err?.message || 'Something went wrong. Try again.';
      // Map Supabase error messages to friendlier ones
      if (msg.includes('Invalid login credentials')) setError('Incorrect email or password.');
      else if (msg.includes('Email not confirmed'))  setError('Please confirm your email first.');
      else if (msg.includes('already registered'))  setError('An account with this email already exists.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [mode, name, email, password, signIn, signUp, onSuccess]);

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err?.message || 'Google sign-in failed.');
    }
  };

  const handleDiscord = async () => {
    setError('');
    try {
      await signInWithDiscord();
    } catch (err) {
      setError(err?.message || 'Discord sign-in failed.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleSubmit();
  };

  return (
    <div className="lb-login-root">
      <style>{CSS}</style>

      {/* Background */}
      <div className="lb-login-bg">
        <div className="lb-login-bg-orb o1" />
        <div className="lb-login-bg-orb o2" />
        <div className="lb-login-bg-orb o3" />
        <div className="lb-login-grain" />
        <div className="lb-login-grid" />
      </div>

      {/* Card */}
      <div className="lb-login-card">

        {/* Logo */}
        <div className="lb-login-logo">
          <div className="lb-login-logo-mark">
            <EqBars />
          </div>
          <span className="lb-login-logo-text">Liquid <em>Bars</em></span>
        </div>

        {success ? (
          <div className="lb-login-success">
            <div className="lb-login-success-ring">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1DB954" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3>{mode === 'signup' ? 'Welcome aboard' : 'Welcome back'}</h3>
            <p>{mode === 'signup' ? 'Your account is ready.' : 'Loading your music...'}</p>
          </div>
        ) : (
          <>
            {/* Heading */}
            <h1 className="lb-login-heading">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
            <p className="lb-login-sub">
              {mode === 'login'
                ? 'Welcome back. Your music is waiting.'
                : 'Join and start building your sound.'}
            </p>

            {/* Tab switcher */}
            <div className="lb-login-tabs" role="tablist">
              <button
                role="tab"
                className={`lb-login-tab${mode === 'login' ? ' active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign In
              </button>
              <button
                role="tab"
                className={`lb-login-tab${mode === 'signup' ? ' active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Sign Up
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="lb-login-err">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Display name — signup only */}
            {mode === 'signup' && (
              <div className="lb-field" style={{ animation: 'cardIn .3s var(--spring) both' }}>
                <label>Display Name</label>
                <input
                  type="text"
                  placeholder="How should we call you?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            )}

            {/* Email */}
            <div className="lb-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete={mode === 'login' ? 'email' : 'email'}
                disabled={loading}
                className={error && !email ? 'error' : ''}
              />
            </div>

            {/* Password */}
            <div className="lb-field">
              <label>Password</label>
              <input
                type="password"
                placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
                className={error && !password ? 'error' : ''}
              />
            </div>

            {/* Submit */}
            <button className="lb-login-btn" onClick={handleSubmit} disabled={loading}>
              <div className="lb-login-btn-shine" />
              {loading
                ? <><span className="lb-btn-spinner" />{mode === 'login' ? 'Signing in…' : 'Creating account…'}</>
                : mode === 'login' ? 'Sign In' : 'Create Account'
              }
            </button>

            {/* Divider */}
            <div className="lb-login-divider">or continue with</div>

            {/* OAuth buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="lb-google-btn" onClick={handleGoogle} disabled={loading} style={{ flex: 1 }}>
                <GoogleIcon />
                Google
              </button>
              <button className="lb-google-btn lb-discord-btn" onClick={handleDiscord} disabled={loading} style={{ flex: 1 }}>
                <DiscordIcon />
                Discord
              </button>
            </div>

            {/* Footer */}
            <p className="lb-login-footer">
              {mode === 'login'
                ? <>No account? <a onClick={() => switchMode('signup')}>Sign up free</a></>
                : <>Already have an account? <a onClick={() => switchMode('login')}>Sign in</a></>
              }
            </p>
          </>
        )}
      </div>
    </div>
  );
}