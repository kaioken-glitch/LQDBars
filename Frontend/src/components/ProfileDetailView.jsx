import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faListUl, faCompactDisc } from '@fortawesome/free-solid-svg-icons';
import { FaPlay, FaPaperPlane } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../hooks/usePresence';
import { openDirectMessage } from '../hooks/dmNavigationStore';

const FB_AVATAR = 'https://placehold.co/200x200/1a1a1a/333?text=%E2%99%AA';
const FB_COVER  = 'https://placehold.co/200x200/061408/112208?text=%E2%99%AA';

const STYLES = `
  .pdv-overlay { position: fixed; inset: 0; z-index: 62; display: flex; flex-direction: column; overflow: hidden; background: #07080A; }
  .pdv-bg { position: absolute; inset: -60px; z-index: 0; pointer-events: none; filter: blur(70px) saturate(1.4) brightness(0.32); background-size: cover; background-position: center; transform: scale(1.15); }
  .pdv-scrim { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(5,7,9,.4) 0%, rgba(5,7,9,.7) 50%, #07080A 100%); }
  .pdv-nav { position: relative; z-index: 10; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 14px 22px; background: rgba(0,0,0,.2); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,.06); }
  .pdv-nav-btn { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s; }
  .pdv-nav-btn:hover { background: rgba(255,255,255,.15); }
  .pdv-nav-title { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.4); }

  .pdv-hero { position: relative; z-index: 10; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 30px 24px 22px; text-align: center; }

  /* ── Avatar: gradient "story ring" + gap + live presence dot ── */
  .pdv-avatar-glow { position: absolute; inset: -18px; border-radius: 50%; background: radial-gradient(circle, rgba(29,185,84,.34) 0%, transparent 70%); filter: blur(18px); pointer-events: none; }
  .pdv-avatar-wrap { position: relative; width: 120px; height: 120px; }
  .pdv-avatar-ring {
    position: relative; width: 100%; height: 100%; border-radius: 50%; padding: 3px;
    background: conic-gradient(from 180deg, #1DB954, #64FFB4, #0BAF3F, #23E065, #1DB954);
  }
  .pdv-avatar-gap { width: 100%; height: 100%; border-radius: 50%; background: #07080A; padding: 3px; }
  .pdv-avatar { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,.6); }
  .pdv-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pdv-presence-dot {
    position: absolute; right: 4px; bottom: 4px; width: 20px; height: 20px; border-radius: 50%;
    border: 3px solid #07080A; z-index: 2;
  }
  .pdv-presence-dot.online { background: #1DB954; box-shadow: 0 0 10px rgba(29,185,84,.6); }
  .pdv-presence-dot.offline { background: rgba(255,255,255,.2); }

  .pdv-name { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; letter-spacing: -.03em; color: #fff; }
  .pdv-bio { font-size: 13px; color: rgba(255,255,255,.45); max-width: 360px; line-height: 1.6; }

  /* ── Now-listening pill ── */
  .pdv-listening {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 14px; border-radius: 9999px;
    background: rgba(29,185,84,.10); border: 1px solid rgba(29,185,84,.24);
    font-size: 12px; color: rgba(255,255,255,.75); max-width: 340px;
  }
  .pdv-listening strong { color: #fff; font-weight: 700; }
  .pdv-listening-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pdv-wave { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 10px; flex-shrink: 0; }
  .pdv-wave span { width: 2px; border-radius: 1px; background: #1DB954; display: block; }
  .pdv-wave span:nth-child(1) { animation: pdvw1 .8s ease-in-out infinite; }
  .pdv-wave span:nth-child(2) { animation: pdvw2 .8s ease-in-out infinite .1s; }
  .pdv-wave span:nth-child(3) { animation: pdvw3 .8s ease-in-out infinite .2s; }
  @keyframes pdvw1 { 0%,100%{height:3px} 50%{height:9px} }
  @keyframes pdvw2 { 0%,100%{height:7px} 50%{height:3px} }
  @keyframes pdvw3 { 0%,100%{height:4px} 50%{height:10px} }

  /* ── Stats: IG-style hairline-divided row ── */
  .pdv-stats { display: flex; align-items: stretch; margin-top: 2px; }
  .pdv-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 22px; }
  .pdv-stat + .pdv-stat { border-left: 1px solid rgba(255,255,255,.09); }
  .pdv-stat-n { font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; color: #fff; }
  .pdv-stat-l { font-size: 10.5px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .09em; }

  /* ── Actions: Follow + Message ── */
  .pdv-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; width: 100%; max-width: 300px; }
  .pdv-follow-btn, .pdv-message-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px 20px; border-radius: 9999px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
    border: none; cursor: pointer; transition: background .15s, transform .15s, color .15s, border-color .15s;
  }
  .pdv-follow-btn.unfollowed { background: #1DB954; color: #000; box-shadow: 0 4px 18px rgba(29,185,84,.4); }
  .pdv-follow-btn.unfollowed:hover { background: #23E065; transform: translateY(-1px); }
  .pdv-follow-btn.followed { background: rgba(255,255,255,.08); color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.16); }
  .pdv-follow-btn.followed:hover { background: rgba(255,80,80,.12); color: #ff8888; }
  .pdv-message-btn { background: rgba(255,255,255,.08); color: #fff; border: 1px solid rgba(255,255,255,.16); }
  .pdv-message-btn:hover { background: rgba(255,255,255,.15); transform: translateY(-1px); }
  .pdv-message-btn:active, .pdv-follow-btn:active { transform: scale(.96); }

  .pdv-divider { position: relative; z-index: 10; height: 1px; background: rgba(255,255,255,.07); margin: 22px 24px 0; flex-shrink: 0; }
  .pdv-content { position: relative; z-index: 10; flex: 1; overflow-y: auto; padding: 18px 0 48px; }
  .pdv-section-label { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.35); margin: 0 24px 14px; }

  /* ── Edge-to-edge Instagram-grid playlist tiles ── */
  .pdv-pl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
  .pdv-pl-card { position: relative; aspect-ratio: 1; overflow: hidden; cursor: pointer; background: #111214; }
  .pdv-pl-art-mosaic { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
  .pdv-pl-art-single { position: absolute; inset: 0; }
  .pdv-pl-art-single img, .pdv-pl-art-mosaic img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s ease; }
  .pdv-pl-card:hover .pdv-pl-art-single img, .pdv-pl-card:hover .pdv-pl-art-mosaic img { transform: scale(1.06); }
  .pdv-pl-art-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 26px; color: rgba(29,185,84,.3); background: rgba(29,185,84,.06); }

  .pdv-pl-type-badge {
    position: absolute; top: 6px; right: 6px; z-index: 2;
    width: 20px; height: 20px; border-radius: 5px; background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.85); font-size: 10px;
  }
  .pdv-pl-count-chip {
    position: absolute; left: 6px; bottom: 6px; z-index: 2;
    padding: 2px 7px; border-radius: 6px; background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
    font-size: 10px; font-weight: 700; color: #fff;
  }
  .pdv-pl-overlay {
    position: absolute; inset: 0; z-index: 1;
    background: linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.15) 45%, transparent 70%);
    opacity: 0; transition: opacity .2s;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  }
  .pdv-pl-card:hover .pdv-pl-overlay { opacity: 1; }
  .pdv-pl-play { width: 38px; height: 38px; border-radius: 50%; background: #1DB954; color: #000; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(29,185,84,.5); }
  .pdv-pl-hover-name { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; color: #fff; text-align: center; padding: 0 10px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .pdv-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; color: rgba(255,255,255,.3); text-align: center; }
`;

