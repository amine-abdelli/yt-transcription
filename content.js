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
function showSummaryModal(summary, summaryMode = 'detailed', isLoading = false) {
  // Remove existing modal if any
  const existingModal = document.getElementById('transcript-summary-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Get video title for the header
  const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
  const videoTitle = titleElement ? titleElement.textContent.trim() : '';

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
    padding: 0;
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: flex-start;
    padding: 24px;
    border-bottom: 1px solid var(--yt-spec-10-percent-layer);
    gap: 16px;
  `;

  // Red circle with star icon
  const iconCircle = document.createElement('div');
  iconCircle.style.cssText = `
    width: 48px;
    height: 48px;
    background: #d32f2f;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `;
  iconCircle.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: white;">
      <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
    </svg>
  `;

  // Title section
  const titleSection = document.createElement('div');
  titleSection.style.cssText = `
    flex: 1;
    min-width: 0;
  `;

  const modeTitle = document.createElement('h2');
  const titleText = summaryMode === 'express' ? 'Quick Summary' :
                    summaryMode === 'bullets' ? 'Bullet Points Summary' :
                    'Detailed Summary';
  modeTitle.textContent = titleText;
  modeTitle.style.cssText = `
    margin: 0 0 4px 0;
    font-size: 20px;
    font-family: "Roboto", Arial, sans-serif;
    font-weight: 500;
  `;

  const videoTitleDiv = document.createElement('div');
  videoTitleDiv.textContent = videoTitle;
  videoTitleDiv.style.cssText = `
    font-size: 14px;
    color: var(--yt-spec-text-secondary);
    font-family: "Roboto", Arial, sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  `;

  titleSection.appendChild(modeTitle);
  titleSection.appendChild(videoTitleDiv);

  // Close button
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
    flex-shrink: 0;
  `;
  closeBtn.onclick = () => modal.remove();

  header.appendChild(iconCircle);
  header.appendChild(titleSection);
  header.appendChild(closeBtn);

  // Create content area
  const contentArea = document.createElement('div');
  contentArea.id = 'modal-content-area';
  contentArea.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  if (isLoading) {
    // Show loader
    const loaderContainer = document.createElement('div');
    loaderContainer.style.cssText = `
      text-align: center;
    `;

    // Add spin animation if not already present
    if (!document.getElementById('spinner-animation-style')) {
      const style = document.createElement('style');
      style.id = 'spinner-animation-style';
      style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    loaderContainer.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: currentColor; animation: spin 1s linear infinite; margin-bottom: 16px;">
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
      <div style="color: var(--yt-spec-text-secondary); font-family: 'Roboto', Arial, sans-serif; font-size: 14px;">
        Generating summary...
      </div>
    `;
    contentArea.appendChild(loaderContainer);
  } else {
    // Show summary content
    contentArea.style.alignItems = 'flex-start';
    contentArea.style.justifyContent = 'flex-start';

    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `
      font-family: "Roboto", Arial, sans-serif;
      font-size: ${summaryMode === 'express' ? '16px' : '14px'};
      line-height: ${summaryMode === 'express' ? '1.8' : '1.6'};
      white-space: pre-wrap;
      ${summaryMode === 'express' ? 'font-weight: 400;' : ''}
      width: 100%;
    `;
    summaryDiv.textContent = summary;
    contentArea.appendChild(summaryDiv);
  }

  // Create footer with buttons (always show footer)
  const footer = document.createElement('div');
  footer.id = 'modal-footer';
  footer.style.cssText = `
    padding: 16px 24px;
    border-top: 1px solid var(--yt-spec-10-percent-layer);
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const poweredBy = document.createElement('div');
  poweredBy.textContent = 'Powered by AI SDK';
  poweredBy.style.cssText = `
    font-size: 12px;
    color: var(--yt-spec-text-secondary);
    font-family: "Roboto", Arial, sans-serif;
  `;

  const buttonGroup = document.createElement('div');
  buttonGroup.id = 'modal-button-group';
  buttonGroup.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  // Regenerate button
  const regenerateBtn = document.createElement('button');
  regenerateBtn.id = 'regenerate-btn';
  regenerateBtn.disabled = isLoading;
  regenerateBtn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; margin-right: 6px;">
      <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
    </svg>
    Regenerate
  `;
  regenerateBtn.style.cssText = `
    padding: 8px 16px;
    background: transparent;
    color: var(--yt-spec-text-primary);
    border: 1px solid var(--yt-spec-10-percent-layer);
    border-radius: 18px;
    cursor: ${isLoading ? 'not-allowed' : 'pointer'};
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    opacity: ${isLoading ? '0.5' : '1'};
  `;
  regenerateBtn.onclick = () => {
    if (!isLoading) {
      const currentMode = summaryMode;
      modal.remove();
      handleSummarize(true, currentMode);
    }
  };
  buttonGroup.appendChild(regenerateBtn);

  // Download button
  const downloadBtn = document.createElement('button');
  downloadBtn.id = 'download-btn';
  downloadBtn.disabled = isLoading;
  downloadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; margin-right: 6px;">
      <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
    </svg>
    Download
  `;
  downloadBtn.style.cssText = `
    padding: 8px 16px;
    background: transparent;
    color: var(--yt-spec-text-primary);
    border: 1px solid var(--yt-spec-10-percent-layer);
    border-radius: 18px;
    cursor: ${isLoading ? 'not-allowed' : 'pointer'};
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    opacity: ${isLoading ? '0.5' : '1'};
  `;
  downloadBtn.onclick = () => {
    if (!isLoading) {
      const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
      const videoTitle = titleElement ? titleElement.textContent.trim() : 'summary';
      const safeTitle = videoTitle
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 100);
      const filename = `summary_${safeTitle}.txt`;

      const blob = new Blob([summary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  buttonGroup.appendChild(downloadBtn);

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.id = 'copy-btn';
  copyBtn.disabled = isLoading;
  copyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: ${isLoading ? 'currentColor' : 'white'}; margin-right: 6px;">
      <path d="M16,1H4C2.9,1,2,1.9,2,3V17H4V3H16V1M19,5H8C6.9,5,6,5.9,6,7V21C6,22.1,6.9,23,8,23H19C20.1,23,21,22.1,21,21V7C21,5.9,20.1,5,19,5M19,21H8V7H19V21Z"/>
    </svg>
    Copy
  `;
  copyBtn.style.cssText = `
    padding: 8px 16px;
    background: ${isLoading ? 'transparent' : '#cc6666'};
    color: ${isLoading ? 'var(--yt-spec-text-primary)' : 'white'};
    border: ${isLoading ? '1px solid var(--yt-spec-10-percent-layer)' : 'none'};
    border-radius: 18px;
    cursor: ${isLoading ? 'not-allowed' : 'pointer'};
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    opacity: ${isLoading ? '0.5' : '1'};
  `;
  copyBtn.onclick = () => {
    if (!isLoading) {
      navigator.clipboard.writeText(summary);
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white; margin-right: 6px;">
          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white; margin-right: 6px;">
            <path d="M16,1H4C2.9,1,2,1.9,2,3V17H4V3H16V1M19,5H8C6.9,5,6,5.9,6,7V21C6,22.1,6.9,23,8,23H19C20.1,23,21,22.1,21,21V7C21,5.9,20.1,5,19,5M19,21H8V7H19V21Z"/>
          </svg>
          Copy
        `;
      }, 2000);
    }
  };
  buttonGroup.appendChild(copyBtn);

  footer.appendChild(poweredBy);
  footer.appendChild(buttonGroup);

  modalContent.appendChild(header);
  modalContent.appendChild(contentArea);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);

  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };

  document.body.appendChild(modal);

  return modal;
}

