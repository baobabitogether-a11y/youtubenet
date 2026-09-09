import { CaptionCue, TranslationSource, YouTubeNativeTranslationResult } from '../types';
import { normalizeLanguageCode } from './ttsEngine';
import { cleanAndFixEncoding, parseRawCaptionData } from '../utils/captionParser';
import { getObservedTimedTextUrl, saveObservedTimedTextUrl } from '../utils/subtitleCache';

const memoryCache = new Map<string, string>();
// Cache of full translated tracks from YouTube native timedtext: key = `${videoId || 'current'}:${langCode}`
const nativeTrackCache = new Map<string, CaptionCue[]>();
// Tracks source type per target language: key = `${videoId || 'current'}:${langCode}`
const languageSourceMap = new Map<string, TranslationSource>();

export const SAMPLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  'Hello, welcome to this video lesson!': {
    it: 'Ciao, benvenuto a questa lezione video!',
    ar: 'مرحباً بكم في هذا الدرس التعليمي بالفيديو!',
    es: '¡Hola, bienvenido a esta lección en video!',
    fr: 'Bonjour, bienvenue à cette leçon vidéo !',
    de: 'Hallo, willkommen zu dieser Videolektion!',
  },
  'Today we are practicing subtitles with automatic translation.': {
    it: 'Oggi ci esercitiamo con i sottotitoli con traduzione automatica.',
    ar: 'اليوم نتدرب على الترجمة مع الترجمة التلقائية.',
    es: 'Hoy practicamos subtítulos con traducción automática.',
    fr: "Aujourd'hui, nous nous entraînons aux sous-titres avec traduction automatique.",
    de: 'Heute üben wir Untertitel mit automatischer Übersetzung.',
  },
  'The player will automatically pause and speak each translation.': {
    it: 'Il lettore metterà automaticamente in pausa e pronuncerà ciascuna traduzione.',
    ar: 'سيقوم المشغل بالإيقاف المؤقت وتلاوة كل ترجمة تلقائياً.',
    es: 'El reproductor pausará automáticamente y pronunciará cada traducción.',
    fr: 'Le lecteur se mettra automatiquement en pause et lira chaque traduction.',
    de: 'Der Player stoppt automatisch und spricht jede Übersetzung.',
  },
  'You can customize the speaking speed and order of languages.': {
    it: "Puoi personalizzare la velocità di pronuncia e l'ordine delle lingue.",
    ar: 'يمكنك تخصيص سرعة التحدث وترتيب اللغات.',
    es: 'Puedes personalizar la velocidad de habla y el orden de los idiomas.',
    fr: 'Vous pouvez personnaliser la vitesse de parole et l’ordre des langues.',
    de: 'Sie können die Sprechgeschwindigkeit und die Reihenfolge der Sprachen anpassen.',
  },
  'Enjoy practicing and learning new languages easily!': {
    it: 'Divertiti a fare pratica e imparare nuove lingue facilmente!',
    ar: 'استمتع بالتدريب وتعلم لغات جديدة بكل سهولة!',
    es: '¡Disfruta practicando y aprendiendo nuevos idiomas fácilmente!',
    fr: 'Profitez de la pratique et apprenez de nouvelles langues facilement !',
    de: 'Viel Spaß beim Üben und einfachen Erlernen neuer Sprachen!',
  },
  'Hello, testing speech translation.': {
    it: 'Ciao, test della traduzione vocale.',
    ar: 'مرحباً، اختبار الترجمة الصوتية.',
    es: 'Hola, probando traducción de voz.',
    fr: 'Bonjour, test de traduction vocale.',
    de: 'Hallo, Test der Sprachübersetzung.',
  },
};

/**
 * Translates single text string from source language to target language
 * using Google Translate public GTX API endpoint with automatic caching
 */
