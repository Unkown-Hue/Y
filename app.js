// DOM Elements
const urlInput = document.getElementById('urlInput');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const urlForm = document.getElementById('urlForm');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const errorCard = document.getElementById('errorCard');
const errorText = document.getElementById('errorText');
const successCard = document.getElementById('successCard');
const videoCard = document.getElementById('videoCard');
const thumbnail = document.getElementById('thumbnail');
const duration = document.getElementById('duration');
const videoTitle = document.getElementById('videoTitle');
const channelName = document.getElementById('channelName');
const emptyState = document.getElementById('emptyState');
const qualitySelect = document.getElementById('qualitySelect');
const formatToggle = document.getElementById('formatToggle');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const playlistBadge = document.getElementById('playlistBadge');

// State
let currentVideoInfo = null;
let currentStatus = 'idle'; // idle, fetching, ready, downloading, complete, error
let selectedFormat = 'video'; // video or audio
let downloadHistory = [];

// LocalStorage key
const HISTORY_KEY = 'yt_downloader_history';

// YouTube URL validation patterns
const youtubePatterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
];

function isValidYouTubeUrl(url) {
    return youtubePatterns.some(pattern => pattern.test(url));
}

function isPlaylistUrl(url) {
    return url.includes('list=');
}

function extractPlaylistId(url) {
    const match = url.match(/[&?]list=([^&]+)/);
    return match ? match[1] : null;
}

function getVideoUrlWithoutPlaylist(url) {
    // Remove the list parameter from the URL
    return url.replace(/[&?]list=[^&]+/, '').replace(/[?&]$/, '');
}

function extractVideoId(url) {
    const pattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
}

function updateUI() {
    const url = urlInput.value.trim();
    const hasUrl = url.length > 0;
    
    // Clear button visibility
    if (hasUrl) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
    
    // Download button state
    downloadBtn.disabled = !hasUrl || currentStatus === 'fetching' || currentStatus === 'downloading';
    
    // Button text and icon
    const btnText = downloadBtn.querySelector('.btn-text');
    const downloadIcon = downloadBtn.querySelector('.download-icon');
    const spinner = downloadBtn.querySelector('.spinner');
    
    const downloadLabel = selectedFormat === 'audio' ? 'Audio' : 'Video';
    
    switch (currentStatus) {
        case 'fetching':
            btnText.textContent = 'Fetching Video...';
            downloadIcon.classList.add('hidden');
            spinner.classList.remove('hidden');
            break;
        case 'downloading':
            btnText.textContent = 'Downloading...';
            downloadIcon.classList.add('hidden');
            spinner.classList.remove('hidden');
            break;
        case 'ready':
        case 'complete':
            btnText.textContent = `Download ${downloadLabel}`;
            downloadIcon.classList.remove('hidden');
            spinner.classList.add('hidden');
            break;
        default:
            btnText.textContent = 'Get Video';
            downloadIcon.classList.remove('hidden');
            spinner.classList.add('hidden');
    }
    
    // Progress section
    if (currentStatus === 'downloading') {
        progressSection.classList.remove('hidden');
    } else {
        progressSection.classList.add('hidden');
    }
    
    // Error card
    if (currentStatus === 'error') {
        errorCard.classList.remove('hidden');
    } else {
        errorCard.classList.add('hidden');
    }
    
    // Success card
    if (currentStatus === 'complete') {
        successCard.classList.remove('hidden');
    } else {
        successCard.classList.add('hidden');
    }
    
    // Video card
    if (currentVideoInfo && (currentStatus === 'ready' || currentStatus === 'downloading' || currentStatus === 'complete')) {
        videoCard.classList.remove('hidden');
        thumbnail.src = currentVideoInfo.thumbnail;
        thumbnail.alt = currentVideoInfo.title;
        videoTitle.textContent = currentVideoInfo.title;
        channelName.textContent = currentVideoInfo.channel;
        if (currentVideoInfo.duration) {
            duration.textContent = currentVideoInfo.duration;
            duration.classList.remove('hidden');
        } else {
            duration.classList.add('hidden');
        }
        // Show playlist badge if video is from a playlist
        if (currentVideoInfo.fromPlaylist) {
            playlistBadge.classList.remove('hidden');
        } else {
            playlistBadge.classList.add('hidden');
        }
    } else {
        videoCard.classList.add('hidden');
    }
    
    // Empty state
    if (!hasUrl && currentStatus === 'idle') {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
    }
}

function setProgress(percent) {
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.round(percent)}%`;
}

function showError(message) {
    currentStatus = 'error';
    errorText.textContent = message;
    updateUI();
}

async function fetchVideoInfo() {
    const url = urlInput.value.trim();
    
    if (!isValidYouTubeUrl(url)) {
        showError('Please enter a valid YouTube URL');
        return;
    }
    
    currentStatus = 'fetching';
    updateUI();
    
    try {
        // Check if it's a playlist-only URL (no video ID)
        const videoId = extractVideoId(url);
        const playlistId = extractPlaylistId(url);
        
        if (playlistId && !videoId) {
            // It's a playlist URL without a specific video
            showError('Playlist URL detected. Please share a link to a specific video from the playlist.');
            return;
        }
        
        // If URL has playlist parameter, use the clean video URL
        const fetchUrl = playlistId ? getVideoUrlWithoutPlaylist(url) : url;
        
        const response = await fetch(`/api/video-info?url=${encodeURIComponent(fetchUrl)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch video info');
        }
        
        currentVideoInfo = data;
        
        // Add playlist info to video info if present
        if (playlistId) {
            currentVideoInfo.fromPlaylist = true;
            currentVideoInfo.playlistId = playlistId;
        }
        
        currentStatus = 'ready';
        
        // Populate quality options
        populateQualityOptions(data.qualities || []);
        
        updateUI();
    } catch (error) {
        showError(error.message || 'Failed to fetch video info');
    }
}

