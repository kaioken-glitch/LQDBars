// src/components/chat/ConversationList.jsx
import React, { useEffect, useState, useMemo, memo } from 'react';
import { FaComments, FaSearch, FaMusic } from 'react-icons/fa';
import { supabase } from '../../lib/supabase';
import { usePresence, usePresenceMap } from '../../hooks/usePresence';

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

/* ── Online stories row — quick glanceable "who's around right now" ── */
const OnlineStory = memo(({ conv, profile, onSelect }) => {
  const presence = usePresence(conv.otherId);
  if (!presence.online) return null;
  const name = profile?.display_name || profile?.username || 'Unknown';

  return (
    <button className="dm-story" onClick={() => onSelect(conv)} title={name}>
      <span className="dm-story-ring">
        <img
          src={profile?.avatar_url || FALLBACK}
          alt=""
          className="dm-story-avatar"
          onError={e => { e.target.src = FALLBACK; }}
        />
        {presence.song && <span className="dm-story-note"><FaMusic /></span>}
      </span>
      <span className="dm-story-name">{name.split(' ')[0]}</span>
    </button>
  );
});

const ConversationRow = memo(({ conv, profile, active, onSelect }) => {
  const presence = usePresence(conv.otherId);
  const name = profile?.display_name || profile?.username || 'Unknown';

  return (
    <button className={`dm-row${active ? ' active' : ''}`} onClick={() => onSelect(conv)}>
      <div className="dm-row-avatar-wrap">
        <span className={`dm-row-avatar-ring${presence.online ? ' online' : ''}`}>
          <img
            src={profile?.avatar_url || FALLBACK}
            alt=""
            className="dm-row-avatar"
            onError={e => { e.target.src = FALLBACK; }}
          />
        </span>
        <span className={`dm-row-dot ${presence.online ? 'online' : 'offline'}`} />
      </div>
      <div className="dm-row-meta">
        <div className="dm-row-top">
          <span className="dm-row-name">{name}</span>
          <span className="dm-row-time">{fmtPreviewTime(conv.lastMessageAt)}</span>
        </div>
        <div className="dm-row-preview">
          {presence.song ? (
            <span className="dm-row-listening">
              <span className="dm-row-wave"><span /><span /><span /></span>
              {presence.song.name}
            </span>
          ) : (
            conv.lastMessage?.body || 'Say hi 👋'
          )}
        </div>
      </div>
      {conv.unreadCount > 0 && <span className="dm-row-badge">{conv.unreadCount}</span>}
    </button>
  );
});

