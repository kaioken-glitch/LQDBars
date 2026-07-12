// src/components/chat/Profilebanner.jsx
import React from 'react';
import { usePresence } from '../../hooks/usePresence';

const FALLBACK = 'https://placehold.co/88x88/0d1a12/1a2e20?text=?';

const CSS = `
.dm-banner {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px; flex-shrink: 0; position: relative;
  background: linear-gradient(180deg, rgba(29,185,84,0.06) 0%, var(--lb-bg-raised, #0E1012) 100%);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.dm-banner-back {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); cursor: pointer;
  color: rgba(255,255,255,0.6); font-size: 16px; width: 34px; height: 34px;
  border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.dm-banner-back:hover { background: rgba(255,255,255,0.1); color: #fff; }
.dm-banner-avatar-wrap { position: relative; flex-shrink: 0; }
.dm-banner-avatar {
  width: 46px; height: 46px; border-radius: 50%;
  object-fit: cover; display: block;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.dm-banner-dot {
  position: absolute; right: -1px; bottom: -1px;
  width: 13px; height: 13px; border-radius: 50%;
  border: 2.5px solid var(--lb-bg-raised, #0E1012);
}
.dm-banner-dot.online  { background: #1DB954; box-shadow: 0 0 8px rgba(29,185,84,0.7); }
.dm-banner-dot.offline { background: rgba(255,255,255,0.22); }
.dm-banner-meta { min-width: 0; flex: 1; }
.dm-banner-name {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 16px;
  color: #fff; letter-spacing: -0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-banner-status {
  font-size: 12.5px; color: rgba(255,255,255,0.42);
  margin-top: 3px; display: flex; align-items: center; gap: 7px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-banner-listening strong { color: #1DB954; font-weight: 700; }
.dm-wave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 10px; flex-shrink: 0; }
.dm-wave span { width: 2px; border-radius: 1px; background: #1DB954; display: block; }
.dm-wave span:nth-child(1) { animation: dmw1 0.8s ease-in-out infinite; }
.dm-wave span:nth-child(2) { animation: dmw2 0.8s ease-in-out infinite 0.1s; }
.dm-wave span:nth-child(3) { animation: dmw3 0.8s ease-in-out infinite 0.2s; }
@keyframes dmw1 { 0%,100%{height:3px} 50%{height:9px} }
@keyframes dmw2 { 0%,100%{height:7px} 50%{height:3px} }
@keyframes dmw3 { 0%,100%{height:4px} 50%{height:10px} }
`;

export default function ProfileBanner({ user, onBack }) {
  const presence = usePresence(user?.id);
  const song = presence.song;

  return (
    <div className="dm-banner">
      <style>{CSS}</style>
      {onBack && (
        <button className="dm-banner-back" onClick={onBack} aria-label="Back to conversations">‹</button>
      )}
      <div className="dm-banner-avatar-wrap">
        <img
          src={user?.avatar || FALLBACK}
          alt={user?.name || 'User'}
          className="dm-banner-avatar"
          onError={e => { e.target.src = FALLBACK; }}
        />
        <span className={`dm-banner-dot ${presence.online ? 'online' : 'offline'}`} />
      </div>
      <div className="dm-banner-meta">
        <div className="dm-banner-name">{user?.name || 'Unknown'}</div>
        <div className="dm-banner-status">
          {song ? (
            <span className="dm-banner-listening" style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
              <span className="dm-wave"><span /><span /><span /></span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Listening to <strong>{song.name}</strong> — {song.artist}
              </span>
            </span>
          ) : (
            presence.online ? 'Online' : 'Offline'
          )}
        </div>
      </div>
    </div>
  );
}