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

        // Get language preference
        const languagePreference = await getLanguagePreference();
        const languageConfig = getLanguageConfig(languagePreference);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                        role: 'system',
                        content: languageConfig.systemPrompt
                    },
                    {
                        role: 'user',
                        content: languageConfig.userPrompt.replace('${transcript}', transcript)
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
        chrome.storage.sync.set({
            openaiApiKey: apiKey
        }, () => {
            console.log('[OpenAI Summary] API key saved');
            resolve();
        });
    });
}

/**
 * Get the stored language preference
 * @returns {Promise<string>}
 */
async function getLanguagePreference() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['summaryLanguage'], (result) => {
            resolve(result.summaryLanguage || 'fr'); // Default to French
        });
    });
}

/**
 * Get language-specific configuration for prompts
 * @param {string} language - Language code (fr, en, de, es)
 * @returns {object} Configuration object with system and user prompts
 */
function getLanguageConfig(language) {
    const configs = {
        fr: {
            systemPrompt: 'You are an assistant that creates concise, adaptive summaries of video transcripts in French. Adjust the format based on the video type (comparison, tutorial, interview, conference, etc.) to present information clearly. Always respond in French, no markdown.',
            userPrompt: `Résumez la transcription vidéo suivante en français en adaptant le format selon son contenu. Incluez :
- Un aperçu général
- Les points principaux
- Les comparaisons ou étapes clés si pertinentes
- Ce qu'il faut retenir

Transcription :
\${transcript}`
        },
        en: {
            systemPrompt: 'You are an assistant that creates concise, adaptive summaries of video transcripts in English. Adjust the format based on the video type (comparison, tutorial, interview, conference, etc.) to present information clearly. Always respond in English, no markdown.',
            userPrompt: `Summarize the following video transcript in English by adapting the format to its content. Include:
- A general overview
- The main points
- Key comparisons or steps if relevant
- Key takeaways

Transcript:
\${transcript}`
        },
        de: {
            systemPrompt: 'You are an assistant that creates concise, adaptive summaries of video transcripts in German. Adjust the format based on the video type (comparison, tutorial, interview, conference, etc.) to present information clearly. Always respond in German, no markdown.',
            userPrompt: `Fassen Sie das folgende Video-Transkript auf Deutsch zusammen, indem Sie das Format an den Inhalt anpassen. Fügen Sie hinzu:
- Einen allgemeinen Überblick
- Die Hauptpunkte
- Wichtige Vergleiche oder Schritte, falls relevant
- Wichtige Erkenntnisse

Transkript:
\${transcript}`
        },
        es: {
            systemPrompt: 'You are an assistant that creates concise, adaptive summaries of video transcripts in Spanish. Adjust the format based on the video type (comparison, tutorial, interview, conference, etc.) to present information clearly. Always respond in Spanish, no markdown.',
            userPrompt: `Resume la siguiente transcripción de video en español adaptando el formato a su contenido. Incluye:
- Una visión general
- Los puntos principales
- Comparaciones o pasos clave si son relevantes
- Conclusiones clave

Transcripción:
\${transcript}`
        }
    };

    return configs[language] || configs.fr; // Default to French if language not found
}