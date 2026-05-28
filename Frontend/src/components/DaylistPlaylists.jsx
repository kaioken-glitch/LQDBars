/**
 * DaylistPlaylists.jsx
 *
 * Spotify Daylist-inspired interface showing curated playlists for:
 * - Morning (5am-12pm)
 * - Noon (12pm-5pm)
 * - Evening (5pm-11pm)
 * - Lay Hour (volatile, once daily, 4-5am or 11pm-12am)
 *
 * Each slot can be customized with mood preferences and regenerated.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  FaTimes, FaPlay, FaSpinner, FaSave, FaRefresh, FaGear,
  FaSun, FaClock, FaMoon, FaFire,
} from 'react-icons/fa';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../hooks/usePlaylists';
import { useMoodPlaylist } from '../hooks/useMoodPlaylist';
import { useDaylistSchedule, useDaylistPreferences, useDaylistCache } from '../hooks/useDaylistSchedule';
import { useToast } from '../components/Toast';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');

.dl-root {
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

.dl-root *, .dl-root *::before, .dl-root *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.dl-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,20,10,0.9) 100%);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dlFadeIn 0.3s var(--ease) both;
}

@keyframes dlFadeIn { from { opacity: 0; } to { opacity: 1; } }

.dl-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b1);
  background: rgba(0,0,0,0.4);
}

.dl-title {
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--t1);
}

.dl-close-btn {
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

.dl-close-btn:hover {
  background: var(--sh);
  color: var(--t1);
}

.dl-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dl-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 640px) {
  .dl-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1024px) {
  .dl-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.dl-slot {
  display: flex;
  flex-direction: column;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.2s var(--ease);
  animation: dlSlideIn 0.4s var(--spring) both;
}

@keyframes dlSlideIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.dl-slot:nth-child(1) { animation-delay: 0.05s; }
.dl-slot:nth-child(2) { animation-delay: 0.10s; }
.dl-slot:nth-child(3) { animation-delay: 0.15s; }
.dl-slot:nth-child(4) { animation-delay: 0.20s; }

.dl-slot:hover {
  border-color: var(--g);
  box-shadow: 0 8px 24px rgba(29,185,84,0.1);
}

.dl-slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(29,185,84,0.08), transparent);
  border-bottom: 1px solid var(--b1);
}

.dl-slot-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dl-slot-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(29,185,84,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--g);
  flex-shrink: 0;
}

.dl-slot-icon.lay-hour {
  background: rgba(255,107,107,0.15);
  color: #ff6b6b;
}

.dl-slot-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--t1);
}

.dl-slot-status {
  font-size: 10px;
  color: var(--t3);
  font-weight: 500;
}

.dl-slot-refresh {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--b1);
  color: var(--t3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: all 0.15s var(--ease);
}

.dl-slot-refresh:hover {
  background: var(--s2);
  border-color: var(--g);
  color: var(--g);
}

.dl-slot-body {
  padding: 14px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dl-mood-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 9px;
  color: var(--t1);
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s var(--ease), background 0.15s var(--ease);
}

.dl-mood-input::placeholder {
  color: var(--t3);
}

.dl-mood-input:focus {
  border-color: rgba(29,185,84,0.5);
  background: var(--s2);
  box-shadow: 0 0 0 3px rgba(29,185,84,0.1);
}

.dl-songs {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.07) transparent;
}

.dl-songs::-webkit-scrollbar {
  width: 3px;
}

.dl-songs::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.07);
  border-radius: 2px;
}

.dl-song-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s var(--ease);
}

.dl-song-item:hover {
  background: var(--s2);
  border-color: var(--g);
}

.dl-song-thumb {
  width: 36px;
  height: 36px;
  border-radius: 5px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--gdim);
}

.dl-song-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dl-song-meta {
  flex: 1;
  min-width: 0;
}

.dl-song-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--t1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dl-song-artist {
  font-size: 10px;
  color: var(--t3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dl-song-play {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--g);
  border: none;
  color: #000;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s var(--spring);
}

.dl-song-play:hover {
  background: var(--g2);
  transform: scale(1.1);
}

.dl-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: var(--t2);
  font-size: 12px;
}

.dl-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--b1);
  border-top-color: var(--g);
  border-radius: 50%;
  animation: dlSpin 0.8s linear infinite;
}

@keyframes dlSpin { to { transform: rotate(360deg); } }

.dl-slot-actions {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--b1);
  background: rgba(0,0,0,0.1);
}

.dl-action-btn {
  flex: 1;
  padding: 8px 12px;
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 8px;
  color: var(--t2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s var(--ease);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.dl-action-btn:hover {
  background: var(--s2);
  border-color: var(--g);
  color: var(--g);
}

.dl-action-btn.generate {
  background: var(--g);
  color: #000;
  border-color: var(--g);
}

.dl-action-btn.generate:hover {
  background: var(--g2);
  border-color: var(--g2);
}

.dl-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

const SlotIcon = ({ slot }) => {
  const icons = {
    morning: <FaSun />,
    noon: <FaClock />,
    evening: <FaMoon />,
    lay_hour: <FaFire />,
  };
  return icons[slot] || icons.morning;
};

const SlotLabels = {
  morning: 'Morning Mix',
  noon: 'Noon Peak',
  evening: 'Evening Vibes',
  lay_hour: 'Lay Hour',
};

const Slot = memo(({ slot, songs, loading, mood, onMoodChange, onGenerate, onPlay, onSave }) => {
  return (
    <div className="dl-slot">
      <div className="dl-slot-header">
        <div className="dl-slot-title-wrap">
          <div className={`dl-slot-icon ${slot === 'lay_hour' ? 'lay-hour' : ''}`}>
            <SlotIcon slot={slot} />
          </div>
          <div>
            <div className="dl-slot-title">{SlotLabels[slot]}</div>
            <div className="dl-slot-status">
              {slot === 'lay_hour' ? 'Once daily' : 'Every day'}
            </div>
          </div>
        </div>
      </div>

      <div className="dl-slot-body">
        <input
          type="text"
          className="dl-mood-input"
          placeholder={`e.g. "chill" or "energetic"`}
          value={mood}
          onChange={(e) => onMoodChange(e.target.value)}
          maxLength={50}
        />

        {loading ? (
          <div className="dl-loading">
            <div className="dl-spinner" />
            Generating...
          </div>
        ) : songs?.length > 0 ? (
          <div className="dl-songs">
            {songs.map((song, i) => (
              <div key={i} className="dl-song-item">
                <div className="dl-song-thumb">
                  <img
                    src={song.cover || 'https://placehold.co/36x36/1DB954/ffffff?text=♪'}
                    alt={song.name}
                    onError={(e) => {
                      e.target.src = 'https://placehold.co/36x36/1DB954/ffffff?text=♪';
                    }}
                  />
                </div>
                <div className="dl-song-meta">
                  <div className="dl-song-name">{song.name}</div>
                  <div className="dl-song-artist">{song.artist}</div>
                </div>
                <button
                  className="dl-song-play"
                  onClick={() => onPlay(song)}
                  aria-label={`Play ${song.name}`}
                >
                  <FaPlay style={{ marginLeft: 1 }} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '12px', padding: '20px' }}>
            No songs yet. Set a mood and generate.
          </div>
        )}
      </div>

      <div className="dl-slot-actions">
        <button
          className="dl-action-btn generate"
          onClick={onGenerate}
          disabled={!mood.trim() || loading}
        >
          <FaRefresh /> Generate
        </button>
        {songs?.length > 0 && (
          <button className="dl-action-btn" onClick={onSave} title="Save as playlist">
            <FaSave /> Save
          </button>
        )}
      </div>
    </div>
  );
});

Slot.displayName = 'Slot';

const DaylistPlaylists = memo(({ onClose }) => {
  const { setPlayerSongs } = usePlayer();
  const { addPlaylist } = usePlaylists();
  const { generatePlaylist } = useMoodPlaylist();
  const { toast } = useToast();
  const schedule = useDaylistSchedule();
  const { prefs, updatePreference, getPreference } = useDaylistPreferences();
  const { getCache, setCache } = useDaylistCache();

  const [moods, setMoods] = useState({
    morning: getPreference('morning') || '',
    noon: getPreference('noon') || '',
    evening: getPreference('evening') || '',
    lay_hour: getPreference('lay_hour') || '',
  });

  const [loading, setLoading] = useState({});
  const [slotSongs, setSlotSongs] = useState(() => {
    const initial = {};
    ['morning', 'noon', 'evening', 'lay_hour'].forEach(slot => {
      initial[slot] = getCache(slot) || [];
    });
    return initial;
  });

  const handleMoodChange = useCallback((slot, value) => {
    setMoods(prev => ({ ...prev, [slot]: value }));
    updatePreference(slot, value);
  }, [updatePreference]);

  const handleGenerate = useCallback(
    async (slot) => {
      const mood = moods[slot];
      if (!mood.trim()) {
        toast({ type: 'error', message: 'Please enter a mood' });
        return;
      }

      setLoading(prev => ({ ...prev, [slot]: true }));
      const result = await generatePlaylist(mood, 15);
      setLoading(prev => ({ ...prev, [slot]: false }));

      if (result) {
        setSlotSongs(prev => ({ ...prev, [slot]: result }));
        setCache(slot, result);
        toast({ type: 'success', message: `Generated ${slot} playlist!` });
      } else {
        toast({ type: 'error', message: 'Failed to generate playlist' });
      }
    },
    [moods, generatePlaylist, toast, setCache]
  );

  const handlePlaySong = useCallback(
    (song) => {
      setPlayerSongs([song], 0);
      toast({ type: 'success', message: `Playing: ${song.name}` });
    },
    [setPlayerSongs, toast]
  );

  const handleSavePlaylist = useCallback(
    async (slot) => {
      const songs = slotSongs[slot];
      if (!songs.length) return;
      const name = `${SlotLabels[slot]} — ${new Date().toLocaleDateString()}`;
      try {
        const playlist = {
          id: `daylist_${slot}_${Date.now()}`,
          name,
          songs,
          source: 'daylist',
          createdAt: Date.now(),
          _daylistSlot: slot, // metadata for future reference
        };
        addPlaylist(playlist);
        toast({ type: 'success', message: `Saved "${name}"!` });
      } catch (err) {
        toast({ type: 'error', message: 'Failed to save playlist' });
      }
    },
    [slotSongs, addPlaylist, toast]
  );

  if (!schedule) return null;

  const activeSlots = schedule.activePlaylists.length > 0 
    ? schedule.activePlaylists 
    : ['morning', 'noon', 'evening', 'lay_hour'];

  return (
    <div className="dl-root">
      <style>{CSS}</style>
      <div className="dl-overlay">
        <div className="dl-header">
          <div className="dl-title">Daylist</div>
          <button className="dl-close-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="dl-content">
          <div className="dl-grid">
            {activeSlots.map((slot) => (
              <Slot
                key={slot}
                slot={slot}
                songs={slotSongs[slot]}
                loading={loading[slot]}
                mood={moods[slot]}
                onMoodChange={(value) => handleMoodChange(slot, value)}
                onGenerate={() => handleGenerate(slot)}
                onPlay={handlePlaySong}
                onSave={() => handleSavePlaylist(slot)}
              />
            ))}
          </Slot>
        </div>
      </div>
    </div>
  );
});

DaylistPlaylists.displayName = 'DaylistPlaylists';

export default DaylistPlaylists;
