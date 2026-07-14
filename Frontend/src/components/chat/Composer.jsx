// src/components/chat/Composer.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FaPaperPlane } from 'react-icons/fa';

export default function Composer({ onSend, disabled, onTypingChange }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const taRef = useRef(null);

  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  useEffect(() => {
    if (!typing) return;
    const id = window.setTimeout(() => {
      setTyping(false);
      onTypingChange?.(false);
    }, 1400);
    return () => window.clearTimeout(id);
  }, [typing, value, onTypingChange]);

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setValue('');
    setTyping(false);
    onTypingChange?.(false);
    const { error } = await onSend(text);
    if (error) setValue(text);
    setSending(false);
    requestAnimationFrame(autoResize);
    taRef.current?.focus();
  }, [value, sending, disabled, onSend, onTypingChange]);

  useEffect(() => {
    return () => {
      try { document.body.classList.remove('chat-input-active'); } catch (_) {}
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="dm-composer">
      <style>{CSS}</style>
      <div className="dm-composer-input-wrap">
        <textarea
          ref={taRef}
          className="dm-composer-input"
          value={value}
          onChange={e => {
            const next = e.target.value;
            setValue(next);
            autoResize();
            setTyping(Boolean(next.trim()));
            onTypingChange?.(Boolean(next.trim()));
          }}
          onFocus={() => {
            setTyping(true);
            onTypingChange?.(true);
            try { document.body.classList.add('chat-input-active'); } catch (_) {}
          }}
          onBlur={() => {
            setTyping(false);
            onTypingChange?.(false);
            try { document.body.classList.remove('chat-input-active'); } catch (_) {}
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          disabled={disabled}
        />
      </div>
      <button
        className={`dm-composer-send${value.trim() ? ' active' : ''}`}
        onClick={submit}
        disabled={!value.trim() || sending || disabled}
        aria-label="Send message"
      >
        <FaPaperPlane style={{ fontSize: 13, marginLeft: -1 }} />
      </button>
    </div>
  );
}

const CSS = `
.dm-composer {
  flex-shrink: 0; display: flex; align-items: flex-end; gap: 10px;
  padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.07);
  background: var(--lb-bg-raised, #0E1012);
}
.dm-composer-input-wrap { flex: 1; min-width: 0; }
.dm-composer-input {
  width: 100%; resize: none; max-height: 120px;
  padding: 11px 16px; border-radius: 18px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  color: #fff; font-family: inherit; font-size: 13.5px;
  line-height: 1.4; outline: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.dm-composer-input:focus {
  border-color: rgba(29,185,84,0.5);
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 0 3px rgba(29,185,84,0.10);
}
.dm-composer-input::placeholder { color: rgba(255,255,255,0.3); }
.dm-composer-input:disabled { opacity: 0.5; cursor: not-allowed; }

.dm-composer-send {
  flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s, transform 0.1s, box-shadow 0.15s;
}
.dm-composer-send.active {
  background: linear-gradient(135deg, #23E065, #1DB954);
  border-color: transparent; color: #05130a;
  box-shadow: 0 4px 16px rgba(29,185,84,0.4);
}
.dm-composer-send.active:hover { transform: scale(1.06); }
.dm-composer-send:active:not(:disabled) { transform: scale(0.92); }
.dm-composer-send:disabled { cursor: not-allowed; }
`;