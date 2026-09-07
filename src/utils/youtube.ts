import { ParsedYouTubeResult, YouTubeFormatType } from '../types';

/**
 * YouTube Video IDs are strictly 11 characters: [a-zA-Z0-9_-]{11}
 */
export const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Converts a YouTube timestamp string into seconds.
 * Supports:
 * - "1h2m3s" -> 3723
 * - "2m15s" -> 135
 * - "45s" -> 45
 * - "1h" -> 3600
 * - "90" -> 90
 * - "90s" -> 90
 */
export function parseYouTubeTimestamp(timeParam?: string | null): number | undefined {
  if (!timeParam) return undefined;
  const str = timeParam.trim().toLowerCase();

  // If already pure number
  if (/^\d+$/.test(str)) {
    const val = parseInt(str, 10);
    return isNaN(val) ? undefined : val;
  }

  // If ends with s and pure digits (e.g. "90s")
  if (/^\d+s$/.test(str)) {
    const val = parseInt(str.slice(0, -1), 10);
    return isNaN(val) ? undefined : val;
  }

  let totalSeconds = 0;
  let hasMatch = false;

  const hoursMatch = str.match(/(\d+)\s*h/);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
    hasMatch = true;
  }

  const minsMatch = str.match(/(\d+)\s*m(?!s)/);
  if (minsMatch) {
    totalSeconds += parseInt(minsMatch[1], 10) * 60;
    hasMatch = true;
  }

  const secsMatch = str.match(/(\d+)\s*s/);
  if (secsMatch) {
    totalSeconds += parseInt(secsMatch[1], 10);
    hasMatch = true;
  }

  return hasMatch ? totalSeconds : undefined;
}

/**
 * Extracts a clean URL from wrapped text, such as:
 * - <iframe src="https://www.youtube.com/embed/xyz" ...>
 * - [Markdown text](https://www.youtube.com/watch?v=xyz)
 * - <https://youtu.be/xyz>
 * - "https://www.youtube.com/watch?v=xyz"
 * - "Check this out https://youtu.be/xyz"
 */
export function sanitizeInputText(input: string): { sanitized: string; wasWrapped: boolean; isIframe: boolean } {
  let text = input.trim();
  let isIframe = false;
  let wasWrapped = false;

  // 1. Check for HTML iframe snippet
  const iframeSrcMatch = text.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    return { sanitized: iframeSrcMatch[1].trim(), wasWrapped: true, isIframe: true };
  }

  // 2. Check for markdown link: [title](url)
  const markdownMatch = text.match(/\[[^\]]*\]\((https?:\/\/[^\s\)]+)\)/i);
  if (markdownMatch && markdownMatch[1]) {
    return { sanitized: markdownMatch[1].trim(), wasWrapped: true, isIframe: false };
  }

  // 3. Check for angle brackets: <https://...>
  const angleMatch = text.match(/<(https?:\/\/[^>]+)>/i);
  if (angleMatch && angleMatch[1]) {
    return { sanitized: angleMatch[1].trim(), wasWrapped: true, isIframe: false };
  }

  // 4. Strip quotes: "https://..." or 'https://...'
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
    wasWrapped = true;
  }

  // 5. Look for an embedded URL within sentence text (e.g. "Watch this: https://youtu.be/...")
  const embeddedUrlMatch = text.match(/(https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.[a-z.]{2,}|youtu\.be|y2u\.be)\/[^\s]+)/i);
  if (embeddedUrlMatch && embeddedUrlMatch[1]) {
    return { sanitized: embeddedUrlMatch[1].trim(), wasWrapped: true, isIframe: false };
  }

  return { sanitized: text, wasWrapped, isIframe };
}

