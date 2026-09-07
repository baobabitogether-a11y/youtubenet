import { CaptionCue, InterceptedCaptionData } from '../types';

/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Maps Windows-1252 character codes back to their original single-byte representation.
 * Used for reversing Mojibake caused by UTF-8 bytes misinterpreted as Windows-1252.
 */
const WIN1252_TO_BYTE: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
};

/**
 * Automatically detects and repairs Mojibake resulting from UTF-8 bytes
 * mistakenly read as Windows-1252 or Latin-1 (ISO-8859-1).
 */
export function fixMojibake(str: string): string {
  if (!str) return str;
  // Check if string contains candidate byte characters
  if (!/[\xC0-\xFF\u0100-\u02FF\u2010-\u2030]/.test(str)) return str;

  try {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 256) {
        bytes.push(code);
      } else if (WIN1252_TO_BYTE[code] !== undefined) {
        bytes.push(WIN1252_TO_BYTE[code]);
      } else {
        // Contains genuine Unicode character outside Windows-1252 range
        return str;
      }
    }
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    if (decoded && decoded !== str) {
      return decoded;
    }
  } catch {
    // If TextDecoder fails, string is not a valid UTF-8 byte stream, keep original
  }
  return str;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&iexcl;': '¡',
  '&iquest;': '¿',
  '&laquo;': '«',
  '&raquo;': '»',
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&bull;': '•',
  '&middot;': '·',
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&cent;': '¢',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&deg;': '°',
  '&plusmn;': '±',
  '&times;': '×',
  '&divide;': '÷',
  '&szlig;': 'ß',
  // Acute
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&yacute;': 'ý',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&Yacute;': 'Ý',
  // Grave
  '&agrave;': 'à',
  '&egrave;': 'è',
  '&igrave;': 'ì',
  '&ograve;': 'ò',
  '&ugrave;': 'ù',
  '&Agrave;': 'À',
  '&Egrave;': 'È',
  '&Igrave;': 'Ì',
  '&Ograve;': 'Ò',
  '&Ugrave;': 'Ù',
  // Circumflex
  '&acirc;': 'â',
  '&ecirc;': 'ê',
  '&icirc;': 'î',
  '&ocirc;': 'ô',
  '&ucirc;': 'û',
  '&Acirc;': 'Â',
  '&Ecirc;': 'Ê',
  '&Icirc;': 'Î',
  '&Ocirc;': 'Ô',
  '&Ucirc;': 'Û',
  // Umlaut / Diaeresis
  '&auml;': 'ä',
  '&euml;': 'ë',
  '&iuml;': 'ï',
  '&ouml;': 'ö',
  '&uuml;': 'ü',
  '&yuml;': 'ÿ',
  '&Auml;': 'Ä',
  '&Euml;': 'Ë',
  '&Iuml;': 'Ï',
  '&Ouml;': 'Ö',
  '&Uuml;': 'Ü',
  // Tilde
  '&atilde;': 'ã',
  '&ntilde;': 'ñ',
  '&otilde;': 'õ',
  '&Atilde;': 'Ã',
  '&Ntilde;': 'Ñ',
  '&Otilde;': 'Õ',
  // Cedilla
  '&ccedil;': 'ç',
  '&Ccedil;': 'Ç',
  // Ring / Slash / Ligatures
  '&aring;': 'å',
  '&Aring;': 'Å',
  '&oslash;': 'ø',
  '&Oslash;': 'Ø',
  '&aelig;': 'æ',
  '&AElig;': 'Æ',
  '&oelig;': 'œ',
  '&OElig;': 'Œ',
};

/**
 * Decodes all HTML numeric (decimal &#...; & hex &#x...;) and named entities
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  let s = text;

  // 1. Decimal numeric entities (e.g. &#1575; for Arabic, &#232; for è)
  s = s.replace(/&#(\d+);?/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
  });

  // 2. Hexadecimal numeric entities (e.g. &#x0627;, &#xE8;)
  s = s.replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) => {
    const code = parseInt(hex, 16);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
  });

  // 3. Named HTML entities
  s = s.replace(/&[a-zA-Z]+;/g, (m) => NAMED_HTML_ENTITIES[m] || m);

  // 4. Browser DOMParser fallback if unhandled entities remain
  if (typeof DOMParser !== 'undefined' && s.includes('&')) {
    try {
      const doc = new DOMParser().parseFromString(s, 'text/html');
      if (doc && doc.body && doc.body.textContent) {
        s = doc.body.textContent;
      }
    } catch {}
  }

  return s;
}

/**
 * Comprehensive text sanitizer and encoding corrector:
 * - Decodes unicode escape sequences (\uXXXX, \u{XXXX})
 * - Decodes all HTML entities (numeric and named)
 * - Auto-repairs UTF-8 Mojibake (Latin-1 / Windows-1252 misreads)
 * - Strips unwanted inner HTML/XML tags
 * - Normalizes non-breaking spaces and trims
 */
