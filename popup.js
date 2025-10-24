// Popup script to handle user interactions

document.addEventListener('DOMContentLoaded', function() {
  const downloadBtn = document.getElementById('downloadBtn');
  const statusDiv = document.getElementById('status');
  const includeTimestampsCheckbox = document.getElementById('includeTimestamps');

  // Load saved preference for timestamps
  chrome.storage.sync.get(['includeTimestamps'], function(result) {
    if (result.includeTimestamps !== undefined) {
      includeTimestampsCheckbox.checked = result.includeTimestamps;
    }
  });

  // Save preference when changed
  includeTimestampsCheckbox.addEventListener('change', function() {
    chrome.storage.sync.set({ includeTimestamps: this.checked });
  });

  downloadBtn.addEventListener('click', async function() {
    try {
      // Check if we're on a YouTube video page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url || !tab.url.includes('youtube.com/watch')) {
        setStatus('Please navigate to a YouTube video page.', 'error');
        return;
      }

      setStatus('Extracting transcript...', 'loading');
      downloadBtn.disabled = true;

      const includeTimestamps = includeTimestampsCheckbox.checked;

      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (injectionError) {
        // Content script might already be injected, ignore error
        console.log('Content script injection:', injectionError.message);
      }

      // Wait a moment for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getTranscript',
        includeTimestamps: includeTimestamps
      });

      if (response && response.success) {
        // Download the transcript as a text file
        downloadTranscript(response.transcript, response.title);
        setStatus('Transcript downloaded successfully!', 'success');
      } else {
        setStatus(response?.error || 'Failed to extract transcript.', 'error');
      }

    } catch (error) {
      if (error.message.includes('Receiving end does not exist')) {
        setStatus('Please refresh the YouTube page and try again.', 'error');
      } else {
        setStatus('Error: ' + error.message, 'error');
      }
      console.error('Download error:', error);
    } finally {
      downloadBtn.disabled = false;
    }
  });

  function setStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
  }

  function downloadTranscript(content, videoTitle) {
    // Clean the title for use as filename
    const safeTitle = videoTitle
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);

    const filename = `transcript_${safeTitle}.txt`;

    // Create a blob and download it
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, function(downloadId) {
      // Clean up the URL after download starts
      if (downloadId) {
        URL.revokeObjectURL(url);
      }
    });
  }
});
