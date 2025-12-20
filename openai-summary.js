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
        let languageConfig;

        if (summaryMode === 'express') {
            languageConfig = getExpressLanguageConfig(languagePreference);
        } else if (summaryMode === 'bullets') {
            languageConfig = getBulletsLanguageConfig(languagePreference);
        } else {
            languageConfig = getLanguageConfig(languagePreference);
        }

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
                max_tokens: summaryMode === 'express' ? 200 : (summaryMode === 'bullets' ? 600 : 1000)
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
            systemPrompt: 'You are an expert at creating practical video summaries in French. Extract CONCRETE information, never describe what the video does. Always respond in French, no markdown, no lists, no formatting.',
            userPrompt: `Analysez cette transcription et créez un résumé UTILE en 1-2 paragraphes.

⚠️ INTERDIT ABSOLU :
- NE JAMAIS dire "Cette vidéo montre...", "Le créateur explique...", "La vidéo décrit..."
- NE JAMAIS décrire CE QUE fait la vidéo
- DONNER directement L'INFORMATION CONCRÈTE

SELON LE TYPE DE CONTENU :

RECETTE/TUTORIEL CUISINE : Donner le plat, les ingrédients principaux avec quantités approximatives, les étapes essentielles de cuisson, temps de cuisson, température si mentionnée, et astuces clés. Exemple : "Le boeuf bourguignon nécessite 1kg de viande de boeuf, des carottes, oignons, lardons, ail, bouquet garni et une bouteille de vin rouge. Faire revenir la viande..."

ACTUALITÉS : Donner le fait précis, qui/quoi/où/quand, contexte immédiat, conséquences. Exemple : "OpenAI et Disney ont signé un accord le 15 janvier 2025 pour intégrer ChatGPT dans..."

TUTORIEL PRATIQUE : Donner l'objectif, le matériel nécessaire, les étapes concrètes numérotées mentalement, résultat attendu et temps estimé. Exemple : "Pour créer un site web, installer Node.js et VS Code, puis créer un dossier projet..."

COMPARAISON PRODUIT : Nommer les produits comparés, leurs prix, différences clés, avantages/inconvénients de chacun, verdict final avec justification. Exemple : "L'iPhone 15 Pro (1199€) contre le Samsung S24 Ultra (1299€). L'iPhone offre..."

HISTOIRE/RÉCIT : Situation de départ, événement déclencheur, développement crucial, dénouement/conclusion. Exemple : "Un homme découvre en 2020 que sa maison cachait un trésor. En rénovant sa cave..."

ÉDUCATIF/SCIENCE : Concept principal expliqué simplement, exemples concrets donnés, application pratique ou leçon à retenir. Exemple : "La photosynthèse permet aux plantes de transformer CO2 et eau en glucose grâce à la lumière..."

CRITIQUE/AVIS : Sujet critiqué, arguments principaux pour et contre, position finale de l'auteur avec raisons. Exemple : "Le film Dune 2 impressionne par ses effets visuels mais déçoit sur le rythme narratif..."

GAMING : Nom du jeu, objectif de la session, stratégie/technique utilisée, résultat obtenu, moment clé. Exemple : "Session de Elden Ring où le joueur affronte Malenia avec une build mage..."

TECHNOLOGIE/INNOVATION : Technologie présentée, fonctionnement simplifié, démonstration concrète, résultats/performances, implications. Exemple : "Le nouveau processeur M4 d'Apple utilise une gravure 3nm permettant..."

RÈGLES STRICTES :
- DONNER L'INFORMATION, ne pas décrire la vidéo
- 1-2 paragraphes, prose naturelle, aucune liste
- Informations concrètes et chiffres quand disponibles
- Permettre de comprendre SANS regarder la vidéo

Transcription à analyser :
\${transcript}`
        },
        en: {
            systemPrompt: 'You are an expert at creating practical video summaries in English. Extract CONCRETE information, never describe what the video does. Always respond in English, no markdown, no lists, no formatting.',
            userPrompt: `Analyze this transcript and create a USEFUL summary in 1-2 paragraphs.

⚠️ ABSOLUTE PROHIBITIONS:
- NEVER say "This video shows...", "The creator explains...", "The video describes..."
- NEVER describe WHAT the video does
- GIVE the CONCRETE INFORMATION directly

BY CONTENT TYPE:

RECIPE/COOKING TUTORIAL: Give the dish name, main ingredients with approximate quantities, essential cooking steps, cooking time, temperature if mentioned, and key tips. Example: "Beef bourguignon requires 1kg beef, carrots, onions, bacon, garlic, bouquet garni, and a bottle of red wine. Sear the meat..."

NEWS: Give the precise fact, who/what/where/when, immediate context, consequences. Example: "OpenAI and Disney signed an agreement on January 15, 2025 to integrate ChatGPT into..."

PRACTICAL TUTORIAL: Give the goal, necessary materials, concrete steps mentally numbered, expected result, and estimated time. Example: "To create a website, install Node.js and VS Code, then create a project folder..."

PRODUCT COMPARISON: Name the compared products, their prices, key differences, pros/cons of each, final verdict with justification. Example: "iPhone 15 Pro ($1199) vs Samsung S24 Ultra ($1299). The iPhone offers..."

STORY/NARRATIVE: Starting situation, triggering event, crucial development, outcome/conclusion. Example: "A man discovered in 2020 that his house hid a treasure. While renovating his basement..."

EDUCATION/SCIENCE: Main concept explained simply, concrete examples given, practical application or key takeaway. Example: "Photosynthesis allows plants to transform CO2 and water into glucose using light..."

REVIEW/OPINION: Subject reviewed, main arguments for and against, author's final position with reasons. Example: "Dune 2 impresses with visual effects but disappoints in narrative pacing..."

GAMING: Game name, session objective, strategy/technique used, result obtained, key moment. Example: "Elden Ring session where the player fights Malenia with a mage build..."

TECHNOLOGY/INNOVATION: Technology presented, simplified functioning, concrete demonstration, results/performance, implications. Example: "Apple's new M4 processor uses 3nm engraving enabling..."

STRICT RULES:
- GIVE THE INFORMATION, don't describe the video
- 1-2 paragraphs, natural prose, no lists
- Concrete information and numbers when available
- Must allow understanding WITHOUT watching the video

Transcript to analyze:
\${transcript}`
        },
        de: {
            systemPrompt: 'You are an expert at creating practical video summaries in German. Extract CONCRETE information, never describe what the video does. Always respond in German, no markdown, no lists, no formatting.',
            userPrompt: `Analysieren Sie dieses Transkript und erstellen Sie eine NÜTZLICHE Zusammenfassung in 1-2 Absätzen.

⚠️ ABSOLUTE VERBOTE:
- NIEMALS sagen "Dieses Video zeigt...", "Der Ersteller erklärt...", "Das Video beschreibt..."
- NIEMALS beschreiben WAS das Video tut
- GEBEN Sie die KONKRETE INFORMATION direkt

NACH INHALTSTYP:

REZEPT/KOCHTUTORIAL: Gericht, Hauptzutaten mit ungefähren Mengen, wesentliche Kochschritte, Kochzeit, Temperatur falls erwähnt, wichtige Tipps angeben.

NACHRICHTEN: Präzise Fakten, wer/was/wo/wann, unmittelbarer Kontext, Konsequenzen angeben.

PRAKTISCHES TUTORIAL: Ziel, notwendige Materialien, konkrete Schritte mental nummeriert, erwartetes Ergebnis, geschätzte Zeit angeben.

PRODUKTVERGLEICH: Verglichene Produkte, Preise, Hauptunterschiede, Vor-/Nachteile, Urteil mit Begründung nennen.

GESCHICHTE/ERZÄHLUNG: Ausgangssituation, auslösendes Ereignis, entscheidende Entwicklung, Ausgang/Fazit.

BILDUNG/WISSENSCHAFT: Hauptkonzept einfach erklärt, konkrete Beispiele, praktische Anwendung oder wichtigste Erkenntnis.

KRITIK/MEINUNG: Kritisiertes Thema, Hauptargumente dafür und dagegen, Autorenposition mit Gründen.

GAMING: Spielname, Sitzungsziel, verwendete Strategie/Technik, Ergebnis, Schlüsselmoment.

TECHNOLOGIE/INNOVATION: Präsentierte Technologie, vereinfachte Funktionsweise, konkrete Demonstration, Ergebnisse/Leistung, Auswirkungen.

STRENGE REGELN:
- INFORMATION GEBEN, nicht das Video beschreiben
- 1-2 Absätze, natürliche Prosa, keine Listen
- Konkrete Informationen und Zahlen wenn verfügbar
- Muss Verständnis OHNE Video-Ansicht ermöglichen

Zu analysierendes Transkript:
\${transcript}`
        },
        es: {
            systemPrompt: 'You are an expert at creating practical video summaries in Spanish. Extract CONCRETE information, never describe what the video does. Always respond in Spanish, no markdown, no lists, no formatting.',
            userPrompt: `Analiza esta transcripción y crea un resumen ÚTIL en 1-2 párrafos.

⚠️ PROHIBICIONES ABSOLUTAS:
- NUNCA decir "Este video muestra...", "El creador explica...", "El video describe..."
- NUNCA describir QUÉ hace el video
- DAR la INFORMACIÓN CONCRETA directamente

POR TIPO DE CONTENIDO:

RECETA/TUTORIAL DE COCINA: Dar el plato, ingredientes principales con cantidades aproximadas, pasos esenciales de cocción, tiempo de cocción, temperatura si se menciona, y consejos clave.

NOTICIAS: Dar el hecho preciso, quién/qué/dónde/cuándo, contexto inmediato, consecuencias.

TUTORIAL PRÁCTICO: Dar el objetivo, materiales necesarios, pasos concretos numerados mentalmente, resultado esperado, tiempo estimado.

COMPARACIÓN DE PRODUCTOS: Nombrar productos comparados, precios, diferencias clave, pros/contras de cada uno, veredicto final con justificación.

HISTORIA/NARRATIVA: Situación inicial, evento desencadenante, desarrollo crucial, desenlace/conclusión.

EDUCACIÓN/CIENCIA: Concepto principal explicado simplemente, ejemplos concretos dados, aplicación práctica o lección clave.

CRÍTICA/OPINIÓN: Tema criticado, argumentos principales a favor y en contra, posición final del autor con razones.

GAMING: Nombre del juego, objetivo de la sesión, estrategia/técnica utilizada, resultado obtenido, momento clave.

TECNOLOGÍA/INNOVACIÓN: Tecnología presentada, funcionamiento simplificado, demostración concreta, resultados/rendimiento, implicaciones.

REGLAS ESTRICTAS:
- DAR LA INFORMACIÓN, no describir el video
- 1-2 párrafos, prosa natural, sin listas
- Información concreta y números cuando estén disponibles
- Debe permitir comprensión SIN ver el video

Transcripción a analizar:
\${transcript}`
        }
    };

    return configs[language] || configs.fr; // Default to French if language not found
}

