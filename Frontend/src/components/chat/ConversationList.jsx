// src/components/chat/ConversationList.jsx
import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../../lib/supabase';
import { usePresence } from '../../hooks/usePresence';

const FALLBACK = 'https://placehold.co/56x56/111214/333?text=?';

function useProfilesByIds(ids) {
  const key = ids.filter(Boolean).join(',');
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    const unique = [...new Set(key.split(',').filter(Boolean))];
    if (!unique.length) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', unique)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const map = {};
        (data || []).forEach(p => { map[p.id] = p; });
        setProfiles(prev => ({ ...prev, ...map }));
      });

    return () => { cancelled = true; };
  }, [key]);

  return profiles;
}

function fmtPreviewTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const ConversationRow = memo(({ conv, profile, active, onSelect }) => {
  const presence = usePresence(conv.otherId);
  const name = profile?.display_name || profile?.username || 'Unknown';

  return (
    <button className={`dm-row${active ? ' active' : ''}`} onClick={() => onSelect(conv)}>
      <div className="dm-row-avatar-wrap">
        <img
          src={profile?.avatar_url || FALLBACK}
          alt=""
          className="dm-row-avatar"
          onError={e => { e.target.src = FALLBACK; }}
        />
        <span className={`dm-row-dot ${presence.online ? 'online' : 'offline'}`} />
      </div>
      <div className="dm-row-meta">
        <div className="dm-row-top">
          <span className="dm-row-name">{name}</span>
          <span className="dm-row-time">{fmtPreviewTime(conv.lastMessageAt)}</span>
        </div>
        <div className="dm-row-preview">
          {presence.song ? `🎵 ${presence.song.name}` : (conv.lastMessage?.body || 'Say hi 👋')}
        </div>
      </div>
      {conv.unreadCount > 0 && <span className="dm-row-badge">{conv.unreadCount}</span>}
    </button>
  );
});

export default function ConversationList({ conversations, activeId, onSelect }) {
  const profiles = useProfilesByIds(conversations.map(c => c.otherId));

  return (
    <div className="dm-list">
      <style>{CSS}</style>
      <div className="dm-list-header">Messages</div>
      <div className="dm-list-body">
        {conversations.length === 0 ? (
          <div className="dm-list-empty">
            <div className="dm-list-empty-icon">💬</div>
            <p>No conversations yet</p>
          </div>
        ) : (
          conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              profile={profiles[conv.otherId]}
              active={conv.id === activeId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

const CSS = `
.dm-list {
  display: flex; flex-direction: column;
  width: 280px; flex-shrink: 0;
  height: 100%;
  border-right: 1px solid var(--lb-border-1, rgba(255,255,255,0.07));
  background: var(--lb-bg-base, #07080A);
}
.dm-list-header {
  flex-shrink: 0; padding: 18px 18px 12px;
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 17px;
  color: var(--lb-text-1, #fff); letter-spacing: -0.02em;
}
.dm-list-body { flex: 1; overflow-y: auto; padding: 4px 8px 12px; }
.dm-row {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 12px;
  background: none; border: none; cursor: pointer; text-align: left;
  transition: background 0.15s;
}
.dm-row:hover { background: var(--lb-surface-1, rgba(255,255,255,0.04)); }
.dm-row.active { background: rgba(29,185,84,0.10); }
.dm-row-avatar-wrap { position: relative; flex-shrink: 0; }
.dm-row-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; display: block; }
.dm-row-dot {
  position: absolute; right: -1px; bottom: -1px;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--lb-bg-base, #07080A);
}
.dm-row-dot.online  { background: var(--lb-green, #1DB954); }
.dm-row-dot.offline { background: rgba(255,255,255,0.22); }
.dm-row-meta { flex: 1; min-width: 0; }
.dm-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.dm-row-name {
  font-size: 13px; font-weight: 600; color: var(--lb-text-1, #fff);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dm-row-time { font-size: 10px; color: var(--lb-text-3, rgba(255,255,255,0.28)); flex-shrink: 0; }
.dm-row-preview {
  font-size: 12px; color: var(--lb-text-2, rgba(255,255,255,0.55));
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;
}
.dm-row-badge {
  flex-shrink: 0; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9999px; background: var(--lb-green, #1DB954);
  color: #000; font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.dm-list-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; gap: 10px; text-align: center;
  color: var(--lb-text-3, rgba(255,255,255,0.28)); font-size: 13px;
}
.dm-list-empty-icon { font-size: 26px; opacity: 0.5; }
`;