function populateQualityOptions(qualities) {
    // Clear existing options except the first one
    while (qualitySelect.options.length > 1) {
        qualitySelect.remove(1);
    }
    
    // Add quality options
    qualities.forEach(q => {
        const option = document.createElement('option');
        option.value = q.value;
        option.textContent = q.label + (q.container !== 'mp4' ? ` (${q.container})` : '');
        qualitySelect.appendChild(option);
    });
}

async function downloadVideo() {
    if (!currentVideoInfo) return;
    
    // Use the video ID to construct a clean URL for download
    const videoId = currentVideoInfo.videoId;
    const cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const selectedQuality = qualitySelect.value;
    const isAudioOnly = selectedFormat === 'audio';
    
    currentStatus = 'downloading';
    setProgress(0);
    updateUI();
    
    // Build download URL with parameters using the clean video URL
    let downloadUrl = `/api/download?url=${encodeURIComponent(cleanVideoUrl)}`;
    if (selectedQuality) {
        downloadUrl += `&itag=${selectedQuality}`;
    }
    if (isAudioOnly) {
        downloadUrl += '&audioOnly=true';
    }
    
    // Simulate progress while downloading
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) {
            progress = 90;
            clearInterval(progressInterval);
        }
        setProgress(progress);
    }, 300);
    
    try {
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Download failed');
        }
        
        // Add to download history immediately after successful response
        // This ensures history is recorded even if blob processing is interrupted
        addToHistory(currentVideoInfo, selectedFormat);
        
        clearInterval(progressInterval);
        setProgress(100);
        
        // Create download link
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        
        // Set appropriate file extension
        const extension = isAudioOnly ? 'm4a' : 'mp4';
        a.download = `${currentVideoInfo.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        
        currentStatus = 'complete';
        updateUI();
    } catch (error) {
        clearInterval(progressInterval);
        showError(error.message || 'Download failed');
    }
}

function handleSubmit(e) {
    e.preventDefault();
    
    if (currentStatus === 'ready' || currentStatus === 'complete') {
        downloadVideo();
    } else {
        fetchVideoInfo();
    }
}

function handleClear() {
    urlInput.value = '';
    currentVideoInfo = null;
    currentStatus = 'idle';
    setProgress(0);
    updateUI();
    urlInput.focus();
}

function handleInput() {
    const url = urlInput.value.trim();
    const videoId = extractVideoId(url);
    
    // Reset if URL changed to a different video
    if (currentVideoInfo && videoId !== currentVideoInfo.videoId) {
        currentVideoInfo = null;
        currentStatus = 'idle';
    }
    
    // Clear error when typing
    if (currentStatus === 'error') {
        currentStatus = 'idle';
    }
    
    updateUI();
}

// Format toggle handler
function handleFormatToggle(e) {
    const btn = e.target.closest('.format-btn');
    if (!btn) return;
    
    const format = btn.dataset.format;
    if (format === selectedFormat) return;
    
    selectedFormat = format;
    
    // Update active state
    formatToggle.querySelectorAll('.format-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.format === format);
    });
    
    // Disable quality selection for audio-only
    qualitySelect.disabled = format === 'audio';
    
    // Update button text
    updateUI();
}

// Event listeners
urlInput.addEventListener('input', handleInput);
clearBtn.addEventListener('click', handleClear);
urlForm.addEventListener('submit', handleSubmit);
formatToggle.addEventListener('click', handleFormatToggle);
historyList.addEventListener('click', handleHistoryClick);
clearHistoryBtn.addEventListener('click', clearHistory);

// History management functions
function loadHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        downloadHistory = stored ? JSON.parse(stored) : [];
    } catch (e) {
        downloadHistory = [];
    }
    renderHistory();
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(downloadHistory));
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

function addToHistory(videoInfo, format) {
    const historyItem = {
        id: Date.now(),
        videoId: videoInfo.videoId,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        channel: videoInfo.channel,
        duration: videoInfo.duration,
        format: format, // 'video' or 'audio'
        downloadedAt: new Date().toISOString(),
    };
    
    // Remove duplicate if exists
    downloadHistory = downloadHistory.filter(h => h.videoId !== videoInfo.videoId || h.format !== format);
    
    // Add to beginning
    downloadHistory.unshift(historyItem);
    
    // Keep only last 20 items
    if (downloadHistory.length > 20) {
        downloadHistory = downloadHistory.slice(0, 20);
    }
    
    saveHistory();
    renderHistory();
}

function clearHistory() {
    downloadHistory = [];
    saveHistory();
    renderHistory();
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

function renderHistory() {
    if (downloadHistory.length === 0) {
        historySection.classList.add('hidden');
        return;
    }
    
    historySection.classList.remove('hidden');
    historyList.innerHTML = downloadHistory.map(item => `
        <div class="history-item" data-video-id="${item.videoId}" data-testid="history-item-${item.id}">
            <img src="${item.thumbnail}" alt="${item.title}" class="history-thumb">
            <div class="history-info">
                <div class="history-item-title">${item.title}</div>
                <div class="history-meta">
                    <span class="history-type ${item.format}">${item.format}</span>
                    <span>${formatDate(item.downloadedAt)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function handleHistoryClick(e) {
    const item = e.target.closest('.history-item');
    if (!item) return;
    
    const videoId = item.dataset.videoId;
    urlInput.value = `https://www.youtube.com/watch?v=${videoId}`;
    handleInput();
    fetchVideoInfo();
}

// Initialize
loadHistory();
updateUI();
