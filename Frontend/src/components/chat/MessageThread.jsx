import React, { useEffect, useRef, useState } from 'react';
import { FaHandPeace, FaEllipsisH } from 'react-icons/fa';

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

export default function MessageThread({
  messages,
  currentUserId,
  loading,
  typing,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  const bottomRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleEditStart = (msg) => {
    setEditingId(msg.id);
    setEditText(msg.body);
    setMenuOpenId(null);
  };

  const handleEditSave = async (msgId) => {
    const text = editText.trim();
    if (!text || !onEdit) return;
    await onEdit(msgId, text);
    setEditingId(null);
    setEditText('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText('');
  };

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

          const isDeleted = !!m.deleted_at;
          const isEdited = !!m.edited_at;

          return (
            <React.Fragment key={m.id}>
              {showDateDivider && (
                <div className="dm-date-divider"><span>{fmtDateLabel(m.created_at)}</span></div>
              )}
              <div className={`dm-bubble-row ${mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}`}>
                <div className="dm-bubble" style={{ position: 'relative' }}>
                  {editingId === m.id ? (
                    <div className="dm-edit-inline">
                      <input
                        className="dm-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave(m.id);
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                      />
                      <div className="dm-edit-actions">
                        <button onClick={() => handleEditSave(m.id)}>Save</button>
                        <button onClick={handleEditCancel}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="dm-bubble-text">
                        {isDeleted ? '[Message deleted]' : m.body}
                      </span>
                      {isEdited && !isDeleted && (
                        <span className="dm-edited-tag">edited</span>
                      )}
                    </>
                  )}
                  {mine && !isDeleted && !editingId && (
                    <div className="dm-message-menu">
                      <button
                        className="dm-message-menu-trigger"
                        onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                      >
                        <FaEllipsisH />
                      </button>
                      {menuOpenId === m.id && (
                        <div className="dm-message-menu-dropdown">
                          <button onClick={() => handleEditStart(m)}>Edit</button>
                          <button onClick={() => { onDeleteForMe(m.id); setMenuOpenId(null); }}>
                            Delete for me
                          </button>
                          <button onClick={() => { onDeleteForEveryone(m.id); setMenuOpenId(null); }}>
                            Delete for everyone
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {!mine && !isDeleted && !editingId && (
                    <div className="dm-message-menu">
                      <button
                        className="dm-message-menu-trigger"
                        onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                      >
                        <FaEllipsisH />
                      </button>
                      {menuOpenId === m.id && (
                        <div className="dm-message-menu-dropdown">
                          <button onClick={() => { onDeleteForMe(m.id); setMenuOpenId(null); }}>
                            Delete for me
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!grouped && (
                  <div className="dm-bubble-meta">
                    <span className="dm-bubble-time">{fmtTime(m.created_at)}</span>
                    {mine && <span className={`dm-bubble-receipt ${m.read_at ? 'read' : 'sent'}`}>{m.read_at ? '✓✓' : '✓'}</span>}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })
      )}
      {typing && (
        <div className="dm-bubble-row theirs typing">
          <div className="dm-bubble dm-typing-bubble">
            <span className="dm-typing-wave" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
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
  position: relative;
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
.dm-bubble-meta {
  display: flex; align-items: center; gap: 4px;
  margin-top: 4px; padding: 0 4px;
}
.dm-bubble-time {
  font-size: 10px; color: rgba(255,255,255,0.28);
}
.dm-bubble-receipt {
  font-size: 10px; color: rgba(255,255,255,0.42);
  font-weight: 700; letter-spacing: 0.02em;
}
.dm-bubble-receipt.read { color: #6EE7B7; }
.dm-bubble-row.mine .dm-bubble-meta { justify-content: flex-end; }

.dm-typing-bubble {
  display: inline-flex; align-items: center;
  min-width: 52px; padding: 12px 16px;
}
.dm-typing-wave {
  display: inline-flex; align-items: center; gap: 4px; height: 14px;
}
.dm-typing-wave span {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--lb-green, #1DB954);
  box-shadow: 0 0 6px rgba(29,185,84,0.55);
  animation: dmTypingWave 1.1s ease-in-out infinite;
}
.dm-typing-wave span:nth-child(2) { animation-delay: 0.15s; }
.dm-typing-wave span:nth-child(3) { animation-delay: 0.30s; }
@keyframes dmTypingWave {
  0%, 60%, 100% { transform: translateY(0) scale(0.85); opacity: 0.5; }
  30%           { transform: translateY(-5px) scale(1.15); opacity: 1; }
}

.dm-edited-tag {
  font-size: 9px; color: rgba(255,255,255,0.4);
  margin-left: 5px; font-weight: 400;
  letter-spacing: 0.02em;
}
.dm-bubble-row.mine .dm-edited-tag { color: rgba(5,19,10,0.5); }

.dm-message-menu {
  position: absolute; top: 2px; right: 4px;
  opacity: 0; transition: opacity 0.15s;
}
.dm-bubble:hover .dm-message-menu { opacity: 1; }
.dm-message-menu-trigger {
  background: transparent; border: none; cursor: pointer;
  color: rgba(255,255,255,0.3); padding: 2px 4px;
  font-size: 13px; line-height: 1;
  border-radius: 4px;
}
.dm-message-menu-trigger:hover { color: #fff; background: rgba(255,255,255,0.06); }
.dm-bubble-row.mine .dm-message-menu-trigger { color: rgba(5,19,10,0.4); }
.dm-bubble-row.mine .dm-message-menu-trigger:hover { color: #05130a; background: rgba(255,255,255,0.15); }

.dm-message-menu-dropdown {
  position: absolute; top: 100%; right: 0; z-index: 10;
  background: #1a1c1f; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 4px 0; min-width: 140px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
}
.dm-message-menu-dropdown button {
  display: block; width: 100%; padding: 8px 14px;
  background: transparent; border: none; color: rgba(255,255,255,0.7);
  font-size: 12.5px; text-align: left; cursor: pointer;
}
.dm-message-menu-dropdown button:hover { background: rgba(255,255,255,0.06); color: #fff; }
.dm-message-menu-dropdown button:first-child { border-radius: 10px 10px 0 0; }
.dm-message-menu-dropdown button:last-child { border-radius: 0 0 10px 10px; }

.dm-edit-inline {
  display: flex; flex-direction: column; gap: 6px;
}
.dm-edit-input {
  background: rgba(0,0,0,0.2); border: 1px solid rgba(29,185,84,0.3);
  border-radius: 8px; padding: 4px 8px; color: #fff;
  font-family: inherit; font-size: 13px; outline: none;
}
.dm-edit-input:focus { border-color: #1DB954; }
.dm-edit-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
.dm-edit-actions button {
  background: transparent; border: none; color: rgba(255,255,255,0.6);
  font-size: 12px; cursor: pointer; padding: 2px 6px;
}
.dm-edit-actions button:hover { color: #fff; }
.dm-edit-actions button:first-child { color: #1DB954; }
.dm-edit-actions button:first-child:hover { color: #23E065; }
`;