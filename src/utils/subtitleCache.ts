import { CaptionCue, LibraryVideoItem } from '../types';
import { cleanAndFixEncoding } from './captionParser';

const SUBTITLE_CACHE_PREFIX = 'yt_subtitles_';
const LIBRARY_STORAGE_KEY = 'yt_video_library_v2';
const LAST_ACTIVE_VIDEO_KEY = 'yt_last_active_video_v1';

// In-memory cache for fast synchronous access
const memoryCache = new Map<string, CaptionCue[]>();

export interface CachedSubtitleData {
  videoId: string;
  cues: CaptionCue[];
  title?: string;
  originalUrl?: string;
  timestamp: number;
}

/**
 * Validate and clean cues array to ensure proper text encoding
 */
export function sanitizeCues(cues: CaptionCue[]): CaptionCue[] {
  if (!Array.isArray(cues)) return [];
  return cues
    .filter((cue) => cue && typeof cue.text === 'string' && typeof cue.start === 'number')
    .map((cue, idx) => ({
      id: cue.id || `cue-${idx + 1}`,
      start: Number(cue.start) || 0,
      duration: Math.max(0.5, Number(cue.duration) || 2),
      text: cleanAndFixEncoding(cue.text),
    }));
}

/**
 * Get cached subtitles for a given YouTube video ID.
 * Tries:
 * 1. Fast in-memory cache
 * 2. Dedicated per-video localStorage item (`yt_subtitles_${videoId}`)
 * 3. Video Library storage (`yt_video_library_v2`)
 */
export function getCachedSubtitles(videoId: string): CaptionCue[] | null {
  if (!videoId) return null;

  // 1. In-memory cache
  if (memoryCache.has(videoId)) {
    const mem = memoryCache.get(videoId);
    if (mem && mem.length > 0) {
      return mem;
    }
  }

  // 2. Dedicated per-video cache item
  try {
    const raw = localStorage.getItem(`${SUBTITLE_CACHE_PREFIX}${videoId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const cuesList = Array.isArray(parsed) ? parsed : parsed.cues;
      if (Array.isArray(cuesList) && cuesList.length > 0) {
        const sanitized = sanitizeCues(cuesList);
        if (sanitized.length > 0) {
          memoryCache.set(videoId, sanitized);
          return sanitized;
        }
      }
    }
  } catch (err) {
    console.warn(`[SubtitleCache] Failed reading dedicated cache for ${videoId}:`, err);
  }

  // 3. Fallback to general library storage
  try {
    const rawLib = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (rawLib) {
      const lib = JSON.parse(rawLib);
      if (Array.isArray(lib)) {
        const matched = lib.find((item: LibraryVideoItem) => item.id === videoId);
        if (matched && Array.isArray(matched.cues) && matched.cues.length > 0) {
          const sanitized = sanitizeCues(matched.cues);
          if (sanitized.length > 0) {
            memoryCache.set(videoId, sanitized);
            // Also store into dedicated key for faster future lookup
            saveCachedSubtitles(videoId, sanitized, {
              title: matched.title,
              originalUrl: matched.originalUrl,
            });
            return sanitized;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[SubtitleCache] Failed reading library cache for ${videoId}:`, err);
  }

  return null;
}

/**
 * Checks if non-empty cached subtitles exist for a video ID
 */
export function hasCachedSubtitles(videoId: string): boolean {
  if (!videoId) return false;
  if (memoryCache.has(videoId)) {
    const mem = memoryCache.get(videoId);
    if (mem && mem.length > 0) return true;
  }
  try {
    const raw = localStorage.getItem(`${SUBTITLE_CACHE_PREFIX}${videoId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const cues = Array.isArray(parsed) ? parsed : parsed.cues;
      if (Array.isArray(cues) && cues.length > 0) return true;
    }
  } catch {}
  return false;
}

/**
 * Persist subtitles for a video into memory and localStorage.
 */
export function saveCachedSubtitles(
  videoId: string,
  cues: CaptionCue[],
  meta?: { title?: string; originalUrl?: string }
): void {
  if (!videoId || !Array.isArray(cues) || cues.length === 0) return;

  const sanitized = sanitizeCues(cues);
  if (sanitized.length === 0) return;

  // 1. Update in-memory cache
  memoryCache.set(videoId, sanitized);

  // 2. Update dedicated per-video localStorage entry
  const dataToSave: CachedSubtitleData = {
    videoId,
    cues: sanitized,
    title: meta?.title || `Video ${videoId}`,
    originalUrl: meta?.originalUrl || `https://www.youtube.com/watch?v=${videoId}`,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(
      `${SUBTITLE_CACHE_PREFIX}${videoId}`,
      JSON.stringify(dataToSave)
    );
  } catch (err) {
    console.warn('[SubtitleCache] LocalStorage quota exceeded, pruning old cached subtitles...', err);
    pruneOldSubtitleCaches();
    try {
      localStorage.setItem(
        `${SUBTITLE_CACHE_PREFIX}${videoId}`,
        JSON.stringify(dataToSave)
      );
    } catch {
      // If still fails, memory cache remains active
    }
  }
}

