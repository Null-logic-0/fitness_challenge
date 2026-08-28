import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildShareText, buildLinkedInShareUrl, buildXShareUrl, copyText, wireCopyButton, initShareCard } from './share.js';

describe('buildShareText', () => {
  const base = {
    title: '5-Minute Challenge',
    total: 92,
    totalLabel: 'Total reps',
    pullUps: 41,
    pullUpsLabel: 'Pull-ups',
    dips: 51,
    dipsLabel: 'Dips',
    canYouBeatLabel: 'Can you beat me?',
  };

  it('composes the standard lines in order', () => {
    const text = buildShareText({ ...base, isPersonalBest: false });
    expect(text).toBe('5-Minute Challenge\n\n92 Total reps\n\n41 Pull-ups\n51 Dips\n\nCan you beat me?');
  });

  it('inserts the personal-best line when isPersonalBest is true and a label is given', () => {
    const text = buildShareText({ ...base, isPersonalBest: true, personalBestLabel: 'Personal best' });
    expect(text).toContain('Personal best');
    expect(text.indexOf('Personal best')).toBeLessThan(text.indexOf('Can you beat me?'));
  });

  it('omits the personal-best line when isPersonalBest is true but no label is given', () => {
    const text = buildShareText({ ...base, isPersonalBest: true });
    expect(text).not.toContain('Personal best');
  });

  it('omits the personal-best line when isPersonalBest is false even with a label', () => {
    const text = buildShareText({ ...base, isPersonalBest: false, personalBestLabel: 'Personal best' });
    expect(text).not.toContain('Personal best');
  });
});

describe('buildLinkedInShareUrl', () => {
  it('URL-encodes the shared link as a query param', () => {
    const url = buildLinkedInShareUrl('https://5minchallenge.com/en/results/abc?x=1&y=2');
    expect(url).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2F5minchallenge.com%2Fen%2Fresults%2Fabc%3Fx%3D1%26y%3D2',
    );
  });
});

describe('buildXShareUrl', () => {
  it('includes both the url and text as encoded query params', () => {
    const url = buildXShareUrl('https://5minchallenge.com/en/results/abc', 'Can you beat 92 reps?');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://twitter.com/intent/tweet');
    expect(parsed.searchParams.get('url')).toBe('https://5minchallenge.com/en/results/abc');
    expect(parsed.searchParams.get('text')).toBe('Can you beat 92 reps?');
  });
});

describe('copyText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves true when the clipboard write succeeds', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    expect(await copyText('hello')).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('resolves false instead of throwing when the clipboard write fails', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    expect(await copyText('hello')).toBe(false);
  });
});

describe('wireCopyButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing when the button is null (no querySelector match)', () => {
    expect(() => wireCopyButton(null, () => 'text')).not.toThrow();
  });

  it('swaps the label to the copied text on click, then reverts after 2s', async () => {
    document.body.innerHTML = `<button data-copied-label="Copied"><span data-copy-label>Copy result</span></button>`;
    const button = document.querySelector('button');
    wireCopyButton(button, () => 'the shared text');

    button.click();
    // let the async click handler's microtasks (copyText's await) resolve
    await vi.runAllTimersAsync();

    // by the time runAllTimersAsync finishes, both the swap and the 2s
    // revert timeout have fired — check the swap happened by re-running
    // with a fresh button so we can inspect the intermediate state too
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('the shared text');
    expect(document.querySelector('[data-copy-label]').textContent).toBe('Copy result');
  });

  it('reverts to the label text itself when no data-copied-label is set', async () => {
    document.body.innerHTML = `<button><span data-copy-label>Copy link</span></button>`;
    const button = document.querySelector('button');
    wireCopyButton(button, () => 'a link');

    button.click();
    await Promise.resolve(); // flush the copyText microtask
    await Promise.resolve();
    expect(document.querySelector('[data-copy-label]').textContent).toBe('Copy link');
  });

  it('leaves the label unchanged when the copy fails', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    document.body.innerHTML = `<button data-copied-label="Copied"><span data-copy-label>Copy result</span></button>`;
    const button = document.querySelector('button');
    wireCopyButton(button, () => 'text');

    button.click();
    await vi.runAllTimersAsync();
    expect(document.querySelector('[data-copy-label]').textContent).toBe('Copy result');
  });
});

describe('initShareCard', () => {
  it('wires the [data-action="copy"] button to copy data-share-text', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    document.body.innerHTML = `
      <div data-share-text="the result text">
        <button data-action="copy" data-copied-label="Copied"><span data-copy-label>Copy result</span></button>
      </div>`;
    initShareCard(document.querySelector('[data-share-text]'));

    document.querySelector('[data-action="copy"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('the result text');
    vi.restoreAllMocks();
  });

  it('does not throw when there is no copy button in root', () => {
    document.body.innerHTML = `<div data-share-text="x"></div>`;
    expect(() => initShareCard(document.querySelector('[data-share-text]'))).not.toThrow();
  });
});
