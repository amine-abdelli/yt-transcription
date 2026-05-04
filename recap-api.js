/* ============================================================================
 * Recap additions to openai-summary.js
 * - detectVideoCategory: classify video type (news/info → enable fact-check)
 * - extractClaimsAndQuotes: pull verifiable affirmations + key quotes w/ timestamps
 * - factCheckClaim: verify a single claim, return verdict + sources
 * ========================================================================= */

/**
 * Detect the video category. Returns one of:
 *   'news', 'review', 'lecture', 'tutorial', 'opinion', 'interview',
 *   'recipe', 'vlog', 'entertainment', 'other'
 * Fact-checking is meaningful for: news, review, lecture, opinion, interview.
 */
async function detectVideoCategory(transcript, apiKey) {
  try {
    if (!apiKey || !transcript) return { success: false, category: 'other', factCheckable: false };

    const sample = transcript.slice(0, 4000);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You classify YouTube videos. Reply with ONLY one word from: news, review, lecture, opinion, interview, tutorial, recipe, vlog, entertainment, other.' },
          { role: 'user', content: 'Classify this transcript:\n\n' + sample }
        ],
        temperature: 0,
        max_tokens: 10
      })
    });
    if (!response.ok) throw new Error('classify failed');
    const data = await response.json();
    const raw = (data.choices[0]?.message?.content || 'other').trim().toLowerCase().replace(/[^a-z]/g, '');
    const allowed = ['news','review','lecture','opinion','interview','tutorial','recipe','vlog','entertainment','other'];
    const category = allowed.includes(raw) ? raw : 'other';
    const factCheckable = ['news','review','lecture','opinion','interview'].includes(category);
    return { success: true, category, factCheckable };
  } catch (err) {
    console.error('[Recap] detectVideoCategory failed:', err);
    return { success: false, category: 'other', factCheckable: false };
  }
}

/**
 * Extract verifiable claims + memorable quotes from a transcript w/ timestamps.
 * Expects transcript lines like "[1:23] some text".
 *
 * Returns: { success, claims: [{id, text, ts}], quotes: [{text, speaker, role, ts}] }
 */
