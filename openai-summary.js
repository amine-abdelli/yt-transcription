// OpenAI API integration for video transcript summarization

/**
 * Generate a summary of the transcript using OpenAI API
 * @param {string} transcript - The video transcript text
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{success: boolean, summary?: string, error?: string}>}
 */
async function generateSummary(transcript, apiKey) {
  try {
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Please configure it in the extension popup.');
    }

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is empty. Cannot generate summary.');
    }

    console.log('[OpenAI Summary] Generating summary...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, informative summaries of video transcripts in French. Provide a clear summary with key points in bullet format. Always respond in French. Also do not answer in markdown format. No ### or ***.'
          },
          {
            role: 'user',
            content: `Veuillez résumer la transcription vidéo suivante en français. Incluez :
1. Un aperçu général (2-3 phrases)
2. Les points principaux abordés (points à puces)
3. Les points clés à retenir

Transcription :
${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated from the API response.');
    }

    console.log('[OpenAI Summary] Summary generated successfully!');

    return {
      success: true,
      summary: summary.trim()
    };

  } catch (error) {
    console.error('[OpenAI Summary] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the stored OpenAI API key
 * @returns {Promise<string|null>}
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
      resolve(result.openaiApiKey || null);
    });
  });
}

/**
 * Save the OpenAI API key
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
async function saveApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
      console.log('[OpenAI Summary] API key saved');
      resolve();
    });
  });
}
