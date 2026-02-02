// Updated YouTube Converter - Works WITHOUT backend server
class YouTubeConverter {
  constructor() {
    this.apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  // Search for YouTube videos
  async searchVideos(query, maxResults = 20) {
    try {
      if (!this.apiKey || this.apiKey === 'your_youtube_api_key_here') {
        console.warn('YouTube API key not configured');
        return [];
      }

      const response = await fetch(
        `${this.baseUrl}/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${this.apiKey}`
      );
      
      if (!response.ok) throw new Error('YouTube API request failed');
      
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

  // Extract video ID from URL
  extractVideoId(url) {
    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?]+)/,
      /youtube\.com\/embed\/([^?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }

  // Get audio stream - NO BACKEND NEEDED!
  async getAudioStream(videoIdOrUrl) {
    try {
      // Extract video ID if URL provided
      const videoId = videoIdOrUrl.includes('youtube.com') || videoIdOrUrl.includes('youtu.be')
        ? this.extractVideoId(videoIdOrUrl)
        : videoIdOrUrl;

      if (!videoId) {
        throw new Error('Invalid YouTube URL or ID');
      }

      // Return direct YouTube URL
      // The audio element will handle playback via iframe
      return `https://www.youtube.com/watch?v=${videoId}`;
      
    } catch (error) {
      console.error('Error getting audio stream:', error);
      throw error;
    }
  }

  // Parse YouTube duration format (PT4M13S)
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

  // Get video details
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

  // Prepare song for playback - SIMPLIFIED VERSION
  async prepareSongForPlayback(song) {
    try {
      // If song already has streamUrl, return it directly
      if (song.streamUrl) {
        return {
          ...song,
          audio: song.streamUrl,
          source: song.source || 'youtube'
        };
      }

      // If song has audio URL, use it
      if (song.audio) {
        return song;
      }

      // Fallback: search for song on YouTube
      console.log(`Searching YouTube for: ${song.name} ${song.artist}`);
      const searchResults = await this.searchVideos(`${song.name} ${song.artist}`, 1);
      
      if (searchResults.length > 0) {
        return {
          ...song,
          audio: searchResults[0].youtubeUrl,
          streamUrl: searchResults[0].youtubeUrl,
          source: 'youtube',
          youtubeId: searchResults[0].id
        };
      }

      throw new Error('Could not find stream for this song');
      
    } catch (error) {
      console.error('Error preparing song:', error);
      throw error;
    }
  }

  // Get trending music
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

  // Check if URL is streamable
  isStreamableUrl(url) {
    if (!url) return false;
    
    const patterns = [
      /youtube\.com/,
      /youtu\.be/,
      /\.mp3$/,
      /\.m4a$/,
      /\.wav$/,
      /\.ogg$/
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }
}

export default new YouTubeConverter();