async function extractClaimsAndQuotes(transcript, apiKey, language = 'en') {
  try {
    if (!apiKey) throw new Error('OpenAI API key is required.');
    if (!transcript || transcript.trim().length === 0) throw new Error('Transcript is empty.');

    const langName = { fr: 'French', en: 'English', es: 'Spanish', de: 'German' }[language] || 'English';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You analyze YouTube transcripts (with timestamps like [MM:SS]) and extract two things in ${langName}:

1. CLAIMS: 4-8 specific, verifiable factual affirmations made in the video. Each claim must:
   - Be a single statement of fact (not opinion, not vague generalization)
   - Be checkable against external sources (statistics, dates, events, specific figures, named people, quoted decisions, etc.)
   - Include the timestamp where it appears
   - Be self-contained and understandable without surrounding context

2. QUOTES: 2-4 memorable, well-phrased excerpts spoken in the video. Each quote must:
   - Be a near-verbatim line worth remembering
   - Include speaker name if identifiable (else null)
   - Include speaker role/title if obvious (else null)
   - Include the timestamp

Respond with strict JSON: { "claims": [{"text": "...", "ts": "1:23"}], "quotes": [{"text": "...", "speaker": "...", "role": "...", "ts": "1:23"}] }`
          },
          { role: 'user', content: 'Transcript:\n\n' + transcript }
        ],
        temperature: 0.2,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API request failed (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { claims: [], quotes: [] }; }

    const claims = (parsed.claims || []).map((c, i) => ({
      id: 'c' + i,
      text: c.text || '',
      ts: c.ts || c.timestamp || null,
      verdict: 'idle'
    })).filter(c => c.text);

    const quotes = (parsed.quotes || []).map(q => ({
      text: q.text || '',
      speaker: q.speaker || null,
      role: q.role || null,
      ts: q.ts || q.timestamp || null
    })).filter(q => q.text);

    return { success: true, claims, quotes };
  } catch (err) {
    console.error('[Recap] extractClaimsAndQuotes failed:', err);
    return { success: false, error: err.message, claims: [], quotes: [] };
  }
}

/**
 * Fact-check a single claim using the OpenAI Responses API with the web_search tool.
 * Returns verdict + grounded explanation + real cited URLs retrieved from the web.
 * Verdict ∈ 'verified' | 'disputed' | 'false' | 'unverified'.
 */
async function factCheckClaim(claimText, apiKey, language = 'en') {
  try {
    if (!apiKey) throw new Error('OpenAI API key is required.');
    if (!claimText) throw new Error('No claim text.');

    const langName = { fr: 'French', en: 'English', es: 'Spanish', de: 'German' }[language] || 'English';

    // Use the Responses API with the web_search tool so the model fetches live pages.
    // Annotations on the output message contain actual URLs retrieved during the search.
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        tool_choice: 'required',
        input: [
          {
            role: 'system',
            content: `You are a rigorous fact-checker. Search the web to verify the claim, then respond in ${langName} with this exact JSON and nothing else:
{
  "verdict": "verified" | "disputed" | "false" | "unverified",
  "note": "2-3 sentence explanation grounded in what you found online, in ${langName}",
  "sources": [
    { "name": "Publication or site name", "url": "https://full-url-you-retrieved", "date": "YYYY-MM-DD or YYYY-MM or YYYY" }
  ]
}

Verdict rules:
- "verified"   — clearly confirmed by reliable sources found online
- "disputed"   — partially true, contested, or lacking consensus across sources
- "false"      — contradicted by reliable evidence found online
- "unverified" — not enough credible information found to make a call

Sources: only include URLs you actually retrieved. Up to 3. Prefer primary sources (official sites, major newswires, peer-reviewed papers). Empty array if nothing credible found.`
          },
          { role: 'user', content: 'Fact-check this claim: ' + claimText }
        ],
        max_output_tokens: 1000
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API request failed (${response.status})`);
    }

    const data = await response.json();

    // The Responses API returns output as an array of items.
    // The message item contains content blocks with text + annotations.
    const messageItem = (data.output || []).find(o => o.type === 'message');
    const textBlock = (messageItem?.content || []).find(c => c.type === 'output_text');
    const rawText = textBlock?.text || '';

    // Collect cited URLs from annotations (these are real URLs fetched by the search tool)
    const annotationSources = {};
    (textBlock?.annotations || []).forEach(a => {
      if (a.type === 'url_citation' && a.url) {
        annotationSources[a.url] = {
          url: a.url,
          name: a.title || extractDomain(a.url),
          domain: extractDomain(a.url),
          date: null
        };
      }
    });

    // Parse the JSON block the model wrote
    const jsonMatch = rawText.replaceAll(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
    let parsed;
    try { parsed = JSON.parse(jsonMatch?.[0] || '{}'); }
    catch { parsed = { verdict: 'unverified', note: rawText || 'Could not parse response.', sources: [] }; }

    const verdict = ['verified', 'disputed', 'false', 'unverified'].includes(parsed.verdict)
      ? parsed.verdict : 'unverified';

    // Merge model-written sources (have dates/names) with annotation URLs not already listed
    const modelSources = (Array.isArray(parsed.sources) ? parsed.sources : [])
      .filter(s => s.url)
      .map(s => ({ name: s.name || extractDomain(s.url), url: s.url, domain: extractDomain(s.url), date: s.date || null }));

    const modelUrls = new Set(modelSources.map(s => s.url));
    const extraSources = Object.values(annotationSources).filter(s => !modelUrls.has(s.url));
    const sources = [...modelSources, ...extraSources].slice(0, 3);

    return { success: true, verdict, note: parsed.note || '', sources };
  } catch (err) {
    console.error('[Recap] factCheckClaim failed:', err);
    return { success: false, verdict: 'unverified', note: err.message, sources: [] };
  }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}
