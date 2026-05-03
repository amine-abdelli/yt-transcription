// Core content script — transcript extraction + sponsor auto-skip
// The UI is handled by panel.js + recap-orchestrator.js

async function getTranscript(includeTimestamps) {
  try {
    await new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve);
    });

    const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
    const videoTitle = titleElement ? titleElement.textContent.trim() : 'transcript';

    const transcriptButton = await findTranscriptButton();
    if (!transcriptButton) {
      throw new Error('Transcript button not found. Make sure captions are available for this video.');
    }

    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    if (!transcriptPanel || transcriptPanel.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Support both the old DOM (ytd-transcript-segment-renderer) and the new ViewModel DOM
    let segments = document.querySelectorAll('ytd-transcript-segment-renderer');
    const isNewDOM = segments.length === 0;
    if (isNewDOM) {
      segments = document.querySelectorAll('transcript-segment-view-model');
    }

    if (segments.length === 0) {
      throw new Error('No transcript segments found. Please make sure the transcript panel is loaded.');
    }

    let transcriptText = '';
    segments.forEach(segment => {
      let timestamp, text;
      if (isNewDOM) {
        timestamp = segment.querySelector('.ytwTranscriptSegmentViewModelTimestamp')?.textContent?.trim();
        text = segment.querySelector('.ytAttributedStringHost')?.textContent?.trim();
      } else {
        timestamp = segment.querySelector('.segment-timestamp')?.textContent?.trim();
        text = segment.querySelector('.segment-text')?.textContent?.trim();
      }
      if (text) {
        if (includeTimestamps && timestamp) transcriptText += `[${timestamp}] ${text}\n`;
        else transcriptText += `${text}\n`;
      }
    });

    return { success: true, transcript: transcriptText, title: videoTitle };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function findTranscriptButton() {
  const selectors = [
    'button[aria-label*="transcript" i]',
    'button[aria-label*="Show transcript" i]'
  ];
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) return button;
  }

  const buttons = document.querySelectorAll('ytd-menu-renderer button, ytd-button-renderer button');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    if (text.includes('transcript') || ariaLabel.includes('transcript')) return button;
  }
  return null;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showSkipNotification(segment) {
  const existing = document.getElementById('sponsor-skip-notification');
  if (existing) existing.remove();

  const moviePlayer = document.querySelector('#movie_player');
  if (!moviePlayer) return;

  const duration = Math.round(segment.end - segment.start);
  const notification = document.createElement('div');
  notification.id = 'sponsor-skip-notification';
  notification.innerHTML = `
    <span style="background:#ff0000;padding:4px 6px;border-radius:2px;margin-right:10px;font-size:11px;">⏭</span>
    <span>Sponsor skipped</span>
    <span style="margin-left:8px;color:rgba(255,255,255,0.7);">(+${duration}s)</span>
    <span style="margin-left:14px;opacity:0.6;font-size:18px;line-height:1;">&times;</span>
  `;
  notification.style.cssText = `
    position:absolute;top:10px;left:10px;
    background:rgba(33,33,33,0.95);color:white;
    padding:10px 14px;border-radius:2px;
    font-family:"YouTube Sans","Roboto",Arial,sans-serif;
    font-size:14px;font-weight:500;z-index:9999;
    display:flex;align-items:center;cursor:pointer;
    transition:opacity 0.3s;box-shadow:0 2px 10px rgba(0,0,0,0.3);
  `;
  notification.addEventListener('click', () => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  });
  moviePlayer.appendChild(notification);
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }
  }, 4000);
}

let sponsorSegments = [];
let sponsorSkipActive = false;
let videoTimeChecker = null;
let currentVideoId = null;

async function autoDetectAndSkipSponsors(indicator) {
  const skipEnabled = await new Promise(resolve => {
    chrome.storage.sync.get(['filterSponsors'], result => resolve(result.filterSponsors !== false));
  });

  if (!skipEnabled) {
    indicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;margin-right:4px;"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,10.5A1.5,1.5 0 0,0 10.5,12A1.5,1.5 0 0,0 12,13.5A1.5,1.5 0 0,0 13.5,12A1.5,1.5 0 0,0 12,10.5Z"/></svg><span>Skip disabled</span>`;
    indicator.style.background = 'rgba(128,128,128,0.15)';
    indicator.style.color = '#888';
    return;
  }

  const videoId = new URLSearchParams(window.location.search).get('v');
  if (videoId === currentVideoId && sponsorSkipActive) return;
  currentVideoId = videoId;

  if (videoTimeChecker) { clearInterval(videoTimeChecker); videoTimeChecker = null; }
  sponsorSegments = [];
  sponsorSkipActive = false;

  const apiKey = await getApiKey();
  if (!apiKey) {
    indicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;margin-right:4px;"><path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg><span>No API key</span>`;
    indicator.style.background = 'rgba(255,0,0,0.1)';
    indicator.style.color = '#ff6b6b';
    return;
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const result = await getTranscript(true);
    if (!result.success) throw new Error(result.error);

    const detection = await detectSponsorSegments(result.transcript, apiKey);
    if (!detection.success) throw new Error(detection.error);

    sponsorSegments = detection.segments || [];

    if (sponsorSegments.length === 0) {
      indicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;margin-right:4px;"><path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/></svg><span>No sponsors detected</span>`;
      indicator.style.background = 'rgba(0,200,0,0.1)';
      indicator.style.color = '#4ade80';
      return;
    }

    const segmentsList = sponsorSegments.map(s => `${formatTime(s.start)}-${formatTime(s.end)}`).join(', ');
    sponsorSkipActive = true;
    indicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;margin-right:4px;"><path d="M6,18L14.5,12L6,6M16,6V18H18V6"/></svg><span title="${segmentsList}">Skipping sponsors: ${segmentsList}</span>`;
    indicator.style.background = 'rgba(204,0,0,0.15)';
    indicator.style.color = '#ff4444';
    indicator.style.cursor = 'help';

    const video = document.querySelector('video');
    if (!video) return;

    videoTimeChecker = setInterval(() => {
      if (!sponsorSkipActive) { clearInterval(videoTimeChecker); return; }
      const currentTime = video.currentTime;
      for (const segment of sponsorSegments) {
        const start = Number(segment.start);
        const end = Number(segment.end);
        if (currentTime >= start && currentTime < end) {
          video.currentTime = end + 0.5;
          showSkipNotification(segment);
          break;
        }
      }
    }, 500);

  } catch (error) {
    console.error('[Recap] Auto-detect error:', error);
    indicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;margin-right:4px;"><path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/></svg><span>Detection failed</span>`;
    indicator.style.background = 'rgba(255,165,0,0.15)';
    indicator.style.color = '#ffa500';
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    getTranscript(request.includeTimestamps).then(sendResponse);
    return true;
  }
});