/**
 * Universal YouTube URL and ID parser that accurately handles ANY YouTube format:
 * - Standard watch URLs (youtube.com/watch?v=...)
 * - Parameters before/after 'v' (feature=shared, list=..., t=...)
 * - Shortened youtu.be & y2u.be links
 * - YouTube Shorts (youtube.com/shorts/...)
 * - YouTube Live links (youtube.com/live/...)
 * - Embedded players (youtube.com/embed/..., youtube-nocookie.com/embed/...)
 * - IFrame snippet codes (<iframe src="...">)
 * - Mobile & localized subdomains (m., music., gaming., tv.)
 * - Country TLDs (youtube.co.uk, youtube.ca, youtube.de, youtube.fr, youtube.jp, etc.)
 * - Attribution redirects (/attribution_link?u=/watch?v=...)
 * - Legacy paths (/v/..., /e/..., /watch/...)
 * - Hash routes (youtube.com/watch#!v=...)
 * - Bare 11-char video IDs
 * - Timestamps (t=1m30s, start=90)
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeResult | null {
  if (!input) return null;

  const { sanitized, wasWrapped, isIframe } = sanitizeInputText(input);
  const trimmed = sanitized.trim();

  // 1. Direct 11-character video ID
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return {
      videoId: trimmed,
      formatType: 'raw_id',
      cleanWatchUrl: `https://www.youtube.com/watch?v=${trimmed}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${trimmed}`,
    };
  }

  // Normalize URL with protocol if missing
  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    // Check if it's a domain pattern
    if (/^(?:www\.)?(?:youtube|youtu\.be|y2u\.be)/i.test(normalized)) {
      normalized = 'https://' + normalized;
    } else {
      // Could be text or partial
      normalized = 'https://' + normalized;
    }
  }

  let videoId: string | null = null;
  let formatType: YouTubeFormatType = wasWrapped ? 'text_extracted' : 'standard_watch';
  let startTime: number | undefined = undefined;
  let listId: string | undefined = undefined;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    // Check for start/t parameter in query or hash
    const tParam = searchParams.get('t') || searchParams.get('start');
    if (tParam) {
      startTime = parseYouTubeTimestamp(tParam);
    } else if (url.hash) {
      const hashMatch = url.hash.match(/[#&?](?:t|start)=([^&]+)/);
      if (hashMatch) {
        startTime = parseYouTubeTimestamp(hashMatch[1]);
      }
    }

    // Check for list parameter
    const listParam = searchParams.get('list');
    if (listParam) {
      listId = listParam;
    }

    // A. Attribution Links (e.g. /attribution_link?a=...&u=/watch%3Fv%3Dxyz)
    if (pathname === '/attribution_link') {
      const innerU = searchParams.get('u');
      if (innerU) {
        const innerResult = parseYouTubeUrl(innerU.startsWith('http') ? innerU : `https://www.youtube.com${innerU}`);
        if (innerResult) {
          return {
            ...innerResult,
            formatType: 'attribution',
          };
        }
      }
    }

    // B. Google / Third-party redirect links
    if (host.includes('google.') && (pathname === '/url' || pathname.startsWith('/url/'))) {
      const redirectTarget = searchParams.get('q') || searchParams.get('url');
      if (redirectTarget) {
        const innerResult = parseYouTubeUrl(redirectTarget);
        if (innerResult) return innerResult;
      }
    }

    // C. youtu.be and y2u.be short URLs
    if (host === 'youtu.be' || host === 'y2u.be') {
      formatType = 'short_link';
      // Path usually is /<videoId> or /<videoId>?t=...
      const pathPart = pathname.replace(/^\/+/, '').split('/')[0];
      if (YOUTUBE_ID_REGEX.test(pathPart)) {
        videoId = pathPart;
      }
    }

    // D. Standard YouTube domains (youtube.com, youtube-nocookie.com, m.youtube.com, youtube.co.uk, etc.)
    const isYouTubeDomain =
      host.includes('youtube.com') ||
      host.includes('youtube-nocookie.com') ||
      /\byoutube\.[a-z.]{2,}\b/i.test(host);

    if (isYouTubeDomain) {
      if (host.startsWith('m.')) {
        formatType = 'mobile_watch';
      }

      // 1. /watch endpoint (e.g. /watch?v=VIDEO_ID or /watch/VIDEO_ID)
      if (pathname === '/watch' || pathname === '/watch/') {
        const v = searchParams.get('v') || searchParams.get('video_id');
        if (v && YOUTUBE_ID_REGEX.test(v)) {
          videoId = v;
          if (listId && !formatType) formatType = 'playlist_video';
          else if (formatType !== 'mobile_watch') formatType = 'standard_watch';
        } else if (url.hash) {
          // Check hash params: #!v=xyz or #/watch?v=xyz or #v=xyz
          const hashVMatch = url.hash.match(/[#!&?/]+(?:v|video_id)=([a-zA-Z0-9_-]{11})/);
          if (hashVMatch) {
            videoId = hashVMatch[1];
          }
        }
      } else if (pathname.startsWith('/watch/')) {
        const pathPart = pathname.replace(/^\/watch\//, '').split('/')[0];
        if (YOUTUBE_ID_REGEX.test(pathPart)) {
          videoId = pathPart;
        }
      }

      // 2. /shorts/ endpoint (e.g. /shorts/VIDEO_ID)
      if (!videoId && pathname.startsWith('/shorts/')) {
        formatType = 'shorts';
        const pathPart = pathname.replace(/^\/shorts\//, '').split('/')[0].split('?')[0];
        if (YOUTUBE_ID_REGEX.test(pathPart)) {
          videoId = pathPart;
        }
      }

      // 3. /live/ endpoint (e.g. /live/VIDEO_ID)
      if (!videoId && pathname.startsWith('/live/')) {
        formatType = 'live';
        const pathPart = pathname.replace(/^\/live\//, '').split('/')[0].split('?')[0];
        if (YOUTUBE_ID_REGEX.test(pathPart)) {
          videoId = pathPart;
        }
      }

      // 4. /embed/ endpoint (e.g. /embed/VIDEO_ID)
      if (!videoId && pathname.startsWith('/embed/')) {
        formatType = isIframe ? 'iframe_code' : 'embed';
        const pathPart = pathname.replace(/^\/embed\//, '').split('/')[0].split('?')[0];
        if (YOUTUBE_ID_REGEX.test(pathPart)) {
          videoId = pathPart;
        }
      }

      // 5. Legacy endpoints: /v/VIDEO_ID or /e/VIDEO_ID or /p/VIDEO_ID
      if (!videoId && /^\/(?:v|e|p)\//i.test(pathname)) {
        formatType = 'legacy_v';
        const pathPart = pathname.replace(/^\/(?:v|e|p)\//i, '').split('/')[0].split('?')[0];
        if (YOUTUBE_ID_REGEX.test(pathPart)) {
          videoId = pathPart;
        }
      }
    }
  } catch {
    // If URL constructor fails, proceed to robust regex fallbacks below
  }

  // E. Fallback Heuristic Regexes for truncated, wrapped, or unusual formats
  if (!videoId) {
    // Regex matching standard patterns
    const patterns = [
      /[?&#!](?:v|video_id)=([a-zA-Z0-9_-]{11})/i,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/i,
      /y2u\.be\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i,
      /youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/(?:v|e|watch)\/([a-zA-Z0-9_-]{11})/i,
      /attribution_link.*v%3D([a-zA-Z0-9_-]{11})/i,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1] && YOUTUBE_ID_REGEX.test(match[1])) {
        videoId = match[1];
        break;
      }
    }

    // Try extracting timestamp from raw string if not parsed yet
    if (!startTime) {
      const rawTimeMatch = trimmed.match(/[?&#](?:t|start)=([^"&?\s]+)/i);
      if (rawTimeMatch) {
        startTime = parseYouTubeTimestamp(rawTimeMatch[1]);
      }
    }
  }

  if (videoId && YOUTUBE_ID_REGEX.test(videoId)) {
    const cleanWatchUrl = `https://www.youtube.com/watch?v=${videoId}${startTime ? `&t=${startTime}s` : ''}`;
    const embedUrl = getYouTubeEmbedUrl(videoId, { startTime });

    return {
      videoId,
      formatType,
      startTime,
      listId,
      cleanWatchUrl,
      embedUrl,
    };
  }

  return null;
}

/**
 * Backward-compatible helper returning just the 11-char ID string or null
 */
