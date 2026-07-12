// src/components/chat/ProfileBanner.jsx
import React from 'react';
import { usePresence } from '../../hooks/usePresence';

const FALLBACK = 'https://placehold.co/88x88/111214/333?text=?';

const CSS = `
.dm-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; flex-shrink: 0;
  background: var(--lb-bg-raised, #0E1012);
  border-bottom: 1px solid var(--lb-border-1, rgba(255,255,255,0.07));
}
.dm-banner-back {
  background: none; border: none; cursor: pointer;
  color: var(--lb-text-2, rgba(255,255,255,0.55));
  font-size: 20px; padding: 4px 6px; line-height: 1;
  border-radius: 8px; transition: background 0.15s, color 0.15s;
}
.dm-banner-back:hover { background: var(--lb-surface-1, rgba(255,255,255,0.04)); color: #fff; }
.dm-banner-avatar-wrap { position: relative; flex-shrink: 0; }
.dm-banner-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  object-fit: cover; display: block;
}
.dm-banner-dot {
  position: absolute; right: -1px; bottom: -1px;
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--lb-bg-raised, #0E1012);
}
.dm-banner-dot.online  { background: var(--lb-green, #1DB954); }
.dm-banner-dot.offline { background: rgba(255,255,255,0.22); }
.dm-banner-meta { min-width: 0; flex: 1; }
.dm-banner-name {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px;
  color: var(--lb-text-1, #fff); letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-banner-status {
  font-size: 12px; color: var(--lb-text-2, rgba(255,255,255,0.55));
  margin-top: 2px; display: flex; align-items: center; gap: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dm-banner-listening strong { color: var(--lb-text-1, #fff); font-weight: 600; }
.dm-wave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 10px; flex-shrink: 0; }
.dm-wave span { width: 2px; border-radius: 1px; background: var(--lb-green, #1DB954); display: block; }
.dm-wave span:nth-child(1) { animation: dmw1 0.8s ease-in-out infinite; }
.dm-wave span:nth-child(2) { animation: dmw2 0.8s ease-in-out infinite 0.1s; }
.dm-wave span:nth-child(3) { animation: dmw3 0.8s ease-in-out infinite 0.2s; }
@keyframes dmw1 { 0%,100%{height:3px} 50%{height:9px} }
@keyframes dmw2 { 0%,100%{height:7px} 50%{height:3px} }
@keyframes dmw3 { 0%,100%{height:4px} 50%{height:10px} }
`;

/**
 * @param {{ id, name, avatar }} user  the OTHER participant
 * @param {() => void} [onBack]         optional back button (mobile)
 */
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
            <span className="dm-banner-listening" style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
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