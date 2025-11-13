// Content script to extract YouTube transcriptions

// Prevent multiple injections
if (window.transcriptDownloaderLoaded) {
  console.log('[Transcript Downloader] Already loaded, skipping...');
} else {
  window.transcriptDownloaderLoaded = true;
  console.log('[Transcript Downloader] Content script loading for the first time...');
}

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

// Create and show summary modal
function showSummaryModal(summary) {
  // Remove existing modal if any
  const existingModal = document.getElementById('transcript-summary-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'transcript-summary-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--yt-spec-base-background);
    color: var(--yt-spec-text-primary);
    border-radius: 12px;
    padding: 24px;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--yt-spec-10-percent-layer);
  `;

  const title = document.createElement('h2');
  title.textContent = 'Video Summary';
  title.style.cssText = `
    margin: 0;
    font-size: 24px;
    font-family: "Roboto", Arial, sans-serif;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    font-size: 32px;
    cursor: pointer;
    color: var(--yt-spec-text-primary);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => modal.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Create summary content
  const summaryDiv = document.createElement('div');
  summaryDiv.style.cssText = `
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
  `;
  summaryDiv.textContent = summary;

  // Create copy button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy Summary';
  copyBtn.style.cssText = `
    margin-top: 16px;
    padding: 10px 20px;
    background: #065fd4;
    color: white;
    border: none;
    border-radius: 18px;
    cursor: pointer;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
  `;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(summary);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy Summary';
    }, 2000);
  };

  modalContent.appendChild(header);
  modalContent.appendChild(summaryDiv);
  modalContent.appendChild(copyBtn);
  modal.appendChild(modalContent);

  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };

  document.body.appendChild(modal);
}

