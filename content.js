// Content script to extract YouTube transcriptions

async function getTranscript(includeTimestamps) {
  try {
    // Wait for the page to be fully loaded
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });

    // Get video title
    const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
    const videoTitle = titleElement ? titleElement.textContent.trim() : 'transcript';

    // Open the transcript panel
    const transcriptButton = await findTranscriptButton();
    if (!transcriptButton) {
      throw new Error('Transcript button not found. Make sure captions are available for this video.');
    }

    // Click to open transcript if not already open
    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    if (!transcriptPanel || transcriptPanel.getAttribute('visibility') !== 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for panel to open
    }

    // Get all transcript segments
    const segments = document.querySelectorAll('ytd-transcript-segment-renderer');

    if (segments.length === 0) {
      throw new Error('No transcript segments found. Please make sure the transcript panel is loaded.');
    }

    let transcriptText = '';

    segments.forEach(segment => {
      const timestamp = segment.querySelector('.segment-timestamp')?.textContent?.trim();
      const text = segment.querySelector('.segment-text')?.textContent?.trim();

      if (text) {
        if (includeTimestamps && timestamp) {
          transcriptText += `[${timestamp}] ${text}\n`;
        } else {
          transcriptText += `${text}\n`;
        }
      }
    });

    return {
      success: true,
      transcript: transcriptText,
      title: videoTitle
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function findTranscriptButton() {
  // Try to find the transcript button (it might be in different locations)
  const selectors = [
    'button[aria-label*="transcript" i]',
    'button[aria-label*="Show transcript" i]',
    'ytd-button-renderer:has(yt-formatted-string:contains("Transcript"))',
    '#primary-button button:has-text("Show transcript")'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) return button;
  }

  // Alternative: Look in the description area buttons
  const buttons = document.querySelectorAll('ytd-menu-renderer button, ytd-button-renderer button');
  for (const button of buttons) {
    const text = button.textContent.toLowerCase();
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    if (text.includes('transcript') || ariaLabel.includes('transcript')) {
      return button;
    }
  }

  return null;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    getTranscript(request.includeTimestamps).then(sendResponse);
    return true; // Keep the message channel open for async response
  }
});
