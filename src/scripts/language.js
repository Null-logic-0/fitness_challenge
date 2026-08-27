/**
 * Client-side language persistence. URLs are always the source of truth for
 * SEO (locale-prefixed, independently indexable) — this module only
 * remembers the visitor's last choice so the root "/" can send returning
 * visitors straight to it instead of always defaulting to English.
 */
const STORAGE_KEY = '5min-lang';

/** @param {string} locale */
export function persistLocale(locale) {
  if (!locale) return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable (private mode, disabled cookies) — safe to ignore */
  }
}

/** @returns {string|null} */
export function getStoredLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