export function extractYouTubeId(urlOrId: string): string | null {
  const result = parseYouTubeUrl(urlOrId);
  return result ? result.videoId : null;
}

/**
 * Formats a YouTube format type into a clean, human-readable badge label
 */
export function formatTypeName(type: YouTubeFormatType): string {
  switch (type) {
    case 'standard_watch':
      return 'Standard Watch URL';
    case 'short_link':
      return 'youtu.be Short Link';
    case 'shorts':
      return 'YouTube Shorts';
    case 'live':
      return 'Live Stream';
    case 'embed':
      return 'Embed URL';
    case 'iframe_code':
      return 'HTML <iframe> Snippet';
    case 'legacy_v':
      return 'Legacy /v/ Endpoint';
    case 'attribution':
      return 'Attribution Link';
    case 'playlist_video':
      return 'Playlist Video';
    case 'mobile_watch':
      return 'Mobile (m.youtube.com)';
    case 'raw_id':
      return 'Direct Video ID';
    case 'text_extracted':
      return 'Extracted from Text';
    default:
      return 'YouTube Link';
  }
}

/**
 * Generates an optimized embed URL for iframe
 */
export function getYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    loop?: boolean;
    startTime?: number;
  } = {}
): string {
  const { autoplay = false, loop = false, startTime } = options;
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  });

  if (autoplay) {
    params.set('autoplay', '1');
  }

  if (loop) {
    params.set('loop', '1');
    params.set('playlist', videoId);
  }

  if (startTime && startTime > 0) {
    params.set('start', Math.floor(startTime).toString());
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Returns highest available thumbnail URL for a video ID
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Default sample video ID requested by user
 */
export const DEFAULT_VIDEO_URL = 'https://www.youtube.com/watch?v=FcRzAdI8R9U';
export const DEFAULT_VIDEO_ID = 'FcRzAdI8R9U';

/**
 * Curated list of varied real-world YouTube URL formats for interactive testing
 */
export const SAMPLE_YOUTUBE_URL_FORMATS: Array<{
  label: string;
  tag: string;
  url: string;
  description: string;
}> = [
  {
    label: 'Standard Watch',
    tag: 'watch?v=',
    url: 'https://www.youtube.com/watch?v=FcRzAdI8R9U',
    description: 'Standard desktop watch link',
  },
  {
    label: 'youtu.be Short',
    tag: 'youtu.be',
    url: 'https://youtu.be/FcRzAdI8R9U',
    description: 'Official YouTube link shortener',
  },
  {
    label: 'With Timestamp',
    tag: 't=1m42s',
    url: 'https://www.youtube.com/watch?v=FcRzAdI8R9U&t=1m42s',
    description: 'Starts playback at 102 seconds',
  },
  {
    label: 'YouTube Shorts',
    tag: 'shorts/',
    url: 'https://www.youtube.com/shorts/FcRzAdI8R9U?feature=share',
    description: 'Shorts vertical video format',
  },
  {
    label: 'Live Link',
    tag: 'live/',
    url: 'https://www.youtube.com/live/FcRzAdI8R9U',
    description: 'YouTube live stream URL format',
  },
  {
    label: 'Embed URL',
    tag: 'embed/',
    url: 'https://www.youtube-nocookie.com/embed/FcRzAdI8R9U',
    description: 'Direct iframe player source',
  },
  {
    label: 'HTML <iframe> Snippet',
    tag: '<iframe>',
    url: '<iframe width="560" height="315" src="https://www.youtube.com/embed/FcRzAdI8R9U" title="YouTube video player" frameborder="0" allowfullscreen></iframe>',
    description: 'Full iframe code copied from share embed menu',
  },
  {
    label: 'Attribution Share',
    tag: 'attribution',
    url: 'https://www.youtube.com/attribution_link?a=xyz&u=%2Fwatch%3Fv%3DFcRzAdI8R9U%26feature%3Dshare',
    description: 'Share link generated by mobile apps',
  },
  {
    label: 'Legacy /v/',
    tag: '/v/',
    url: 'https://www.youtube.com/v/FcRzAdI8R9U',
    description: 'Legacy Flash / direct video URL',
  },
  {
    label: 'Bare 11-char ID',
    tag: 'Raw ID',
    url: 'FcRzAdI8R9U',
    description: 'Direct video ID without any domain',
  },
];

export interface YouTubeValidationResult {
  isValid: boolean;
  error?: string;
  parsed?: ParsedYouTubeResult;
}

/**
 * Validates any shared link or input text.
 * Returns clear, helpful complaints if the link is not a recognized YouTube URL.
 */
export function validateYouTubeUrl(input: string): YouTubeValidationResult {
  const trimmed = input?.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Please enter or share a link with the app.',
    };
  }

  const parsed = parseYouTubeUrl(trimmed);
  if (!parsed) {
    // Determine the nature of the link to provide a precise complaint
    let domainHint = '';
    try {
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      domainHint = urlObj.hostname;
    } catch {
      // not a standard url
    }

    if (domainHint) {
      return {
        isValid: false,
        error: `"${domainHint}" is not a YouTube link. The app only supports YouTube videos (youtube.com, youtu.be, shorts, live, embed).`,
      };
    }

    return {
      isValid: false,
      error: `The shared link or text "${trimmed.slice(0, 45)}${trimmed.length > 45 ? '...' : ''}" is not a valid YouTube link. Please provide a YouTube video URL or 11-character video ID.`,
    };
  }

  return {
    isValid: true,
    parsed,
  };
}

export const SAMPLE_INVALID_LINKS = [
  { label: 'Vimeo Link', url: 'https://vimeo.com/76979871', reason: 'Vimeo video platform' },
  { label: 'Dailymotion Link', url: 'https://www.dailymotion.com/video/x7tgad0', reason: 'Dailymotion video platform' },
  { label: 'General Website', url: 'https://www.wikipedia.org', reason: 'Non-video website' },
  { label: 'Arbitrary Text', url: 'hello world non-video text', reason: 'Plain text without YouTube ID' },
];
