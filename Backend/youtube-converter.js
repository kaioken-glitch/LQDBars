import express from 'express';
import cors from 'cors';
import ytdl from '@distube/ytdl-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Store audio files temporarily
const AUDIO_DIR = path.join(__dirname, 'temp_audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR);
}

// Serve static audio files
app.use('/audio', express.static(AUDIO_DIR));

// Convert YouTube video to audio
app.get('/api/youtube/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    // Validate video ID
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }

    // Check if audio file already exists
    const audioPath = path.join(AUDIO_DIR, `${videoId}.webm`);
    const audioUrl = `http://localhost:${PORT}/audio/${videoId}.webm`;
    
    if (fs.existsSync(audioPath)) {
      return res.json({ audioUrl });
    }

    // Get video info
    const info = await ytdl.getInfo(videoId);
    const title = info.videoDetails.title;
    
    console.log(`Converting: ${title}`);

    // Download audio stream
    const audioStream = ytdl(videoId, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    // Save to file
    const writeStream = fs.createWriteStream(audioPath);
    audioStream.pipe(writeStream);

    writeStream.on('finish', () => {
      console.log(`Audio conversion completed: ${title}`);
      res.json({ 
        audioUrl,
        title,
        duration: info.videoDetails.lengthSeconds
      });
    });

    writeStream.on('error', (error) => {
      console.error('Write stream error:', error);
      res.status(500).json({ error: 'Audio conversion failed' });
    });

    audioStream.on('error', (error) => {
      console.error('Audio stream error:', error);
      res.status(500).json({ error: 'Failed to download audio' });
    });

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Video conversion failed' });
  }
});

// Get video info without downloading
app.get('/api/youtube/info/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    if (!ytdl.validateID(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }

    const info = await ytdl.getInfo(videoId);
    
    res.json({
      id: videoId,
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0].url,
      viewCount: info.videoDetails.viewCount
    });
    
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Failed to get video info' });
  }
});

// Clean up old audio files (run daily)
function cleanupOldFiles() {
  const files = fs.readdirSync(AUDIO_DIR);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  files.forEach(file => {
    const filePath = path.join(AUDIO_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtime.getTime() > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up old file: ${file}`);
    }
  });
}

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`YouTube converter service running on port ${PORT}`);
});

export default app;
