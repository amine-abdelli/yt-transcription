const TRANSLATIONS = {
  en: {
    title: 'Recap Settings',
    apiKeyLabel: 'OpenAI API Key',
    apiKeyConfigured: 'API key configured',
    apiKeyPlaceholder: 'sk-…',
    modifyBtn: 'Modify',
    saveBtn: 'Save API Key',
    uiLanguageLabel: 'Interface language',
    summaryLanguageLabel: 'Summary language',
    filterSponsorsLabel: 'Auto-skip sponsors',
    errorEmpty: 'Enter an API key.',
    errorFormat: 'Invalid key format (should start with sk-).',
    saved: 'Saved!',
  },
  fr: {
    title: 'Paramètres Recap',
    apiKeyLabel: 'Clé API OpenAI',
    apiKeyConfigured: 'Clé API configurée',
    apiKeyPlaceholder: 'sk-…',
    modifyBtn: 'Modifier',
    saveBtn: 'Enregistrer la clé',
    uiLanguageLabel: 'Langue de l\'interface',
    summaryLanguageLabel: 'Langue des résumés',
    filterSponsorsLabel: 'Ignorer les sponsors',
    errorEmpty: 'Entrez une clé API.',
    errorFormat: 'Format invalide (doit commencer par sk-).',
    saved: 'Enregistré !',
  },
  es: {
    title: 'Ajustes de Recap',
    apiKeyLabel: 'Clave API de OpenAI',
    apiKeyConfigured: 'Clave API configurada',
    apiKeyPlaceholder: 'sk-…',
    modifyBtn: 'Modificar',
    saveBtn: 'Guardar clave',
    uiLanguageLabel: 'Idioma de la interfaz',
    summaryLanguageLabel: 'Idioma de los resúmenes',
    filterSponsorsLabel: 'Omitir patrocinadores',
    errorEmpty: 'Introduce una clave API.',
    errorFormat: 'Formato inválido (debe empezar por sk-).',
    saved: '¡Guardado!',
  },
  de: {
    title: 'Recap-Einstellungen',
    apiKeyLabel: 'OpenAI API-Schlüssel',
    apiKeyConfigured: 'API-Schlüssel konfiguriert',
    apiKeyPlaceholder: 'sk-…',
    modifyBtn: 'Ändern',
    saveBtn: 'Schlüssel speichern',
    uiLanguageLabel: 'Oberflächensprache',
    summaryLanguageLabel: 'Zusammenfassungssprache',
    filterSponsorsLabel: 'Sponsoren überspringen',
    errorEmpty: 'Bitte API-Schlüssel eingeben.',
    errorFormat: 'Ungültiges Format (muss mit sk- beginnen).',
    saved: 'Gespeichert!',
  },
};

document.addEventListener('DOMContentLoaded', function () {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleBtn = document.getElementById('toggleBtn');
  const saveBtn = document.getElementById('saveBtn');
  const modifyBtn = document.getElementById('modifyBtn');
  const configuredRow = document.getElementById('configuredRow');
  const inputRow = document.getElementById('inputRow');
  const apiStatus = document.getElementById('apiStatus');
  const languageSelect = document.getElementById('languageSelect');
  const uiLanguageSelect = document.getElementById('uiLanguageSelect');
  const filterSponsors = document.getElementById('filterSponsors');

  let currentLang = 'en';

  function applyTranslations(lang) {
    currentLang = lang;
    const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key] != null) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (t[key] != null) el.placeholder = t[key];
    });
  }

  // Load saved settings
  chrome.storage.sync.get(['openaiApiKey', 'summaryLanguage', 'filterSponsors', 'uiLanguage'], result => {
    const uiLang = result.uiLanguage || 'en';
    uiLanguageSelect.value = uiLang;
    applyTranslations(uiLang);

    if (result.openaiApiKey) showConfigured();
    else showInput();

    if (result.summaryLanguage) languageSelect.value = result.summaryLanguage;
    filterSponsors.checked = result.filterSponsors !== false;
  });

  function showConfigured() {
    configuredRow.style.display = 'flex';
    inputRow.style.display = 'none';
    saveBtn.style.display = 'none';
  }

  function showInput() {
    configuredRow.style.display = 'none';
    inputRow.style.display = 'flex';
    saveBtn.style.display = 'block';
  }

  modifyBtn.addEventListener('click', () => {
    showInput();
    apiKeyInput.focus();
  });

  toggleBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? '🙈' : '👁';
  });

  saveBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    if (!key) { setStatus(t.errorEmpty, true); return; }
    if (!key.startsWith('sk-')) { setStatus(t.errorFormat, true); return; }
    await chrome.storage.sync.set({ openaiApiKey: key });
    setStatus(t.saved, false);
    showConfigured();
    setTimeout(() => setStatus(''), 2000);
  });

  uiLanguageSelect.addEventListener('change', () => {
    const lang = uiLanguageSelect.value;
    chrome.storage.sync.set({ uiLanguage: lang });
    applyTranslations(lang);
  });

  languageSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ summaryLanguage: languageSelect.value });
  });

  filterSponsors.addEventListener('change', () => {
    chrome.storage.sync.set({ filterSponsors: filterSponsors.checked });
  });

  function setStatus(msg, isError = false) {
    apiStatus.textContent = msg;
    apiStatus.className = 'status' + (isError ? ' error' : '');
  }
});
