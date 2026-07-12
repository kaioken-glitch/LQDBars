// src/components/chat/MessageThread.jsx
import React, { useEffect, useRef } from 'react';
import { FaHandPeace } from 'react-icons/fa';

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function fmtDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
        <div className="dm-thread-loading">
          <div className="dm-thread-spinner" />
          <span>Loading messages…</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="dm-thread-empty">
          <div className="dm-thread-empty-icon"><FaHandPeace /></div>
          <h3>Say hello!</h3>
          <p>This is the start of your conversation.</p>
        </div>
      ) : (
        messages.map((m, i) => {
          const mine = m.sender_id === currentUserId;
          const prev = messages[i - 1];
          const grouped = prev && prev.sender_id === m.sender_id &&
            (new Date(m.created_at) - new Date(prev.created_at)) < 3 * 60 * 1000 &&
            new Date(prev.created_at).toDateString() === new Date(m.created_at).toDateString();

          const showDateDivider = !prev ||
            new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();

          return (
            <React.Fragment key={m.id}>
              {showDateDivider && (
                <div className="dm-date-divider"><span>{fmtDateLabel(m.created_at)}</span></div>
              )}
              <div className={`dm-bubble-row ${mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}`}>
                <div className="dm-bubble">
                  <span className="dm-bubble-text">{m.body}</span>
                </div>
                {!grouped && <span className="dm-bubble-time">{fmtTime(m.created_at)}</span>}
              </div>
            </React.Fragment>
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
  padding: 20px 22px; display: flex; flex-direction: column;
  background:
    radial-gradient(ellipse 60% 40% at 30% 0%, rgba(29,185,84,0.035) 0%, transparent 60%),
    var(--lb-bg-base, #07080A);
}

.dm-thread-loading, .dm-thread-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.3); font-size: 13px; gap: 10px; text-align: center;
}
.dm-thread-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.12); border-top-color: #1DB954;
  animation: dmspin 0.7s linear infinite;
}
@keyframes dmspin { to { transform: rotate(360deg); } }
.dm-thread-empty-icon {
  width: 60px; height: 60px; border-radius: 50%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: #1DB954; margin-bottom: 2px;
}
.dm-thread-empty h3 { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; color: rgba(255,255,255,0.7); }
.dm-thread-empty p { font-size: 13px; color: rgba(255,255,255,0.32); }

.dm-date-divider {
  display: flex; align-items: center; justify-content: center;
  margin: 18px 0 12px;
}
.dm-date-divider span {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  padding: 4px 12px; border-radius: 9999px;
}

.dm-bubble-row { display: flex; flex-direction: column; max-width: 62%; margin-top: 10px; }
.dm-bubble-row.grouped { margin-top: 3px; }
.dm-bubble-row.mine   { align-self: flex-end; align-items: flex-end; }
.dm-bubble-row.theirs { align-self: flex-start; align-items: flex-start; }

.dm-bubble {
  padding: 10px 14px; border-radius: 18px;
  font-size: 13.5px; line-height: 1.5; word-break: break-word;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  animation: dmBubbleIn 0.22s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes dmBubbleIn { from { opacity:0; transform: translateY(6px) scale(0.98); } to { opacity:1; transform:none; } }

.dm-bubble-row.mine .dm-bubble {
  background: linear-gradient(135deg, #23E065, #1DB954);
  color: #05130a; font-weight: 500;
  border-bottom-right-radius: 5px;
}
.dm-bubble-row.theirs .dm-bubble {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.06);
  color: #fff;
  border-bottom-left-radius: 5px;
}
.dm-bubble-time {
  font-size: 10px; color: rgba(255,255,255,0.28);
  margin-top: 4px; padding: 0 4px;
}
`;