export async function translateText(
  text: string,
  fromLang: string = 'auto',
  toLang: string = 'en'
): Promise<string> {
  const cleanFrom = normalizeLanguageCode(fromLang);
  const cleanTo = normalizeLanguageCode(toLang);
  const trimmed = (text || '').trim();

  if (!trimmed) return '';
  if (cleanFrom === cleanTo) return trimmed;

  const cacheKey = `${cleanFrom}:${cleanTo}:${trimmed}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  // Check built-in sample translations for instant, deterministic offline response
  const targetPrefix = cleanTo.split('-')[0];
  if (SAMPLE_TRANSLATIONS[trimmed]?.[targetPrefix]) {
    const sampleResult = SAMPLE_TRANSLATIONS[trimmed][targetPrefix];
    memoryCache.set(cacheKey, sampleResult);
    return sampleResult;
  }

  try {
    const sl = cleanFrom === 'auto' ? 'auto' : cleanFrom.split('-')[0];
    const tl = targetPrefix;

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Translation HTTP ${res.status}`);
    }

    const data = await res.json();
    let translated = '';

    if (Array.isArray(data) && Array.isArray(data[0])) {
      translated = data[0].map((item: any) => (Array.isArray(item) ? item[0] : '')).join('');
    } else if (data && typeof data === 'object' && data.translatedText) {
      translated = data.translatedText;
    }

    const finalResult = cleanAndFixEncoding(translated.trim() || trimmed);
    memoryCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (err) {
    // If translation fails (e.g. offline), return known sample or fallback
    if (SAMPLE_TRANSLATIONS[trimmed]?.[targetPrefix]) {
      return SAMPLE_TRANSLATIONS[trimmed][targetPrefix];
    }
    return trimmed;
  }
}

/**
 * Prefetches translations for upcoming subtitle cues
 */
export async function prefetchCueTranslations(
  cues: CaptionCue[],
  startIndex: number,
  count: number = 6,
  fromLang: string,
  toLang: string
): Promise<void> {
  const endIndex = Math.min(cues.length, startIndex + count);
  const promises: Promise<string>[] = [];

  for (let i = startIndex; i < endIndex; i++) {
    const cue = cues[i];
    if (cue?.text) {
      promises.push(translateText(cue.text, fromLang, toLang));
    }
  }

  await Promise.allSettled(promises);
}

/**
 * Repeats an observed YouTube timedtext subtitle request URL
 * but changes the target language code (tlang) and format (fmt=srt, json3, or xml).
 *
 * Example:
 * Input: https://www.youtube.com/api/timedtext?...&lang=ru&fmt=json3...
 * Output: https://www.youtube.com/api/timedtext?...&lang=ru&fmt=srt&tlang=en...
 */
export function buildYouTubeTranslatedTimedTextUrl(
  observedUrl: string,
  targetLangCode: string,
  format: 'srt' | 'json3' | 'vtt' | 'xml' | '' = 'srt'
): string {
  try {
    const urlObj = new URL(observedUrl);
    urlObj.searchParams.set('tlang', targetLangCode);
    if (format === 'srt' || format === 'json3' || format === 'vtt') {
      urlObj.searchParams.set('fmt', format);
    } else if (format === 'xml' || format === '') {
      urlObj.searchParams.delete('fmt');
    }
    return urlObj.toString();
  } catch {
    // If not parseable as full URL, safely apply query replacements
    let modified = observedUrl;
    if (/[?&]tlang=[^&]*/.test(modified)) {
      modified = modified.replace(/([?&])tlang=[^&]*/, `$1tlang=${encodeURIComponent(targetLangCode)}`);
    } else {
      const sep = modified.includes('?') ? '&' : '?';
      modified = `${modified}${sep}tlang=${encodeURIComponent(targetLangCode)}`;
    }
    if (format === 'srt' || format === 'json3' || format === 'vtt') {
      if (/[?&]fmt=[^&]*/.test(modified)) {
        modified = modified.replace(/([?&])fmt=[^&]*/, `$1fmt=${format}`);
      } else {
        modified = `${modified}&fmt=${format}`;
      }
    } else if (format === 'xml' || format === '') {
      modified = modified.replace(/[?&]fmt=[^&]*/, '');
    }
    return modified;
  }
}

