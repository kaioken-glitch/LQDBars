/**
 * MoodPlaylist.jsx
 *
 * Full-screen mood playlist generator UI.
 * Allows user to describe a vibe, generates songs via Claude, reveals playlist.
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { FaTimes, FaPlay, FaSpinner, FaSave, FaChevronLeft } from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../hooks/usePlaylists';
import { useMoodPlaylist } from '../hooks/useMoodPlaylist';
import { useToast } from '../components/Toast';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

.mp-root {
  --g:      #1DB954;
  --g2:     #23E065;
  --gdim:   rgba(29,185,84,0.14);
  --gglow:  rgba(29,185,84,0.28);
  --s1:     rgba(255,255,255,0.04);
  --s2:     rgba(255,255,255,0.07);
  --sh:     rgba(255,255,255,0.09);
  --b1:     rgba(255,255,255,0.07);
  --b2:     rgba(255,255,255,0.13);
  --t1:     #fff;
  --t2:     rgba(255,255,255,0.55);
  --t3:     rgba(255,255,255,0.28);
  --ease:   cubic-bezier(0.4,0,0.2,1);
  --spring: cubic-bezier(0.22,1,0.36,1);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--t1);
}

.mp-root *, .mp-root *::before, .mp-root *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.mp-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,20,10,0.9) 100%);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: mpFadeIn 0.3s var(--ease) both;
}

@keyframes mpFadeIn { from { opacity: 0; } to { opacity: 1; } }

.mp-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b1);
  background: rgba(0,0,0,0.4);
}

.mp-title {
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--t1);
}

.mp-close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--s1);
  border: 1px solid var(--b1);
  color: var(--t2);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}

.mp-close-btn:hover {
  background: var(--sh);
  color: var(--t1);
}

.mp-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Mood Input Stage ── */
.mp-stage {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: mpScaleIn 0.3s var(--spring) both;
}

@keyframes mpScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

.mp-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--g);
}

.mp-textarea {
  width: 100%;
  min-height: 100px;
  padding: 14px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 12px;
  color: var(--t1);
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  outline: none;
  resize: none;
  transition: border-color 0.18s var(--ease), background 0.18s var(--ease);
}

.mp-textarea::placeholder {
  color: var(--t3);
}

.mp-textarea:focus {
  border-color: rgba(29,185,84,0.5);
  background: var(--s2);
  box-shadow: 0 0 0 3px rgba(29,185,84,0.1);
}

.mp-examples {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mp-example-btn {
  padding: 10px 14px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 9px;
  color: var(--t2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s var(--ease);
}

.mp-example-btn:hover {
  background: var(--s2);
  border-color: var(--g);
  color: var(--g);
}

.mp-generate-btn {
  padding: 13px 20px;
  background: var(--g);
  border: none;
  border-radius: 9999px;
  color: #000;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s var(--spring);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.mp-generate-btn:hover:not(:disabled) {
  background: var(--g2);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(29,185,84,0.4);
}

.mp-generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Loading Stage ── */
.mp-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  text-align: center;
  min-height: 300px;
  animation: mpScaleIn 0.3s var(--spring) both;
}

.mp-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--b1);
  border-top-color: var(--g);
  border-radius: 50%;
  animation: mpSpin 1s linear infinite;
}

@keyframes mpSpin { to { transform: rotate(360deg); } }

.mp-loading-text {
  font-size: 14px;
  color: var(--t2);
}

/* ── Error Stage ── */
.mp-error {
  padding: 16px;
  background: rgba(220,40,40,0.1);
  border: 1px solid rgba(220,40,40,0.3);
  border-radius: 12px;
  color: #ff6b6b;
  font-size: 13px;
  text-align: center;
  animation: mpScaleIn 0.3s var(--spring) both;
}

/* ── Playlist Reveal Stage ── */
.mp-playlist {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: mpScaleIn 0.3s var(--spring) both;
}

.mp-playlist-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mp-playlist-title {
  font-family: 'Syne', sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: var(--t1);
}

.mp-playlist-mood {
  font-size: 12px;
  color: var(--t3);
  font-style: italic;
}

.mp-playlist-actions {
  display: flex;
  gap: 10px;
}

.mp-playlist-save-btn {
  flex: 1;
  padding: 11px 16px;
  background: var(--g);
  border: none;
  border-radius: 9999px;
  color: #000;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s var(--spring);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.mp-playlist-save-btn:hover {
  background: var(--g2);
  transform: translateY(-1px);
}

.mp-songs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.07) transparent;
}

.mp-songs::-webkit-scrollbar {
  width: 4px;
}

.mp-songs::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.07);
  border-radius: 3px;
}

.mp-song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s var(--ease);
}

.mp-song-item:hover {
  background: var(--s2);
  border-color: var(--g);
}

.mp-song-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--gdim);
}

.mp-song-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mp-song-info {
  flex: 1;
  min-width: 0;
}

.mp-song-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.mp-song-artist {
  font-size: 11px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mp-song-play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--g);
  border: none;
  color: #000;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s var(--spring);
}

