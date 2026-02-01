// OpenAI API integration for video transcript summarization

/**
 * Convert a timestamp string (e.g., "1:45", "10:30", "1:05:30") to seconds
 * @param {string|number} timestamp - The timestamp to convert
 * @returns {number|null} The timestamp in seconds, or null if invalid
 */
function timestampToSeconds(timestamp) {
    // If already a number, return it
    if (typeof timestamp === 'number') {
        return timestamp;
    }

    // If not a string, return null
    if (typeof timestamp !== 'string') {
        return null;
    }

    // Remove brackets if present [1:45] -> 1:45
    timestamp = timestamp.replace(/[\[\]]/g, '').trim();

    // Split by colon
    const parts = timestamp.split(':').map(p => parseInt(p, 10));

    if (parts.some(isNaN)) {
        return null;
    }

    if (parts.length === 2) {
        // MM:SS format
        const [minutes, seconds] = parts;
        return minutes * 60 + seconds;
    } else if (parts.length === 3) {
        // H:MM:SS format
        const [hours, minutes, seconds] = parts;
        return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
}

/**
 * Detect sponsor segments in a transcript with timestamps
 * @param {string} transcript - The video transcript with timestamps (format: [MM:SS] text)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{success: boolean, segments?: Array<{start: number, end: number}>, error?: string}>}
 */
async function detectSponsorSegments(transcript, apiKey) {
    try {
        if (!apiKey) {
            throw new Error('OpenAI API key is required.');
        }

        if (!transcript || transcript.trim().length === 0) {
            throw new Error('Transcript is empty.');
        }

        console.log('[OpenAI] Detecting sponsor segments...');
        console.log('[OpenAI] Transcript preview:', transcript.substring(0, 500));

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
                    content: `You detect sponsor segments in YouTube transcripts. The transcript may be in ANY language.

Each line starts with a timestamp like [0:30] or [5:45] or [12:03].

SPONSOR INDICATORS:

ENGLISH: "sponsored by", "thanks to [brand]", "use code", "link in description", "check out"
FRENCH: "sponsorisé par", "partenaire", "en partenariat avec", "grâce à", "code promo", "lien en description", "n'hésitez pas", "avec le code"
SPANISH: "patrocinado por", "usa el código", "enlace en la descripción"
GERMAN: "gesponsert von", "benutzt den Code", "Link in der Beschreibung"

BRANDS: NordVPN, ExpressVPN, Surfshark, Skillshare, Audible, Squarespace, HelloFresh, Raycon, Ridge, Manscaped, BetterHelp, Honey, Opera GX, Raid Shadow Legends, etc.

END INDICATORS:
ENGLISH: "anyway", "back to", "moving on", "alright so", "now let's"
FRENCH: "bref", "du coup", "donc voilà", "on reprend", "passons à", "en tout cas", "allez on continue"

RULES:
1. Find the EXACT timestamp where sponsor STARTS (first mention of brand/sponsor)
2. Find the EXACT timestamp where they RETURN to main content
3. Copy timestamps EXACTLY as they appear in the transcript (e.g., "1:45", "10:30")
4. Be conservative: shorter is better than too long

OUTPUT FORMAT - Return timestamps as strings, exactly as in transcript:
[{"start": "1:45", "end": "2:30"}]
No sponsors: []`
                },
                {
                    role: 'user',
                    content: `Find sponsor segments. Return timestamps exactly as they appear in the transcript.

${transcript}

JSON:`
                }],
                temperature: 0.1,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content?.trim();

        if (!content) {
            return { success: true, segments: [] };
        }

        // Parse JSON response and convert timestamps to seconds
        try {
            const rawSegments = JSON.parse(content);
            if (Array.isArray(rawSegments)) {
                // Convert timestamp strings to seconds
                const segments = rawSegments.map(seg => ({
                    start: timestampToSeconds(seg.start),
                    end: timestampToSeconds(seg.end)
                })).filter(seg => seg.start !== null && seg.end !== null && seg.end > seg.start);

                console.log('[OpenAI] Raw segments from AI:', rawSegments);
                console.log('[OpenAI] Converted segments (seconds):', segments);
                return { success: true, segments };
            }
            return { success: true, segments: [] };
        } catch (parseError) {
            console.warn('[OpenAI] Could not parse segments:', content);
            return { success: true, segments: [] };
        }

    } catch (error) {
        console.error('[OpenAI] Error detecting sponsors:', error);
        return { success: false, error: error.message };
    }
}

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

        // Get sponsor filter preference
        const filterSponsors = await getSponsorFilterPreference();
        console.log(`[OpenAI Summary] Sponsor filter: ${filterSponsors ? 'enabled' : 'disabled'}`);

        // Map summaryMode to output format
        const outputFormat = summaryMode === 'express' ? 'SHORT' :
                            summaryMode === 'bullets' ? 'BULLET POINTS' : 'DETAILED';

        const config = getSummaryConfig(languagePreference, filterSponsors);

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
                        content: config.userPrompt.replace('${transcript}', transcript).replace(/\${outputFormat}/g, outputFormat)
                    }
                ],
                temperature: 0.7,
                max_tokens: summaryMode === 'express' ? 300 : (summaryMode === 'bullets' ? 800 : 2000)
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
 * Get the sponsor filtering preference
 * @returns {Promise<boolean>}
 */