/**
 * Checks if a translation source originates from YouTube native timedtext stream
 */
export function isYouTubeNativeSource(source?: string | null): boolean {
  return typeof source === 'string' && source.startsWith('youtube_native');
}

/**
 * Executes a repeated YouTube timedtext request for native translation.
 * DIRECTIVE: Tries via the SAME CLIENT FIRST (Android Native Shell or browser direct fetch with tlang)
 * before attempting backend proxy or falling back to translation service.
 */
export async function fetchYouTubeNativeTranslation({
  observedUrl,
  targetLang,
  format = 'srt',
  videoId,
}: {
  observedUrl?: string | null;
  targetLang: string;
  format?: 'srt' | 'json3' | 'vtt' | 'xml' | '';
  videoId?: string;
}): Promise<YouTubeNativeTranslationResult> {
  const cleanLang = normalizeLanguageCode(targetLang).split('-')[0];
  const activeObservedUrl = observedUrl || (videoId ? getObservedTimedTextUrl(videoId) : null);

  // Sync activeObservedUrl to Android Native Shell if available
  if (typeof window !== 'undefined' && activeObservedUrl && window.AndroidNativeShell?.setLastObservedTimedTextUrl) {
    try {
      window.AndroidNativeShell.setLastObservedTimedTextUrl(activeObservedUrl);
    } catch {}
  }

  // -------------------------------------------------------------
  // 1. TRY VIA THE SAME CLIENT FIRST
  // -------------------------------------------------------------

  // 1A. Android Native Shell client: executes via OkHttpClient using device network, cookies & headers
  if (
    typeof window !== 'undefined' &&
    (window.AndroidNativeShell?.fetchTranslatedCaptionsWithUrl || window.AndroidNativeShell?.fetchTranslatedCaptions)
  ) {
    const formatsToTry: Array<'srt' | 'json3' | ''> = [
      format === 'json3' ? 'json3' : 'srt',
      format === 'json3' ? 'srt' : 'json3',
      '',
    ];

    for (const fmt of formatsToTry) {
      try {
        console.log(`[Translation] Trying YouTube timedtext repetition via Android Shell client for ${cleanLang} (fmt=${fmt || 'xml'})...`);
        let rawNative = '';
        if (activeObservedUrl && window.AndroidNativeShell.fetchTranslatedCaptionsWithUrl) {
          rawNative = window.AndroidNativeShell.fetchTranslatedCaptionsWithUrl(activeObservedUrl, cleanLang, fmt);
        } else if (window.AndroidNativeShell.fetchTranslatedCaptions) {
          rawNative = window.AndroidNativeShell.fetchTranslatedCaptions(cleanLang, fmt);
        }

        if (rawNative && rawNative.length > 0 && !rawNative.includes('<title>Sorry...</title>')) {
          const parsed = parseRawCaptionData(rawNative);
          if (parsed.cues && parsed.cues.length > 0) {
            console.log(`[Translation] Android Shell client succeeded: ${parsed.cues.length} cues for ${cleanLang} (format: ${parsed.format})!`);
            const modifiedUrl = activeObservedUrl ? buildYouTubeTranslatedTimedTextUrl(activeObservedUrl, cleanLang, fmt) : undefined;
            return {
              success: true,
              source: 'youtube_native_android',
              targetLang: cleanLang,
              format: parsed.format,
              cues: parsed.cues,
              modifiedUrl,
            };
          }
        }
      } catch (androidErr) {
        console.warn(`[Translation] Android Shell repetition for ${cleanLang} (fmt=${fmt}) error:`, androidErr);
      }
    }
  }

  // 1B. Web Browser Client Direct Fetch: executes directly in the user's browser
  // Because the browser is running the active video player on the user's connection,
  // client requests match the viewer's IP, and YouTube timedtext sets Access-Control-Allow-Origin.
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const formatsToTry: Array<'srt' | 'json3' | ''> = [
      format === 'json3' ? 'json3' : 'srt',
      format === 'json3' ? 'srt' : 'json3',
      '',
    ];

    // 1B-i: Direct client fetch using active observed timedtext URL
    if (activeObservedUrl) {
      for (const fmt of formatsToTry) {
        try {
          const directUrl = buildYouTubeTranslatedTimedTextUrl(activeObservedUrl, cleanLang, fmt);
          console.log(`[Translation] Trying YouTube native timedtext directly via client browser for ${cleanLang} (fmt=${fmt || 'xml'}): ${directUrl}`);

          const clientRes = await fetch(directUrl, {
            method: 'GET',
            mode: 'cors',
            headers: {
              Accept: '*/*',
            },
          });

          if (clientRes.ok) {
            const rawText = await clientRes.text();
            if (rawText && !rawText.includes('<title>Sorry...</title>') && !rawText.includes('class="g-recaptcha"')) {
              const parsed = parseRawCaptionData(rawText);
              if (parsed.cues && parsed.cues.length > 0) {
                console.log(`[Translation] Client browser direct fetch SUCCESS: ${parsed.cues.length} cues for ${cleanLang} (format: ${parsed.format})!`);
                return {
                  success: true,
                  source: 'youtube_native_client',
                  targetLang: cleanLang,
                  format: parsed.format,
                  cues: parsed.cues,
                  modifiedUrl: directUrl,
                };
              }
            }
          } else {
            console.warn(`[Translation] Client browser direct fetch returned HTTP ${clientRes.status} for ${cleanLang} (fmt=${fmt})`);
          }
        } catch (clientErr) {
          console.warn(`[Translation] Client browser direct fetch error for ${cleanLang} (fmt=${fmt}):`, clientErr);
        }
      }
    }

    // 1B-ii: Direct client fetch using standard endpoints if observedUrl is not yet captured
    if (!activeObservedUrl && videoId) {
      const candidateDirectUrls = [
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&tlang=${cleanLang}&fmt=srt`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&caps=asr&lang=en&tlang=${cleanLang}&fmt=srt`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=auto&tlang=${cleanLang}&fmt=srt`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&tlang=${cleanLang}&fmt=json3`,
      ];
      for (const candUrl of candidateDirectUrls) {
        try {
          console.log(`[Translation] Trying candidate timedtext via client for ${cleanLang}: ${candUrl}`);
          const res = await fetch(candUrl, { method: 'GET', mode: 'cors' });
          if (res.ok) {
            const raw = await res.text();
            if (raw && !raw.includes('<title>Sorry...</title>')) {
              const parsed = parseRawCaptionData(raw);
              if (parsed.cues && parsed.cues.length > 0) {
                saveObservedTimedTextUrl(videoId, candUrl);
                return {
                  success: true,
                  source: 'youtube_native_client',
                  targetLang: cleanLang,
                  format: parsed.format,
                  cues: parsed.cues,
                  modifiedUrl: candUrl,
                };
              }
            }
          }
        } catch {}
      }
    }
  }

  // -------------------------------------------------------------
  // 2. BACKEND SERVER PROXY (/api/youtube-timedtext-translate)
  // -------------------------------------------------------------
  try {
    console.log(`[Translation] Client attempts completed, attempting backend proxy for ${cleanLang}...`);
    const res = await fetch('/api/youtube-timedtext-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observedUrl: activeObservedUrl,
        targetLang: cleanLang,
        format,
        videoId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.cues) && data.cues.length > 0) {
        return {
          success: true,
          source: 'youtube_native',
          targetLang: cleanLang,
          format: data.format,
          cues: data.cues,
          modifiedUrl: data.modifiedUrl,
        };
      }
      return {
        success: false,
        source: 'google_translate_fallback',
        targetLang: cleanLang,
        error: data.error || 'YouTube native timedtext returned no subtitles',
        modifiedUrl: data.modifiedUrl,
      };
    }
  } catch (err: any) {
    console.warn(`[Translation] /api/youtube-timedtext-translate error for ${cleanLang}:`, err);
  }

  // -------------------------------------------------------------
  // 3. FALLBACK TO TRANSLATION SERVICE
  // -------------------------------------------------------------
  return {
    success: false,
    source: 'google_translate_fallback',
    targetLang: cleanLang,
    error: 'Native translation unavailable, falling back to translation service',
  };
}

