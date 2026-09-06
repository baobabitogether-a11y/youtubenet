import { CaptionCue } from '../types';
import { normalizeLanguageCode } from './ttsEngine';

const memoryCache = new Map<string, string>();

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

  try {
    const sl = cleanFrom === 'auto' ? 'auto' : cleanFrom.split('-')[0];
    const tl = cleanTo.split('-')[0];

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

    const finalResult = translated.trim() || trimmed;
    memoryCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (err) {
    // If translation fails (e.g. offline), return original text
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