export function cleanAndFixEncoding(text: string): string {
  if (!text) return '';
  let s = text;

  // 1. Unescape JSON / JavaScript unicode escapes: \u0627 or \u{627}
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

  // 2. Decode HTML numeric & named entities
  s = decodeHtmlEntities(s);

  // 3. Auto-repair UTF-8 Mojibake if present
  s = fixMojibake(s);

  // 4. Strip stray XML/HTML tags
  s = s.replace(/<[^>]+>/g, '');

  // 5. Replace non-breaking spaces and normalize whitespace
  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Safely decodes a Base64 string that contains UTF-8 encoded text.
 * Avoids the standard JavaScript atob() bug which treats UTF-8 bytes as Latin-1.
 */
export function decodeBase64ToUtf8(base64Str: string): string {
  if (!base64Str) return '';
  const sanitized = base64Str.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(sanitized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return decodeURIComponent(escape(atob(sanitized)));
    } catch {
      return atob(sanitized);
    }
  }
}

/**
 * Parses raw YouTube timedtext data (XML, JSON3, or VTT) into structured CaptionCue objects
 */
export function parseRawCaptionData(raw: string): { format: 'xml' | 'json3' | 'vtt' | 'unknown'; cues: CaptionCue[] } {
  const trimmed = raw.trim();

  // 1. Try JSON3 format
  if (trimmed.startsWith('{') && trimmed.includes('"events"')) {
    try {
      const data = JSON.parse(trimmed);
      const cues: CaptionCue[] = [];
      let counter = 1;

      if (Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.segs && Array.isArray(ev.segs)) {
            const rawSegText = ev.segs
              .map((s: { utf8?: string }) => s.utf8 || '')
              .join('');
            const text = cleanAndFixEncoding(rawSegText);
            if (text) {
              const start = (ev.tStartMs || 0) / 1000;
              const duration = (ev.dDurationMs || 0) / 1000;
              cues.push({
                id: `cue-${counter++}`,
                start,
                duration: Math.max(1.0, duration),
                text,
              });
            }
          }
        }
      }
      return { format: 'json3', cues };
    } catch {
      // Fall through
    }
  }

  // 2. Try XML formats (standard <transcript> or srv3 <timedtext>)
  if (trimmed.startsWith('<') || trimmed.includes('<text ') || trimmed.includes('<p ')) {
    const cues: CaptionCue[] = [];
    let counter = 1;

    // Standard <text start="1.42" dur="3.1">...</text>
    const textTagRegex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/gi;
    let match: RegExpExecArray | null;
    while ((match = textTagRegex.exec(trimmed)) !== null) {
      const start = parseFloat(match[1]) || 0;
      const duration = parseFloat(match[2]) || 0;
      const cleanText = cleanAndFixEncoding(match[3]);
      if (cleanText) {
        cues.push({
          id: `cue-${counter++}`,
          start,
          duration: Math.max(1.0, duration),
          text: cleanText,
        });
      }
    }

    // srv3 <p t="1420" d="3100"><s>...</s></p>
    if (cues.length === 0) {
      const pTagRegex = /<p\s+t="([^"]+)"(?:\s+d="([^"]+)")?[^>]*>([\s\S]*?)<\/p>/gi;
      while ((match = pTagRegex.exec(trimmed)) !== null) {
        const start = (parseFloat(match[1]) || 0) / 1000;
        const duration = (parseFloat(match[2] || '0') || 0) / 1000;
        const cleanText = cleanAndFixEncoding(match[3]);
        if (cleanText) {
          cues.push({
            id: `cue-${counter++}`,
            start,
            duration: Math.max(1.0, duration),
            text: cleanText,
          });
        }
      }
    }

    if (cues.length > 0) {
      return { format: 'xml', cues };
    }
  }

  // 3. Try WebVTT
  if (trimmed.startsWith('WEBVTT') || trimmed.includes('-->')) {
    const cues: CaptionCue[] = [];
    let counter = 1;
    const blocks = trimmed.split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIndex !== -1) {
        const timeLine = lines[timeLineIndex];
        const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
        const parseVttTime = (t: string) => {
          const parts = t.split(':');
          if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          } else if (parts.length === 2) {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
          }
          return 0;
        };
        const start = parseVttTime(startStr);
        const end = parseVttTime(endStr);
        const rawText = lines.slice(timeLineIndex + 1).join(' ');
        const text = cleanAndFixEncoding(rawText);
        if (text) {
          cues.push({
            id: `cue-${counter++}`,
            start,
            duration: Math.max(1.0, end - start),
            text,
          });
        }
      }
    }
    if (cues.length > 0) {
      return { format: 'vtt', cues };
    }
  }

  // 4. Try SRT format
  if (trimmed.includes('-->')) {
    const cues: CaptionCue[] = [];
    let counter = 1;
    const blocks = trimmed.split(/\r?\n\s*\r?\n/);
    for (const block of blocks) {
      const lines = block.trim().split(/\r?\n/);
      const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIndex !== -1) {
        const timeLine = lines[timeLineIndex];
        const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
        const parseSrtTime = (t: string) => {
          const parts = t.replace(',', '.').split(':');
          if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          } else if (parts.length === 2) {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
          }
          return parseFloat(parts[0]) || 0;
        };
        const start = parseSrtTime(startStr);
        const end = parseSrtTime(endStr);
        const rawText = lines.slice(timeLineIndex + 1).join(' ');
        const text = cleanAndFixEncoding(rawText);
        if (text) {
          cues.push({
            id: `cue-${counter++}`,
            start,
            duration: Math.max(1.0, end - start),
            text,
          });
        }
      }
    }
    if (cues.length > 0) {
      return { format: 'vtt', cues };
    }
  }

  return { format: 'unknown', cues: [] };
}

