const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
const BASE_URL = import.meta.env.VITE_BASE_URL;
const LASTFM_BASE_URL = `${BASE_URL}/api/lastfm`;

class MusicApiService {
  // Example: fallback search
  async searchTracksMusicBrainz(query, limit = 20) {
    try {
      const response = await fetch(
        `https://musicbrainz.org/ws/2/recording/?query=recording:${encodeURIComponent(query)}&fmt=json&limit=${limit}`
      );
      const data = await response.json();
      return data.recordings?.map(r => ({
        id: r.id,
        name: r.title,
        artist: r['artist-credit']?.[0]?.name || 'Unknown Artist',
        duration: r.length ? `${Math.floor(r.length / 60000)}:${String(Math.floor((r.length % 60000) / 1000)).padStart(2,'0')}` : '0:00',
        cover: `https://placehold.co/60x60?text=${encodeURIComponent(r.title.slice(0,1))}`
      })) || [];
    } catch (err) {
      console.error('MusicBrainz error', err);
      return [];
    }
  }

  // Example: Last.fm track info
  async getTrackInfo(artist, track) {
    try {
      const res = await fetch(
        `${LASTFM_BASE_URL}?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`
      );
      const data = await res.json();
      if (!data.track) return null;
      return {
        id: `${artist}-${track}`.replace(/\s+/g,'-').toLowerCase(),
        name: data.track.name,
        artist: data.track.artist.name,
        album: data.track.album?.title || 'Unknown Album',
        duration: data.track.duration ? Math.floor(data.track.duration / 1000) : 0,
        cover: data.track.album?.image?.[3]?.['#text'] || `${BASE_URL}/images/no-cover.png`,
        playcount: data.track.playcount,
        listeners: data.track.listeners,
        url: data.track.url
      };
    } catch(err) {
      console.error('Last.fm track error', err);
      return null;
    }
  }

  // Example: frontend fetch to backend /songs
  async getSongs() {
    try {
      const res = await fetch(`${BASE_URL}/songs`);
      return res.json();
    } catch (err) {
      console.error('Backend /songs error', err);
      return [];
    }
  }

  async addSong(song) {
    try {
      const res = await fetch(`${BASE_URL}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(song)
      });
      return res.json();
    } catch(err) {
      console.error('Backend addSong error', err);
      return null;
    }
  }
}

export default new MusicApiService();