async function getSponsorFilterPreference() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['filterSponsors'], (result) => {
            resolve(result.filterSponsors !== false); // Default to true (enabled)
        });
    });
}

/**
 * Get summary configuration with the comprehensive prompt
 * @param {string} language - Language code (fr, en, de, es)
 * @param {boolean} filterSponsors - Whether to filter sponsor content
 * @returns {object} Configuration object with system and user prompts
 */
function getSummaryConfig(language, filterSponsors = true) {
    const languageInstructions = {
        fr: 'Always respond in French.',
        en: 'Always respond in English.',
        de: 'Always respond in German.',
        es: 'Always respond in Spanish.'
    };

    const sponsorFilterInstructions = {
        en: `
------------------------------------
SPONSOR SEGMENT HANDLING
------------------------------------
IMPORTANT: IGNORE and DO NOT include any sponsor segments, promotional content, or paid partnerships in your summary.
Sponsor segments typically include:
- Product promotions (NordVPN, Skillshare, Audible, Squarespace, etc.)
- Discount codes and "use my code" mentions
- Affiliate links and "link in description" promotions
- Sponsored messages and paid partnerships
- Self-promotions for merchandise or Patreon

Focus ONLY on the actual educational/entertainment content of the video.
Do NOT mention that you skipped sponsor content.
`,
        fr: `
------------------------------------
GESTION DES SEGMENTS SPONSORISÉS
------------------------------------
IMPORTANT: IGNOREZ et N'INCLUEZ PAS les segments sponsorisés, le contenu promotionnel ou les partenariats payants dans votre résumé.
Les segments sponsorisés comprennent généralement:
- Promotions de produits (NordVPN, Skillshare, Audible, Squarespace, etc.)
- Codes promo et mentions "utilisez mon code"
- Liens affiliés et promotions "lien en description"
- Messages sponsorisés et partenariats payants
- Auto-promotions pour le merchandising ou Patreon

Concentrez-vous UNIQUEMENT sur le contenu éducatif/divertissant réel de la vidéo.
Ne mentionnez PAS que vous avez ignoré le contenu sponsorisé.
`,
        de: `
------------------------------------
UMGANG MIT SPONSOR-SEGMENTEN
------------------------------------
WICHTIG: IGNORIEREN Sie Sponsor-Segmente, Werbeinhalte oder bezahlte Partnerschaften in Ihrer Zusammenfassung.
Sponsor-Segmente umfassen typischerweise:
- Produktwerbung (NordVPN, Skillshare, Audible, Squarespace, etc.)
- Rabattcodes und "benutzt meinen Code" Erwähnungen
- Affiliate-Links und "Link in der Beschreibung" Promotionen
- Gesponserte Nachrichten und bezahlte Partnerschaften
- Eigenwerbung für Merchandise oder Patreon

Konzentrieren Sie sich NUR auf den tatsächlichen Bildungs-/Unterhaltungsinhalt des Videos.
Erwähnen Sie NICHT, dass Sie gesponserte Inhalte übersprungen haben.
`,
        es: `
------------------------------------
MANEJO DE SEGMENTOS PATROCINADOS
------------------------------------
IMPORTANTE: IGNORE y NO INCLUYA segmentos patrocinados, contenido promocional o asociaciones pagas en su resumen.
Los segmentos patrocinados típicamente incluyen:
- Promociones de productos (NordVPN, Skillshare, Audible, Squarespace, etc.)
- Códigos de descuento y menciones de "usa mi código"
- Enlaces de afiliados y promociones de "enlace en la descripción"
- Mensajes patrocinados y asociaciones pagas
- Auto-promociones de merchandising o Patreon

Concéntrese SOLO en el contenido educativo/de entretenimiento real del video.
NO mencione que omitió contenido patrocinado.
`
    };

    // Translated template labels for each language
    const templates = {
        en: {
            // Recipe
            dishName: 'DISH NAME',
            ingredients: 'INGREDIENTS',
            preparation: 'PREPARATION',
            cooking: 'COOKING',
            method: 'Method',
            temperature: 'Temperature',
            time: 'Time',
            tipsVariations: 'TIPS & VARIATIONS',
            // Tutorial
            goal: 'GOAL',
            prerequisites: 'PREREQUISITES',
            stepByStep: 'STEP-BY-STEP PROCESS',
            mistakesToAvoid: 'COMMON MISTAKES TO AVOID',
            proTips: 'PRO TIPS',
            // Product Review
            product: 'PRODUCT',
            pros: 'PROS',
            cons: 'CONS',
            whoIsItFor: 'WHO IS IT FOR?',
            whoShouldSkip: 'WHO SHOULD SKIP IT?',
            verdict: 'VERDICT',
            // News
            headline: 'HEADLINE',
            context: 'CONTEXT',
            keyFacts: 'KEY FACTS',
            stakeholders: 'STAKEHOLDERS',
            implications: 'IMPLICATIONS',
            // Opinion
            mainArgument: 'MAIN ARGUMENT',
            supportingPoints: 'SUPPORTING POINTS',
            counterarguments: 'COUNTERARGUMENTS ADDRESSED',
            conclusion: 'CONCLUSION',
            // Interview
            participants: 'PARTICIPANTS',
            keyInsights: 'KEY INSIGHTS',
            memorableQuotes: 'MEMORABLE QUOTES',
            mainTakeaways: 'MAIN TAKEAWAYS',
            // Educational
            topic: 'TOPIC',
            coreConcept: 'CORE CONCEPT',
            whyItMatters: 'WHY IT MATTERS',
            keyPoints: 'KEY POINTS',
            rememberThis: 'REMEMBER THIS',
            // Motivation
            coreMessage: 'CORE MESSAGE',
            keyPrinciples: 'KEY PRINCIPLES',
            actionableAdvice: 'ACTIONABLE ADVICE',
            powerfulQuotes: 'POWERFUL QUOTES',
            mindsetShift: 'MINDSET SHIFT',
            // Technical
            objective: 'OBJECTIVE',
            toolsSetup: 'TOOLS & SETUP',
            implementation: 'IMPLEMENTATION',
            gotchas: 'GOTCHAS',
            keyConcepts: 'KEY CONCEPTS',
            // Default
            overview: 'OVERVIEW',
            highlights: 'HIGHLIGHTS',
            takeaway: 'TAKEAWAY'
        },
        fr: {
            // Recipe
            dishName: 'NOM DU PLAT',
            ingredients: 'INGRÉDIENTS',
            preparation: 'PRÉPARATION',
            cooking: 'CUISSON',
            method: 'Méthode',
            temperature: 'Température',
            time: 'Temps',
            tipsVariations: 'ASTUCES & VARIANTES',
            // Tutorial
            goal: 'OBJECTIF',
            prerequisites: 'PRÉREQUIS',
            stepByStep: 'ÉTAPES',
            mistakesToAvoid: 'ERREURS À ÉVITER',
            proTips: 'CONSEILS DE PRO',
            // Product Review
            product: 'PRODUIT',
            pros: 'AVANTAGES',
            cons: 'INCONVÉNIENTS',
            whoIsItFor: 'POUR QUI ?',
            whoShouldSkip: 'À ÉVITER SI...',
            verdict: 'VERDICT',
            // News
            headline: 'TITRE',
            context: 'CONTEXTE',
            keyFacts: 'FAITS CLÉS',
            stakeholders: 'ACTEURS IMPLIQUÉS',
            implications: 'IMPLICATIONS',
            // Opinion
            mainArgument: 'ARGUMENT PRINCIPAL',
            supportingPoints: 'POINTS DE SOUTIEN',
            counterarguments: 'CONTRE-ARGUMENTS ABORDÉS',
            conclusion: 'CONCLUSION',
            // Interview
            participants: 'PARTICIPANTS',
            keyInsights: 'IDÉES CLÉS',
            memorableQuotes: 'CITATIONS MÉMORABLES',
            mainTakeaways: 'POINTS À RETENIR',
            // Educational
            topic: 'SUJET',
            coreConcept: 'CONCEPT CENTRAL',
            whyItMatters: 'POURQUOI C\'EST IMPORTANT',
            keyPoints: 'POINTS CLÉS',
            rememberThis: 'À RETENIR',
            // Motivation
            coreMessage: 'MESSAGE PRINCIPAL',
            keyPrinciples: 'PRINCIPES CLÉS',
            actionableAdvice: 'CONSEILS PRATIQUES',
            powerfulQuotes: 'CITATIONS MARQUANTES',
            mindsetShift: 'CHANGEMENT DE MENTALITÉ',
            // Technical
            objective: 'OBJECTIF',
            toolsSetup: 'OUTILS & CONFIGURATION',
            implementation: 'IMPLÉMENTATION',
            gotchas: 'PIÈGES À ÉVITER',
            keyConcepts: 'CONCEPTS CLÉS',
            // Default
            overview: 'APERÇU',
            highlights: 'MOMENTS FORTS',
            takeaway: 'À RETENIR'
        },
        de: {
            // Recipe
            dishName: 'GERICHTNAME',
            ingredients: 'ZUTATEN',
            preparation: 'ZUBEREITUNG',
            cooking: 'KOCHEN',
            method: 'Methode',
            temperature: 'Temperatur',
            time: 'Zeit',
            tipsVariations: 'TIPPS & VARIATIONEN',
            // Tutorial
            goal: 'ZIEL',
            prerequisites: 'VORAUSSETZUNGEN',
            stepByStep: 'SCHRITT-FÜR-SCHRITT',
            mistakesToAvoid: 'HÄUFIGE FEHLER',
            proTips: 'PROFI-TIPPS',
            // Product Review
            product: 'PRODUKT',
            pros: 'VORTEILE',
            cons: 'NACHTEILE',
            whoIsItFor: 'FÜR WEN?',
            whoShouldSkip: 'NICHT GEEIGNET FÜR',
            verdict: 'FAZIT',
            // News
            headline: 'SCHLAGZEILE',
            context: 'KONTEXT',
            keyFacts: 'WICHTIGE FAKTEN',
            stakeholders: 'BETEILIGTE',
            implications: 'AUSWIRKUNGEN',
            // Opinion
            mainArgument: 'HAUPTARGUMENT',
            supportingPoints: 'STÜTZENDE PUNKTE',
            counterarguments: 'GEGENARGUMENTE',
            conclusion: 'SCHLUSSFOLGERUNG',
            // Interview
            participants: 'TEILNEHMER',
            keyInsights: 'WICHTIGE ERKENNTNISSE',
            memorableQuotes: 'DENKWÜRDIGE ZITATE',
            mainTakeaways: 'HAUPTERKENNTNISSE',
            // Educational
            topic: 'THEMA',
            coreConcept: 'KERNKONZEPT',
            whyItMatters: 'WARUM ES WICHTIG IST',
            keyPoints: 'SCHLÜSSELPUNKTE',
            rememberThis: 'MERKE DIR',
            // Motivation
            coreMessage: 'KERNBOTSCHAFT',
            keyPrinciples: 'SCHLÜSSELPRINZIPIEN',
            actionableAdvice: 'PRAKTISCHE RATSCHLÄGE',
            powerfulQuotes: 'STARKE ZITATE',
            mindsetShift: 'DENKWEISE ÄNDERN',
            // Technical
            objective: 'ZIEL',
            toolsSetup: 'WERKZEUGE & EINRICHTUNG',
            implementation: 'IMPLEMENTIERUNG',
            gotchas: 'FALLSTRICKE',
            keyConcepts: 'SCHLÜSSELKONZEPTE',
            // Default
            overview: 'ÜBERBLICK',
            highlights: 'HÖHEPUNKTE',
            takeaway: 'FAZIT'
        },
        es: {
            // Recipe
            dishName: 'NOMBRE DEL PLATO',
            ingredients: 'INGREDIENTES',
            preparation: 'PREPARACIÓN',
            cooking: 'COCCIÓN',
            method: 'Método',
            temperature: 'Temperatura',
            time: 'Tiempo',
            tipsVariations: 'CONSEJOS Y VARIACIONES',
            // Tutorial
            goal: 'OBJETIVO',
            prerequisites: 'PRERREQUISITOS',
            stepByStep: 'PASO A PASO',
            mistakesToAvoid: 'ERRORES COMUNES',
            proTips: 'CONSEJOS PRO',
            // Product Review
            product: 'PRODUCTO',
            pros: 'VENTAJAS',
            cons: 'DESVENTAJAS',
            whoIsItFor: '¿PARA QUIÉN?',
            whoShouldSkip: '¿QUIÉN DEBERÍA EVITARLO?',
            verdict: 'VEREDICTO',
            // News
            headline: 'TITULAR',
            context: 'CONTEXTO',
            keyFacts: 'DATOS CLAVE',
            stakeholders: 'ACTORES INVOLUCRADOS',
            implications: 'IMPLICACIONES',
            // Opinion
            mainArgument: 'ARGUMENTO PRINCIPAL',
            supportingPoints: 'PUNTOS DE APOYO',
            counterarguments: 'CONTRAARGUMENTOS',
            conclusion: 'CONCLUSIÓN',
            // Interview
            participants: 'PARTICIPANTES',
            keyInsights: 'IDEAS CLAVE',
            memorableQuotes: 'CITAS MEMORABLES',
            mainTakeaways: 'PUNTOS PRINCIPALES',
            // Educational
            topic: 'TEMA',
            coreConcept: 'CONCEPTO CENTRAL',
            whyItMatters: 'POR QUÉ IMPORTA',
            keyPoints: 'PUNTOS CLAVE',
            rememberThis: 'RECUERDA ESTO',
            // Motivation
            coreMessage: 'MENSAJE CENTRAL',
            keyPrinciples: 'PRINCIPIOS CLAVE',
            actionableAdvice: 'CONSEJOS PRÁCTICOS',
            powerfulQuotes: 'CITAS PODEROSAS',
            mindsetShift: 'CAMBIO DE MENTALIDAD',
            // Technical
            objective: 'OBJETIVO',
            toolsSetup: 'HERRAMIENTAS Y CONFIGURACIÓN',
            implementation: 'IMPLEMENTACIÓN',
            gotchas: 'ERRORES FRECUENTES',
            keyConcepts: 'CONCEPTOS CLAVE',
            // Default
            overview: 'RESUMEN',
            highlights: 'MOMENTOS DESTACADOS',
            takeaway: 'CONCLUSIÓN'
        }
    };

    const t = templates[language] || templates.fr;
    const langInstruction = languageInstructions[language] || languageInstructions.fr;
    const sponsorInstruction = filterSponsors
        ? (sponsorFilterInstructions[language] || sponsorFilterInstructions.en)
        : '';

    const systemPrompt = `You are an expert content analyst and summarizer. ${langInstruction}`;

    const userPrompt = `I will provide you with:
1) A YouTube video transcript
2) A selected output format

Your task is to:
- Analyze the transcript
- Identify the video type
- Produce the best possible summary adapted to that video type
- Focus on what a viewer should REMEMBER long-term
- USE THE EXACT FORMATTING TEMPLATE for the detected video type

------------------------------------
VIDEO TYPE DETECTION
------------------------------------
First, silently determine the video category. Possible types include:

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

------------------------------------
FORMATTING TEMPLATES FOR DETAILED MODE
------------------------------------
IMPORTANT: When output format is DETAILED, you MUST use these exact section structures with headers.

### RECIPE / COOKING VIDEO → Use this exact structure:

🍽️ [${t.dishName}]

📝 ${t.ingredients}
• [ingredient 1 with quantity]
• [ingredient 2 with quantity]
• ...

👨‍🍳 ${t.preparation}
1. [step 1]
2. [step 2]
3. ...

�� ${t.cooking}
• ${t.method}: [baking/frying/etc.]
• ${t.temperature}: [if mentioned]
• ${t.time}: [duration]

💡 ${t.tipsVariations}
• [tip 1]
• [tip 2]


### TUTORIAL / HOW-TO → Use this exact structure:
🎯 ${t.goal}
[What you will learn/achieve]

📋 ${t.prerequisites}
• [requirement 1]
• [requirement 2]

📝 ${t.stepByStep}
1. [Step 1 title]
   [Details]

2. [Step 2 title]
   [Details]

3. ...

⚠️ ${t.mistakesToAvoid}
• [mistake 1]
• [mistake 2]

💡 ${t.proTips}
• [tip 1]
• [tip 2]

### PRODUCT REVIEW → Use this exact structure:
📦 ${t.product}
[Product name and what it is]

✅ ${t.pros}
• [pro 1]
• [pro 2]
• ...

❌ ${t.cons}
• [con 1]
• [con 2]
• ...

👤 ${t.whoIsItFor}
[Target audience]

🚫 ${t.whoShouldSkip}
[Who shouldn't buy]

⭐ ${t.verdict}
[Final recommendation with rating if given]

### NEWS / CURRENT EVENTS → Use this exact structure:
📰 ${t.headline}
[Main news in one sentence]

📍 ${t.context}
[Background and why this matters]

📋 ${t.keyFacts}
• [fact 1]
• [fact 2]
• ...

👥 ${t.stakeholders}
[Who is involved]

🔮 ${t.implications}
[What this means going forward]

### OPINION / COMMENTARY → Use this exact structure:
💭 ${t.mainArgument}
[The creator's central thesis]

📊 ${t.supportingPoints}
• [point 1]
• [point 2]
• ...

⚖️ ${t.counterarguments}
• [if any were discussed]

🎯 ${t.conclusion}
[Creator's final stance]

### INTERVIEW / PODCAST → Use this exact structure:
🎙️ ${t.participants}
• [Person 1] - [Role/Title]
• [Person 2] - [Role/Title]

💎 ${t.keyInsights}
• [insight 1]
• [insight 2]
• ...

💬 ${t.memorableQuotes}
• "[quote 1]"
• "[quote 2]"

🧠 ${t.mainTakeaways}
[Summary of most important ideas]

### EDUCATIONAL / EXPLAINER → Use this exact structure:
📚 ${t.topic}
[What is being explained]

🔑 ${t.coreConcept}
[Main idea in simple terms]

❓ ${t.whyItMatters}
[Relevance and importance]

📖 ${t.keyPoints}
• [point 1]
• [point 2]
• ...

🧠 ${t.rememberThis}
[Mental model or key takeaway]

### MOTIVATION / SELF-IMPROVEMENT → Use this exact structure:
🎯 ${t.coreMessage}
[The main principle]

💡 ${t.keyPrinciples}
• [principle 1]
• [principle 2]
• ...

✨ ${t.actionableAdvice}
• [action 1]
• [action 2]

💬 ${t.powerfulQuotes}
• "[quote 1]"
• "[quote 2]"

🧠 ${t.mindsetShift}
[What to change in your thinking]

### TECHNICAL / PROGRAMMING → Use this exact structure:
💻 ${t.topic}
[What is being taught]

🎯 ${t.objective}
[What you'll be able to do]

🛠️ ${t.toolsSetup}
• [tool/requirement 1]
• [tool/requirement 2]

📝 ${t.implementation}
1. [Step 1]
   \`[code or command if relevant]\`

2. [Step 2]
   \`[code or command if relevant]\`

⚠️ ${t.gotchas}
• [common issue 1]
• [common issue 2]

📚 ${t.keyConcepts}
• [concept 1]: [explanation]
• [concept 2]: [explanation]

### DEFAULT (Entertainment/Documentary/Other) → Use this structure:
📺 ${t.overview}
[What the video is about]

🔑 ${t.keyPoints}
• [point 1]
• [point 2]
• ...

🎬 ${t.highlights}
[Most memorable moments or facts]

🧠 ${t.takeaway}
[What to remember]

------------------------------------
OUTPUT FORMAT RULES
------------------------------------

Selected format: \${outputFormat}

### If DETAILED:
- USE the appropriate template from above based on video type
- Include ALL relevant sections from the template
- Use headers and bullet points as shown
- Make it scannable and easy to reference later

### If SHORT:
- 2-3 sentences ONLY
- No formatting, no bullets, no headers
- Just the essence and conclusion
- Pure prose

### If BULLET POINTS:
- 5-8 bullet points using "• " prefix
- Each point is one complete sentence
- No headers, no sub-bullets
- Focus on key takeaways only

------------------------------------
QUALITY REQUIREMENTS
------------------------------------
- Do NOT summarize line-by-line
- Remove filler, repetition, and tangents
- Prioritize clarity, usefulness, and memory retention
- If transcript is messy, clean and organize the ideas
- ALWAYS match the template structure for DETAILED mode
${sponsorInstruction}
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
