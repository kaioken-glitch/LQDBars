// Music API utilities - Last.fm integration
// Get your free API key at: https://www.last.fm/api/account/create
const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;
const BASE_URL = import.meta.env.VITE_BASE_URL;
const LASTFM_BASE_URL = `${BASE_URL}/api/lastfm`;


class MusicApiService {

  // Fallback search using MusicBrainz (no CORS issues)
  async searchTracksMusicBrainz(query, limit = 20) {
    try {
      console.log('🎵 Using MusicBrainz API for:', query);
      const response = await fetch(
        `https://musicbrainz.org/ws/2/recording/?query=recording:${encodeURIComponent(query)}&fmt=json&limit=${limit}`
      );
      const data = await response.json();
      
      if (data.recordings && data.recordings.length > 0) {
        console.log(`✅ MusicBrainz found ${data.recordings.length} tracks`);
        return data.recordings.map(recording => ({
          id: recording.id,
          name: recording.title,
          artist: recording['artist-credit']?.[0]?.name || 'Unknown Artist',
          duration: recording.length ? `${Math.floor(recording.length / 60000)}:${String(Math.floor((recording.length % 60000) / 1000)).padStart(2, '0')}` : '0:00',
          cover: `https://placehold.co/60x60?text=${encodeURIComponent(recording.title.slice(0, 1))}`
        }));
      }
      return [];
    } catch (error) {
      console.error('💥 MusicBrainz error:', error);
      return [];
    }
  }
  
  // Search for tracks with fallback
  async searchTracks(query, limit = 20) {
    console.log('🔍 Searching for:', query);
    console.log('🎵 Using MusicBrainz API (no CORS issues)');
    
    try {
      const response = await fetch(
        `https://musicbrainz.org/ws/2/recording/?query=recording:${encodeURIComponent(query)}&fmt=json&limit=${limit}`
      );
      
      console.log('📡 MusicBrainz response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 MusicBrainz raw data:', data);
      
      if (data.recordings && data.recordings.length > 0) {
        console.log(`✅ MusicBrainz found ${data.recordings.length} tracks`);
        
        const results = data.recordings.map(recording => ({
          id: recording.id,
          name: recording.title,
          artist: recording['artist-credit']?.[0]?.name || 'Unknown Artist',
          duration: recording.length ? `${Math.floor(recording.length / 60000)}:${String(Math.floor((recording.length % 60000) / 1000)).padStart(2, '0')}` : '0:00',
          cover: `https://placehold.co/60x60?text=${encodeURIComponent(recording.title.slice(0, 1))}`
        }));
        
        console.log('🎯 Formatted results:', results);
        return results;
      } else {
        console.log('⚠️ No recordings found in MusicBrainz response');
        return [];
      }
    } catch (error) {
      console.error('💥 MusicBrainz error:', error);
      return [];
    }
  }

