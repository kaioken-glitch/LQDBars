import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faListUl, faCompactDisc } from '@fortawesome/free-solid-svg-icons';
import { FaPlay } from 'react-icons/fa';
import { supabase } from '../lib/supabase';

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

  .pdv-hero { position: relative; z-index: 10; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 32px 24px 24px; text-align: center; }
  .pdv-avatar-wrap { position: relative; width: 110px; height: 110px; }
  .pdv-avatar-glow { position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(circle, rgba(29,185,84,.32) 0%, transparent 70%); filter: blur(16px); }
  .pdv-avatar { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; border: 3px solid rgba(255,255,255,.1); box-shadow: 0 20px 50px rgba(0,0,0,.6); }
  .pdv-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pdv-name { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; letter-spacing: -.03em; color: #fff; }
  .pdv-bio { font-size: 13px; color: rgba(255,255,255,.45); max-width: 360px; line-height: 1.6; }

  .pdv-stats { display: flex; align-items: center; gap: 28px; margin-top: 4px; }
  .pdv-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .pdv-stat-n { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; color: #fff; }
  .pdv-stat-l { font-size: 11px; color: rgba(255,255,255,.35); text-transform: uppercase; letter-spacing: .08em; }

  .pdv-follow-btn { margin-top: 6px; padding: 10px 28px; border-radius: 9999px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; border: none; cursor: pointer; transition: background .15s, transform .15s, color .15s; }
  .pdv-follow-btn.unfollowed { background: #1DB954; color: #000; box-shadow: 0 4px 18px rgba(29,185,84,.4); }
  .pdv-follow-btn.unfollowed:hover { background: #23E065; transform: translateY(-1px); }
  .pdv-follow-btn.followed { background: rgba(255,255,255,.08); color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.16); }
  .pdv-follow-btn.followed:hover { background: rgba(255,80,80,.12); color: #ff8888; }

  .pdv-divider { position: relative; z-index: 10; height: 1px; background: rgba(255,255,255,.07); margin: 0 24px; flex-shrink: 0; }
  .pdv-content { position: relative; z-index: 10; flex: 1; overflow-y: auto; padding: 20px 24px 48px; }
  .pdv-section-label { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.35); margin-bottom: 14px; }

  .pdv-pl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 16px; }
  .pdv-pl-card { position: relative; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden; cursor: pointer; transition: transform .2s, border-color .2s; }
  .pdv-pl-card:hover { transform: translateY(-4px); border-color: rgba(29,185,84,.28); }
  .pdv-pl-art { position: relative; width: 100%; padding-top: 100%; background: rgba(29,185,84,.1); }
  .pdv-pl-art-mosaic { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }
  .pdv-pl-art-single { position: absolute; inset: 0; overflow: hidden; }
  .pdv-pl-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pdv-pl-art-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 28px; color: rgba(29,185,84,.3); }
  .pdv-pl-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 55%); opacity: 0; transition: opacity .2s; display: flex; align-items: center; justify-content: center; }
  .pdv-pl-card:hover .pdv-pl-overlay { opacity: 1; }
  .pdv-pl-play { width: 40px; height: 40px; border-radius: 50%; background: #1DB954; color: #000; display: flex; align-items: center; justify-content: center; }
  .pdv-pl-info { padding: 10px 12px 12px; }
  .pdv-pl-name { font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pdv-pl-count { font-size: 11px; color: rgba(255,255,255,.32); margin-top: 2px; }

  .pdv-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; color: rgba(255,255,255,.3); text-align: center; }
`;

export default function ProfileDetailView({ profileId, isFollowing, onToggleFollow, getCounts, onClose, onPlayPlaylist }) {
  const [profile, setProfile]     = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [counts, setCounts]       = useState({ followers: 0, following: 0 });
  const [loading, setLoading]     = useState(true);

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
          <div className="pdv-avatar">
            <img src={profile?.avatar_url || FB_AVATAR} alt={name} onError={e => { e.target.src = FB_AVATAR; }} />
          </div>
        </div>
        <h1 className="pdv-name">{name}</h1>
        {profile?.bio && <p className="pdv-bio">{profile.bio}</p>}

        <div className="pdv-stats">
          <div className="pdv-stat"><span className="pdv-stat-n">{playlists.length}</span><span className="pdv-stat-l">Playlists</span></div>
          <div className="pdv-stat"><span className="pdv-stat-n">{counts.followers}</span><span className="pdv-stat-l">Followers</span></div>
          <div className="pdv-stat"><span className="pdv-stat-n">{counts.following}</span><span className="pdv-stat-l">Following</span></div>
        </div>

        {onToggleFollow && (
          <button className={`pdv-follow-btn ${following ? 'followed' : 'unfollowed'}`} onClick={() => onToggleFollow(profileId)}>
            {following ? 'Following' : 'Follow'}
          </button>
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
                  <div className="pdv-pl-art">
                    {covers.length === 0 ? (
                      <div className="pdv-pl-art-empty"><FontAwesomeIcon icon={faListUl} /></div>
                    ) : covers.length === 1 ? (
                      <div className="pdv-pl-art-single"><img src={covers[0]} alt={pl.name} onError={e => { e.target.src = FB_COVER; }} /></div>
                    ) : (
                      <div className="pdv-pl-art-mosaic">
                        {covers.map((c, i) => <img key={i} src={c} alt="" onError={e => { e.target.src = FB_COVER; }} />)}
                      </div>
                    )}
                    <div className="pdv-pl-overlay">
                      <button className="pdv-pl-play" onClick={e => { e.stopPropagation(); onPlayPlaylist?.(pl.songs); }}>
                        <FaPlay style={{ marginLeft: 2, fontSize: 13 }} />
                      </button>
                    </div>
                  </div>
                  <div className="pdv-pl-info">
                    <div className="pdv-pl-name">{pl.name}</div>
                    <div className="pdv-pl-count">{(pl.songs || []).length} songs</div>
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