// Handle summarize button click
async function handleSummarize(includeTimestamps, button) {
  console.log('[Transcript Downloader] Generating summary...');

  // Get API key
  const apiKey = await getApiKey();

  if (!apiKey) {
    alert('Please configure your OpenAI API key first!\n\nGo to the extension popup and enter your API key in the settings.');
    return;
  }

  // Disable button and show loading state
  button.disabled = true;
  const originalHTML = button.innerHTML;
  button.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor; animation: spin 1s linear infinite;">
      <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
    </svg>
  `;

  try {
    // Get transcript
    const result = await getTranscript(includeTimestamps);

    if (!result.success) {
      alert('Failed to get transcript: ' + result.error);
      return;
    }

    // Generate summary using OpenAI
    const summaryResult = await generateSummary(result.transcript, apiKey);

    if (summaryResult.success) {
      showSummaryModal(summaryResult.summary);
    } else {
      alert('Failed to generate summary: ' + summaryResult.error);
    }

  } catch (error) {
    console.error('[Transcript Downloader] Summary error:', error);
    alert('Error generating summary: ' + error.message);
  } finally {
    // Restore button
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
}

// Add download button to transcript panel
function addDownloadButton() {
  console.log('[Transcript Downloader] Attempting to add download button...');

  // Check if button already exists
  if (document.getElementById('transcript-download-btn')) {
    console.log('[Transcript Downloader] Button already exists');
    return;
  }

  // Wait for transcript panel to be available
  const checkPanel = setInterval(() => {
    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    console.log('[Transcript Downloader] Looking for panel...', transcriptPanel);

    if (transcriptPanel && transcriptPanel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
      clearInterval(checkPanel);
      console.log('[Transcript Downloader] Panel found and expanded!');

      // Find the transcript header area - try multiple selectors
      let header = transcriptPanel.querySelector('ytd-engagement-panel-title-header-renderer');
      if (!header) {
        header = transcriptPanel.querySelector('#header');
      }
      if (!header) {
        header = transcriptPanel.querySelector('[id*="header"]');
      }

      console.log('[Transcript Downloader] Header found:', header);

      if (header && !document.getElementById('transcript-download-btn')) {
        // Create container for our buttons
        const container = document.createElement('div');
        container.id = 'transcript-download-container';
        container.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
          padding-right: 16px;
        `;

        // Create checkbox for timestamps
        const checkboxLabel = document.createElement('label');
        checkboxLabel.style.cssText = `
          display: flex;
          align-items: center;
          font-size: 12px;
          color: var(--yt-spec-text-secondary);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'transcript-include-timestamps';
        checkbox.checked = true;
        checkbox.style.cssText = `
          margin-right: 4px;
          cursor: pointer;
        `;

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(document.createTextNode('Timestamps'));

        // Create download button
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'transcript-download-btn';
        downloadBtn.innerHTML = `
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
            <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
          </svg>
        `;
        downloadBtn.style.cssText = `
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: transparent;
          color: var(--yt-spec-text-primary);
          border: 1px solid var(--yt-spec-10-percent-layer);
          border-radius: 18px;
          cursor: pointer;
          font-family: "Roboto","Arial",sans-serif;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        `;

        downloadBtn.addEventListener('mouseenter', () => {
          downloadBtn.style.background = 'var(--yt-spec-badge-chip-background)';
        });

        downloadBtn.addEventListener('mouseleave', () => {
          downloadBtn.style.background = 'transparent';
        });

        downloadBtn.addEventListener('click', async () => {
          const includeTimestamps = checkbox.checked;
          downloadBtn.disabled = true;
          downloadBtn.innerHTML = `
            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor; animation: spin 1s linear infinite;">
              <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
            </svg>
            <span style="margin-left: 4px;">Downloading...</span>
          `;

          // Add spin animation
          const style = document.createElement('style');
          style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
          document.head.appendChild(style);

          const result = await getTranscript(includeTimestamps);

          if (result.success) {
            downloadTranscriptFile(result.transcript, result.title);
            downloadBtn.innerHTML = `
              <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #0f0;">
                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
              </svg>
              <span style="margin-left: 4px;">Downloaded!</span>
            `;
            setTimeout(() => {
              downloadBtn.innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
                  <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                </svg>
                <span style="margin-left: 4px;">Download</span>
              `;
              downloadBtn.disabled = false;
            }, 2000);
          } else {
            downloadBtn.innerHTML = `
              <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: #f00;">
                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
              </svg>
              <span style="margin-left: 4px;">Error</span>
            `;
            setTimeout(() => {
              downloadBtn.innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
                  <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                </svg>
                <span style="margin-left: 4px;">Download</span>
              `;
              downloadBtn.disabled = false;
            }, 2000);
          }
        });

        // Create Summarize button
        const summarizeBtn = document.createElement('button');
        summarizeBtn.id = 'transcript-summarize-btn';
        summarizeBtn.innerHTML = `
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M15,18V16H8V18H15M15,14V12H8V14H15Z"/>
          </svg>
        `;
        summarizeBtn.title = 'Summarize with AI';
        summarizeBtn.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: transparent;
          color: var(--yt-spec-text-primary);
          border: 1px solid var(--yt-spec-10-percent-layer);
          border-radius: 18px;
          cursor: pointer;
          font-family: "Roboto","Arial",sans-serif;
          transition: background 0.2s;
        `;

        summarizeBtn.addEventListener('mouseenter', () => {
          summarizeBtn.style.background = 'var(--yt-spec-badge-chip-background)';
        });

        summarizeBtn.addEventListener('mouseleave', () => {
          summarizeBtn.style.background = 'transparent';
        });

        summarizeBtn.addEventListener('click', async () => {
          await handleSummarize(checkbox.checked, summarizeBtn);
        });

        container.appendChild(checkboxLabel);
        container.appendChild(downloadBtn);
        container.appendChild(summarizeBtn);

        // Insert into header
        if (!header.querySelector('#transcript-download-container')) {
          header.style.display = 'flex';
          header.style.alignItems = 'center';
          header.appendChild(container);
          console.log('[Transcript Downloader] ✅ Download button added successfully!');
        }
      } else {
        console.log('[Transcript Downloader] ❌ Header not found or button already exists');
      }
    }
  }, 500);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkPanel), 10000);
}

// Function to download transcript file
function downloadTranscriptFile(content, videoTitle) {
  const safeTitle = videoTitle
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);

  const filename = `transcript_${safeTitle}.txt`;
  const blob = new Blob([content], {
    type: 'text/plain'
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Only initialize once
if (!window.transcriptDownloaderInitialized) {
  window.transcriptDownloaderInitialized = true;

  // Continuously check for transcript panel (more aggressive approach)
  console.log('[Transcript Downloader] Content script loaded!');

  // Run check every 2 seconds
  setInterval(() => {
    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');

    if (transcriptPanel && transcriptPanel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
      if (!document.getElementById('transcript-download-btn')) {
        console.log('[Transcript Downloader] Panel is open, adding button...');
        addDownloadButton();
      }
    }
  }, 2000);

  // Also check on page load
  setTimeout(() => {
    console.log('[Transcript Downloader] Initial check...');
    const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
    if (transcriptPanel && transcriptPanel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
      addDownloadButton();
    }
  }, 2000);

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTranscript') {
      getTranscript(request.includeTimestamps).then(sendResponse);
      return true; // Keep the message channel open for async response
    }
  });
}