/**
 * Remove oldest cached items if storage quota is tight
 */
function pruneOldSubtitleCaches(): void {
  try {
    const keys: { key: string; time: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SUBTITLE_CACHE_PREFIX)) {
        try {
          const val = JSON.parse(localStorage.getItem(k) || '{}');
          keys.push({ key: k, time: val.timestamp || 0 });
        } catch {
          keys.push({ key: k, time: 0 });
        }
      }
    }
    // Sort oldest first
    keys.sort((a, b) => a.time - b.time);
    // Remove oldest 3
    for (let i = 0; i < Math.min(3, keys.length); i++) {
      localStorage.removeItem(keys[i].key);
    }
  } catch {}
}

/**
 * Remember the last active video ID and URL
 */
export function saveLastActiveVideo(videoId: string, url: string): void {
  try {
    localStorage.setItem(
      LAST_ACTIVE_VIDEO_KEY,
      JSON.stringify({ videoId, url, timestamp: Date.now() })
    );
  } catch {}
}

/**
 * Get the last active video from previous session
 */
export function getLastActiveVideo(): { videoId: string; url: string } | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_VIDEO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.videoId) {
        return { videoId: parsed.videoId, url: parsed.url || `https://www.youtube.com/watch?v=${parsed.videoId}` };
      }
    }
  } catch {}
  return null;
}

const TIMEDTEXT_URL_PREFIX = 'yt_observed_timedtext_';

// In-memory observed timedtext requests
const observedTimedTextCache = new Map<string, string>();

// Example observed timedtext request URL for FcRzAdI8R9U
export const SAMPLE_OBSERVED_TIMEDTEXT_URL =
  'https://www.youtube.com/api/timedtext?v=FcRzAdI8R9U&ei=DCKeatfmPKPRp-oPnqqzgQk&caps=asr&opi=112496729&exp=xpe&xoaf=5&xowf=1&xospf=1&hl=iw&ip=0.0.0.0&ipbits=0&expire=1788773501&sparams=ip%2Cipbits%2Cexpire%2Cv%2Cei%2Ccaps%2Copi%2Cexp%2Cxoaf&signature=217DB32BACFE6E926084313687E03C0510F5DB34.D9A7AA9EE51F782ED170B2AA7DE3BD0AC740CF6A&key=yt8&kind=asr&lang=ru&potc=1&pot=MlMn_joq5JrJpSfCjjnANqOg57lCS8ADS5l8eKcn0AlVAENOp6W5mBZK47JADSIT6O2ApINKm8nUuNtmdxJwIJwpTZBJx8pnBEBe0f6-5yn6TBh6DA%3D%3D&fmt=json3&xorb=2&xobt=3&xovt=3&tlang=en&cbr=Chrome&cbrver=152.0.0.0&c=WEB&cver=2.20260904.01.00&cplayer=UNIPLAYER&cos=Windows&cosver=10.0&cplatform=DESKTOP';

export function saveObservedTimedTextUrl(videoId: string, url: string): void {
  if (!videoId || !url) return;
  observedTimedTextCache.set(videoId, url);
  try {
    localStorage.setItem(`${TIMEDTEXT_URL_PREFIX}${videoId}`, url);
  } catch {}
}

export function getObservedTimedTextUrl(videoId: string): string | null {
  if (!videoId) return null;
  if (observedTimedTextCache.has(videoId)) {
    return observedTimedTextCache.get(videoId)!;
  }
  try {
    const saved = localStorage.getItem(`${TIMEDTEXT_URL_PREFIX}${videoId}`);
    if (saved) {
      observedTimedTextCache.set(videoId, saved);
      return saved;
    }
  } catch {}

  // Built-in sample fallback for video FcRzAdI8R9U
  if (videoId === 'FcRzAdI8R9U') {
    return SAMPLE_OBSERVED_TIMEDTEXT_URL;
  }
  return null;
}
