// src/components/chat/MessageThread.jsx
import React, { useEffect, useRef } from 'react';

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function MessageThread({ messages, currentUserId, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <div className="dm-thread">
      <style>{CSS}</style>
      {loading ? (
        <div className="dm-thread-loading">Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className="dm-thread-empty">
          <div className="dm-thread-empty-icon">👋</div>
          <p>This is the start of your conversation.</p>
        </div>
      ) : (
        messages.map((m, i) => {
          const mine = m.sender_id === currentUserId;
          const prev = messages[i - 1];
          const grouped = prev && prev.sender_id === m.sender_id &&
            (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000;

          return (
            <div key={m.id} className={`dm-bubble-row ${mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}`}>
              <div className="dm-bubble">
                <span className="dm-bubble-text">{m.body}</span>
              </div>
              {!grouped && <span className="dm-bubble-time">{fmtTime(m.created_at)}</span>}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

const CSS = `
.dm-thread {
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 18px 20px; display: flex; flex-direction: column; gap: 3px;
}
.dm-thread-loading, .dm-thread-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: var(--lb-text-3, rgba(255,255,255,0.28)); font-size: 13px; gap: 8px; text-align: center;
}
.dm-thread-empty-icon { font-size: 26px; }
.dm-bubble-row { display: flex; flex-direction: column; max-width: 62%; margin-top: 10px; }
.dm-bubble-row.grouped { margin-top: 2px; }
.dm-bubble-row.mine   { align-self: flex-end; align-items: flex-end; }
.dm-bubble-row.theirs { align-self: flex-start; align-items: flex-start; }
.dm-bubble {
  padding: 9px 13px; border-radius: 16px;
  font-size: 13.5px; line-height: 1.45; word-break: break-word;
}
.dm-bubble-row.mine .dm-bubble {
  background: var(--lb-green, #1DB954); color: #05130a;
  border-bottom-right-radius: 5px;
}
.dm-bubble-row.theirs .dm-bubble {
  background: var(--lb-surface-2, rgba(255,255,255,0.07));
  color: var(--lb-text-1, #fff);
  border-bottom-left-radius: 5px;
}
.dm-bubble-time {
  font-size: 10px; color: var(--lb-text-3, rgba(255,255,255,0.28));
  margin-top: 3px; padding: 0 4px;
}
`;