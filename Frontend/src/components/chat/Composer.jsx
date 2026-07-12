// src/components/chat/Composer.jsx
import React, { useState, useRef, useCallback } from 'react';

export default function Composer({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef(null);

  const submit = useCallback(async () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setValue('');
    const { error } = await onSend(text);
    if (error) setValue(text); // restore on failure so nothing's lost
    setSending(false);
    taRef.current?.focus();
  }, [value, sending, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="dm-composer">
      <style>{CSS}</style>
      <textarea
        ref={taRef}
        className="dm-composer-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message…"
        rows={1}
        disabled={disabled}
      />
      <button
        className="dm-composer-send"
        onClick={submit}
        disabled={!value.trim() || sending || disabled}
        aria-label="Send message"
      >
        ➤
      </button>
    </div>
  );
}

const CSS = `
.dm-composer {
  flex-shrink: 0; display: flex; align-items: flex-end; gap: 10px;
  padding: 12px 16px; border-top: 1px solid var(--lb-border-1, rgba(255,255,255,0.07));
  background: var(--lb-bg-raised, #0E1012);
}
.dm-composer-input {
  flex: 1; resize: none; max-height: 120px;
  padding: 10px 14px; border-radius: 14px;
  background: var(--lb-surface-1, rgba(255,255,255,0.04));
  border: 1px solid var(--lb-border-1, rgba(255,255,255,0.07));
  color: var(--lb-text-1, #fff); font-family: inherit; font-size: 13.5px;
  line-height: 1.4; outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.dm-composer-input:focus {
  border-color: rgba(29,185,84,0.5);
  background: var(--lb-surface-2, rgba(255,255,255,0.07));
}
.dm-composer-input::placeholder { color: var(--lb-text-3, rgba(255,255,255,0.28)); }
.dm-composer-send {
  flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%;
  background: var(--lb-green, #1DB954); border: none; color: #05130a;
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, transform 0.1s, opacity 0.15s;
}
.dm-composer-send:hover:not(:disabled) { background: var(--lb-green-bright, #23E065); }
.dm-composer-send:active:not(:disabled) { transform: scale(0.92); }
.dm-composer-send:disabled { opacity: 0.35; cursor: not-allowed; }
`;