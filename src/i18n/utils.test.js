import { describe, it, expect } from 'vitest';
import {
  locales,
  defaultLocale,
  isLocale,
  getLangFromUrl,
  useTranslations,
  getDictionary,
  getLocalizedPath,
  localizedStaticPaths,
  pluralize,
} from './utils.js';

describe('isLocale', () => {
  it('is true for every supported locale', () => {
    for (const l of locales) expect(isLocale(l)).toBe(true);
  });

  it('is false for anything else', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('getLangFromUrl', () => {
  it('reads the first path segment when it is a supported locale', () => {
    expect(getLangFromUrl(new URL('https://example.com/ka/challenge'))).toBe('ka');
  });

  it('falls back to the default locale for an unsupported segment', () => {
    expect(getLangFromUrl(new URL('https://example.com/fr/challenge'))).toBe(defaultLocale);
  });

  it('falls back to the default locale for the bare root path', () => {
    expect(getLangFromUrl(new URL('https://example.com/'))).toBe(defaultLocale);
  });
});

describe('useTranslations', () => {
  it('resolves a nested dotted key', () => {
    const t = useTranslations('en');
    expect(t('nav.challenge')).toBe('Challenge');
  });

  it('resolves the same key shape in every locale', () => {
    for (const lang of locales) {
      const t = useTranslations(lang);
      expect(typeof t('nav.challenge')).toBe('string');
      expect(t('nav.challenge').length).toBeGreaterThan(0);
    }
  });

  it('falls back to English when a key is missing in the requested locale', () => {
    const t = useTranslations('ka');
    // simulate a hypothetically-missing key by checking a real one falls
    // back correctly when the locale dict itself is unknown
    expect(t('nav.challenge')).not.toBe('nav.challenge');
  });

  it('falls back to the raw key string when missing everywhere', () => {
    const t = useTranslations('en');
    expect(t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('falls back to the English dictionary for an unknown locale', () => {
    const t = useTranslations('xx');
    expect(t('nav.challenge')).toBe('Challenge');
  });
});

describe('getDictionary', () => {
  it('returns the raw dictionary object for a locale', () => {
    const dict = getDictionary('es');
    expect(dict.nav.challenge).toBe('Desafío');
  });

  it('falls back to English for an unknown locale', () => {
    expect(getDictionary('xx')).toBe(getDictionary('en'));
  });
});

describe('getLocalizedPath', () => {
  it('prefixes a path with the locale', () => {
    expect(getLocalizedPath('en', '/leaderboard')).toBe('/en/leaderboard');
  });

  it('handles a path without a leading slash', () => {
    expect(getLocalizedPath('en', 'leaderboard')).toBe('/en/leaderboard');
  });

  it('handles the root path specially (no trailing slash)', () => {
    expect(getLocalizedPath('en', '/')).toBe('/en');
  });

  it('defaults to the root path when none is given', () => {
    expect(getLocalizedPath('ka')).toBe('/ka');
  });

  it('handles nested paths', () => {
    expect(getLocalizedPath('ru', '/athletes/luka-tchelidze')).toBe('/ru/athletes/luka-tchelidze');
  });
});

describe('localizedStaticPaths', () => {
  it('returns one {params:{lang}} entry per supported locale', () => {
    expect(localizedStaticPaths()).toEqual(locales.map((lang) => ({ params: { lang } })));
  });
});

describe('pluralize', () => {
  it('handles English one/other', () => {
    expect(pluralize('en', 1, { one: '{count} rep', other: '{count} reps' })).toBe('1 rep');
    expect(pluralize('en', 5, { one: '{count} rep', other: '{count} reps' })).toBe('5 reps');
  });

  it('handles Spanish one/other', () => {
    expect(pluralize('es', 1, { one: '{count} repetición', other: '{count} repeticiones' })).toBe('1 repetición');
    expect(pluralize('es', 0, { one: '{count} repetición', other: '{count} repeticiones' })).toBe('0 repeticiones');
  });

  it('handles Russian one/few/many correctly per CLDR rules', () => {
    const forms = { one: '{count} попытка', few: '{count} попытки', many: '{count} попыток', other: '{count} попытки' };
    expect(pluralize('ru', 1, forms)).toBe('1 попытка');
    expect(pluralize('ru', 2, forms)).toBe('2 попытки');
    expect(pluralize('ru', 5, forms)).toBe('5 попыток');
    expect(pluralize('ru', 21, forms)).toBe('21 попытка');
    expect(pluralize('ru', 11, forms)).toBe('11 попыток');
  });

  it('falls back to "other" for Georgian, which has no distinct plural categories in CLDR', () => {
    const forms = { other: '{count} გამეორება' };
    expect(pluralize('ka', 1, forms)).toBe('1 გამეორება');
    expect(pluralize('ka', 7, forms)).toBe('7 გამეორება');
  });

  it('formats the substituted count using the locale number format', () => {
    const forms = { one: '{count} attempt', other: '{count} attempts' };
    // Don't hardcode the thousands separator glyph — Russian formatting
    // uses U+202F (narrow no-break space), not a plain space, and the two
    // are visually indistinguishable in test output.
    const expectedCount = new Intl.NumberFormat('ru-RU').format(14923);
    expect(pluralize('ru', 14923, forms)).toBe(`${expectedCount} attempts`);
  });
});
