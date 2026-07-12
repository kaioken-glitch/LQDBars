import React, { memo, useMemo } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { usePresence } from '../hooks/usePresence';

const FB_AVATAR = 'https://placehold.co/80x80/1a1a1a/333?text=%E2%99%AA';

const STYLES = `
  .pr-shelf { display: flex; gap: 12px; overflow-x: auto; padding: 2px 28px 8px; -ms-overflow-style: none; scrollbar-width: none; }
  .pr-shelf::-webkit-scrollbar { display: none; }

  /* ── Instagram-style suggested-account card ── */
  .pr-card {
    flex-shrink: 0; width: 132px; padding: 16px 12px 12px;
    display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    border-radius: 18px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.18s;
  }
  .pr-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(29,185,84,0.22); transform: translateY(-2px); }

  /* ── Avatar: same story-ring treatment as ProfileDetailView ── */
  .pr-avatar-wrap { position: relative; width: 62px; height: 62px; }
  .pr-avatar-ring {
    width: 100%; height: 100%; border-radius: 50%; padding: 2px;
    background: conic-gradient(from 180deg, #1DB954, #64FFB4, #0BAF3F, #23E065, #1DB954);
  }
  .pr-avatar-gap { width: 100%; height: 100%; border-radius: 50%; background: #07080A; padding: 2px; }
  .pr-avatar { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; }
  .pr-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pr-presence-dot {
    position: absolute; right: 1px; bottom: 1px; width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid #07080A;
  }
  .pr-presence-dot.online { background: #1DB954; }
  .pr-presence-dot.offline { background: rgba(255,255,255,.2); }

  .pr-name {
    font-size: 12.5px; font-weight: 700; color: #fff; width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-family: 'DM Sans', sans-serif;
  }
  .pr-sub {
    font-size: 10.5px; color: rgba(255,255,255,0.4); width: 100%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pr-sub.listening { color: rgba(29,185,84,0.85); display: flex; align-items: center; justify-content: center; gap: 4px; }

  .pr-wave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 8px; flex-shrink: 0; }
  .pr-wave span { width: 1.5px; border-radius: 1px; background: #1DB954; display: block; }
  .pr-wave span:nth-child(1) { animation: prw1 .8s ease-in-out infinite; }
  .pr-wave span:nth-child(2) { animation: prw2 .8s ease-in-out infinite .1s; }
  .pr-wave span:nth-child(3) { animation: prw3 .8s ease-in-out infinite .2s; }
  @keyframes prw1 { 0%,100%{height:2px} 50%{height:7px} }
  @keyframes prw2 { 0%,100%{height:5px} 50%{height:2px} }
  @keyframes prw3 { 0%,100%{height:3px} 50%{height:8px} }

  .pr-follow-btn {
    width: 100%; margin-top: 2px;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    padding: 7px 0; border-radius: 9999px; font-size: 12px; font-weight: 700;
    font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.1s;
  }
  .pr-follow-btn.unfollowed { background: var(--lb-green, #1DB954); color: #000; }
  .pr-follow-btn.unfollowed:hover { background: var(--lb-green-bright, #23E065); }
  .pr-follow-btn.followed { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }
  .pr-follow-btn.followed:hover { background: rgba(255,80,80,0.12); color: #ff8888; }
  .pr-follow-btn:active { transform: scale(0.94); }

  .pr-shimmer-card { flex-shrink: 0; width: 132px; height: 148px; border-radius: 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); }
`;

const PersonCard = memo(({ person, following, onOpen, onToggleFollow }) => {
  const name = person.display_name || 'Music Lover';
  const presence = usePresence(person.id);

  return (
    <div className="pr-card" onClick={() => onOpen(person)}>
      <div className="pr-avatar-wrap">
        <div className="pr-avatar-ring">
          <div className="pr-avatar-gap">
            <div className="pr-avatar">
              <img src={person.avatar_url || FB_AVATAR} alt={name} onError={e => { e.target.src = FB_AVATAR; }} />
            </div>
          </div>
        </div>
        <span className={`pr-presence-dot ${presence.online ? 'online' : 'offline'}`} />
      </div>

      <span className="pr-name">{name}</span>

      {presence.song ? (
        <span className="pr-sub listening">
          <span className="pr-wave"><span /><span /><span /></span>
          {presence.song.name}
        </span>
      ) : (
        <span className="pr-sub">Suggested for you</span>
      )}

      <button
        className={`pr-follow-btn ${following ? 'followed' : 'unfollowed'}`}
        onClick={e => { e.stopPropagation(); onToggleFollow(person.id); }}
      >
        {following ? <><FaCheck style={{ fontSize: 9 }} /> Following</> : 'Follow'}
      </button>
    </div>
  );
});

export default function PeopleRow({ people, loading, isFollowing, onToggleFollow, onOpenProfile, onDismiss, onToggleVisibility, visible, disabledUntil }) {
  const cooldownLabel = useMemo(() => {
    if (!disabledUntil) return '';
    const diff = Math.max(0, Math.ceil((disabledUntil - Date.now()) / (1000 * 60 * 60 * 24)));
    return diff > 0 ? `Hidden for ${diff} day${diff === 1 ? '' : 's'}` : 'Reappearing soon';
  }, [disabledUntil]);

  if (!loading && (!people || people.length === 0)) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      <style>{STYLES}</style>
      <div className="ho-section-head">
        <div className="ho-section-title">
          <span className="ho-section-dot" />
          <h2>Suggested Profiles</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onToggleVisibility}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 10px' }}
          >
            {visible ? 'Hide for 4 days' : 'Show suggestions'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss suggestions"
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <FaTimes size={12} />
          </button>
        </div>
      </div>
      {cooldownLabel && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '-8px 0 10px 28px' }}>{cooldownLabel}</div>
      )}

      {loading ? (
        <div className="pr-shelf">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="pr-shimmer-card" />)}
        </div>
      ) : (
        <div className="pr-shelf">
          {people.map(person => (
            <PersonCard
              key={person.id}
              person={person}
              following={isFollowing(person.id)}
              onOpen={onOpenProfile}
              onToggleFollow={onToggleFollow}
            />
          ))}
        </div>
      )}
    </section>
  );
}