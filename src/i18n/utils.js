import { en } from './en.js';
import { ka } from './ka.js';
import { es } from './es.js';
import { ru } from './ru.js';

/** Supported locales. Order controls display order in the language switcher. */
export const locales = ['en', 'ka', 'es', 'ru'];

export const defaultLocale = 'en';

/** BCP-47 tags used for Intl.* APIs. */
export const localeTags = {
  en: 'en-US',
  ka: 'ka-GE',
  es: 'es-ES',
  ru: 'ru-RU',
};

export const localeNames = {
  en: 'English',
  ka: 'ქართული',
  es: 'Español',
  ru: 'Русский',
};

const dictionaries = { en, ka, es, ru };

/** Returns true if the given string is one of the supported locale codes. */
export function isLocale(value) {
  return locales.includes(value);
}

/**
 * Reads the locale segment out of an Astro.url pathname.
 * @param {URL} url
 */
export function getLangFromUrl(url) {
  const [, maybeLocale] = url.pathname.split('/');
  return isLocale(maybeLocale) ? maybeLocale : defaultLocale;
}

/**
 * Returns a lookup function `t(key)` for dotted translation keys,
 * e.g. t('nav.challenge'). Falls back to English, then the key itself.
 * @param {string} lang
 */
export function useTranslations(lang) {
  const dict = dictionaries[lang] ?? dictionaries[defaultLocale];
  return function t(key) {
    const value = getPath(dict, key) ?? getPath(dictionaries[defaultLocale], key);
    return value ?? key;
  };
}

/** Raw dictionary accessor, useful for translating structured data (arrays/objects). */
export function getDictionary(lang) {
  return dictionaries[lang] ?? dictionaries[defaultLocale];
}

function getPath(obj, key) {
  return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

/** Builds a localized path, e.g. getLocalizedPath('en', '/leaderboard') -> '/en/leaderboard'. */
export function getLocalizedPath(lang, path = '/') {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return clean ? `/${lang}/${clean}` : `/${lang}`;
}

/** getStaticPaths helper shared by every localized route. */
export function localizedStaticPaths() {
  return locales.map((lang) => ({ params: { lang } }));
}

/**
 * Selects a plural form for `count` in `lang` using CLDR plural categories,
 * then substitutes {count} with a locale-formatted number.
 * @param {string} lang
 * @param {number} count
 * @param {Record<string,string>} forms e.g. { one: '{count} rep', other: '{count} reps' }
 */
export function pluralize(lang, count, forms) {
  const tag = localeTags[lang] ?? localeTags[defaultLocale];
  const category = new Intl.PluralRules(tag).select(count);
  const template = forms[category] ?? forms.other;
  const formatted = new Intl.NumberFormat(tag).format(count);
  return template.replace('{count}', formatted);
}
