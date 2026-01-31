// YouTube to Audio Converter Utility
class YouTubeConverter {
  constructor() {
    this.apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  // Search for YouTube videos
  async searchVideos(query, maxResults = 20) {
    try {
      if (!this.apiKey || this.apiKey === 'your_youtube_api_key_here') {
        console.warn('YouTube API key not configured. Please add VITE_YOUTUBE_API_KEY to your .env file');
        return [];
      }

      const response = await fetch(
        `${this.baseUrl}/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error('YouTube API request failed');
      }
      
      const data = await response.json();
      
      return data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        publishedAt: item.snippet.publishedAt,
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));
    } catch (error) {
      console.error('Error searching YouTube:', error);
      return [];
    }
  }

  // Get video details including duration
  async getVideoDetails(videoId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/videos?part=contentDetails,snippet&id=${videoId}&key=${this.apiKey}`
      );
      
      const data = await response.json();
      
      if (data.items.length === 0) {
        throw new Error('Video not found');
      }
      
      const video = data.items[0];
      return {
        id: videoId,
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        duration: this.parseDuration(video.contentDetails.duration),
        thumbnail: video.snippet.thumbnails.medium.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`
      };
    } catch (error) {
      console.error('Error getting video details:', error);
      return null;
    }
  }

  // Parse YouTube duration format (PT4M13S) to readable format
  parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    if (hours) {
      return `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }
    return `${minutes || '0'}:${seconds.padStart(2, '0')}`;
  }

  // Convert YouTube video to audio stream URL
  // Note: This calls your backend service for audio conversion
  async getAudioStream(videoId) {
    try {
      // Call your backend API endpoint
      const response = await fetch(`http://localhost:3001/api/youtube/audio/${videoId}`);
      
      if (!response.ok) {
        throw new Error('Audio conversion failed');
      }
      
      const data = await response.json();
      return data.audioUrl;
    } catch (error) {
      console.error('Error getting audio stream:', error);
      // For demo purposes, return a placeholder
      return 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav';
    }
  }

  // Get trending music videos
  async getTrendingMusic() {
    try {
      const response = await fetch(
        `${this.baseUrl}/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=US&maxResults=50&key=${this.apiKey}`
      );
      
      const data = await response.json();
      
      return data.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`
      }));
    } catch (error) {
      console.error('Error getting trending music:', error);
      return [];
    }
  }

  // Search for specific artist's music
  async searchArtist(artistName, maxResults = 20) {
    const query = `${artistName} music official`;
    return this.searchVideos(query, maxResults);
  }

  // Search for playlists
  async searchPlaylists(query, maxResults = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?part=snippet&type=playlist&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${this.apiKey}`
      );
      
      const data = await response.json();
      
      return data.items.map(item => ({
        id: item.id.playlistId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        playlistUrl: `https://www.youtube.com/playlist?list=${item.id.playlistId}`
      }));
    } catch (error) {
      console.error('Error searching playlists:', error);
      return [];
    }
  }

  // Get videos from a playlist
  async getPlaylistVideos(playlistId, maxResults = 50) {
    try {
      const response = await fetch(
        `${this.baseUrl}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${this.apiKey}`
      );
      
      const data = await response.json();
      
      return data.items.map(item => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
        youtubeUrl: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
      }));
    } catch (error) {
      console.error('Error getting playlist videos:', error);
      return [];
    }
  }
}

export default new YouTubeConverter();