/**
 * Translates an entire track:
 * 1. BY DEFAULT: attempts YouTube native translation by repeating the observed subtitle request with tlang & fmt=srt.
 * 2. FALLBACK: if YouTube native timedtext fails or is unavailable, falls back to the current Google Translate GTX service.
 */
export async function translateTrackWithNativeFirst({
  originalCues,
  targetLang,
  observedUrl,
  videoId,
  sourceLang = 'auto',
  onStatusChange,
}: {
  originalCues: CaptionCue[];
  targetLang: string;
  observedUrl?: string | null;
  videoId?: string;
  sourceLang?: string;
  onStatusChange?: (source: TranslationSource) => void;
}): Promise<{
  source: TranslationSource;
  translations: Record<string, string>;
  cues?: CaptionCue[];
  modifiedUrl?: string;
}> {
  const cleanLang = normalizeLanguageCode(targetLang).split('-')[0];
  const cacheKey = `${videoId || 'current'}:${cleanLang}`;

  // Check if we already have a cached native track for this video and language
  if (nativeTrackCache.has(cacheKey)) {
    const cachedCues = nativeTrackCache.get(cacheKey)!;
    const mapped = mapTranslatedCuesToOriginal(originalCues, cachedCues);
    languageSourceMap.set(cacheKey, 'youtube_native');
    onStatusChange?.('youtube_native');
    return {
      source: 'youtube_native',
      translations: mapped,
      cues: cachedCues,
    };
  }

  // STEP 1: Attempt YouTube Native Translation by repeating observed request
  console.log(`[Translation] Trying YouTube Native translation for ${cleanLang} with fmt=srt & tlang=${cleanLang}...`);
  const nativeResult = await fetchYouTubeNativeTranslation({
    observedUrl,
    targetLang: cleanLang,
    format: 'srt',
    videoId,
  });

  if (nativeResult.success && nativeResult.cues && nativeResult.cues.length > 0) {
    console.log(`[Translation] Successfully retrieved ${nativeResult.cues.length} cues via YouTube Native Translation for ${cleanLang}! (Source: ${nativeResult.source})`);
    const resolvedSource = nativeResult.source || 'youtube_native';
    nativeTrackCache.set(cacheKey, nativeResult.cues);
    languageSourceMap.set(cacheKey, resolvedSource);
    onStatusChange?.(resolvedSource);

    const mapped = mapTranslatedCuesToOriginal(originalCues, nativeResult.cues);

    // Populate memory cache for single text lookups
    originalCues.forEach((orig) => {
      if (mapped[orig.id]) {
        const textKey = `${sourceLang}:${cleanLang}:${orig.text.trim()}`;
        memoryCache.set(textKey, mapped[orig.id]);
      }
    });

    return {
      source: resolvedSource,
      translations: mapped,
      cues: nativeResult.cues,
      modifiedUrl: nativeResult.modifiedUrl,
    };
  }

  // STEP 2: FALLBACK to current translation service (Google Translate GTX / sample)
  console.log(`[Translation] YouTube native translation unavailable (${nativeResult.error || 'fallback'}), using fallback translation service for ${cleanLang}...`);
  languageSourceMap.set(cacheKey, 'google_translate_fallback');
  onStatusChange?.('google_translate_fallback');

  const fallbackTranslations: Record<string, string> = {};
  await Promise.all(
    originalCues.map(async (cue) => {
      const translated = await translateText(cue.text, sourceLang, cleanLang);
      fallbackTranslations[cue.id] = translated;
    })
  );

  return {
    source: 'google_translate_fallback',
    translations: fallbackTranslations,
    modifiedUrl: nativeResult.modifiedUrl,
  };
}

