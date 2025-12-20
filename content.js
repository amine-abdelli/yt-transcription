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
function showSummaryModal(summary, summaryMode = 'detailed') {
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

  const titleContainer = document.createElement('div');
  const title = document.createElement('h2');

  const titleText = summaryMode === 'express' ? 'Ultra-short Summary' :
                    summaryMode === 'bullets' ? 'Bullet Points' :
                    'Detailed Summary';
  title.textContent = titleText;
  title.style.cssText = `
    margin: 0;
    font-size: 24px;
    font-family: "Roboto", Arial, sans-serif;
  `;

  if (summaryMode === 'express') {
    const badge = document.createElement('span');
    badge.textContent = '⚡ 3 sentences';
    badge.style.cssText = `
      display: inline-block;
      margin-left: 8px;
      padding: 4px 8px;
      background: #ff6b35;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      vertical-align: middle;
    `;
    title.appendChild(badge);
  }

  titleContainer.appendChild(title);

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

  header.appendChild(titleContainer);
  header.appendChild(closeBtn);

  // Create summary content
  const summaryDiv = document.createElement('div');
  summaryDiv.style.cssText = `
    font-family: "Roboto", Arial, sans-serif;
    font-size: ${summaryMode === 'express' ? '16px' : '14px'};
    line-height: ${summaryMode === 'express' ? '1.8' : '1.6'};
    white-space: pre-wrap;
    ${summaryMode === 'express' ? 'font-weight: 400;' : ''}
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

// Create a custom dropdown button
function createDropdownButton({ id, label, icon, options, onSelect }) {
  // Create container
  const container = document.createElement('div');
  container.style.cssText = `
    position: relative;
    display: inline-block;
  `;

  // Create button
  const button = document.createElement('button');
  button.id = id;
  button.innerHTML = `
    ${icon}
    <span style="margin: 0 4px;">${label}</span>
    <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: currentColor;">
      <path d="M7,10L12,15L17,10H7Z"/>
    </svg>
  `;
  button.style.cssText = `
    display: flex;
    align-items: center;
    padding: 6px 10px;
    background: var(--yt-spec-badge-chip-background);
    color: var(--yt-spec-text-secondary);
    border: none;
    border-radius: 18px;
    cursor: pointer;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.1s;
  `;

  // Create dropdown menu
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--yt-spec-menu-background);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    min-width: 200px;
    display: none;
    z-index: 10001;
    padding: 8px 0;
  `;

  // Create menu items
  options.forEach((option) => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 10px 16px;
      cursor: pointer;
      color: var(--yt-spec-text-primary);
      font-family: "Roboto", Arial, sans-serif;
      font-size: 14px;
      transition: background 0.1s;
    `;

    const labelDiv = document.createElement('div');
    labelDiv.textContent = option.label;
    labelDiv.style.cssText = `
      font-weight: 400;
    `;

    item.appendChild(labelDiv);

    if (option.description) {
      const descDiv = document.createElement('div');
      descDiv.textContent = option.description;
      descDiv.style.cssText = `
        font-size: 12px;
        color: var(--yt-spec-text-secondary);
        margin-top: 2px;
      `;
      item.appendChild(descDiv);
    }

    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });

    item.addEventListener('click', () => {
      menu.style.display = 'none';
      onSelect(option.value);
    });

    menu.appendChild(item);
  });

  // Toggle menu on button click
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = menu.style.display === 'block';
    // Close all other dropdowns first
    document.querySelectorAll('[id$="-dropdown"] + div').forEach(m => {
      if (m !== menu) m.style.display = 'none';
    });
    menu.style.display = isVisible ? 'none' : 'block';
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  // Hover effect
  button.addEventListener('mouseenter', () => {
    button.style.background = 'rgba(255, 255, 255, 0.1)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = 'var(--yt-spec-badge-chip-background)';
  });

  container.appendChild(button);
  container.appendChild(menu);

  return { container, button, menu };
}

// Handle summarize button click
async function handleSummarize(includeTimestamps, button, summaryMode = 'detailed') {
  console.log(`[Transcript Downloader] Generating ${summaryMode} summary...`);

  // Get API key
  const apiKey = await getApiKey();

  if (!apiKey) {
    alert('Please configure your OpenAI API key first!\n\nGo to the extension popup and enter your API key in the settings.');
    return;
  }

  // Disable button and show loading state
  button.disabled = true;
  const originalHTML = button.innerHTML;

  // Add spin animation if not already present
  if (!document.getElementById('spinner-animation-style')) {
    const style = document.createElement('style');
    style.id = 'spinner-animation-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  button.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor; animation: spin 1s linear infinite;">
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
    const summaryResult = await generateSummary(result.transcript, apiKey, summaryMode);

    if (summaryResult.success) {
      showSummaryModal(summaryResult.summary, summaryMode);
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

// Add download button to video metadata actions
function addDownloadButton() {
  console.log('[Transcript Downloader] Attempting to add buttons...');

  // Check if buttons already exist
  if (document.getElementById('transcript-download-container')) {
    console.log('[Transcript Downloader] Buttons already exist');
    return;
  }

  // Wait for the actions menu to be available
  const checkActions = setInterval(() => {
    const actionsMenu = document.querySelector('ytd-menu-renderer #top-level-buttons-computed');

    console.log('[Transcript Downloader] Looking for actions menu...', actionsMenu);

    if (actionsMenu && !document.getElementById('transcript-download-container')) {
      clearInterval(checkActions);
      console.log('[Transcript Downloader] Actions menu found!');

      // Check if we already have our buttons
      if (actionsMenu.querySelector('#transcript-download-container')) {
        console.log('[Transcript Downloader] Buttons already in DOM');
        return;
      }
        // Create container for our buttons
        const container = document.createElement('div');
        container.id = 'transcript-download-container';
        container.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0 8px;
        `;

        // Create "AI-powered summaries" label
        const aiLabel = document.createElement('span');
        aiLabel.textContent = 'AI-powered summaries';
        aiLabel.style.cssText = `
          font-size: 11px;
          color: var(--yt-spec-text-secondary);
          font-family: "Roboto", Arial, sans-serif;
          white-space: nowrap;
        `;

        // Create Summarize dropdown button
        const summarizeDropdown = createDropdownButton({
          id: 'transcript-summarize-dropdown',
          label: 'Summarize',
          icon: `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M15,18V16H8V18H15M15,14V12H8V14H15Z"/>
          </svg>`,
          options: [
            { value: 'detailed', label: 'Detailed summary', description: 'Comprehensive overview' },
            { value: 'bullets', label: 'Bullet points', description: 'Key highlights and takeaways' },
            { value: 'express', label: 'Ultra-short summary', description: '1-3 sentence overview' }
          ],
          onSelect: async (value) => {
            await handleSummarize(true, summarizeDropdown.button, value);
          }
        });

        // Create Transcript dropdown button
        const transcriptDropdown = createDropdownButton({
          id: 'transcript-download-dropdown',
          label: 'Transcript',
          icon: `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;">
            <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
          </svg>`,
          options: [
            { value: 'with-timestamps', label: 'Download with timestamps', description: '' },
            { value: 'without-timestamps', label: 'Download without timestamps', description: '' },
            { value: 'copy', label: 'Copy to clipboard', description: '' }
          ],
          onSelect: async (value) => {
            if (value === 'with-timestamps' || value === 'without-timestamps') {
              const includeTimestamps = value === 'with-timestamps';
              transcriptDropdown.button.disabled = true;
              const originalHTML = transcriptDropdown.button.innerHTML;

              transcriptDropdown.button.innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; animation: spin 1s linear infinite; margin-right: 4px;">
                  <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                </svg>
                Transcript
                <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: currentColor; margin-left: 4px;">
                  <path d="M7,10L12,15L17,10H7Z"/>
                </svg>
              `;

              const result = await getTranscript(includeTimestamps);

              if (result.success) {
                downloadTranscriptFile(result.transcript, result.title);
              }

              transcriptDropdown.button.innerHTML = originalHTML;
              transcriptDropdown.button.disabled = false;
            } else if (value === 'copy') {
              const result = await getTranscript(false);
              if (result.success) {
                navigator.clipboard.writeText(result.transcript);
                const originalHTML = transcriptDropdown.button.innerHTML;
                transcriptDropdown.button.innerHTML = `
                  <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: #0f0; margin-right: 4px;">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                  </svg>
                  Copied!
                  <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: currentColor; margin-left: 4px;">
                    <path d="M7,10L12,15L17,10H7Z"/>
                  </svg>
                `;
                setTimeout(() => {
                  transcriptDropdown.button.innerHTML = originalHTML;
                }, 2000);
              }
            }
          }
        });

      container.appendChild(aiLabel);
      container.appendChild(summarizeDropdown.container);
      container.appendChild(transcriptDropdown.container);

      // Insert buttons into the actions menu (after share button)
      actionsMenu.appendChild(container);

      console.log('[Transcript Downloader] ✅ Buttons added successfully!');
    }
  }, 500);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkActions), 10000);
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

  // Add buttons to video metadata on page load
  addDownloadButton();

  // Also re-add on navigation (YouTube is a SPA)
  setInterval(() => {
    if (!document.getElementById('transcript-download-container')) {
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