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

// Handle fact-checking
async function handleFactCheck() {
  console.log('[Transcript Downloader] Starting fact check...');

  // Get API key
  const apiKey = await getApiKey();

  if (!apiKey) {
    alert('Please configure your OpenAI API key first!\n\nGo to the extension popup and enter your API key in the settings.');
    return;
  }

  // Get the fact check button and show loading state
  const factCheckBtn = document.getElementById('fact-check-btn');
  if (factCheckBtn) {
    const originalHTML = factCheckBtn.innerHTML;
    const originalStyle = factCheckBtn.style.cssText;

    factCheckBtn.disabled = true;
    factCheckBtn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: white; margin-right: 6px; animation: spin 1s linear infinite;">
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
      Checking...
    `;
    factCheckBtn.style.cssText = originalStyle + 'opacity: 0.7; cursor: wait;';

    try {
      // Get the full transcript
      const result = await getTranscript(false);

      if (!result.success) {
        throw new Error('Failed to get transcript: ' + result.error);
      }

      // Call OpenAI API to fact-check the transcript
      const languagePreference = await getLanguagePreference();

      const systemPrompt = languagePreference === 'fr'
        ? 'You are a professional fact-checker. Analyze the video transcript and verify key claims, identify any potential misinformation, and provide a fact-check report in French.'
        : 'You are a professional fact-checker. Analyze the video transcript and verify key claims, identify any potential misinformation, and provide a fact-check report in English.';

      const userPrompt = languagePreference === 'fr'
        ? `Analysez cette transcription vidéo et effectuez une vérification des faits. Pour chaque affirmation importante, indiquez si elle est vérifiable, correcte, douteuse ou nécessite plus de contexte. Format attendu:

✓ [Affirmation correcte/vérifiable]
⚠ [Affirmation nécessitant plus de contexte]
✗ [Affirmation incorrecte ou douteuse]

Transcription à vérifier:
${result.transcript}`
        : `Analyze this video transcript and perform a fact-check. For each important claim, indicate whether it is verifiable, correct, doubtful, or requires more context. Expected format:

✓ [Correct/verifiable claim]
⚠ [Claim requiring more context]
✗ [Incorrect or doubtful claim]

Transcript to fact-check:
${result.transcript}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const factCheckResult = data.choices[0]?.message?.content;

      if (!factCheckResult) {
        throw new Error('No fact-check result from API');
      }

      // Show fact-check result in an alert or modal
      alert('Fact Check Results:\n\n' + factCheckResult);

      // Restore button
      factCheckBtn.disabled = false;
      factCheckBtn.innerHTML = originalHTML;
      factCheckBtn.style.cssText = originalStyle;

    } catch (error) {
      console.error('[Transcript Downloader] Fact check error:', error);
      alert('Failed to perform fact check: ' + error.message);

      // Restore button
      factCheckBtn.disabled = false;
      factCheckBtn.innerHTML = originalHTML;
      factCheckBtn.style.cssText = originalStyle;
    }
  }
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

  // Create fact check button container (replaces "Powered by AI SDK")
  const factCheckContainer = document.createElement('div');
  factCheckContainer.id = 'fact-check-container';
  factCheckContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Always create enabled fact check button (unless loading)
  if (!isLoading) {
    const factCheckBtn = document.createElement('button');
    factCheckBtn.id = 'fact-check-btn';
    factCheckBtn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: white; margin-right: 6px;">
        <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M16.59,7.58L10,14.17L7.41,11.59L6,13L10,17L18,9L16.59,7.58Z"/>
      </svg>
      Fact Check
    `;
    factCheckBtn.style.cssText = `
      padding: 8px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 18px;
      cursor: pointer;
      font-family: "Roboto", Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transition: all 0.2s ease;
    `;
    factCheckBtn.onmouseenter = () => {
      factCheckBtn.style.transform = 'translateY(-2px)';
      factCheckBtn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    };
    factCheckBtn.onmouseleave = () => {
      factCheckBtn.style.transform = 'translateY(0)';
      factCheckBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };
    factCheckBtn.onclick = () => {
      handleFactCheck();
    };
    factCheckContainer.appendChild(factCheckBtn);
  }

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

  footer.appendChild(factCheckContainer);
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

  // Update fact check button container
  const factCheckContainer = document.getElementById('fact-check-container');
  if (factCheckContainer) {
    factCheckContainer.innerHTML = ''; // Clear loading state

    // Always create enabled fact check button
    const factCheckBtn = document.createElement('button');
    factCheckBtn.id = 'fact-check-btn';
    factCheckBtn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: white; margin-right: 6px;">
        <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M16.59,7.58L10,14.17L7.41,11.59L6,13L10,17L18,9L16.59,7.58Z"/>
      </svg>
      Fact Check
    `;
    factCheckBtn.style.cssText = `
      padding: 8px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 18px;
      cursor: pointer;
      font-family: "Roboto", Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transition: all 0.2s ease;
    `;
    factCheckBtn.onmouseenter = () => {
      factCheckBtn.style.transform = 'translateY(-2px)';
      factCheckBtn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    };
    factCheckBtn.onmouseleave = () => {
      factCheckBtn.style.transform = 'translateY(0)';
      factCheckBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };
    factCheckBtn.onclick = () => {
      handleFactCheck();
    };
    factCheckContainer.appendChild(factCheckBtn);
  }
}