/**
 * Maps translated cues to original cues based on timing and sequence
 */
function mapTranslatedCuesToOriginal(
  originalCues: CaptionCue[],
  translatedCues: CaptionCue[]
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!originalCues || originalCues.length === 0) return result;
  if (!translatedCues || translatedCues.length === 0) return result;

  // If cue counts match exactly, map 1-to-1
  if (originalCues.length === translatedCues.length) {
    originalCues.forEach((orig, idx) => {
      result[orig.id] = translatedCues[idx].text;
    });
    return result;
  }

  // Otherwise, match each original cue to closest translated cue by start time
  originalCues.forEach((orig, idx) => {
    let closestCue = translatedCues[idx] || translatedCues[0];
    let minDiff = Math.abs(closestCue.start - orig.start);

    for (const trans of translatedCues) {
      const diff = Math.abs(trans.start - orig.start);
      if (diff < minDiff) {
        minDiff = diff;
        closestCue = trans;
      }
    }

    result[orig.id] = closestCue.text;
  });

  return result;
}

/**
 * Get current translation source for a target language
 */
export function getLanguageTranslationSource(langCode: string, videoId?: string): TranslationSource {
  const cleanLang = normalizeLanguageCode(langCode).split('-')[0];
  const key = `${videoId || 'current'}:${cleanLang}`;
  return languageSourceMap.get(key) || 'youtube_native';
}