// Update modal with summary content
function updateModalWithSummary(summary, summaryMode) {
  const contentArea = document.getElementById('modal-content-area');
  const buttonGroup = document.getElementById('modal-button-group');
  const modal = document.getElementById('transcript-summary-modal');

  if (!contentArea || !buttonGroup) return;

  // Update content area styling
  contentArea.style.alignItems = 'flex-start';
  contentArea.style.justifyContent = 'flex-start';
  contentArea.innerHTML = '';

  // Add summary text
  const summaryDiv = document.createElement('div');
  summaryDiv.style.cssText = `
    font-family: "Roboto", Arial, sans-serif;
    font-size: ${summaryMode === 'express' ? '16px' : '14px'};
    line-height: ${summaryMode === 'express' ? '1.8' : '1.6'};
    white-space: pre-wrap;
    ${summaryMode === 'express' ? 'font-weight: 400;' : ''}
    width: 100%;
  `;
  summaryDiv.textContent = summary;
  contentArea.appendChild(summaryDiv);

  // Enable buttons and update their state
  const regenerateBtn = document.getElementById('regenerate-btn');
  const downloadBtn = document.getElementById('download-btn');
  const copyBtn = document.getElementById('copy-btn');

  if (regenerateBtn) {
    regenerateBtn.disabled = false;
    regenerateBtn.style.opacity = '1';
    regenerateBtn.style.cursor = 'pointer';
    regenerateBtn.onclick = () => {
      modal.remove();
      handleSummarize(true, summaryMode);
    };
  }

  if (downloadBtn) {
    downloadBtn.disabled = false;
    downloadBtn.style.opacity = '1';
    downloadBtn.style.cursor = 'pointer';
    downloadBtn.onclick = () => {
      const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
      const videoTitle = titleElement ? titleElement.textContent.trim() : 'summary';
      const safeTitle = videoTitle
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 100);
      const filename = `summary_${safeTitle}.txt`;

      const blob = new Blob([summary], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }

  if (copyBtn) {
    copyBtn.disabled = false;
    copyBtn.style.opacity = '1';
    copyBtn.style.cursor = 'pointer';
    copyBtn.style.background = '#cc6666';
    copyBtn.style.color = 'white';
    copyBtn.style.border = 'none';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white; margin-right: 6px;">
        <path d="M16,1H4C2.9,1,2,1.9,2,3V17H4V3H16V1M19,5H8C6.9,5,6,5.9,6,7V21C6,22.1,6.9,23,8,23H19C20.1,23,21,22.1,21,21V7C21,5.9,20.1,5,19,5M19,21H8V7H19V21Z"/>
      </svg>
      Copy
    `;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(summary);
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white; margin-right: 6px;">
          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: white; margin-right: 6px;">
            <path d="M16,1H4C2.9,1,2,1.9,2,3V17H4V3H16V1M19,5H8C6.9,5,6,5.9,6,7V21C6,22.1,6.9,23,8,23H19C20.1,23,21,22.1,21,21V7C21,5.9,20.1,5,19,5M19,21H8V7H19V21Z"/>
          </svg>
          Copy
        `;
      }, 2000);
    };
  }
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
    left: 0;
    background: var(--yt-spec-menu-background);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    min-width: 200px;
    display: none;
    z-index: 999999;
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
async function handleSummarize(includeTimestamps, summaryMode = 'detailed') {
  console.log(`[Transcript Downloader] Generating ${summaryMode} summary...`);

  // Get API key
  const apiKey = await getApiKey();

  if (!apiKey) {
    alert('Please configure your OpenAI API key first!\n\nGo to the extension popup and enter your API key in the settings.');
    return;
  }

  // Show modal with loading state immediately
  showSummaryModal('', summaryMode, true);

  try {
    // Get transcript
    const result = await getTranscript(includeTimestamps);

    if (!result.success) {
      // Close modal and show error
      const modal = document.getElementById('transcript-summary-modal');
      if (modal) modal.remove();
      alert('Failed to get transcript: ' + result.error);
      return;
    }

    // Generate summary using OpenAI
    const summaryResult = await generateSummary(result.transcript, apiKey, summaryMode);

    if (summaryResult.success) {
      // Update modal with summary
      updateModalWithSummary(summaryResult.summary, summaryMode);
    } else {
      // Close modal and show error
      const modal = document.getElementById('transcript-summary-modal');
      if (modal) modal.remove();
      alert('Failed to generate summary: ' + summaryResult.error);
    }

  } catch (error) {
    console.error('[Transcript Downloader] Summary error:', error);
    // Close modal and show error
    const modal = document.getElementById('transcript-summary-modal');
    if (modal) modal.remove();
    alert('Error generating summary: ' + error.message);
  }
}

