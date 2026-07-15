import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FaPaperPlane } from 'react-icons/fa';

export default function Composer({ onSend, disabled, sendTyping }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const taRef = useRef(null);
  const typingTimeout = useRef(null);

  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const emitTyping = useCallback((isTyping) => {
    sendTyping?.(isTyping);
  }, [sendTyping]);

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    autoResize();

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    const hasText = next.trim().length > 0;
    if (hasText) {
      emitTyping(true);
      typingTimeout.current = setTimeout(() => emitTyping(false), 1400);
    } else {
      emitTyping(false);
    }
  };

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setValue('');
    emitTyping(false);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    const { error } = await onSend(text);
    if (error) setValue(text);
    setSending(false);
    requestAnimationFrame(autoResize);
    taRef.current?.focus();
  }, [value, sending, disabled, onSend, emitTyping]);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      emitTyping(false);
    };
  }, [emitTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="dm-composer">
      <style>{CSS}</style>
      <div className={`dm-composer-input-wrap${focused ? ' focused' : ''}`}>
        <textarea
          ref={taRef}
          className="dm-composer-input"
          value={value}
          onChange={handleChange}
          onFocus={() => { setFocused(true); emitTyping(hasText); }}
          onBlur={() => {
            setFocused(false);
            emitTyping(false);
            if (typingTimeout.current) clearTimeout(typingTimeout.current);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          disabled={disabled}
        />
      </div>
      <button
        className={`dm-composer-send${hasText ? ' active' : ''}${sending ? ' sending' : ''}`}
        onClick={submit}
        disabled={!hasText || sending || disabled}
        aria-label="Send message"
      >
        {sending
          ? <span className="dm-composer-spinner" />
          : <FaPaperPlane style={{ fontSize: 13, marginLeft: -1 }} />
        }
      </button>
    </div>
  );
}

const CSS = `
.dm-composer {
  flex-shrink: 0; display: flex; align-items: flex-end; gap: 10px;
  padding: 14px 18px; border-top: 1px solid rgba(255,255,255,0.07);
  background:
    linear-gradient(180deg, transparent 0%, rgba(29,185,84,0.03) 100%),
    var(--lb-bg-raised, #0E1012);
}
.dm-composer-input-wrap {
  flex: 1; min-width: 0; border-radius: 20px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
}
.dm-composer-input-wrap.focused {
  border-color: rgba(29,185,84,0.5);
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 0 3px rgba(29,185,84,0.10);
}
.dm-composer-input {
  width: 100%; resize: none; max-height: 120px;
  padding: 11px 16px; border-radius: inherit;
  background: transparent; border: none;
  color: #fff; font-family: inherit; font-size: 13.5px;
  line-height: 1.4; outline: none; display: block;
}
.dm-composer-input::placeholder { color: rgba(255,255,255,0.3); }
.dm-composer-input:disabled { opacity: 0.5; cursor: not-allowed; }

.dm-composer-send {
  flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.18s, color 0.18s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s;
}
.dm-composer-send.active {
  background: linear-gradient(135deg, #23E065, #1DB954);
  border-color: transparent; color: #05130a;
  box-shadow: 0 4px 18px rgba(29,185,84,0.45);
}
.dm-composer-send.active:hover { transform: scale(1.08) rotate(-6deg); }
.dm-composer-send:active:not(:disabled) { transform: scale(0.9); }
.dm-composer-send:disabled { cursor: not-allowed; }
.dm-composer-send.sending { cursor: wait; }
.dm-composer-spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(5,19,10,0.3); border-top-color: #05130a;
  animation: dmSendSpin 0.6s linear infinite;
}
@keyframes dmSendSpin { to { transform: rotate(360deg); } }
`;