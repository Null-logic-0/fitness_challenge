import { describe, it, expect, beforeEach, vi } from 'vitest';
import { persistLocale, getStoredLocale } from './language.js';

const STORAGE_KEY = '5min-lang';

describe('persistLocale / getStoredLocale', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a value through localStorage', () => {
    persistLocale('ka');
    expect(getStoredLocale()).toBe('ka');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ka');
  });

  it('returns null when nothing has been stored', () => {
    expect(getStoredLocale()).toBeNull();
  });

  it('is a no-op for a falsy locale (does not overwrite an existing value)', () => {
    persistLocale('en');
    persistLocale('');
    persistLocale(null);
    persistLocale(undefined);
    expect(getStoredLocale()).toBe('en');
  });

  it('does not throw when localStorage.setItem throws (private browsing)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => persistLocale('ru')).not.toThrow();
    spy.mockRestore();
  });

  it('returns null instead of throwing when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(getStoredLocale()).toBeNull();
    spy.mockRestore();
  });
});
