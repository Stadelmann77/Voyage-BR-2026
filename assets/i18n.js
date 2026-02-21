// assets/i18n.js
// Internationalisation module — language toggle (FR / PT-BR), t() helper,
// localStorage persistence, and automatic data-i18n attribute replacement.

import fr   from './i18n/fr.js';
import ptBR from './i18n/pt-BR.js';

const DICTS = { fr, 'pt-BR': ptBR };
const LS_KEY = 'lang';
const SUPPORTED = ['fr', 'pt-BR'];

/** Current language (reactive — read this to get current lang). */
export let lang = SUPPORTED.includes(localStorage.getItem(LS_KEY))
  ? localStorage.getItem(LS_KEY)
  : 'fr';

/**
 * Translate a key. Falls back to the key itself if not found.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return (DICTS[lang] || DICTS.fr)[key] ?? (DICTS.fr[key] ?? key);
}

/**
 * Change the active language, persist to localStorage, and re-apply translations.
 * @param {string} newLang  'fr' or 'pt-BR'
 */
export function setLang(newLang) {
  if (!SUPPORTED.includes(newLang)) return;
  lang = newLang;
  localStorage.setItem(LS_KEY, newLang);
  document.documentElement.lang = newLang;
  applyI18n();
  // Notify listeners so JS-rendered sections can re-render if needed
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: newLang } }));
}

/**
 * Replace textContent / placeholder of all [data-i18n] and
 * [data-i18n-placeholder] elements, then update toggle button state.
 *
 * Keys whose translated value contains HTML tags use innerHTML;
 * all others use textContent (safe default).
 */
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    // Use innerHTML only when the translation itself contains markup
    if (val.includes('<')) {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });

  // Update active state on lang toggle buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });
}

// ── Initialise on DOMContentLoaded ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = lang;
  applyI18n();

  // Wire up language toggle buttons injected in nav
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
});
