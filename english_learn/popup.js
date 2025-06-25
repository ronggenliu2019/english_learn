// Placeholder for complex words list (to be replaced by user)
const COMPLEX_WORDS = ["notorious", "intricate", "ubiquitous", "meticulous", "benevolent"];

let subtitles = [];
let subtitleTimer = null;
let subtitleStartTime = 0;
let subtitlePaused = true;
let subtitleElapsed = 0;

// Extract video ID from URL
function extractVideoId(url) {
  const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Fetch YouTube captions list (auto-generated)
async function fetchYouTubeCaptions(videoId) {
  // This is a placeholder. YouTube captions are not directly accessible via public API due to CORS.
  // In production, you may need a backend or use 3rd-party services.
  // Here, we simulate failure to trigger upload.
  return null;
}

// Parse SRT file
function parseSRT(data) {
  const pattern = /\d+\s+([\d:,]+)\s+-->\s+([\d:,]+)\s+([\s\S]*?)(?=\n\d+\s|$)/g;
  const toSeconds = t => {
    const [h, m, s] = t.replace(',', '.').split(':');
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  };
  let match, results = [];
  while ((match = pattern.exec(data)) !== null) {
    results.push({
      start: toSeconds(match[1]),
      end: toSeconds(match[2]),
      text: match[3].replace(/\n/g, ' ').trim()
    });
  }
  return results;
}

// Parse VTT file
function parseVTT(data) {
  const pattern = /([\d:.]+)\s+-->\s+([\d:.]+)\s+([\s\S]*?)(?=\n\n|$)/g;
  const toSeconds = t => {
    const [h, m, s] = t.split(':');
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  };
  let match, results = [];
  while ((match = pattern.exec(data)) !== null) {
    results.push({
      start: toSeconds(match[1]),
      end: toSeconds(match[2]),
      text: match[3].replace(/\n/g, ' ').trim()
    });
  }
  return results;
}

// Find current subtitle line by time
function getCurrentSubtitle(time) {
  for (let i = 0; i < subtitles.length; i++) {
    if (time >= subtitles[i].start && time <= subtitles[i].end) {
      return subtitles[i].text;
    }
  }
  return '';
}

// Display subtitle line with word highlighting
function displaySubtitleLine(line) {
  const container = document.getElementById('subtitleContainer');
  if (!line) {
    container.innerHTML = '';
    return;
  }
  const html = line.split(/(\b\w+\b)/g).map(word => {
    if (COMPLEX_WORDS.includes(word.toLowerCase())) {
      return `<span class=\"complex-word\">${word}</span>`;
    }
    return word;
  }).join('');
  container.innerHTML = `<div class=\"subtitle-line\">${html}</div>`;
}

// Sync subtitles with a timer
function startSubtitleSync() {
  if (subtitleTimer) clearInterval(subtitleTimer);
  subtitlePaused = false;
  subtitleStartTime = Date.now() - subtitleElapsed * 1000;
  subtitleTimer = setInterval(() => {
    if (subtitlePaused) return;
    subtitleElapsed = (Date.now() - subtitleStartTime) / 1000;
    const line = getCurrentSubtitle(subtitleElapsed);
    displaySubtitleLine(line);
  }, 200);
}

function pauseSubtitleSync() {
  subtitlePaused = true;
  if (subtitleTimer) clearInterval(subtitleTimer);
}

// Handle word click for dictionary lookup
function onSubtitleClick(e) {
  if (e.target.classList.contains('complex-word')) {
    const word = e.target.textContent;
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
      .then(res => res.json())
      .then(data => {
        const def = data[0]?.meanings[0]?.definitions[0]?.definition || 'No definition found.';
        alert(`${word}: ${def}`);
      })
      .catch(() => alert('Failed to fetch definition.'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('subtitleContainer').addEventListener('click', onSubtitleClick);

  document.getElementById('videoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('youtubeUrl').value;
    const videoId = extractVideoId(url);
    if (!videoId) {
      alert('Invalid YouTube URL');
      return;
    }
    // Load video
    const videoContainer = document.getElementById('videoContainer');
    videoContainer.innerHTML = `<iframe id=\"ytplayer\" width=\"100%\" height=\"200\" src=\"https://www.youtube.com/embed/${videoId}\" frameborder=\"0\" allowfullscreen></iframe>`;
    videoContainer.style.display = 'block';
    document.getElementById('subtitleControls').style.display = 'flex';
    // Try to fetch captions
    const captions = await fetchYouTubeCaptions(videoId);
    if (!captions) {
      document.getElementById('uploadSubtitleDiv').style.display = 'block';
      document.getElementById('subtitleContainer').innerHTML = '<div class=\"text-warning\">No auto subtitles found. Please upload a subtitle file.</div>';
    } else {
      document.getElementById('uploadSubtitleDiv').style.display = 'none';
      subtitles = captions;
    }
    // Reset subtitle timer
    pauseSubtitleSync();
    subtitleElapsed = 0;
    displaySubtitleLine('');
  });

  // Handle subtitle file upload
  document.getElementById('subtitleFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      let parsed = [];
      if (file.name.endsWith('.srt')) {
        parsed = parseSRT(evt.target.result);
      } else if (file.name.endsWith('.vtt')) {
        parsed = parseVTT(evt.target.result);
      } else {
        alert('Unsupported subtitle format. Please upload .srt or .vtt file.');
        return;
      }
      subtitles = parsed;
      pauseSubtitleSync();
      subtitleElapsed = 0;
      displaySubtitleLine('');
    };
    reader.readAsText(file);
  });

  // Start subtitles button
  document.getElementById('startSubtitlesBtn').addEventListener('click', () => {
    startSubtitleSync();
  });
  // Pause subtitles button
  document.getElementById('pauseSubtitlesBtn').addEventListener('click', () => {
    pauseSubtitleSync();
  });
}); 