/**
 * Get language-specific configuration for express mode (ultra-condensed summaries)
 * @param {string} language - Language code (fr, en, de, es)
 * @returns {object} Configuration object with system and user prompts for express mode
 */
function getExpressLanguageConfig(language) {
    const configs = {
        fr: {
            systemPrompt: 'You are an expert at creating ultra-condensed video summaries in French. Always respond in French with exactly 3 sentences, no formatting.',
            userPrompt: `Analysez cette transcription vidéo YouTube et générez un résumé ultra-condensé de EXACTEMENT 3 phrases.

RÈGLES STRICTES :
- Exactement 3 phrases, pas plus, pas moins
- Aucun formatage (pas de puces, pas de numéros, pas de titres)
- Ton direct et factuel uniquement
- Aucun détail secondaire

STRUCTURE OBLIGATOIRE :
Phrase 1 : L'idée principale ou le sujet central de la vidéo
Phrase 2 : L'événement clé, l'information principale ou le point crucial
Phrase 3 : La conclusion, le résultat final ou le message de fin

Le résumé doit suffire à comprendre la vidéo sans la regarder. Allez droit au but.

Transcription à analyser :
\${transcript}`
        },
        en: {
            systemPrompt: 'You are an expert at creating ultra-condensed video summaries in English. Always respond in English with exactly 3 sentences, no formatting.',
            userPrompt: `Analyze this YouTube video transcript and generate an ultra-condensed summary of EXACTLY 3 sentences.

STRICT RULES:
- Exactly 3 sentences, no more, no less
- No formatting (no bullets, no numbers, no titles)
- Direct, factual tone only
- No secondary details

MANDATORY STRUCTURE:
Sentence 1: The core idea or central topic of the video
Sentence 2: The key event, main information, or crucial point
Sentence 3: The conclusion, final outcome, or ending message

The summary must be enough to understand the video without watching it. Get straight to the point.

Transcript to analyze:
\${transcript}`
        },
        de: {
            systemPrompt: 'You are an expert at creating ultra-condensed video summaries in German. Always respond in German with exactly 3 sentences, no formatting.',
            userPrompt: `Analysieren Sie dieses YouTube-Video-Transkript und erstellen Sie eine ultra-komprimierte Zusammenfassung von GENAU 3 Sätzen.

STRENGE REGELN:
- Genau 3 Sätze, nicht mehr, nicht weniger
- Keine Formatierung (keine Aufzählungszeichen, keine Zahlen, keine Titel)
- Nur direkter, sachlicher Ton
- Keine Nebendetails

OBLIGATORISCHE STRUKTUR:
Satz 1: Die Kernidee oder das zentrale Thema des Videos
Satz 2: Das Schlüsselereignis, die Hauptinformation oder der entscheidende Punkt
Satz 3: Das Fazit, das Endergebnis oder die Abschlussbotschaft

Die Zusammenfassung muss ausreichen, um das Video zu verstehen, ohne es anzusehen. Kommen Sie direkt zum Punkt.

Zu analysierendes Transkript:
\${transcript}`
        },
        es: {
            systemPrompt: 'You are an expert at creating ultra-condensed video summaries in Spanish. Always respond in Spanish with exactly 3 sentences, no formatting.',
            userPrompt: `Analiza esta transcripción de video de YouTube y genera un resumen ultra-condensado de EXACTAMENTE 3 frases.

REGLAS ESTRICTAS:
- Exactamente 3 frases, ni más ni menos
- Sin formato (sin viñetas, sin números, sin títulos)
- Solo tono directo y factual
- Sin detalles secundarios

ESTRUCTURA OBLIGATORIA:
Frase 1: La idea central o tema principal del video
Frase 2: El evento clave, información principal o punto crucial
Frase 3: La conclusión, resultado final o mensaje de cierre

El resumen debe ser suficiente para entender el video sin verlo. Ve directo al grano.

Transcripción a analizar:
\${transcript}`
        }
    };

    return configs[language] || configs.fr; // Default to French if language not found
}

