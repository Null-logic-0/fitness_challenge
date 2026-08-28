import { describe, it, expect } from 'vitest';
import { extractYouTubeId, isValidYouTubeUrl, youtubeThumbnailUrl, youtubeEmbedUrl, youtubeWatchUrl } from './youtube.js';

const VALID_ID = 'dQw4w9WgXcQ';

describe('extractYouTubeId', () => {
  it('extracts the id from a standard watch URL', () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extracts the id from a watch URL without www', () => {
    expect(extractYouTubeId(`https://youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extracts the id from a youtu.be short link', () => {
    expect(extractYouTubeId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extracts the id from a mobile (m.youtube.com) link', () => {
    expect(extractYouTubeId(`https://m.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extracts the id when extra query params come first', () => {
    expect(extractYouTubeId(`https://youtube.com/watch?feature=share&v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extracts the id when extra query params come after', () => {
    expect(extractYouTubeId(`https://youtube.com/watch?v=${VALID_ID}&t=30s`)).toBe(VALID_ID);
  });

  it('extracts the id from a Shorts URL', () => {
    expect(extractYouTubeId(`https://youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('trims surrounding whitespace', () => {
    expect(extractYouTubeId(`  https://youtu.be/${VALID_ID}  `)).toBe(VALID_ID);
  });

  it('returns null for a non-YouTube URL', () => {
    expect(extractYouTubeId('https://vimeo.com/12345')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(extractYouTubeId('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractYouTubeId('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(extractYouTubeId(null)).toBeNull();
    expect(extractYouTubeId(undefined)).toBeNull();
  });

  it('returns null when the video id is the wrong length', () => {
    expect(extractYouTubeId('https://youtu.be/short')).toBeNull();
  });

  it('rejects http (non-https) the same way — requires https per the pattern being optional http(s)', () => {
    // patterns use http?s, so plain http:// should still match
    expect(extractYouTubeId(`http://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });
});

describe('isValidYouTubeUrl', () => {
  it('returns true for a valid link', () => {
    expect(isValidYouTubeUrl(`https://youtu.be/${VALID_ID}`)).toBe(true);
  });

  it('returns false for an invalid link', () => {
    expect(isValidYouTubeUrl('https://vimeo.com/12345')).toBe(false);
  });
});

describe('URL builders', () => {
  it('youtubeThumbnailUrl builds the hqdefault.jpg URL', () => {
    expect(youtubeThumbnailUrl(VALID_ID)).toBe(`https://img.youtube.com/vi/${VALID_ID}/hqdefault.jpg`);
  });

  it('youtubeEmbedUrl uses the privacy-enhanced nocookie domain', () => {
    expect(youtubeEmbedUrl(VALID_ID)).toBe(`https://www.youtube-nocookie.com/embed/${VALID_ID}`);
  });

  it('youtubeWatchUrl builds a standard watch URL', () => {
    expect(youtubeWatchUrl(VALID_ID)).toBe(`https://www.youtube.com/watch?v=${VALID_ID}`);
  });
});