export const SUPPORTED_TARGET_LANGUAGES = [
  { code: 'en', name: 'English', color: '#3b82f6' },
  { code: 'es', name: 'Spanish (Español)', color: '#ef4444' },
  { code: 'fr', name: 'French (Français)', color: '#8b5cf6' },
  { code: 'de', name: 'German (Deutsch)', color: '#f59e0b' },
  { code: 'it', name: 'Italian (Italiano)', color: '#10b981' },
  { code: 'pt', name: 'Portuguese (Português)', color: '#06b6d4' },
  { code: 'ru', name: 'Russian (Русский)', color: '#ec4899' },
  { code: 'ja', name: 'Japanese (日本語)', color: '#f43f5e' },
  { code: 'ko', name: 'Korean (한국어)', color: '#6366f1' },
  { code: 'zh-CN', name: 'Chinese Simplified (简体中文)', color: '#e11d48' },
  { code: 'zh-TW', name: 'Chinese Traditional (繁體中文)', color: '#ea580c' },
  { code: 'ar', name: 'Arabic (العربية)', color: '#14b8a6' },
  { code: 'he', name: 'Hebrew (עברית)', color: '#0284c7' },
  { code: 'hi', name: 'Hindi (हिन्दी)', color: '#d97706' },
  { code: 'tr', name: 'Turkish (Türkçe)', color: '#be123c' },
  { code: 'nl', name: 'Dutch (Nederlands)', color: '#84cc16' },
  { code: 'pl', name: 'Polish (Polski)', color: '#a855f7' },
  { code: 'sv', name: 'Swedish (Svenska)', color: '#0ea5e9' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)', color: '#10b981' },
  { code: 'th', name: 'Thai (ไทย)', color: '#ca8a04' },
  { code: 'el', name: 'Greek (Ελληνικά)', color: '#2563eb' },
  { code: 'uk', name: 'Ukrainian (Українська)', color: '#eab308' },
];