/**
 * Get language-specific configuration for bullets mode (key highlights and takeaways)
 * @param {string} language - Language code (fr, en, de, es)
 * @returns {object} Configuration object with system and user prompts for bullets mode
 */
function getBulletsLanguageConfig(language) {
    const configs = {
        fr: {
            systemPrompt: 'You are an expert at creating concise bullet-point summaries in French. Always respond in French with 5-8 bullet points, no other formatting.',
            userPrompt: `Analysez cette transcription vidéo YouTube et générez un résumé sous forme de points clés.

RÈGLES STRICTES :
- Entre 5 et 8 points clés maximum
- Chaque point commence par "• " (bullet Unicode)
- Chaque point est une phrase complète
- Aucun formatage supplémentaire (pas de titres, pas de numéros)
- Ton direct et factuel uniquement

CONTENU DES POINTS :
- Points principaux et idées clés de la vidéo
- Faits importants, chiffres, et informations concrètes
- Étapes clés ou événements principaux
- Conclusions et messages à retenir
- Astuces ou conseils pratiques si présents

Le résumé doit donner les informations essentielles sans regarder la vidéo. Allez droit au but.

Transcription à analyser :
\${transcript}`
        },
        en: {
            systemPrompt: 'You are an expert at creating concise bullet-point summaries in English. Always respond in English with 5-8 bullet points, no other formatting.',
            userPrompt: `Analyze this YouTube video transcript and generate a summary in bullet points.

STRICT RULES:
- Between 5 and 8 key points maximum
- Each point starts with "• " (Unicode bullet)
- Each point is a complete sentence
- No additional formatting (no titles, no numbers)
- Direct, factual tone only

BULLET CONTENT:
- Main points and key ideas from the video
- Important facts, numbers, and concrete information
- Key steps or main events
- Conclusions and key takeaways
- Tips or practical advice if present

The summary must provide essential information without watching the video. Get straight to the point.

Transcript to analyze:
\${transcript}`
        },
        de: {
            systemPrompt: 'You are an expert at creating concise bullet-point summaries in German. Always respond in German with 5-8 bullet points, no other formatting.',
            userPrompt: `Analysieren Sie dieses YouTube-Video-Transkript und erstellen Sie eine Zusammenfassung in Stichpunkten.

STRENGE REGELN:
- Zwischen 5 und 8 Hauptpunkte maximum
- Jeder Punkt beginnt mit "• " (Unicode-Aufzählungszeichen)
- Jeder Punkt ist ein vollständiger Satz
- Keine zusätzliche Formatierung (keine Titel, keine Zahlen)
- Nur direkter, sachlicher Ton

INHALT DER PUNKTE:
- Hauptpunkte und Schlüsselideen aus dem Video
- Wichtige Fakten, Zahlen und konkrete Informationen
- Hauptschritte oder Hauptereignisse
- Schlussfolgerungen und wichtige Erkenntnisse
- Tipps oder praktische Ratschläge falls vorhanden

Die Zusammenfassung muss wesentliche Informationen liefern, ohne das Video anzusehen. Kommen Sie direkt zum Punkt.

Zu analysierendes Transkript:
\${transcript}`
        },
        es: {
            systemPrompt: 'You are an expert at creating concise bullet-point summaries in Spanish. Always respond in Spanish with 5-8 bullet points, no other formatting.',
            userPrompt: `Analiza esta transcripción de video de YouTube y genera un resumen en puntos clave.

REGLAS ESTRICTAS:
- Entre 5 y 8 puntos clave máximo
- Cada punto comienza con "• " (viñeta Unicode)
- Cada punto es una frase completa
- Sin formato adicional (sin títulos, sin números)
- Solo tono directo y factual

CONTENIDO DE LOS PUNTOS:
- Puntos principales e ideas clave del video
- Hechos importantes, números e información concreta
- Pasos clave o eventos principales
- Conclusiones y mensajes clave
- Consejos o recomendaciones prácticas si están presentes

El resumen debe proporcionar información esencial sin ver el video. Ve directo al grano.

Transcripción a analizar:
\${transcript}`
        }
    };

    return configs[language] || configs.fr; // Default to French if language not found
}
