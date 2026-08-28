import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent, formatDate, formatPace, formatClock, formatSignedNumber } from './format.js';

describe('formatNumber', () => {
  it('formats with the locale thousands separator', () => {
    expect(formatNumber('en', 14923)).toBe('14,923');
    expect(formatNumber('ru', 14923)).toBe(new Intl.NumberFormat('ru-RU').format(14923));
  });

  it('falls back to English for an unknown locale', () => {
    expect(formatNumber('xx', 1000)).toBe(formatNumber('en', 1000));
  });

  it('passes through Intl.NumberFormat options', () => {
    expect(formatNumber('en', 3, { minimumFractionDigits: 2 })).toBe('3.00');
  });
});

describe('formatPercent', () => {
  it('formats a 0-1 fraction as a whole percentage by default', () => {
    expect(formatPercent('en', 0.73)).toBe('73%');
  });

  it('respects overridden options', () => {
    expect(formatPercent('en', 0.735, { maximumFractionDigits: 1 })).toBe('73.5%');
  });
});

describe('formatDate', () => {
  it('formats a date using the locale convention', () => {
    const result = formatDate('en', '2026-03-05T00:00:00Z');
    expect(result).toContain('2026');
    expect(result).toContain('March');
  });

  it('accepts custom Intl.DateTimeFormat options', () => {
    const result = formatDate('en', '2026-03-05T00:00:00Z', { year: 'numeric', month: 'short' });
    expect(result).toBe('Mar 2026');
  });
});

describe('formatPace', () => {
  it('divides reps by minutes to one decimal place', () => {
    expect(formatPace('en', 92, 5)).toBe('18.4');
  });

  it('returns zero when minutes is zero, without dividing by zero', () => {
    expect(formatPace('en', 92, 0)).toBe('0.0');
  });

  it('handles negative minutes the same as zero (guards against garbage input)', () => {
    expect(formatPace('en', 92, -1)).toBe('0.0');
  });
});

describe('formatClock', () => {
  it('formats whole minutes', () => {
    expect(formatClock(300)).toBe('05:00');
  });

  it('formats seconds under a minute', () => {
    expect(formatClock(45)).toBe('00:45');
  });

  it('pads single-digit minutes and seconds', () => {
    expect(formatClock(65)).toBe('01:05');
  });

  it('clamps negative input to zero instead of going negative', () => {
    expect(formatClock(-10)).toBe('00:00');
  });

  it('rounds fractional seconds', () => {
    expect(formatClock(299.6)).toBe('05:00');
  });
});

describe('formatSignedNumber', () => {
  it('prefixes positive numbers with +', () => {
    expect(formatSignedNumber('en', 31)).toBe('+31');
  });

  it('prefixes negative numbers with -', () => {
    expect(formatSignedNumber('en', -4)).toBe('-4');
  });

  it('prefixes zero with + (signDisplay: always)', () => {
    expect(formatSignedNumber('en', 0)).toBe('+0');
  });
});
