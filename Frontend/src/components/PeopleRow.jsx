import React, { memo, useMemo } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';

const FB_AVATAR = 'https://placehold.co/80x80/1a1a1a/333?text=%E2%99%AA';

const STYLES = `
  .pr-shelf { display: flex; gap: 10px; overflow-x: auto; padding: 0 28px 4px; -ms-overflow-style: none; scrollbar-width: none; }
  .pr-shelf::-webkit-scrollbar { display: none; }

  .pr-pill {
    flex-shrink: 0; display: flex; align-items: center; gap: 10px;
    padding: 6px 8px 6px 6px; border-radius: 9999px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
    cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.15s;
  }
  .pr-pill:hover { background: rgba(255,255,255,0.09); border-color: rgba(29,185,84,0.28); transform: translateY(-1px); }

  .pr-avatar {
    width: 38px; height: 38px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
    background: rgba(29,185,84,0.15); border: 1px solid rgba(255,255,255,0.1);
  }
  .pr-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .pr-name {
    font-size: 13px; font-weight: 600; color: #fff; max-width: 110px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-family: 'DM Sans', sans-serif;
  }

  .pr-follow-btn {
    flex-shrink: 0; display: flex; align-items: center; gap: 5px;
    padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700;
    font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.1s;
  }
  .pr-follow-btn.unfollowed { background: var(--lb-green, #1DB954); color: #000; }
  .pr-follow-btn.unfollowed:hover { background: var(--lb-green-bright, #23E065); }
  .pr-follow-btn.followed { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }
  .pr-follow-btn.followed:hover { background: rgba(255,80,80,0.12); color: #ff8888; }
  .pr-follow-btn:active { transform: scale(0.94); }

  .pr-shimmer-pill { flex-shrink: 0; width: 168px; height: 50px; border-radius: 9999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); }
`;

const PersonPill = memo(({ person, following, onOpen, onToggleFollow }) => {
  const name = person.display_name || 'Music Lover';
  return (
    <div className="pr-pill" onClick={() => onOpen(person)}>
      <div className="pr-avatar">
        <img src={person.avatar_url || FB_AVATAR} alt={name} onError={e => { e.target.src = FB_AVATAR; }} />
      </div>
      <span className="pr-name">{name}</span>
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
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="pr-shimmer-pill" />)}
        </div>
      ) : (
        <div className="pr-shelf">
          {people.map(person => (
            <PersonPill
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