export default function ConversationList({ conversations, activeId, onSelect }) {
  const [query, setQuery] = useState('');
  const profiles = useProfilesByIds(conversations.map(c => c.otherId));
  const presenceMap = usePresenceMap();

  const onlineCount = useMemo(
    () => conversations.filter(c => presenceMap[c.otherId]?.online).length,
    [conversations, presenceMap]
  );

  const filtered = query.trim()
    ? conversations.filter(c => {
        const p = profiles[c.otherId];
        const name = (p?.display_name || p?.username || '').toLowerCase();
        return name.includes(query.toLowerCase());
      })
    : conversations;

  const onlineConvs = conversations.filter(c => presenceMap[c.otherId]?.online);

  return (
    <div className="dm-list">
      <style>{CSS}</style>

      <div className="dm-list-header">
        <div className="dm-list-eyebrow">
          <span className="dm-list-eyebrow-dot" />
          Direct Messages
          {onlineCount > 0 && <span className="dm-list-online-count">{onlineCount} online</span>}
        </div>
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

      {onlineConvs.length > 0 && !query.trim() && (
        <div className="dm-stories-row">
          {onlineConvs.map(conv => (
            <OnlineStory
              key={conv.id}
              conv={conv}
              profile={profiles[conv.otherId]}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      <div className="dm-list-body">
        {conversations.length === 0 ? (
          <div className="dm-list-empty">
            <div className="dm-list-empty-glow" />
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
          filtered.map((conv, i) => (
            <div key={conv.id} className="dm-row-fadeup" style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}>
              <ConversationRow
                conv={conv}
                profile={profiles[conv.otherId]}
                active={conv.id === activeId}
                onSelect={onSelect}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const CSS = `
.dm-list {
  display: flex; flex-direction: column;
  width: 320px; flex-shrink: 0;
  height: 100%;
  border-right: 1px solid rgba(255,255,255,0.07);
  background:
    radial-gradient(ellipse 60% 30% at 0% 0%, rgba(29,185,84,0.09) 0%, transparent 60%),
    linear-gradient(180deg, rgba(29,185,84,0.05) 0%, transparent 160px),
    var(--lb-bg-base, #07080A);
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
.dm-list-eyebrow-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #1DB954; flex-shrink: 0;
  box-shadow: 0 0 6px rgba(29,185,84,0.8);
  animation: dmDotPulse 2s ease-in-out infinite;
}
@keyframes dmDotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
.dm-list-online-count {
  margin-left: auto; font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
  color: rgba(255,255,255,0.35); text-transform: none;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  padding: 2px 8px; border-radius: 9999px;
}
.dm-list-title {
  font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800;
  letter-spacing: -0.045em;
  background: linear-gradient(135deg, #fff 45%, #23E065 130%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  margin-bottom: 14px;
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

/* ── Online stories row ── */
.dm-stories-row {
  flex-shrink: 0; display: flex; gap: 14px; overflow-x: auto;
  padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
  scrollbar-width: none;
}
.dm-stories-row::-webkit-scrollbar { display: none; }
.dm-story {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer; width: 54px;
  animation: dmStoryIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes dmStoryIn { from { opacity:0; transform: scale(0.85); } to { opacity:1; transform: scale(1); } }
.dm-story-ring {
  position: relative; width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: conic-gradient(from 180deg, #1DB954, #23E065, #0d5c28, #1DB954);
  padding: 2.5px;
  transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
}
.dm-story:hover .dm-story-ring { transform: scale(1.08); }
.dm-story-avatar {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;
  border: 2px solid #07080A;
}
.dm-story-note {
  position: absolute; bottom: -2px; right: -2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #1DB954; color: #05130a;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; border: 2px solid #07080A;
  box-shadow: 0 0 8px rgba(29,185,84,0.6);
}
.dm-story-name {
  font-size: 10.5px; color: rgba(255,255,255,0.5); font-weight: 600;
  max-width: 54px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.dm-list-body { flex: 1; overflow-y: auto; padding: 8px 10px 16px; }

@keyframes dmRowIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
.dm-row-fadeup { animation: dmRowIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }

.dm-row {
  width: 100%; display: flex; align-items: center; gap: 11px;
  padding: 10px; margin-bottom: 2px; border-radius: 16px;
  background: none; border: 1px solid transparent; cursor: pointer; text-align: left;
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
  position: relative;
}
.dm-row:hover { background: rgba(255,255,255,0.05); transform: translateX(2px); }
.dm-row.active {
  background: linear-gradient(90deg, rgba(29,185,84,0.14), rgba(29,185,84,0.05));
  border-color: rgba(29,185,84,0.2);
}
.dm-row.active::before {
  content: '';
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 60%; border-radius: 0 3px 3px 0;
  background: linear-gradient(to bottom, #23E065, #1DB954);
  box-shadow: 0 0 10px rgba(29,185,84,0.5);
}

.dm-row-avatar-wrap { position: relative; flex-shrink: 0; }
.dm-row-avatar-ring {
  display: flex; width: 46px; height: 46px; border-radius: 50%;
  padding: 2px; transition: background 0.2s;
}
.dm-row-avatar-ring.online {
  background: linear-gradient(135deg, #23E065, #1DB954);
}
.dm-row-avatar {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;
  border: 2px solid #07080A;
}
.dm-row-dot {
  position: absolute; right: -1px; bottom: -1px;
  width: 12px; height: 12px; border-radius: 50%;
  border: 2.5px solid #07080A;
}
.dm-row-dot.online  { background: #1DB954; box-shadow: 0 0 6px rgba(29,185,84,0.8); }
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
.dm-row-listening { color: #1DB954; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
.dm-row-wave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 9px; flex-shrink: 0; }
.dm-row-wave span { width: 2px; border-radius: 1px; background: #1DB954; display: block; }
.dm-row-wave span:nth-child(1) { animation: dmw1 0.8s ease-in-out infinite; }
.dm-row-wave span:nth-child(2) { animation: dmw2 0.8s ease-in-out infinite 0.1s; }
.dm-row-wave span:nth-child(3) { animation: dmw3 0.8s ease-in-out infinite 0.2s; }
@keyframes dmw1 { 0%,100%{height:3px} 50%{height:9px} }
@keyframes dmw2 { 0%,100%{height:7px} 50%{height:3px} }
@keyframes dmw3 { 0%,100%{height:4px} 50%{height:10px} }

.dm-row-badge {
  flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 5px;
  border-radius: 9999px; background: linear-gradient(135deg, #23E065, #1DB954);
  color: #05130a; font-size: 10.5px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 10px rgba(29,185,84,0.5);
}

.dm-list-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 24px; gap: 12px; text-align: center; position: relative;
}
.dm-list-empty-glow {
  position: absolute; top: 30%; left: 50%; transform: translate(-50%,-50%);
  width: 220px; height: 220px; border-radius: 50%;
  background: radial-gradient(circle, rgba(29,185,84,0.10) 0%, transparent 70%);
  pointer-events: none;
}
.dm-list-empty-icon {
  position: relative; width: 56px; height: 56px; border-radius: 50%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; color: rgba(29,185,84,0.55);
}
.dm-list-empty h3 {
  position: relative;
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: rgba(255,255,255,0.55);
}
.dm-list-empty p {
  position: relative;
  font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.5; max-width: 200px;
}
`;