// Add download button below the video player
function addDownloadButton() {
  console.log('[Transcript Downloader] Attempting to add buttons...');

  // Check if buttons already exist
  if (document.getElementById('transcript-download-container')) {
    console.log('[Transcript Downloader] Buttons already exist');
    return;
  }

  // Wait for the video player container to be available
  const checkPlayer = setInterval(() => {
    // Find the primary column which contains the video
    const primaryInner = document.querySelector('#primary-inner');

    console.log('[Transcript Downloader] Looking for primary inner...', primaryInner);

    if (primaryInner && !document.getElementById('transcript-download-container')) {
      clearInterval(checkPlayer);
      console.log('[Transcript Downloader] Primary inner found!');

      // Check if we already have our buttons
      if (primaryInner.querySelector('#transcript-download-container')) {
        console.log('[Transcript Downloader] Buttons already in DOM');
        return;
      }

      // Add blinking star animation to the page
      if (!document.getElementById('blinking-star-animation')) {
        const style = document.createElement('style');
        style.id = 'blinking-star-animation';
        style.textContent = `
          @keyframes blink-star {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          .blinking-star {
            animation: blink-star 1.5s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }

      // Create a dedicated section for our buttons
      const section = document.createElement('div');
      section.id = 'transcript-download-container';
      section.style.cssText = `
        background: var(--yt-spec-base-background) !important;
        border: 1px solid var(--yt-spec-10-percent-layer) !important;
        border-radius: 12px;
        padding: 12px 16px;
        margin: 12px 0;
        display: flex !important;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        opacity: 1 !important;
        visibility: visible !important;
        transition: none !important;
      `;

      // Create left side container (buttons)
      const leftContainer = document.createElement('div');
      leftContainer.style.cssText = `
        display: flex !important;
        align-items: center;
        gap: 8px;
        opacity: 1 !important;
        visibility: visible !important;
      `;

      // Create right side container (AI-powered summaries text)
      const rightContainer = document.createElement('div');
      rightContainer.style.cssText = `
        display: flex !important;
        align-items: center;
        opacity: 1 !important;
        visibility: visible !important;
      `;

      const titleText = document.createElement('span');
      titleText.textContent = 'AI-powered summaries';
      titleText.style.cssText = `
        font-size: 12px;
        font-weight: 400;
        color: var(--yt-spec-text-secondary) !important;
        font-family: "Roboto", Arial, sans-serif;
        opacity: 1 !important;
        visibility: visible !important;
        display: inline-block !important;
      `;

      rightContainer.appendChild(titleText);

      // Create Summarize dropdown button with star
      const summarizeDropdown = createDropdownButton({
        id: 'transcript-summarize-dropdown',
        label: 'Summarize',
        icon: `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;">
          <path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
        </svg>`,
          options: [
            { value: 'detailed', label: 'Detailed summary', description: 'Comprehensive overview' },
            { value: 'bullets', label: 'Bullet points', description: 'Key highlights and takeaways' },
            { value: 'express', label: 'Ultra-short summary', description: '1-3 sentence overview' }
          ],
        onSelect: async (value) => {
          await handleSummarize(true, value);
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

      leftContainer.appendChild(summarizeDropdown.container);
      leftContainer.appendChild(transcriptDropdown.container);

      section.appendChild(leftContainer);
      section.appendChild(rightContainer);

      // Insert the section after the player but before metadata
      // Find the player container
      const playerContainer = primaryInner.querySelector('#player');

      if (playerContainer && playerContainer.nextSibling) {
        primaryInner.insertBefore(section, playerContainer.nextSibling);
      } else {
        // Fallback: insert at the beginning of primary-inner
        primaryInner.insertBefore(section, primaryInner.firstChild);
      }

      console.log('[Transcript Downloader] ✅ Buttons added successfully!');
    }
  }, 500);

  // Stop checking after 10 seconds
  setTimeout(() => clearInterval(checkPlayer), 10000);
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