// Show settings modal
function showSettingsModal() {
  // Remove existing modal if any
  const existingModal = document.getElementById('transcript-settings-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'transcript-settings-modal';
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
    padding: 32px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  `;

  // Title
  const title = document.createElement('h1');
  title.textContent = 'AI Summary Settings';
  title.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 28px;
    font-family: "Roboto", Arial, sans-serif;
    font-weight: 400;
  `;

  // API Key Section
  const apiKeySection = document.createElement('div');
  apiKeySection.style.cssText = `
    margin-bottom: 24px;
  `;

  const apiKeyLabel = document.createElement('label');
  apiKeyLabel.textContent = 'OpenAI API Key:';
  apiKeyLabel.style.cssText = `
    display: block;
    font-size: 16px;
    font-weight: 400;
    margin-bottom: 12px;
    font-family: "Roboto", Arial, sans-serif;
    color: var(--yt-spec-text-primary);
  `;

  // Status box (shown when API key exists)
  const statusBox = document.createElement('div');
  statusBox.id = 'api-key-status-box';
  statusBox.style.cssText = `
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    padding: 16px;
    display: none;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  `;

  const statusContent = document.createElement('div');
  statusContent.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const checkmark = document.createElement('span');
  checkmark.innerHTML = '✓';
  checkmark.style.cssText = `
    color: #155724;
    font-size: 24px;
    font-weight: bold;
  `;

  const statusText = document.createElement('span');
  statusText.textContent = 'API Key configured';
  statusText.style.cssText = `
    color: #155724;
    font-size: 16px;
    font-family: "Roboto", Arial, sans-serif;
  `;

  const modifyBtn = document.createElement('button');
  modifyBtn.textContent = 'Modify';
  modifyBtn.style.cssText = `
    padding: 8px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 18px;
    cursor: pointer;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
  `;

  statusContent.appendChild(checkmark);
  statusContent.appendChild(statusText);
  statusBox.appendChild(statusContent);
  statusBox.appendChild(modifyBtn);

  // Input group (shown when adding/modifying API key)
  const inputGroup = document.createElement('div');
  inputGroup.id = 'api-key-input-group';
  inputGroup.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  `;

  const apiKeyInput = document.createElement('input');
  apiKeyInput.type = 'password';
  apiKeyInput.placeholder = 'sk-...';
  apiKeyInput.autocomplete = 'off';
  apiKeyInput.style.cssText = `
    flex: 1;
    padding: 12px 16px;
    background: var(--yt-spec-10-percent-layer);
    color: var(--yt-spec-text-primary);
    border: 1px solid var(--yt-spec-10-percent-layer);
    border-radius: 8px;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
  `;

  const toggleVisibilityBtn = document.createElement('button');
  toggleVisibilityBtn.innerHTML = '👁️';
  toggleVisibilityBtn.title = 'Show/Hide API Key';
  toggleVisibilityBtn.style.cssText = `
    padding: 12px 16px;
    background: var(--yt-spec-10-percent-layer);
    color: var(--yt-spec-text-primary);
    border: 1px solid var(--yt-spec-10-percent-layer);
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
  `;
  toggleVisibilityBtn.onclick = () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibilityBtn.innerHTML = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleVisibilityBtn.innerHTML = '👁️';
    }
  };

  inputGroup.appendChild(apiKeyInput);
  inputGroup.appendChild(toggleVisibilityBtn);

  // Save button (shown only when input group is visible)
  const saveApiKeyBtn = document.createElement('button');
  saveApiKeyBtn.id = 'save-api-key-btn';
  saveApiKeyBtn.textContent = 'Save API Key';
  saveApiKeyBtn.style.cssText = `
    width: 100%;
    padding: 10px 16px;
    background: #065fd4;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
  `;

  const apiKeyHelp = document.createElement('div');
  apiKeyHelp.innerHTML = 'Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #065fd4;">OpenAI</a>. Your key is stored locally and never shared.';
  apiKeyHelp.style.cssText = `
    font-size: 14px;
    color: var(--yt-spec-text-secondary);
    font-family: "Roboto", Arial, sans-serif;
    line-height: 1.4;
  `;

  apiKeySection.appendChild(apiKeyLabel);
  apiKeySection.appendChild(statusBox);
  apiKeySection.appendChild(inputGroup);
  apiKeySection.appendChild(saveApiKeyBtn);
  apiKeySection.appendChild(apiKeyHelp);

  // Check if API key exists and update UI accordingly
  chrome.storage.sync.get(['openaiApiKey'], (result) => {
    if (result.openaiApiKey) {
      statusBox.style.display = 'flex';
      inputGroup.style.display = 'none';
      saveApiKeyBtn.style.display = 'none';
      apiKeyInput.value = result.openaiApiKey;
    } else {
      statusBox.style.display = 'none';
      inputGroup.style.display = 'flex';
      saveApiKeyBtn.style.display = 'block';
    }
  });

  // Modify button click handler
  modifyBtn.onclick = () => {
    statusBox.style.display = 'none';
    inputGroup.style.display = 'flex';
    saveApiKeyBtn.style.display = 'block';
    apiKeyInput.focus();
  };

  // Save API Key button handler
  saveApiKeyBtn.onclick = async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      alert('Invalid API key format. Should start with "sk-"');
      return;
    }

    try {
      await chrome.storage.sync.set({ openaiApiKey: apiKey });

      // Update UI to show status box
      statusBox.style.display = 'flex';
      inputGroup.style.display = 'none';
      saveApiKeyBtn.style.display = 'none';

      // Show success feedback
      const originalText = saveApiKeyBtn.textContent;
      saveApiKeyBtn.textContent = 'Saved!';
      saveApiKeyBtn.style.background = '#28a745';
      setTimeout(() => {
        saveApiKeyBtn.textContent = originalText;
        saveApiKeyBtn.style.background = '#065fd4';
      }, 2000);
    } catch (error) {
      alert('Failed to save API key: ' + error.message);
    }
  };

  // Language Section
  const languageSection = document.createElement('div');
  languageSection.style.cssText = `
    margin-bottom: 32px;
  `;

  const languageLabel = document.createElement('label');
  languageLabel.textContent = 'Summary Language:';
  languageLabel.style.cssText = `
    display: block;
    font-size: 16px;
    font-weight: 400;
    margin-bottom: 12px;
    font-family: "Roboto", Arial, sans-serif;
    color: var(--yt-spec-text-primary);
  `;

  const languageSelect = document.createElement('select');
  languageSelect.innerHTML = `
    <option value="fr">Français (French)</option>
    <option value="en">English</option>
    <option value="es">Español (Spanish)</option>
    <option value="de">Deutsch (German)</option>
  `;
  languageSelect.style.cssText = `
    width: 100%;
    padding: 12px 16px;
    background: var(--yt-spec-10-percent-layer);
    color: var(--yt-spec-text-primary);
    border: 1px solid var(--yt-spec-10-percent-layer);
    border-radius: 8px;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 14px;
    cursor: pointer;
  `;

  // Load saved language
  chrome.storage.sync.get(['summaryLanguage'], (result) => {
    if (result.summaryLanguage) {
      languageSelect.value = result.summaryLanguage;
    } else {
      languageSelect.value = 'fr';
    }
  });

  languageSection.appendChild(languageLabel);
  languageSection.appendChild(languageSelect);

  // Note
  const note = document.createElement('div');
  note.textContent = "Make sure you're on a YouTube video page with captions available.";
  note.style.cssText = `
    font-size: 14px;
    color: var(--yt-spec-text-secondary);
    font-family: "Roboto", Arial, sans-serif;
    margin-bottom: 24px;
    line-height: 1.4;
  `;

  // Close button at bottom
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    width: 100%;
    padding: 12px 20px;
    background: transparent;
    color: var(--yt-spec-text-primary);
    border: 1px solid var(--yt-spec-10-percent-layer);
    border-radius: 8px;
    cursor: pointer;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 16px;
    font-weight: 500;
  `;
  closeBtn.onclick = () => {
    modal.remove();
  };

  modalContent.appendChild(title);
  modalContent.appendChild(apiKeySection);
  modalContent.appendChild(languageSection);
  modalContent.appendChild(note);
  modalContent.appendChild(closeBtn);

  // Auto-save language preference when changed
  languageSelect.onchange = async () => {
    try {
      await chrome.storage.sync.set({ summaryLanguage: languageSelect.value });
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };
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
function createDropdownButton({ id, label, icon, options, onSelect, isRed = false }) {
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
    <span style="margin: 0;">${label}</span>
    <svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: currentColor;">
      <path d="M7,10L12,15L17,10H7Z"/>
    </svg>
  `;
  button.style.cssText = `
    display: flex;
    align-items: center;
    padding: 6px 10px;
    background: ${isRed ? '#cc0000' : 'var(--yt-spec-badge-chip-background)'};
    color: ${isRed ? 'white' : 'var(--yt-spec-text-secondary)'};
    border: none;
    border-radius: 8px;
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
    button.style.background = isRed ? '#b00000' : 'rgba(0, 0, 0, 0.15)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = isRed ? '#cc0000' : 'var(--yt-spec-badge-chip-background)';
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

  // Wait for the secondary sidebar to be available
  const checkPlayer = setInterval(() => {
    // Find the secondary column (right sidebar)
    const secondary = document.querySelector('#secondary');

    console.log('[Transcript Downloader] Looking for secondary...', secondary);

    if (secondary && !document.getElementById('transcript-download-container')) {
      clearInterval(checkPlayer);
      console.log('[Transcript Downloader] Secondary found!');

      // Check if we already have our buttons
      if (secondary.querySelector('#transcript-download-container')) {
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
        padding: 6px 8px;
        margin: 0 0 6px 0;
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

      // Create right side container (Settings button)
      const rightContainer = document.createElement('div');
      rightContainer.style.cssText = `
        display: flex !important;
        align-items: center;
        opacity: 1 !important;
        visibility: visible !important;
      `;

      const settingsBtn = document.createElement('button');
      settingsBtn.id = 'transcript-settings-btn';
      settingsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
          <path d="M19.14,12.94C19.18,12.64 19.2,12.33 19.2,12C19.2,11.68 19.18,11.36 19.13,11.06L21.16,9.48C21.34,9.34 21.39,9.07 21.28,8.87L19.36,5.55C19.24,5.33 18.99,5.26 18.77,5.33L16.38,6.29C15.88,5.91 15.35,5.59 14.76,5.35L14.4,2.81C14.36,2.57 14.16,2.4 13.92,2.4H10.08C9.84,2.4 9.65,2.57 9.61,2.81L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33C5.02,5.25 4.77,5.33 4.65,5.55L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48L4.89,11.06C4.84,11.36 4.8,11.69 4.8,12C4.8,12.31 4.82,12.64 4.87,12.94L2.84,14.52C2.66,14.66 2.61,14.93 2.72,15.13L4.64,18.45C4.76,18.67 5.01,18.74 5.23,18.67L7.62,17.71C8.12,18.09 8.65,18.41 9.24,18.65L9.6,21.19C9.65,21.43 9.84,21.6 10.08,21.6H13.92C14.16,21.6 14.36,21.43 14.39,21.19L14.75,18.65C15.34,18.41 15.88,18.09 16.37,17.71L18.76,18.67C18.98,18.75 19.23,18.67 19.35,18.45L21.27,15.13C21.39,14.91 21.34,14.66 21.15,14.52L19.14,12.94M12,15.6C10.02,15.6 8.4,13.98 8.4,12C8.4,10.02 10.02,8.4 12,8.4C13.98,8.4 15.6,10.02 15.6,12C15.6,13.98 13.98,15.6 12,15.6Z"/>
        </svg>
      `;
      settingsBtn.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        background: transparent;
        color: var(--yt-spec-text-secondary);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.1s;
      `;
      settingsBtn.addEventListener('mouseenter', () => {
        settingsBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      });
      settingsBtn.addEventListener('mouseleave', () => {
        settingsBtn.style.background = 'transparent';
      });
      settingsBtn.onclick = () => {
        showSettingsModal();
      };

      rightContainer.appendChild(settingsBtn);

      // Create Summarize dropdown button with AI robot icon (red like YouTube logo)
      const summarizeDropdown = createDropdownButton({
        id: 'transcript-summarize-dropdown',
        label: '',
        icon: `<svg viewBox="0 0 16 16" style="width: 16px; height: 16px; stroke: currentColor; fill: none;" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
          <rect height="7.5" width="12.5" y="5.75" x="1.75"></rect>
          <path d="m10.75 8.75v1.5m-5.5-1.5v1.5m-.5-7.5 3.25 3 3.25-3"></path>
        </svg>`,
          options: [
            { value: 'detailed', label: 'Detailed summary', description: 'Comprehensive overview' },
            { value: 'bullets', label: 'Bullet points', description: 'Key highlights and takeaways' },
            { value: 'express', label: 'Ultra-short summary', description: '1-3 sentence overview' }
          ],
        onSelect: async (value) => {
          await handleSummarize(true, value);
        },
        isRed: true
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

      // Insert the section at the top of the secondary sidebar
      secondary.insertBefore(section, secondary.firstChild);

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