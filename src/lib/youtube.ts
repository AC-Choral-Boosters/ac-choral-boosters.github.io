// YouTube link handling. Only the video ID is kept; embeds always use youtube-nocookie.
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];

/**
 * Extracts the 11-character video ID from youtube.com/watch?v=, youtu.be/, youtube.com/shorts/,
 * or youtube.com/embed/ links. Returns undefined for anything else.
 */
export function youtubeId(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  let id: string | null | undefined;

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = segments[0];
  } else if (YOUTUBE_HOSTS.includes(host)) {
    if (segments[0] === 'watch' && segments.length === 1) id = url.searchParams.get('v');
    else if ((segments[0] === 'shorts' || segments[0] === 'embed') && segments.length === 2) id = segments[1];
  }

  return id && ID_PATTERN.test(id) ? id : undefined;
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