/**
 * Converts CaptionCue[] into standard SubRip (.srt) format
 */
export function cuesToSrt(cues: CaptionCue[]): string {
  const formatSrtTime = (seconds: number) => {
    const ms = Math.floor((seconds % 1) * 1000);
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  return cues
    .map((cue, idx) => {
      const start = formatSrtTime(cue.start);
      const end = formatSrtTime(cue.start + (cue.duration || 2));
      return `${idx + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join('\n');
}

/**
 * Converts CaptionCue[] into standard WebVTT (.vtt) format
 */
export function cuesToVtt(cues: CaptionCue[]): string {
  const formatVttTime = (seconds: number) => {
    const ms = Math.floor((seconds % 1) * 1000);
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const lines = ['WEBVTT', ''];
  cues.forEach((cue) => {
    const start = formatVttTime(cue.start);
    const end = formatVttTime(cue.start + (cue.duration || 2));
    lines.push(`${start} --> ${end}`);
    lines.push(cue.text);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Authentic sample YouTube timedtext XML response payload
 * specifically generated for testing and demonstration
 */
export const SAMPLE_YOUTUBE_TIMEDTEXT_XML = `<?xml version="1.0" encoding="utf-8" ?>
<transcript>
  <text start="1.42" dur="3.15">Здравствуйте, дорогие друзья! Рад приветствовать вас на нашем канале.</text>
  <text start="4.80" dur="4.20">Сегодня у нас в студии особенный гость — Аркадий Духин.</text>
  <text start="9.15" dur="3.85">Мы поговорим о музыке, творчестве Владимира Высоцкого и Арика Айнштейна.</text>
  <text start="13.20" dur="4.10">А также обсудим глубокие смыслы: может ли музыка спасти жизнь человека?</text>
  <text start="17.50" dur="3.60">Как возникла эта уникальная комбинация жанров: рэп, рок и каббала?</text>
  <text start="21.30" dur="4.80">Аркадий, добро пожаловать! С чего начался ваш путь и как рождались первые аккорды?</text>
  <text start="26.40" dur="4.20">Спасибо за приглашение. Все началось еще в детстве, когда мелодия была единственным языком.</text>
  <text start="31.00" dur="3.90">Когда слышишь честную поэзию, она проникает в самое сердце и остается навсегда.</text>
  <text start="35.20" dur="4.50">Музыка — это мост между мирами, когда слова уже бессильны передать чувства.</text>
</transcript>`;

/**
 * Authentic sample YouTube timedtext JSON3 response payload
 */
export const SAMPLE_YOUTUBE_TIMEDTEXT_JSON3 = JSON.stringify(
  {
    wireMagic: 'pb3',
    pens: [{}],
    wsWinStyles: [{}],
    wpWinPositions: [{}],
    events: [
      {
        tStartMs: 1420,
        dDurationMs: 3150,
        segs: [{ utf8: 'Здравствуйте, дорогие друзья! Рад приветствовать вас на нашем канале.' }],
      },
      {
        tStartMs: 4800,
        dDurationMs: 4200,
        segs: [{ utf8: 'Сегодня у нас в студии особенный гость — Аркадий Духин.' }],
      },
      {
        tStartMs: 9150,
        dDurationMs: 3850,
        segs: [{ utf8: 'Мы поговорим о музыке, творчестве Владимира Высоцкого и Арика Айнштейна.' }],
      },
      {
        tStartMs: 13200,
        dDurationMs: 4100,
        segs: [{ utf8: 'А также обсудим глубокие смыслы: может ли музыка спасти жизнь человека?' }],
      },
      {
        tStartMs: 17500,
        dDurationMs: 3600,
        segs: [{ utf8: 'Как возникла эта уникальная комбинация жанров: рэп, рок и каббала?' }],
      },
      {
        tStartMs: 21300,
        dDurationMs: 4800,
        segs: [{ utf8: 'Аркадий, добро пожаловать! С чего начался ваш путь?' }],
      },
      {
        tStartMs: 26400,
        dDurationMs: 4200,
        segs: [{ utf8: 'Спасибо за приглашение. Все началось еще в детстве.' }],
      },
    ],
  },
  null,
  2
);
