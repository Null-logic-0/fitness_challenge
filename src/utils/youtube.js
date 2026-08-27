/**
 * Recognizes the standard YouTube URL shapes and pulls out the 11-character
 * video id. Returns null for anything else, including private/unlisted
 * links that don't match a YouTube URL at all — unlisted YouTube videos
 * still validate here, since "unlisted" only affects search visibility,
 * not the URL shape.
 * @param {string} url
 * @returns {string|null}
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const trimmed = url.trim();

  const patterns = [
    /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/,
    /^https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/,
    /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** @param {string} url */
export function isValidYouTubeUrl(url) {
  return extractYouTubeId(url) !== null;
}

/** @param {string} videoId */
export function youtubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** @param {string} videoId */
export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** @param {string} videoId */
export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
