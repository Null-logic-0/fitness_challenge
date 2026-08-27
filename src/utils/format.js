import { localeTags, defaultLocale } from '../i18n/utils.js';

function tag(lang) {
  return localeTags[lang] ?? localeTags[defaultLocale];
}

/** Formats an integer/decimal using the locale's number conventions. */
export function formatNumber(lang, value, options = {}) {
  return new Intl.NumberFormat(tag(lang), options).format(value);
}

/** Formats a 0-1 fraction as a locale-aware percentage. */
export function formatPercent(lang, value, options = {}) {
  return new Intl.NumberFormat(tag(lang), { style: 'percent', maximumFractionDigits: 0, ...options }).format(value);
}

/** Formats a date using the locale's date conventions. */
export function formatDate(lang, date, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  return new Intl.DateTimeFormat(tag(lang), options).format(new Date(date));
}

/** Formats "reps per minute" style pace figures with one decimal place. */
export function formatPace(lang, reps, minutes) {
  const pace = minutes > 0 ? reps / minutes : 0;
  return new Intl.NumberFormat(tag(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pace);
}

/** Formats seconds as MM:SS, always two-digit. */
export function formatClock(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Formats a signed delta, e.g. +31 / -4. */
export function formatSignedNumber(lang, value) {
  return new Intl.NumberFormat(tag(lang), { signDisplay: 'always' }).format(value);
}
