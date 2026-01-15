// OpenAI API integration for video transcript summarization

/**
 * Generate a summary of the transcript using OpenAI API
 * @param {string} transcript - The video transcript text
 * @param {string} apiKey - OpenAI API key
 * @param {string} summaryMode - Mode: 'detailed', 'bullets', or 'express'
 * @returns {Promise<{success: boolean, summary?: string, error?: string}>}
 */
async function generateSummary(transcript, apiKey, summaryMode = 'detailed') {
    try {
        if (!apiKey) {
            throw new Error('OpenAI API key is required. Please configure it in the extension popup.');
        }

        if (!transcript || transcript.trim().length === 0) {
            throw new Error('Transcript is empty. Cannot generate summary.');
        }

        console.log(`[OpenAI Summary] Generating ${summaryMode} summary...`);

        // Get language preference
        const languagePreference = await getLanguagePreference();

        // Map summaryMode to output format
        const outputFormat = summaryMode === 'express' ? 'SHORT' :
                            summaryMode === 'bullets' ? 'BULLET POINTS' : 'DETAILED';

        const config = getSummaryConfig(languagePreference);

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
                        content: config.systemPrompt
                    },
                    {
                        role: 'user',
                        content: config.userPrompt.replace('${transcript}', transcript).replace('${outputFormat}', outputFormat)
                    }
                ],
                temperature: 0.7,
                max_tokens: summaryMode === 'express' ? 300 : (summaryMode === 'bullets' ? 800 : 1500)
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
 * Get summary configuration with the comprehensive prompt
 * @param {string} language - Language code (fr, en, de, es)
 * @returns {object} Configuration object with system and user prompts
 */
function getSummaryConfig(language) {
    const languageInstructions = {
        fr: 'Always respond in French.',
        en: 'Always respond in English.',
        de: 'Always respond in German.',
        es: 'Always respond in Spanish.'
    };

    const langInstruction = languageInstructions[language] || languageInstructions.fr;

    const systemPrompt = `You are an expert content analyst and summarizer. ${langInstruction}`;

    const userPrompt = `I will provide you with:
1) A YouTube video transcript
2) A selected output format

Your task is to:
- Analyze the transcript
- Identify the video type
- Produce the best possible summary adapted to that video type
- Focus on what a viewer should REMEMBER long-term

------------------------------------
VIDEO TYPE DETECTION
------------------------------------
First, silently determine the video category. Possible types include (but are not limited to):

- Tutorial / How-to
- Educational / Explainer
- News / Current events
- Opinion / Commentary
- Interview / Podcast
- Recipe / Cooking
- Documentary
- Product Review
- Productivity / Self-improvement
- Technical / Programming
- Business / Finance
- Entertainment / Storytelling
- Motivation / Speech

Adapt the structure, tone, and emphasis of the summary to the detected type.

------------------------------------
SUMMARY RULES BY VIDEO TYPE
------------------------------------

### If the video is a TUTORIAL / HOW-TO:
- Structure the detailed summary like a **mini-course**
- Clearly explain:
  - The goal
  - Required prerequisites/tools
  - Step-by-step process
  - Key concepts to understand (not just steps)
  - Common mistakes or warnings
  - Practical tips or shortcuts
- Make it easy to re-read later for learning or revision

### If the video is EDUCATIONAL / EXPLAINER:
- Clarify the core concept
- Explain WHY it matters
- Break down complex ideas simply
- Highlight definitions, frameworks, or models
- Emphasize mental models and takeaways

### If the video is NEWS / CURRENT EVENTS:
- Provide:
  - Context (background and why this matters now)
  - Key facts and developments
  - Stakeholders involved
  - Consequences or implications
  - The conclusion or likely outcomes
- Stay neutral and factual

### If the video is OPINION / COMMENTARY:
- Clearly distinguish facts vs opinions
- Summarize the main argument
- Present supporting points
- Mention counterarguments if discussed
- Capture the creator's conclusion or stance

### If the video is an INTERVIEW / PODCAST:
- Identify the participants and their roles
- Extract key insights, stories, or lessons
- Highlight memorable quotes or moments
- Focus on ideas worth remembering, not small talk

### If the video is a RECIPE / COOKING VIDEO:
- Output the summary as a **structured recipe**, including:
  - Dish name
  - Ingredients (with quantities if available)
  - Preparation steps
  - Cooking method
  - Cooking time and temperature
  - Tips, variations, or substitutions
- Be concise and practical

### If the video is a PRODUCT REVIEW:
- Identify the product and use case
- Summarize:
  - Key features
  - Pros and cons
  - Who it's for / not for
  - Final verdict or recommendation

### If the video is MOTIVATIONAL / SELF-IMPROVEMENT:
- Extract core principles
- Highlight actionable advice
- Capture mindset shifts
- Emphasize memorable lines or lessons

(If the video doesn't clearly fit one category, adapt intelligently.)

------------------------------------
OUTPUT FORMAT (IMPORTANT)
------------------------------------

Generate ONLY the format selected: \${outputFormat}

### 1) DETAILED
- In-depth, structured
- Designed for long-term understanding and re-reading
- Uses clear headings and logical flow

### 2) SHORT
- 2–3 sentences maximum
- Captures the essence and conclusion

### 3) BULLET POINTS
- Concise bullet points (use "• " prefix)
- Focus on key ideas, steps, or takeaways
- Easy to scan

------------------------------------
QUALITY REQUIREMENTS
------------------------------------
- Do NOT summarize line-by-line
- Remove filler, repetition, and tangents
- Prioritize clarity, usefulness, and memory retention
- Assume the reader wants to learn, not just skim
- If the transcript is messy or spoken, clean and organize the ideas

------------------------------------
INPUT
------------------------------------
Here is the YouTube video transcript:
\${transcript}

Selected output format: \${outputFormat}`;

    return {
        systemPrompt,
        userPrompt
    };
}
