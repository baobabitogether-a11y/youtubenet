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
 * Decodes HTML entities (e.g. &amp;, &#39;, &quot;, &lt;, &gt;)
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&#10;': ' ',
    '&#xA;': ' ',
  };
  return text.replace(/&[#a-zA-Z0-9]+;/g, (m) => entities[m] || m);
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
            const text = ev.segs
              .map((s: { utf8?: string }) => s.utf8 || '')
              .join('')
              .trim();
            if (text && text !== '\n') {
              const start = (ev.tStartMs || 0) / 1000;
              const duration = (ev.dDurationMs || 0) / 1000;
              cues.push({
                id: `cue-${counter++}`,
                start,
                duration,
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
      const cleanText = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, '')).trim();
      if (cleanText) {
        cues.push({
          id: `cue-${counter++}`,
          start,
          duration,
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
        const cleanText = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, '')).trim();
        if (cleanText) {
          cues.push({
            id: `cue-${counter++}`,
            start,
            duration,
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
        const text = lines.slice(timeLineIndex + 1).join(' ').trim();
        if (text) {
          cues.push({
            id: `cue-${counter++}`,
            start,
            duration: Math.max(0, end - start),
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