export default function ProfileDetailView({ profileId, isFollowing, onToggleFollow, getCounts, onClose, onPlayPlaylist }) {
  const [profile, setProfile]     = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [counts, setCounts]       = useState({ followers: 0, following: 0 });
  const [loading, setLoading]     = useState(true);

  const { user: currentUser } = useAuth();
  const presence = usePresence(profileId);
  const isSelf = currentUser?.id === profileId;

  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const [{ data: profileData }, { data: plData }, countsData] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', profileId).single(),
          supabase.from('playlists').select('*, playlist_songs(*)').eq('user_id', profileId).order('created_at', { ascending: false }),
          getCounts ? getCounts(profileId) : Promise.resolve({ followers: 0, following: 0 }),
        ]);
        if (!active) return;
        if (profileData) setProfile(profileData);
        setPlaylists(
          (plData || []).map(pl => ({
            id: pl.id,
            name: pl.name,
            songs: (pl.playlist_songs || [])
              .sort((a, b) => a.position - b.position)
              .map(s => ({
                id: `yt_${s.youtube_id}`,
                name: s.name,
                artist: s.artist,
                cover: s.cover,
                youtubeId: s.youtube_id,
                source: 'youtube',
                audio: `https://www.youtube.com/watch?v=${s.youtube_id}`,
              })),
          }))
        );
        setCounts(countsData);
      } catch (e) {
        console.warn('[ProfileDetailView] load failed:', e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [profileId]); // eslint-disable-line

  const name = profile?.display_name || 'Music Lover';
  const following = isFollowing?.(profileId);
  const bgCover = playlists.find(p => p.songs?.[0]?.cover)?.songs?.[0]?.cover || profile?.avatar_url;

  const handleMessage = () => {
    openDirectMessage(profileId);
    onClose?.();
  };

  return (
    <div className="pdv-overlay">
      <style>{STYLES}</style>
      <div className="pdv-bg" style={{ backgroundImage: bgCover ? `url(${bgCover})` : 'none', backgroundColor: '#0d1a12' }} />
      <div className="pdv-scrim" />

      <div className="pdv-nav">
        <button className="pdv-nav-btn" onClick={onClose}>
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} />
        </button>
        <span className="pdv-nav-title">Profile</span>
        <div style={{ width: 38 }} />
      </div>

      <div className="pdv-hero">
        <div className="pdv-avatar-wrap">
          <div className="pdv-avatar-glow" />
          <div className="pdv-avatar-ring">
            <div className="pdv-avatar-gap">
              <div className="pdv-avatar">
                <img src={profile?.avatar_url || FB_AVATAR} alt={name} onError={e => { e.target.src = FB_AVATAR; }} />
              </div>
            </div>
          </div>
          <span className={`pdv-presence-dot ${presence.online ? 'online' : 'offline'}`} />
        </div>

        <h1 className="pdv-name">{name}</h1>
        {profile?.bio && <p className="pdv-bio">{profile.bio}</p>}

        {presence.song && (
          <div className="pdv-listening">
            <span className="pdv-wave"><span /><span /><span /></span>
            <span className="pdv-listening-text">
              Listening to <strong>{presence.song.name}</strong> — {presence.song.artist}
            </span>
          </div>
        )}

        <div className="pdv-stats">
          <div className="pdv-stat"><span className="pdv-stat-n">{playlists.length}</span><span className="pdv-stat-l">Playlists</span></div>
          <div className="pdv-stat"><span className="pdv-stat-n">{counts.followers}</span><span className="pdv-stat-l">Followers</span></div>
          <div className="pdv-stat"><span className="pdv-stat-n">{counts.following}</span><span className="pdv-stat-l">Following</span></div>
        </div>

        {!isSelf && (
          <div className="pdv-actions">
            {onToggleFollow && (
              <button className={`pdv-follow-btn ${following ? 'followed' : 'unfollowed'}`} onClick={() => onToggleFollow(profileId)}>
                {following ? 'Following' : 'Follow'}
              </button>
            )}
            <button className="pdv-message-btn" onClick={handleMessage}>
              <FaPaperPlane style={{ fontSize: 11 }} /> Message
            </button>
          </div>
        )}
      </div>

      <div className="pdv-divider" />

      <div className="pdv-content">
        <p className="pdv-section-label">Playlists · {playlists.length}</p>
        {loading ? (
          <div className="pdv-empty">Loading playlists…</div>
        ) : playlists.length === 0 ? (
          <div className="pdv-empty">
            <FontAwesomeIcon icon={faCompactDisc} style={{ fontSize: 30 }} />
            <p>No public playlists yet</p>
          </div>
        ) : (
          <div className="pdv-pl-grid">
            {playlists.map(pl => {
              const covers = (pl.songs || []).slice(0, 4).map(s => s.cover || FB_COVER);
              return (
                <div key={pl.id} className="pdv-pl-card" onClick={() => onPlayPlaylist?.(pl.songs)}>
                  {covers.length === 0 ? (
                    <div className="pdv-pl-art-empty"><FontAwesomeIcon icon={faListUl} /></div>
                  ) : covers.length === 1 ? (
                    <div className="pdv-pl-art-single"><img src={covers[0]} alt={pl.name} onError={e => { e.target.src = FB_COVER; }} /></div>
                  ) : (
                    <div className="pdv-pl-art-mosaic">
                      {covers.map((c, i) => <img key={i} src={c} alt="" onError={e => { e.target.src = FB_COVER; }} />)}
                    </div>
                  )}

                  <span className="pdv-pl-type-badge"><FontAwesomeIcon icon={faListUl} /></span>
                  <span className="pdv-pl-count-chip">{(pl.songs || []).length}</span>

                  <div className="pdv-pl-overlay">
                    <button
                      className="pdv-pl-play"
                      onClick={e => { e.stopPropagation(); onPlayPlaylist?.(pl.songs); }}
                      aria-label={`Play ${pl.name}`}
                    >
                      <FaPlay style={{ marginLeft: 2, fontSize: 13 }} />
                    </button>
                    <span className="pdv-pl-hover-name">{pl.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}