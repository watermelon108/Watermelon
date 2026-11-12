const STRINGS = {
  en: {
    home: "Home", search: "Search", addons: "Add-ons", settings: "Settings",
    welcome: "Choose your language",
    language: "Language",
    manifestUrl: "Add-on manifest URL (https://…/manifest.json)",
    install: "Install",
    installing: "Installing…",
    noAddons: "No add-ons yet. Paste a manifest URL above to install one.",
    noCatalogs: "Install an add-on to see catalogs here.",
    noResults: "No results found.",
    searchPlaceholder: "Search titles…",
    loading: "Loading…",
    sourcesDown: "{n} source(s) unavailable",
    sources: "Sources",
    noStreams: "No playable sources found for this title.",
    openExternal: "Open in browser",
    removeAddon: "Remove",
    clearAll: "Remove all add-ons",
    invalid: "This is not a valid add-on manifest.",
    insecure: "Use an https:// manifest URL.",
    version: "Version",
    back: "Back",
    close: "Close",
    ok: "OK",
    playerError: "This source can't be played in the app.",
    enabled: "Enabled",
    working: "Working",
    error: "Error"
  },
  hi: {
    home: "होम", search: "खोजें", addons: "ऐड-ऑन", settings: "सेटिंग्स",
    welcome: "अपनी भाषा चुनें",
    language: "भाषा",
    manifestUrl: "ऐड-ऑन मैनिफेस्ट URL (https://…/manifest.json)",
    install: "इंस्टॉल करें",
    installing: "इंस्टॉल हो रहा है…",
    noAddons: "अभी कोई ऐड-ऑन नहीं है। ऊपर manifest URL डालकर इंस्टॉल करें।",
    noCatalogs: "कैटलॉग देखने के लिए कोई ऐड-ऑन इंस्टॉल करें।",
    noResults: "कोई परिणाम नहीं मिला।",
    searchPlaceholder: "शीर्षक खोजें…",
    loading: "लोड हो रहा है…",
    sourcesDown: "{n} स्रोत उपलब्ध नहीं",
    sources: "स्रोत",
    noStreams: "इस शीर्षक के लिए चलाने योग्य स्रोत नहीं मिले।",
    openExternal: "ब्राउज़र में खोलें",
    removeAddon: "हटाएं",
    clearAll: "सभी ऐड-ऑन हटाएं",
    invalid: "यह एक वैध ऐड-ऑन मैनिफेस्ट नहीं है।",
    insecure: "https:// वाला manifest URL डालें।",
    version: "वर्शन",
    back: "वापस",
    close: "बंद करें",
    ok: "ठीक है",
    playerError: "यह स्रोत ऐप में नहीं चल सकता।",
    enabled: "चालू",
    working: "चालू है",
    error: "त्रुटि"
  }
};

const LANG_KEY = "wm_lang";

function getLang() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function hasLang() {
  return localStorage.getItem(LANG_KEY) !== null;
}

function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
  applyI18n();
}

function t(key, vars = {}) {
  const lang = getLang();
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

// Updates static text marked with data-i18n
function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}
