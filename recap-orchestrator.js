/* ============================================================================
 * Recap orchestrator — wires RecapPanel to the existing transcript/OpenAI APIs
 *
 * Loads AFTER: openai-summary.js, recap-api.js, panel.js, content.js
 * Overrides the "summarize" flow to render in the inline panel instead of a modal.
 * Keeps transcript download, sponsor skip, settings, popup msg flow untouched.
 * ========================================================================= */

(function () {
  console.log('[Recap] orchestrator loaded');

  // shared state for current video
  let currentRun = null; // { language, length, transcript, summary, claims, quotes, category, factCheckable }

  // length → upstream summaryMode mapping
  function modeForLength(length) {
    if (length === 'tldr') return 'express';
    if (length === 'detailed') return 'detailed';
    return 'detailed'; // 'normal' => use detailed for richer paragraph (existing pipeline)
  }
  function lengthLabel(length) {
    if (length === 'tldr') return 'TL;DR';
    if (length === 'detailed') return 'Detailed';
    return 'Normal';
  }

  // strip emoji-heavy "DETAILED" template into a plain paragraph for our card UI.
  // Falls back to raw text if no clear paragraph is found.
  function summaryToParagraph(rawSummary) {
    if (!rawSummary) return '';
    // collapse the templated headings (lines starting with an emoji + uppercase word)
    const lines = rawSummary.split('\n').map(l => l.trim()).filter(Boolean);
    const prose = [];
    for (const ln of lines) {
      if (/^[•\-]/.test(ln)) prose.push(ln.replace(/^[•\-]\s*/, '• '));
      else if (/^\d+\.\s/.test(ln)) prose.push(ln);
      else if (/^[\p{Emoji}\p{Extended_Pictographic}]/u.test(ln)) continue; // skip section headers
      else if (/^[A-ZÀ-ÖØ-Ý\s&'']{4,}$/.test(ln)) continue; // ALL-CAPS header
      else prose.push(ln);
    }
    return prose.join('\n').trim() || rawSummary.trim();
  }

  // map our category names to display tags
  const CATEGORY_LABEL = {
    news: 'News & Analysis',
    review: 'Review',
    lecture: 'Lecture',
    opinion: 'Opinion',
    interview: 'Interview',
    tutorial: 'Tutorial',
    recipe: 'Recipe',
    vlog: 'Vlog',
    entertainment: 'Entertainment',
    other: ''
  };

  // ---------- main flow ------------------------------------------------------
  async function runSummarize({ length }) {
    const apiKey = await getApiKey();
    if (!apiKey) {
      window.RecapPanel.showError('Configure your OpenAI API key in extension settings to generate summaries.');
      return;
    }

    const language = await getLanguagePreference();
    currentRun = { language, length };

    window.RecapPanel.showLoading('Reading transcript…');

    // 1. transcript with timestamps (for claim/quote anchoring)
    const tx = await getTranscript(true);
    if (!tx.success) {
      window.RecapPanel.showError('Failed to read transcript: ' + tx.error);
      return;
    }
    currentRun.transcript = tx.transcript;
    currentRun.title = tx.title;

    // 2. parallel: detect category + summary + claims/quotes
    window.RecapPanel.showLoading('Analyzing video type…');
    const [catRes, summaryRes, extractRes] = await Promise.all([
      detectVideoCategory(tx.transcript, apiKey),
      generateSummary(tx.transcript, apiKey, modeForLength(length)),
      extractClaimsAndQuotes(tx.transcript, apiKey, language)
    ]);

    if (!summaryRes.success) {
      window.RecapPanel.showError('Could not generate summary: ' + summaryRes.error);
      return;
    }

    const paragraph = summaryToParagraph(summaryRes.summary);

    // 3. simulate a brief streaming animation (UX polish; the API isn't streamed)
    await streamInto(paragraph);

    currentRun.category = catRes.category || 'other';
    currentRun.factCheckable = !!catRes.factCheckable;
    currentRun.summary = paragraph;
    currentRun.claims = currentRun.factCheckable ? (extractRes.claims || []) : [];
    currentRun.quotes = extractRes.quotes || [];

    renderCurrent();
  }

  // streams a finished string into the panel char-by-char for ~1.5s max
  function streamInto(text) {
    return new Promise(resolve => {
      const total = text.length;
      const targetMs = Math.min(1500, Math.max(600, total * 4));
      const steps = 30;
      const step = Math.ceil(total / steps);
      let i = 0;
      window.RecapPanel.showStreaming('');
      const tick = () => {
        i = Math.min(total, i + step);
        window.RecapPanel.showStreaming(text.slice(0, i));
        if (i >= total) return resolve();
        setTimeout(tick, targetMs / steps);
      };
      setTimeout(tick, 80);
    });
  }

  function renderCurrent() {
    if (!currentRun) return;
    window.RecapPanel.showResult({
      summary: currentRun.summary,
      claims: currentRun.claims,
      quotes: currentRun.quotes,
      category: CATEGORY_LABEL[currentRun.category] || '',
      lengthLabel: lengthLabel(currentRun.length)
    });
  }

  // ---------- fact check -----------------------------------------------------
  async function runFactCheck(claimId) {
    if (!currentRun) return;
    const apiKey = await getApiKey();
    if (!apiKey) {
      window.RecapPanel.showError('Configure your OpenAI API key to fact-check claims.');
      return;
    }

    if (claimId === 'all') {
      const pending = currentRun.claims.filter(c => !c.verdict || c.verdict === 'idle' || c.verdict === 'unverified');
      // mark all pending → 'pending' visually
      pending.forEach(c => c.verdict = 'pending');
      renderCurrent();
      // run in sequence so the panel updates progressively
      for (const c of pending) {
        const res = await factCheckClaim(c.text, apiKey, currentRun.language);
        Object.assign(c, {
          verdict: res.verdict,
          note: res.note,
          sources: res.sources || []
        });
        renderCurrent();
      }
      return;
    }

    const claim = currentRun.claims.find(c => c.id === claimId);
    if (!claim) return;
    claim.verdict = 'pending';
    renderCurrent();
    const res = await factCheckClaim(claim.text, apiKey, currentRun.language);
    Object.assign(claim, { verdict: res.verdict, note: res.note, sources: res.sources || [] });
    renderCurrent();
  }

  // ---------- aux actions ----------------------------------------------------
  function copySummary() {
    if (!currentRun) return;
    navigator.clipboard.writeText(currentRun.summary || '');
  }
  function saveSummary() {
    if (!currentRun) return;
    const safe = (currentRun.title || 'summary').replace(/[^a-z0-9]/gi, '_').slice(0, 100);
    const blob = new Blob([currentRun.summary || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `recap_${safe}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  async function translateSummary() {
    if (!currentRun) return;
    const apiKey = await getApiKey();
    if (!apiKey) return;
    const target = prompt('Translate summary to (language code, e.g. en, fr, es, de):', 'en');
    if (!target) return;
    window.RecapPanel.showLoading('Translating…');
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `Translate the following text to ${target}. Keep the bullet points and structure. Output translation only.` },
            { role: 'user', content: currentRun.summary }
          ],
          temperature: 0.2, max_tokens: 1500
        })
      });
      const d = await r.json();
      const t = d.choices[0]?.message?.content;
      if (t) { currentRun.summary = t.trim(); renderCurrent(); }
      else renderCurrent();
    } catch (e) {
      window.RecapPanel.showError('Translation failed: ' + e.message);
    }
  }

  // ---------- event wiring ---------------------------------------------------
  window.addEventListener('recap:summarize',  e => runSummarize({ length: e.detail?.length || 'normal' }));
  window.addEventListener('recap:regenerate', () => runSummarize({ length: currentRun?.length || 'normal' }));
  window.addEventListener('recap:fact-check', e => runFactCheck(e.detail?.claimId));
  window.addEventListener('recap:copy',       copySummary);
  window.addEventListener('recap:save',       saveSummary);
  window.addEventListener('recap:translate',  translateSummary);

  // ---------- mount idle panel + override the existing dropdown call ---------
  function mountWhenReady() {
    const tryMount = () => {
      const secondary = document.querySelector('#secondary');
      if (!secondary) return false;
      window.RecapPanel.mount();
      window.RecapPanel.showIdle();
      return true;
    };
    if (tryMount()) return;
    const iv = setInterval(() => { if (tryMount()) clearInterval(iv); }, 500);
    setTimeout(() => clearInterval(iv), 15000);
  }
  mountWhenReady();

  // Re-mount on YouTube SPA nav (poll the document each 2s)
  let lastVid = null;
  setInterval(() => {
    const vid = new URLSearchParams(location.search).get('v');
    if (!vid) return;
    if (vid !== lastVid) {
      lastVid = vid;
      currentRun = null;
      // give YT time to redraw #secondary
      setTimeout(() => {
        if (!document.getElementById('recap-mount')) mountWhenReady();
        else window.RecapPanel.showIdle();
      }, 1200);
    }
  }, 2000);

  // ---------- override the legacy modal-based summarize handler --------------
  // The existing dropdown calls window.handleSummarize(includeTimestamps, mode).
  // We keep its signature but route everything to the panel.
  const legacyMap = { express: 'tldr', bullets: 'normal', detailed: 'detailed' };
  window.handleSummarize = function (_includeTs, summaryMode = 'detailed') {
    const length = legacyMap[summaryMode] || 'normal';
    runSummarize({ length });
  };

  // The fact-check button in the old modal is gone; legacy handler is now no-op
  window.handleFactCheck = function () {
    if (!currentRun) {
      runSummarize({ length: 'normal' });
    } else {
      runFactCheck('all');
    }
  };

  console.log('[Recap] handlers overridden, panel mounted');
})();
