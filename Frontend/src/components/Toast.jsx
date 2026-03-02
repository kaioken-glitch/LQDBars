/**
 * Toast — lightweight snackbar system.
 *
 * Setup: render <ToastContainer /> once near the root of your app.
 * Usage: call useToast() in any component to get { show }.
 *
 * toast.show('Added to Molly ✓')
 * toast.show('Removed from playlist', 'error')
 * toast.show('Copied link!', 'info')
 */

import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';

const ToastContext = createContext(null);

const TOAST_CSS = `
@keyframes lb-toast-in  { from { opacity:0; transform: translateY(12px) scale(0.95); } to { opacity:1; transform: translateY(0) scale(1); } }
@keyframes lb-toast-out { from { opacity:1; transform: translateY(0) scale(1); } to { opacity:0; transform: translateY(-8px) scale(0.95); } }

.lb-toast-wrap {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.lb-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 9999px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: auto;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08);
  animation: lb-toast-in 0.3s cubic-bezier(0.22,1,0.36,1) both;
}
.lb-toast.leaving {
  animation: lb-toast-out 0.25s ease forwards;
}
.lb-toast.success {
  background: rgba(16, 42, 24, 0.92);
  color: #4ade80;
  border: 1px solid rgba(29,185,84,0.3);
}
.lb-toast.error {
  background: rgba(42, 16, 16, 0.92);
  color: #f87171;
  border: 1px solid rgba(255,50,50,0.3);
}
.lb-toast.info {
  background: rgba(16, 24, 42, 0.92);
  color: rgba(255,255,255,0.88);
  border: 1px solid rgba(255,255,255,0.12);
}
.lb-toast-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lb-toast.success .lb-toast-dot { background: #1DB954; }
.lb-toast.error   .lb-toast-dot { background: #ef4444; }
.lb-toast.info    .lb-toast-dot { background: rgba(255,255,255,0.4); }
`;

let _showToast = null;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const show = useCallback((message, type = 'success', duration = 2800) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, leaving: false }]);

    // Start exit animation before removing
    timers.current[id] = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        delete timers.current[id];
      }, 260);
    }, duration);
  }, []);

  // Expose show globally so non-React code can call it if needed
  useEffect(() => {
    _showToast = show;
    return () => { _showToast = null; };
  }, [show]);

  useEffect(() => {
    return () => Object.values(timers.current).forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      <style>{TOAST_CSS}</style>
      {children}
      <div className="lb-toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`lb-toast ${t.type}${t.leaving ? ' leaving' : ''}`}>
            <span className="lb-toast-dot" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// Convenience: call from anywhere without hook (e.g. utility functions)
export const toast = {
  show: (msg, type, duration) => _showToast?.(msg, type, duration),
};