.mp-song-play-btn:hover {
  background: var(--g2);
  transform: scale(1.1);
}

.mp-song-item:nth-child(1) { animation-delay: 0.05s; }
.mp-song-item:nth-child(2) { animation-delay: 0.10s; }
.mp-song-item:nth-child(3) { animation-delay: 0.15s; }
.mp-song-item:nth-child(4) { animation-delay: 0.20s; }
.mp-song-item:nth-child(5) { animation-delay: 0.25s; }
.mp-song-item { animation: mpSlideIn 0.3s var(--spring) both; }

@keyframes mpSlideIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const MoodPlaylist = memo(({ onClose }) => {
  const { setPlayerSongs } = usePlayer();
  const { addPlaylist } = usePlaylists();
  const { generatePlaylist, songs, loading, error } = useMoodPlaylist();
  const { toast } = useToast();
  const [mood, setMood] = useState('');
  const [stage, setStage] = useState('input'); // 'input' | 'loading' | 'error' | 'playlist'
  const moodRef = useRef(mood);

  const exampleMoods = [
    'Chill summer vibes',
    'Workout energy',
    'Sad sad sad',
    'Late night focus',
  ];

  const handleGenerate = async () => {
    if (!mood.trim()) {
      toast({ type: 'error', message: 'Please enter a mood' });
      return;
    }
    moodRef.current = mood;
    setStage('loading');
    const result = await generatePlaylist(mood.trim(), 20);
    if (result) {
      setStage('playlist');
    } else {
      setStage('error');
    }
  };

  const handleExampleClick = (example) => {
    setMood(example);
  };

  const handlePlaySong = (song) => {
    if (!songs || songs.length === 0) return;
    const idx = songs.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      setPlayerSongs(songs, idx);
      toast({ type: 'success', message: `Playing: ${song.name}` });
    }
  };

  const handleSavePlaylist = async () => {
    if (!songs.length) return;
    const name = `${moodRef.current} Mix`;
    try {
      await addPlaylist(name, songs, 'mood');
      toast({ type: 'success', message: `Saved "${name}"!` });
      setMood('');
      setStage('input');
    } catch (err) {
      toast({ type: 'error', message: 'Failed to save playlist' });
    }
  };

  return (
    <div className="mp-root">
      <style>{CSS}</style>
      <div className="mp-overlay">
        {/* Header */}
        <div className="mp-header">
          <div className="mp-title">Today's Mix</div>
          <button className="mp-close-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="mp-content">
          {stage === 'input' && (
            <div className="mp-stage">
              <div>
                <div className="mp-label">Describe your vibe</div>
                <textarea
                  className="mp-textarea"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g. 'chill summer beach day' or 'high energy workout'"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) handleGenerate();
                  }}
                />
              </div>

              <div>
                <div className="mp-label">Try these vibes</div>
                <div className="mp-examples">
                  {exampleMoods.map((ex, i) => (
                    <button
                      key={i}
                      className="mp-example-btn"
                      onClick={() => handleExampleClick(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="mp-generate-btn"
                onClick={handleGenerate}
                disabled={!mood.trim()}
              >
                <FaSpinner style={{ animation: 'none' }} /> Generate Playlist
              </button>
            </div>
          )}

          {stage === 'loading' && (
            <div className="mp-loading">
              <div className="mp-spinner" />
              <div className="mp-loading-text">Generating your playlist...</div>
            </div>
          )}

          {stage === 'error' && (
            <div className="mp-error">{error || 'Failed to generate playlist'}</div>
          )}

          {stage === 'playlist' && songs.length > 0 && (
            <div className="mp-playlist">
              <div className="mp-playlist-header">
                <div className="mp-playlist-title">Your Mix is Ready</div>
                <div className="mp-playlist-mood">Based on: {moodRef.current}</div>
              </div>

              <div className="mp-playlist-actions">
                <button className="mp-playlist-save-btn" onClick={handleSavePlaylist}>
                  <FaSave style={{ fontSize: 12 }} /> Save Playlist
                </button>
              </div>

              <div className="mp-songs">
                {songs.map((song) => (
                  <div key={song.id} className="mp-song-item">
                    <div className="mp-song-thumb">
                      <img
                        src={song.cover || 'https://placehold.co/44x44/1DB954/ffffff?text=♪'}
                        alt={song.name}
                        onError={(e) => {
                          e.target.src = 'https://placehold.co/44x44/1DB954/ffffff?text=♪';
                        }}
                      />
                    </div>
                    <div className="mp-song-info">
                      <div className="mp-song-name">{song.name}</div>
                      <div className="mp-song-artist">{song.artist}</div>
                    </div>
                    <button
                      className="mp-song-play-btn"
                      onClick={() => handlePlaySong(song)}
                      aria-label={`Play ${song.name}`}
                    >
                      <FaPlay style={{ marginLeft: 2 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

MoodPlaylist.displayName = 'MoodPlaylist';

export default MoodPlaylist;