  // Get track details
  async getTrackInfo(artist, track) {
    try {
      const response = await fetch(
        `${LASTFM_BASE_URL}?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`
      );
      const data = await response.json();
      
      if (data.track) {
        return {
          id: `${artist}-${track}`.replace(/\s+/g, '-').toLowerCase(),
          name: data.track.name,
          artist: data.track.artist.name,
          album: data.track.album?.title || 'Unknown Album',
          duration: data.track.duration ? Math.floor(data.track.duration / 1000) : 0,
          cover: data.track.album?.image?.[3]?.['#text'] || 'https://placehold.co/300x300?text=No+Cover',
          playcount: data.track.playcount,
          listeners: data.track.listeners,
          url: data.track.url
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting track info:', error);
      return null;
    }
  }

  // Get artist's top tracks
  async getArtistTopTracks(artist, limit = 10) {
    try {
      const response = await fetch(
        `${LASTFM_BASE_URL}?method=artist.gettoptracks&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`
      );
      const data = await response.json();
      
      return data.toptracks?.track?.map(track => ({
        id: `${artist}-${track.name}`.replace(/\s+/g, '-').toLowerCase(),
        name: track.name,
        artist: artist,
        cover: track.image?.[2]?.['#text'] || 'https://placehold.co/300x300?text=No+Cover',
        playcount: track.playcount,
        listeners: track.listeners,
        url: track.url
      })) || [];
    } catch (error) {
      console.error('Error getting artist top tracks:', error);
      return [];
    }
  }

  // Get similar tracks
  async getSimilarTracks(artist, track, limit = 10) {
    try {
      const response = await fetch(
        `${LASTFM_BASE_URL}?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`
      );
      const data = await response.json();
      
      return data.similartracks?.track?.map(similarTrack => ({
        id: `${similarTrack.artist.name}-${similarTrack.name}`.replace(/\s+/g, '-').toLowerCase(),
        name: similarTrack.name,
        artist: similarTrack.artist.name,
        cover: similarTrack.image?.[2]?.['#text'] || 'https://placehold.co/300x300?text=No+Cover',
        match: similarTrack.match,
        url: similarTrack.url
      })) || [];
    } catch (error) {
      console.error('Error getting similar tracks:', error);
      return [];
    }
  }

  // Get popular/trending tracks (using popular artists)
  async getTrendingTracks(limit = 20) {
    try {
      console.log('🔥 Getting trending tracks...');
      const popularArtists = ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones', 'Bob Dylan', 'Radiohead', 'Nirvana'];
      const randomArtist = popularArtists[Math.floor(Math.random() * popularArtists.length)];
      
      const response = await fetch(
        `https://musicbrainz.org/ws/2/recording/?query=artist:${encodeURIComponent(randomArtist)}&fmt=json&limit=${limit}`
      );
      const data = await response.json();
      
      if (data.recordings && data.recordings.length > 0) {
        console.log(`✅ Found ${data.recordings.length} trending tracks`);
        return data.recordings.map(recording => ({
          id: recording.id,
          name: recording.title,
          artist: recording['artist-credit']?.[0]?.name || randomArtist,
          duration: recording.length ? `${Math.floor(recording.length / 60000)}:${String(Math.floor((recording.length % 60000) / 1000)).padStart(2, '0')}` : '0:00',
          cover: `https://placehold.co/300x300?text=${encodeURIComponent(recording.title.slice(0, 1))}`,
          genre: 'Rock'
        }));
      }
      return [];
    } catch (error) {
      console.error('💥 Error getting trending tracks:', error);
      return [];
    }
  }

  // Get suggested artists
  async getSuggestedArtists(limit = 10) {
    try {
      console.log('🎤 Getting suggested artists...');
      const genres = ['rock', 'pop', 'jazz', 'electronic', 'hip-hop'];
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];
      
      const response = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=tag:${randomGenre}&fmt=json&limit=${limit}`
      );
      const data = await response.json();
      
      if (data.artists && data.artists.length > 0) {
        console.log(`✅ Found ${data.artists.length} suggested artists`);
        return data.artists.map(artist => ({
          id: artist.id,
          name: artist.name,
          cover: `https://placehold.co/200x200?text=${encodeURIComponent(artist.name.slice(0, 2))}`,
          genre: randomGenre,
          type: 'artist'
        }));
      }
      return [];
    } catch (error) {
      console.error('💥 Error getting suggested artists:', error);
      return [];
    }
  }

  // Get popular albums (mock data for now)
  async getPopularAlbums(limit = 10) {
    try {
      console.log('💿 Getting popular albums...');
      // Mock popular albums - you can replace with real API later
      const popularAlbums = [
        { id: 1, name: 'Abbey Road', artist: 'The Beatles', cover: 'https://placehold.co/200x200?text=Abbey+Road', year: '1969', genre: 'Rock' },
        { id: 2, name: 'Dark Side of the Moon', artist: 'Pink Floyd', cover: 'https://placehold.co/200x200?text=Dark+Side', year: '1973', genre: 'Progressive Rock' },
        { id: 3, name: 'Thriller', artist: 'Michael Jackson', cover: 'https://placehold.co/200x200?text=Thriller', year: '1982', genre: 'Pop' },
        { id: 4, name: 'Back in Black', artist: 'AC/DC', cover: 'https://placehold.co/200x200?text=Back+Black', year: '1980', genre: 'Hard Rock' },
        { id: 5, name: 'Hotel California', artist: 'Eagles', cover: 'https://placehold.co/200x200?text=Hotel+CA', year: '1976', genre: 'Rock' },
        { id: 6, name: 'Nevermind', artist: 'Nirvana', cover: 'https://placehold.co/200x200?text=Nevermind', year: '1991', genre: 'Grunge' },
        { id: 7, name: 'OK Computer', artist: 'Radiohead', cover: 'https://placehold.co/200x200?text=OK+Computer', year: '1997', genre: 'Alternative' },
        { id: 8, name: 'Born to Run', artist: 'Bruce Springsteen', cover: 'https://placehold.co/200x200?text=Born+Run', year: '1975', genre: 'Rock' }
      ];
      
      return popularAlbums.slice(0, limit).map(album => ({
        ...album,
        type: 'album'
      }));
    } catch (error) {
      console.error('💥 Error getting popular albums:', error);
      return [];
    }
  }

  // Get featured playlists (mock data)
  async getFeaturedPlaylists(limit = 8) {
    try {
      console.log('📋 Getting featured playlists...');
      const featuredPlaylists = [
        { id: 1, name: 'Today\'s Top Hits', description: 'The most played songs right now', cover: 'https://placehold.co/200x200?text=Top+Hits', songCount: 50, type: 'playlist' },
        { id: 2, name: 'Rock Classics', description: 'Timeless rock anthems', cover: 'https://placehold.co/200x200?text=Rock+Classics', songCount: 75, type: 'playlist' },
        { id: 3, name: 'Chill Vibes', description: 'Relax and unwind', cover: 'https://placehold.co/200x200?text=Chill+Vibes', songCount: 40, type: 'playlist' },
        { id: 4, name: 'Workout Energy', description: 'High energy tracks for your workout', cover: 'https://placehold.co/200x200?text=Workout', songCount: 60, type: 'playlist' },
        { id: 5, name: 'Jazz Essentials', description: 'The best of jazz music', cover: 'https://placehold.co/200x200?text=Jazz', songCount: 45, type: 'playlist' },
        { id: 6, name: 'Electronic Beats', description: 'Modern electronic music', cover: 'https://placehold.co/200x200?text=Electronic', songCount: 55, type: 'playlist' },
        { id: 7, name: 'Acoustic Sessions', description: 'Intimate acoustic performances', cover: 'https://placehold.co/200x200?text=Acoustic', songCount: 35, type: 'playlist' },
        { id: 8, name: 'Hip-Hop Hits', description: 'The hottest hip-hop tracks', cover: 'https://placehold.co/200x200?text=Hip+Hop', songCount: 65, type: 'playlist' }
      ];
      
      return featuredPlaylists.slice(0, limit);
    } catch (error) {
      console.error('💥 Error getting featured playlists:', error);
      return [];
    }
  }
}

export default new MusicApiService();
