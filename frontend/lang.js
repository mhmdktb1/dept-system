import translations from "./translations.js";

export function getLang() {
  return localStorage.getItem("lang") || "en";
}

export function setLang(lang) {
  localStorage.setItem("lang", lang);
  applyTranslations();
}

export function translate(key) {
  const lang = getLang();
  return translations[lang][key] || key;
}

export function applyTranslations() {
  const lang = getLang();

  // Switch page direction for Arabic
  document.body.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;

  // Update all elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang][key]) {
        // If it's an input with placeholder, update placeholder
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.hasAttribute('placeholder')) {
                el.setAttribute('placeholder', translations[lang][key]);
            }
        } else {
            el.textContent = translations[lang][key];
        }
    }
  });

  // Update select options if they have data-i18n-label (custom logic if needed, but usually textContent works)
  // For select options, we might need to iterate differently if we want to translate options text
}
