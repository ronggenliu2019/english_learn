// content.js - placeholder for future subtitle overlay and sync logic 

// ==UserScript==
// @name         English Learn YouTube Subtitles Overlay
// ==/UserScript==

const COMPLEX_WORDS = ["episode", "Search", "Agents", "meticulous", "benevolent"];
let subtitles = [];
let subtitleTimer = null;
let subtitlePaused = true;
let subtitleOffset = 0;
let lastVideoTime = 0;

function parseSRT(data) {
  const pattern = /\d+\s+([\d:,]+)\s+-->\s+([\d:,]+)\s+([\s\S]*?)(?=\n\d+\s|$)/g;
  const toSeconds = t => {
    const [h, m, s] = t.replace(',', '.').split(':');
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  };
  let match, results = [];
  while ((match = pattern.exec(data)) !== null) {
    const sentence = match[3].replace(/\n/g, ' ').trim();
    const words = sentence.split(/(\b\w+\b)/g).filter(w => w.trim());
    const totalDuration = toSeconds(match[2]) - toSeconds(match[1]);
    
    results.push({
      start: toSeconds(match[1]),
      end: toSeconds(match[2]),
      text: sentence,
      words: words.map((word, index) => ({
        text: word,
        start: toSeconds(match[1]) + (totalDuration * index)/words.length,
        end: toSeconds(match[1]) + (totalDuration * (index+1))/words.length
      }))
    });
  }
  return results;
}

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

function getCurrentSubtitle(time) {
  for (let i = 0; i < subtitles.length; i++) {
    if (time >= subtitles[i].start + subtitleOffset && time <= subtitles[i].end + subtitleOffset) {
      return subtitles[i].text;
    }
  }
  return '';
}

function displaySubtitleLine(time) {
  let container = document.getElementById('el-subtitle-overlay');
  if (!container) {
    container = document.createElement('div');
    container.id = 'el-subtitle-overlay';
    document.body.appendChild(container);
  }

  if (!subtitles?.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  
  const currentSentence = subtitles.find(s => 
    time >= s.start - 0.5 && time <= s.end + 0.5
  );
  
  if (currentSentence) {
    container.style.display = 'block';
    // 使用与el-subtitle-overlay相同的背景透明度和更大的字体
    container.innerHTML = `<div class="el-subtitle-line" style="font-size: 18px !important; background: rgba(0, 0, 0, 0) !important;">${
      currentSentence.words
      .map(word => {
        // 使用重叠时间区间检测
        const isActive = time + 0.1 >= word.start && time - 0.1 <= word.end;
        
        // 增加动画帧请求
        function updateHighlight() {
          requestAnimationFrame(() => {
            container.querySelectorAll('span').forEach(span => {
              const wordTime = parseFloat(span.dataset.start);
              span.classList.toggle('active-word', 
                currentTime >= wordTime - 0.2 && 
                currentTime <= wordTime + 0.3
              );
            });
          });
        }
        return `<span class="${isActive ? 'active-word' : ''}">${word.text}</span>`;
      }).join('')
    }</div>`;
  } else {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

function startSubtitleSync(video) {
  if (subtitleTimer) clearInterval(subtitleTimer);
  subtitlePaused = false;
  subtitleTimer = setInterval(() => {
    if (subtitlePaused) return;
    const currentTime = video.currentTime;
    lastVideoTime = currentTime;
    displaySubtitleLine(currentTime); // 确保传递当前时间
  }, 200);
}

function pauseSubtitleSync() {
  subtitlePaused = true;
  if (subtitleTimer) clearInterval(subtitleTimer);
}

function showDictModal(word, definition) {
  let modal = document.getElementById('el-dict-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'el-dict-modal';
  modal.innerHTML = `
    <div id="el-dict-modal-content">
      <span id="el-dict-modal-close">&times;</span>
      <h4>${word}</h4>
      <div>${definition}</div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('el-dict-modal-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

function onSubtitleClick(e) {
  if (e.target.classList.contains('el-complex-word')) {
    const word = e.target.textContent;
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
      .then(res => res.json())
      .then(data => {
        const def = data[0]?.meanings[0]?.definitions[0]?.definition || 'No definition found.';
        showDictModal(word, def);
      })
      .catch(() => showDictModal(word, 'Failed to fetch definition.'));
  }
}

function injectOverlay() {
  if (document.getElementById('el-subtitle-overlay')) return;
  const player = document.querySelector('.html5-video-player');
  if (!player) return;
  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'el-subtitle-overlay';
  // 设置与.el-subtitle-line完全相同的样式
  overlay.style.background = 'rgba(0, 0, 0, 0.7) !important';
  overlay.style.fontSize = '18px !important';
  overlay.addEventListener('click', onSubtitleClick);
  player.appendChild(overlay);
  // Controls
  const controls = document.createElement('div');
  controls.id = 'el-subtitle-controls';
  controls.innerHTML = `
    <input type="file" id="el-subtitle-upload" accept=".srt,.vtt" style="color:#fff;" />
    <button id="el-subtitle-start" class="btn btn-success btn-sm">Start</button>
    <button id="el-subtitle-pause" class="btn btn-secondary btn-sm">Pause</button>
    <label style="color:#fff;font-size:0.95em;">Offset <input id="el-subtitle-offset" type="number" value="0" step="0.1" style="width:60px;" />s</label>
  `;
  player.appendChild(controls);
  // Upload
  controls.querySelector('#el-subtitle-upload').addEventListener('change', (e) => {
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
      displaySubtitleLine('');
    };
    reader.readAsText(file);
  });
  // Start
  controls.querySelector('#el-subtitle-start').onclick = () => {
    const video = document.querySelector('video');
    if (video) {
      subtitlePaused = false;
      startSubtitleSync(video);
    }
  };
  // Pause
  controls.querySelector('#el-subtitle-pause').onclick = () => {
    pauseSubtitleSync();
  };
  // Offset
  controls.querySelector('#el-subtitle-offset').oninput = (e) => {
    subtitleOffset = parseFloat(e.target.value) || 0;
  };
  // Subtitle click
  overlay.addEventListener('click', onSubtitleClick);
}

function waitForPlayerAndInject() {
  const tryInject = () => {
    if (document.querySelector('.html5-video-player') && document.querySelector('video')) {
      injectOverlay();
    } else {
      setTimeout(tryInject, 1000);
    }
  };
  tryInject();
}

waitForPlayerAndInject();