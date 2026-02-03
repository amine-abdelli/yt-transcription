// Internationalization for YouTube Transcript Downloader
// Supports: English (default), French, Spanish, German

const translations = {
  en: {
    // Popup
    title: 'YouTube Transcript Downloader',
    readyStatus: 'Ready to download transcript',
    includeTimestamps: 'Include timestamps',
    downloadBtn: 'Download Transcript',
    aiSummarySettings: 'AI Summary Settings',
    openaiApiKey: 'OpenAI API Key:',
    apiKeyConfigured: 'API Key configured',
    modifyBtn: 'Modify',
    saveApiKey: 'Save API Key',
    apiKeyInfo: 'Get your API key from OpenAI. Your key is stored locally and never shared.',
    summaryLanguage: 'Summary Language:',
    makeInfo: 'Make sure you\'re on a YouTube video page with captions available.',

    // Content - Sponsor detection
    skipSponsorSegments: 'Skip sponsor segments',
    skipDisabled: 'Skip disabled',
    noApiKey: 'No API key',
    detectingSponsors: 'Detecting sponsors...',
    detectionFailed: 'Detection failed',
    noSponsors: 'No sponsors',
    skipSponsors: 'Skip sponsors',
    sponsorSkipped: 'Sponsor skipped',

    // Content - Buttons & Dropdowns
    transcript: 'Transcript',
    detailedSummary: 'Detailed summary',
    comprehensiveOverview: 'Comprehensive overview',
    bulletPoints: 'Bullet points',
    keyHighlights: 'Key highlights and takeaways',
    ultraShortSummary: 'Ultra-short summary',
    sentenceOverview: '1-3 sentence overview',
    downloadWithTimestamps: 'Download with timestamps',
    downloadWithoutTimestamps: 'Download without timestamps',
    copyToClipboard: 'Copy to clipboard',

    // Content - Summary
    generatingSummary: 'Generating summary...',
    aiSummary: 'AI Summary',
    copySummary: 'Copy summary',
    closeSummary: 'Close',
    copied: 'Copied!',
    summaryError: 'Error generating summary',

    // Errors
    errorNoTranscript: 'No transcript available',
    errorApiKey: 'Please configure your OpenAI API key',
  },

  fr: {
    // Popup
    title: 'YouTube Transcript Downloader',
    readyStatus: 'Prêt à télécharger la transcription',
    includeTimestamps: 'Inclure les horodatages',
    downloadBtn: 'Télécharger la transcription',
    aiSummarySettings: 'Paramètres du résumé IA',
    openaiApiKey: 'Clé API OpenAI :',
    apiKeyConfigured: 'Clé API configurée',
    modifyBtn: 'Modifier',
    saveApiKey: 'Enregistrer la clé',
    apiKeyInfo: 'Obtenez votre clé API sur OpenAI. Votre clé est stockée localement et jamais partagée.',
    summaryLanguage: 'Langue du résumé :',
    makeInfo: 'Assurez-vous d\'être sur une vidéo YouTube avec des sous-titres disponibles.',

    // Content - Sponsor detection
    skipSponsorSegments: 'Passer les sponsors',
    skipDisabled: 'Skip désactivé',
    noApiKey: 'Pas de clé API',
    detectingSponsors: 'Détection des sponsors...',
    detectionFailed: 'Échec de détection',
    noSponsors: 'Aucun sponsor',
    skipSponsors: 'Sponsors à passer',
    sponsorSkipped: 'Sponsor passé',

    // Content - Buttons & Dropdowns
    transcript: 'Transcription',
    detailedSummary: 'Résumé détaillé',
    comprehensiveOverview: 'Vue d\'ensemble complète',
    bulletPoints: 'Points clés',
    keyHighlights: 'Points essentiels à retenir',
    ultraShortSummary: 'Résumé ultra-court',
    sentenceOverview: 'Résumé en 1-3 phrases',
    downloadWithTimestamps: 'Télécharger avec horodatage',
    downloadWithoutTimestamps: 'Télécharger sans horodatage',
    copyToClipboard: 'Copier dans le presse-papier',

    // Content - Summary
    generatingSummary: 'Génération du résumé...',
    aiSummary: 'Résumé IA',
    copySummary: 'Copier le résumé',
    closeSummary: 'Fermer',
    copied: 'Copié !',
    summaryError: 'Erreur lors de la génération',

    // Errors
    errorNoTranscript: 'Aucune transcription disponible',
    errorApiKey: 'Veuillez configurer votre clé API OpenAI',
  },

  es: {
    // Popup
    title: 'YouTube Transcript Downloader',
    readyStatus: 'Listo para descargar transcripción',
    includeTimestamps: 'Incluir marcas de tiempo',
    downloadBtn: 'Descargar transcripción',
    aiSummarySettings: 'Configuración del resumen IA',
    openaiApiKey: 'Clave API de OpenAI:',
    apiKeyConfigured: 'Clave API configurada',
    modifyBtn: 'Modificar',
    saveApiKey: 'Guardar clave',
    apiKeyInfo: 'Obtén tu clave API en OpenAI. Tu clave se almacena localmente y nunca se comparte.',
    summaryLanguage: 'Idioma del resumen:',
    makeInfo: 'Asegúrate de estar en un video de YouTube con subtítulos disponibles.',

    // Content - Sponsor detection
    skipSponsorSegments: 'Saltar patrocinadores',
    skipDisabled: 'Salto desactivado',
    noApiKey: 'Sin clave API',
    detectingSponsors: 'Detectando patrocinadores...',
    detectionFailed: 'Error de detección',
    noSponsors: 'Sin patrocinadores',
    skipSponsors: 'Saltar patrocinadores',
    sponsorSkipped: 'Patrocinador saltado',

    // Content - Buttons & Dropdowns
    transcript: 'Transcripción',
    detailedSummary: 'Resumen detallado',
    comprehensiveOverview: 'Vista general completa',
    bulletPoints: 'Puntos clave',
    keyHighlights: 'Puntos destacados',
    ultraShortSummary: 'Resumen ultra-corto',
    sentenceOverview: 'Resumen en 1-3 frases',
    downloadWithTimestamps: 'Descargar con marcas de tiempo',
    downloadWithoutTimestamps: 'Descargar sin marcas de tiempo',
    copyToClipboard: 'Copiar al portapapeles',

    // Content - Summary
    generatingSummary: 'Generando resumen...',
    aiSummary: 'Resumen IA',
    copySummary: 'Copiar resumen',
    closeSummary: 'Cerrar',
    copied: '¡Copiado!',
    summaryError: 'Error al generar resumen',

    // Errors
    errorNoTranscript: 'No hay transcripción disponible',
    errorApiKey: 'Por favor configura tu clave API de OpenAI',
  },

  de: {
    // Popup
    title: 'YouTube Transcript Downloader',
    readyStatus: 'Bereit zum Herunterladen',
    includeTimestamps: 'Zeitstempel einschließen',
    downloadBtn: 'Transkript herunterladen',
    aiSummarySettings: 'KI-Zusammenfassung Einstellungen',
    openaiApiKey: 'OpenAI API-Schlüssel:',
    apiKeyConfigured: 'API-Schlüssel konfiguriert',
    modifyBtn: 'Ändern',
    saveApiKey: 'Schlüssel speichern',
    apiKeyInfo: 'Holen Sie sich Ihren API-Schlüssel bei OpenAI. Ihr Schlüssel wird lokal gespeichert.',
    summaryLanguage: 'Sprache der Zusammenfassung:',
    makeInfo: 'Stellen Sie sicher, dass Sie sich auf einem YouTube-Video mit verfügbaren Untertiteln befinden.',

    // Content - Sponsor detection
    skipSponsorSegments: 'Sponsoren überspringen',
    skipDisabled: 'Überspringen deaktiviert',
    noApiKey: 'Kein API-Schlüssel',
    detectingSponsors: 'Sponsoren erkennen...',
    detectionFailed: 'Erkennung fehlgeschlagen',
    noSponsors: 'Keine Sponsoren',
    skipSponsors: 'Sponsoren überspringen',
    sponsorSkipped: 'Sponsor übersprungen',

    // Content - Buttons & Dropdowns
    transcript: 'Transkript',
    detailedSummary: 'Detaillierte Zusammenfassung',
    comprehensiveOverview: 'Umfassender Überblick',
    bulletPoints: 'Stichpunkte',
    keyHighlights: 'Wichtige Punkte',
    ultraShortSummary: 'Ultra-kurze Zusammenfassung',
    sentenceOverview: 'Zusammenfassung in 1-3 Sätzen',
    downloadWithTimestamps: 'Mit Zeitstempeln herunterladen',
    downloadWithoutTimestamps: 'Ohne Zeitstempel herunterladen',
    copyToClipboard: 'In Zwischenablage kopieren',
    express: 'Kurz',

    // Content - Summary
    generatingSummary: 'Zusammenfassung wird erstellt...',
    aiSummary: 'KI-Zusammenfassung',
    copySummary: 'Zusammenfassung kopieren',
    closeSummary: 'Schließen',
    copied: 'Kopiert!',
    summaryError: 'Fehler bei der Erstellung',

    // Errors
    errorNoTranscript: 'Kein Transkript verfügbar',
    errorApiKey: 'Bitte konfigurieren Sie Ihren OpenAI API-Schlüssel',
  }
};

// Detect browser language and return appropriate locale
function getBrowserLocale() {
  const lang = navigator.language || navigator.userLanguage || 'en';
  const shortLang = lang.split('-')[0].toLowerCase();

  // Return supported locale or default to English
  if (translations[shortLang]) {
    return shortLang;
  }
  return 'en';
}

// Get translation for a key
function t(key) {
  const locale = getBrowserLocale();
  return translations[locale][key] || translations.en[key] || key;
}

// Get current locale
function getCurrentLocale() {
  return getBrowserLocale();
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.i18n = { t, getBrowserLocale, getCurrentLocale, translations };
}
