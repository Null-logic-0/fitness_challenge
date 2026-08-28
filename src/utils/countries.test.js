import { describe, it, expect } from 'vitest';
import { COUNTRY_CODES, getCountryOptions, getCountryName } from './countries.js';

describe('COUNTRY_CODES', () => {
  it('contains a substantial, deduplicated list of 2-letter codes', () => {
    expect(COUNTRY_CODES.length).toBeGreaterThan(150);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('includes the countries this project cares about most', () => {
    for (const code of ['US', 'GE', 'ES', 'RU', 'GB']) {
      expect(COUNTRY_CODES).toContain(code);
    }
  });
});

describe('getCountryOptions', () => {
  it('returns one {code, name} entry per country code', () => {
    const options = getCountryOptions('en-US');
    expect(options).toHaveLength(COUNTRY_CODES.length);
    expect(options[0]).toHaveProperty('code');
    expect(options[0]).toHaveProperty('name');
  });

  it('sorts alphabetically by the localized name, not by code', () => {
    const options = getCountryOptions('en-US');
    const names = options.map((o) => o.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en-US'));
    expect(names).toEqual(sorted);
  });

  it('localizes names per locale', () => {
    const en = getCountryOptions('en-US').find((o) => o.code === 'GE');
    const ka = getCountryOptions('ka-GE').find((o) => o.code === 'GE');
    const es = getCountryOptions('es-ES').find((o) => o.code === 'GE');
    expect(en.name).toBe('Georgia');
    expect(ka.name).toBe('საქართველო');
    expect(es.name).toBe('Georgia');
  });
});

describe('getCountryName', () => {
  it('returns the localized name for a known code', () => {
    expect(getCountryName('US', 'en-US')).toBe('United States');
    expect(getCountryName('GE', 'ka-GE')).toBe('საქართველო');
  });

  it('returns an empty string for null/undefined/empty input', () => {
    expect(getCountryName(null, 'en-US')).toBe('');
    expect(getCountryName(undefined, 'en-US')).toBe('');
    expect(getCountryName('', 'en-US')).toBe('');
  });

  it('falls back to the raw value for old free-text data that predates the code-based dropdown', () => {
    expect(getCountryName('Georgia', 'en-US')).toBe('Georgia');
  });
});
