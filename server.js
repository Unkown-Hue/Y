const express = require('express');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files
app.use(express.static(__dirname));

// API: Get video info
app.get('/api/video-info', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }
        
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        
        // Format duration
        const durationSeconds = parseInt(videoDetails.lengthSeconds);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Get available formats with audio+video for quality selection
        const formats = info.formats.filter(f => f.hasVideo && f.hasAudio);
        
        // Group by quality and pick best per resolution
        const qualityMap = new Map();
        formats.forEach(f => {
            const key = f.height || 0;
            if (!qualityMap.has(key) || (f.container === 'mp4' && qualityMap.get(key).container !== 'mp4')) {
                qualityMap.set(key, f);
            }
        });
        
        // Create quality options sorted by resolution (highest first)
        const qualities = Array.from(qualityMap.entries())
            .filter(([height]) => height > 0)
            .sort((a, b) => b[0] - a[0])
            .map(([height, format]) => ({
                label: `${height}p`,
                value: format.itag.toString(),
                height: height,
                container: format.container,
            }));
        
        res.json({
            title: videoDetails.title,
            thumbnail: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url || '',
            duration: duration,
            channel: videoDetails.author.name,
            videoId: videoDetails.videoId,
            qualities: qualities,
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to fetch video info' 
        });
    }
});

// API: Download video
app.get('/api/download', async (req, res) => {
    try {
        const url = req.query.url;
        const itag = req.query.itag; // Optional quality parameter
        const audioOnly = req.query.audioOnly === 'true';
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }
        
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_');
        
        let selectedFormat;
        let extension;
        let mimeType;
        
        // Handle audio-only download
        if (audioOnly) {
            const audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo);
            audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
            selectedFormat = audioFormats[0];
            
            if (selectedFormat) {
                // Prefer m4a for iOS compatibility
                extension = selectedFormat.container === 'webm' ? 'webm' : 'm4a';
                mimeType = selectedFormat.mimeType?.split(';')[0] || 'audio/mp4';
            }
        } else if (itag) {
            // Use specific quality if provided
            selectedFormat = info.formats.find(f => f.itag.toString() === itag);
            if (selectedFormat) {
                extension = selectedFormat.container || 'mp4';
                mimeType = selectedFormat.mimeType?.split(';')[0] || 'video/mp4';
            }
        }
        
        // Fallback: find best MP4 format with both audio and video for iOS compatibility
        if (!selectedFormat) {
            const formats = info.formats.filter(f => 
                f.hasVideo && f.hasAudio && f.container === 'mp4'
            );
            formats.sort((a, b) => (b.height || 0) - (a.height || 0));
            selectedFormat = formats[0];
            extension = 'mp4';
            mimeType = 'video/mp4';
        }
        
        // Final fallback: any audio+video format
        if (!selectedFormat) {
            const fallbackFormats = info.formats.filter(f => f.hasVideo && f.hasAudio);
            fallbackFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
            selectedFormat = fallbackFormats[0];
            
            if (selectedFormat) {
                extension = selectedFormat.container || 'mp4';
                mimeType = selectedFormat.mimeType?.split(';')[0] || 'video/mp4';
            }
        }
        
        if (!selectedFormat) {
            return res.status(400).json({ error: 'No suitable format found' });
        }
        
        res.header('Content-Disposition', `attachment; filename="${title}.${extension}"`);
        res.header('Content-Type', mimeType);
        
        if (selectedFormat.contentLength) {
            res.header('Content-Length', selectedFormat.contentLength);
        }
        
        ytdl(url, {
            format: selectedFormat,
        }).pipe(res);
        
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to download video' 
        });
    }
});

// API: Get playlist info
app.get('/api/playlist-info', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        // Extract playlist ID from URL
        const playlistMatch = url.match(/[&?]list=([^&]+)/);
        if (!playlistMatch) {
            return res.status(400).json({ error: 'No playlist ID found in URL' });
        }
        
        const playlistId = playlistMatch[1];
        
        // Get first video to validate and extract playlist info
        // Note: ytdl-core doesn't directly support playlists, so we'll get basic info
        // In a production app, you'd use the YouTube Data API for full playlist support
        
        // For now, return info indicating this is a playlist
        res.json({
            isPlaylist: true,
            playlistId: playlistId,
            message: 'Playlist detected. For individual videos, remove the list parameter from the URL.',
        });
    } catch (error) {
        console.error('Error fetching playlist info:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to fetch playlist info' 
        });
    }
});

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
