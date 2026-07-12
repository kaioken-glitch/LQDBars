// src/components/chat/ConversationList.jsx
import React, { useEffect, useState, memo } from 'react';
import { FaComments, FaSearch } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { usePresence } from '../../hooks/usePresence';

const FALLBACK = 'https://placehold.co/56x56/0d1a12/1a2e20?text=?';

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
          {presence.song
            ? <span className="dm-row-listening">♪ {presence.song.name}</span>
            : (conv.lastMessage?.body || 'Say hi 👋')}
        </div>
      </div>
      {conv.unreadCount > 0 && <span className="dm-row-badge">{conv.unreadCount}</span>}
    </button>
  );
});

export default function ConversationList({ conversations, activeId, onSelect }) {
  const [query, setQuery] = useState('');
  const profiles = useProfilesByIds(conversations.map(c => c.otherId));

  const filtered = query.trim()
    ? conversations.filter(c => {
        const p = profiles[c.otherId];
        const name = (p?.display_name || p?.username || '').toLowerCase();
        return name.includes(query.toLowerCase());
      })
    : conversations;

  return (
    <div className="dm-list">
      <style>{CSS}</style>

      <div className="dm-list-header">
        <div className="dm-list-eyebrow"><span className="dm-list-eyebrow-dot" /> Direct Messages</div>
        <h1 className="dm-list-title">Chats</h1>

        <div className="dm-list-search-wrap">
          <FaSearch className="dm-list-search-ico" />
          <input
            className="dm-list-search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conversations…"
          />
        </div>
      </div>

      <div className="dm-list-body">
        {conversations.length === 0 ? (
          <div className="dm-list-empty">
            <div className="dm-list-empty-icon"><FaComments /></div>
            <h3>No conversations yet</h3>
            <p>When you message someone, it'll show up here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dm-list-empty">
            <div className="dm-list-empty-icon"><FaSearch /></div>
            <p>No matches for "{query}"</p>
          </div>
        ) : (
          filtered.map(conv => (
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
  width: 300px; flex-shrink: 0;
  height: 100%;
  border-right: 1px solid rgba(255,255,255,0.07);
  background: linear-gradient(180deg, rgba(29,185,84,0.05) 0%, transparent 140px), var(--lb-bg-base, #07080A);
}

.dm-list-header {
  flex-shrink: 0; padding: 22px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.dm-list-eyebrow {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: #1DB954; margin-bottom: 6px;
}
.dm-list-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #1DB954; flex-shrink: 0; }
.dm-list-title {
  font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800;
  letter-spacing: -0.04em; color: #fff; margin-bottom: 14px;
}
.dm-list-search-wrap { position: relative; }
.dm-list-search-ico {
  position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  color: rgba(255,255,255,0.3); font-size: 12px; pointer-events: none;
}
.dm-list-search {
  width: 100%; padding: 9px 14px 9px 34px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 9999px; color: #fff; font-family: 'DM Sans', sans-serif;
  font-size: 13px; outline: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.dm-list-search::placeholder { color: rgba(255,255,255,0.28); }
.dm-list-search:focus {
  border-color: rgba(29,185,84,0.5); background: rgba(255,255,255,0.07);
  box-shadow: 0 0 0 3px rgba(29,185,84,0.10);
}

.dm-list-body { flex: 1; overflow-y: auto; padding: 8px 10px 16px; }

.dm-row {
  width: 100%; display: flex; align-items: center; gap: 11px;
  padding: 10px; margin-bottom: 2px; border-radius: 14px;
  background: none; border: 1px solid transparent; cursor: pointer; text-align: left;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
  position: relative;
}
.dm-row:hover { background: rgba(255,255,255,0.045); }
.dm-row.active {
  background: rgba(29,185,84,0.10);
  border-color: rgba(29,185,84,0.18);
}
.dm-row.active::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 60%; border-radius: 0 3px 3px 0;
  background: linear-gradient(to bottom, #23E065, #1DB954);
  box-shadow: 0 0 10px rgba(29,185,84,0.5);
}

.dm-row-avatar-wrap { position: relative; flex-shrink: 0; }
.dm-row-avatar {
  width: 44px; height: 44px; border-radius: 50%; object-fit: cover; display: block;
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
}
.dm-row-dot {
  position: absolute; right: -1px; bottom: -1px;
  width: 11px; height: 11px; border-radius: 50%;
  border: 2.5px solid #07080A;
}
.dm-row-dot.online  { background: #1DB954; box-shadow: 0 0 6px rgba(29,185,84,0.7); }
.dm-row-dot.offline { background: rgba(255,255,255,0.22); }

.dm-row-meta { flex: 1; min-width: 0; }
.dm-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; }
.dm-row-name {
  font-size: 13.5px; font-weight: 700; color: #fff;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: 'Syne', sans-serif; letter-spacing: -0.01em;
}
.dm-row-time { font-size: 10px; color: rgba(255,255,255,0.28); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.dm-row-preview {
  font-size: 12px; color: rgba(255,255,255,0.42);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;
}
.dm-row-listening { color: #1DB954; font-weight: 500; }

.dm-row-badge {
  flex-shrink: 0; min-width: 19px; height: 19px; padding: 0 5px;
  border-radius: 9999px; background: #1DB954;
  color: #000; font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(29,185,84,0.4);
}

.dm-list-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 24px; gap: 12px; text-align: center;
}
.dm-list-empty-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: rgba(255,255,255,0.25);
}
.dm-list-empty h3 {
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.55);
}
.dm-list-empty p { font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.5; max-width: 200px; }
`;