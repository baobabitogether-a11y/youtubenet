import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Settings2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Layers,
  Upload,
  BookOpen,
  CheckCircle2,
  Smartphone,
  Globe,
  Radio,
  Clock,
  RotateCcw,
  Subtitles,
  HelpCircle,
  FolderHeart,
  Loader2,
} from 'lucide-react';
import { CaptionCue, TargetLanguage, SyncPlayOrder, YouTubePlayerHandle, TranslationSource } from '../types';
import { useSyncEngine } from '../hooks/useSyncEngine';
import {
  SUPPORTED_TARGET_LANGUAGES,
  SAMPLE_TRANSLATIONS,
  translateText,
  translateTrackWithNativeFirst,
  getLanguageTranslationSource,
  isYouTubeNativeSource,
} from '../lib/translateService';
import { formatTimestamp, cleanAndFixEncoding, parseRawCaptionData } from '../utils/captionParser';
import { isAndroidNativeTTS } from '../lib/ttsEngine';
import { LanguageSettingsModal } from './LanguageSettingsModal';
import { ObservedTimedTextModal } from './ObservedTimedTextModal';

interface SubtitlesTeacherPanelProps {
  cues: CaptionCue[];
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
  onLoadCues?: (cues: CaptionCue[]) => void;
  onOpenLibrary?: () => void;
  onFetchSubtitles?: () => void;
  isFetchingSubtitles?: boolean;
  fetchError?: string | null;
  observedTimedTextUrl?: string | null;
  videoId?: string;
  onUpdateObservedTimedTextUrl?: (url: string) => void;
}

const DEFAULT_TARGET_LANGUAGES: TargetLanguage[] = [
  {
    id: 'lang-it',
    code: 'it',
    name: 'Italian (Italiano)',
    ttsRate: 1.0,
    enabled: true,
    color: '#10b981',
  },
  {
    id: 'lang-ar',
    code: 'ar',
    name: 'Arabic (العربية)',
    ttsRate: 1.0,
    enabled: true,
    color: '#14b8a6',
  },
  {
    id: 'lang-es',
    code: 'es',
    name: 'Spanish (Español)',
    ttsRate: 1.0,
    enabled: false,
    color: '#ef4444',
  },
  {
    id: 'lang-en',
    code: 'en',
    name: 'English',
    ttsRate: 1.0,
    enabled: false,
    color: '#3b82f6',
  },
];

export const SAMPLE_TEACHER_CUES: CaptionCue[] = [];

export const SubtitlesTeacherPanel: React.FC<SubtitlesTeacherPanelProps> = ({
  cues,
  playerRef,
  onLoadCues,
  onOpenLibrary,
  onFetchSubtitles,
  isFetchingSubtitles = false,
  fetchError = null,
  observedTimedTextUrl,
  videoId,
  onUpdateObservedTimedTextUrl,
}) => {
  const [targetLanguages, setTargetLanguages] = useState<TargetLanguage[]>(() => {
    try {
      const saved = localStorage.getItem('yt_teacher_languages_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasIt = parsed.some((l: any) => l.code === 'it');
          const hasAr = parsed.some((l: any) => l.code === 'ar');
          if (hasIt && hasAr) return parsed;
        }
      }
    } catch {}
    return DEFAULT_TARGET_LANGUAGES;
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLangSettingsOpen, setIsLangSettingsOpen] = useState<boolean>(false);
  const [isObservedModalOpen, setIsObservedModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tableTranslations, setTableTranslations] = useState<Record<string, Record<string, string>>>({});
  const [langSources, setLangSources] = useState<Record<string, TranslationSource>>({});

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices() || [];
        setAvailableVoices(v);
      } catch {}
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const getVoicesForLang = (code: string) => {
    const prefix = code.split('-')[0].toLowerCase();
    const matched = availableVoices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    return matched.length > 0 ? matched : availableVoices;
  };

  const updateLanguageVoice = (id: string, voice: string) => {
    setTargetLanguages((prev) =>
      prev.map((lang) => (lang.id === id ? { ...lang, voice } : lang))
    );
  };

  const [playOrder, setPlayOrder] = useState<SyncPlayOrder>(() => {
    try {
      const saved = localStorage.getItem('yt_teacher_play_order_v1');
      if (saved === 'tts_first' || saved === 'video_first') return saved;
    } catch {}
    return 'video_first';
  });

  const [sourceLang, setSourceLang] = useState<string>('auto');

  useEffect(() => {
    try {
      localStorage.setItem('yt_teacher_languages_v1', JSON.stringify(targetLanguages));
    } catch {}
  }, [targetLanguages]);

  useEffect(() => {
    try {
      localStorage.setItem('yt_teacher_play_order_v1', playOrder);
    } catch {}
  }, [playOrder]);

  const effectiveCues = cues;

  const {
    activeCueIndex,
    isSyncActive,
    isSpeaking,
    currentTTSLang,
    currentTTSText,
    translations,
    startSync,
    pauseSync,
    jumpToCue,
    nextCue,
    prevCue,
    testSpeakLang,
  } = useSyncEngine({
    cues: effectiveCues,
    sourceLang,
    languages: targetLanguages,
    playerRef,
    playOrder,
    observedUrl: observedTimedTextUrl,
    videoId,
  });

  // Default to YouTube native translation (repeating observed request with tlang & fmt=srt)
  // and use current translation service as fallback.
  useEffect(() => {
    if (!effectiveCues || effectiveCues.length === 0) return;
    const enabled = targetLanguages.filter((l) => l.enabled);

    enabled.forEach((lang) => {
      translateTrackWithNativeFirst({
        originalCues: effectiveCues,
        targetLang: lang.code,
        observedUrl: observedTimedTextUrl,
        videoId,
        sourceLang,
        onStatusChange: (src) => {
          setLangSources((prev) => ({ ...prev, [lang.code]: src }));
        },
      }).then((res) => {
        if (res.source) {
          setLangSources((prev) => ({ ...prev, [lang.code]: res.source }));
        }
        if (res.translations) {
          setTableTranslations((prev) => {
            const updated = { ...prev };
            Object.entries(res.translations).forEach(([cId, text]) => {
              updated[cId] = { ...(updated[cId] || {}), [lang.code]: text };
            });
            return updated;
          });
        }
      }).catch((err) => {
        console.warn(`Translation error for ${lang.code}:`, err);
      });
    });
  }, [effectiveCues, targetLanguages, sourceLang, observedTimedTextUrl, videoId]);

  const getCueTranslation = (cue: CaptionCue, langCode: string): string => {
    if (translations[cue.id]?.[langCode]) return translations[cue.id][langCode];
    if (tableTranslations[cue.id]?.[langCode]) return tableTranslations[cue.id][langCode];
    if (SAMPLE_TRANSLATIONS[cue.text]?.[langCode]) return SAMPLE_TRANSLATIONS[cue.text][langCode];
    return '';
  };

  const toggleLanguage = (id: string) => {
    setTargetLanguages((prev) =>
      prev.map((lang) => (lang.id === id ? { ...lang, enabled: !lang.enabled } : lang))
    );
  };

  const updateLanguageRate = (id: string, rate: number) => {
    setTargetLanguages((prev) =>
      prev.map((lang) => (lang.id === id ? { ...lang, ttsRate: Math.max(0.5, Math.min(1.5, rate)) } : lang))
    );
  };

  const moveLanguageUp = (index: number) => {
    if (index <= 0) return;
    setTargetLanguages((prev) => {
      const arr = [...prev];
      const temp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const moveLanguageDown = (index: number) => {
    if (index >= targetLanguages.length - 1) return;
    setTargetLanguages((prev) => {
      const arr = [...prev];
      const temp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const removeLanguage = (id: string) => {
    setTargetLanguages((prev) => prev.filter((lang) => lang.id !== id));
  };

  const [isAddingLang, setIsAddingLang] = useState(false);
  const [selectedNewLang, setSelectedNewLang] = useState('fr');

  const handleAddLanguage = () => {
    const meta = SUPPORTED_TARGET_LANGUAGES.find((l) => l.code === selectedNewLang);
    if (!meta) return;

    if (targetLanguages.some((l) => l.code === meta.code)) {
      setTargetLanguages((prev) =>
        prev.map((l) => (l.code === meta.code ? { ...l, enabled: true } : l))
      );
    } else {
      const newLang: TargetLanguage = {
        id: `lang-${meta.code}-${Date.now()}`,
        code: meta.code,
        name: meta.name,
        ttsRate: 1.0,
        enabled: true,
        color: '#6366f1',
      };
      setTargetLanguages((prev) => [...prev, newLang]);
    }
    setIsAddingLang(false);
  };

  const handleLoadSample = () => {
    onLoadCues?.(SAMPLE_TEACHER_CUES);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      // 1. Try unified parser first (handles XML, JSON3, WebVTT, and SRT with automatic encoding correction)
      const { cues } = parseRawCaptionData(content);
      if (cues && cues.length > 0) {
        onLoadCues?.(cues);
        return;
      }

      // 2. Fallback line-by-line parser with full encoding correction
      const lines = content.split(/\r?\n/);
      const parsedCues: CaptionCue[] = [];
      let idx = 1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('-->')) {
          const [startStr, endStr] = line.split('-->').map((s) => s.trim());
          const parseTime = (t: string) => {
            const parts = t.replace(',', '.').split(':');
            if (parts.length === 3) {
              return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
            }
            if (parts.length === 2) {
              return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
            }
            return parseFloat(parts[0]) || 0;
          };

          const start = parseTime(startStr);
          const end = parseTime(endStr);
          const textLines: string[] = [];
          i++;
          while (i < lines.length && lines[i].trim() !== '') {
            textLines.push(lines[i].trim());
            i++;
          }
          const text = cleanAndFixEncoding(textLines.join(' '));
          if (text) {
            parsedCues.push({
              id: `custom-cue-${idx++}`,
              start,
              duration: Math.max(1, end - start),
              text,
            });
          }
        }
      }

      if (parsedCues.length > 0) {
        onLoadCues?.(parsedCues);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const currentCue =
    activeCueIndex >= 0 && activeCueIndex < effectiveCues.length
      ? effectiveCues[activeCueIndex]
      : effectiveCues.length > 0
      ? effectiveCues[0]
      : null;

  const enabledTargetLangs = useMemo(
    () => targetLanguages.filter((l) => l.enabled),
    [targetLanguages]
  );

  const filteredCues = useMemo(() => {
    if (!searchQuery.trim()) return effectiveCues;
    return effectiveCues.filter((cue) =>
      cue.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [effectiveCues, searchQuery]);

  return (
    <div className="w-full rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl overflow-hidden flex flex-col">
      {/* 1. Header & Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-900">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
              <span>Language Learning Session</span>
              {effectiveCues.length > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                  {effectiveCues.length} Cues Ready
                </span>
              )}
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Synchronized video segments with spoken translations &amp; multi-column study view.
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* Target Languages Chips preview */}
          <div className="hidden sm:flex items-center gap-1.5 mr-1">
            {enabledTargetLangs.map((lang) => (
              <span
                key={lang.id}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700"
              >
                {lang.name.split(' ')[0]} ({lang.ttsRate}x)
              </span>
            ))}
          </div>

          {/* YouTube Native TimedText Repetition Inspector */}
          <button
            type="button"
            id="open-observed-timedtext-button"
            data-testid="open-observed-timedtext-button"
            onClick={() => setIsObservedModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition active:scale-95"
            title="Inspect and test YouTube Native Subtitles TimedText request repetition"
          >
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span className="hidden md:inline">YouTube Native Stream</span>
            <span className="md:hidden">YT Stream</span>
          </button>

          <button
            type="button"
            id="open-language-settings-button"
            data-testid="open-language-settings-button"
            onClick={() => setIsLangSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition active:scale-95"
            title="Configure target languages and speaking speed"
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Languages &amp; Speed</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Area */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Step 2: In case subtitles are NOT yet cached */}
        {effectiveCues.length === 0 ? (
          <div
            id="subtitles-not-cached-instruction"
            className="p-8 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col items-center text-center gap-4 animate-fadeIn shadow-lg"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/5">
                <Subtitles className="w-8 h-8" />
              </div>
              <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px] tracking-wider shadow">
                CC
              </span>
            </div>

            <div className="max-w-md">
              <h3 className="text-base font-semibold text-neutral-100">
                Subtitles Not Yet Cached
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Click below or use the &quot;Fetch Subtitles / CC&quot; button above to fetch and synchronize subtitles for this video to start your learning session.
              </p>
            </div>

            {fetchError && (
              <div className="px-3.5 py-2 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs max-w-md">
                {fetchError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 mt-1">
              {onFetchSubtitles && (
                <button
                  type="button"
                  id="fetch-subtitles-action-button"
                  data-testid="fetch-subtitles-action-button"
                  onClick={onFetchSubtitles}
                  disabled={isFetchingSubtitles}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-red-600/20 active:scale-95 transition disabled:opacity-60"
                >
                  {isFetchingSubtitles ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Subtitles className="w-4 h-4" />
                  )}
                  <span>
                    {isFetchingSubtitles
                      ? 'Fetching Subtitles from Video...'
                      : 'Fetch Subtitles for this Video'}
                  </span>
                </button>
              )}

              {onOpenLibrary && (
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-medium transition"
                >
                  <FolderHeart className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Select from My Library</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Step 3, 5, 6: Subtitles ARE cached/loaded -> Full Learning Session Workspace */
          <div className="flex flex-col gap-4">
            {/* Master Session Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80">
              {/* Play / Pause / Skip controls */}
              <div className="flex items-center gap-2">
                <button
                  id="sync-teacher-play-button"
                  type="button"
                  data-testid="sync-teacher-play-button"
                  onClick={() => {
                    if (isSyncActive) {
                      pauseSync();
                    } else {
                      startSync();
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-md ${
                    isSyncActive
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isSyncActive ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause Teacher Sync</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Teacher Sync</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={activeCueIndex <= 0}
                  onClick={prevCue}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Previous Timeframe"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={activeCueIndex >= effectiveCues.length - 1}
                  onClick={nextCue}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Next Timeframe"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-neutral-400 font-mono">
                  Cue <span className="text-neutral-100 font-semibold">{activeCueIndex >= 0 ? activeCueIndex + 1 : 1}</span> of {effectiveCues.length}
                </span>

                {isSpeaking && currentTTSLang && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 animate-pulse">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      Speaking {targetLanguages.find((l) => l.code === currentTTSLang)?.name || currentTTSLang}
                    </span>
                  </div>
                )}

                {isSyncActive && !isSpeaking && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>Video Clip Playing</span>
                  </div>
                )}
              </div>

              {/* Filter search input */}
              <div className="w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filter subtitles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-44 text-xs bg-neutral-900 text-neutral-200 border border-neutral-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Active Subtitle Preview Card */}
            {currentCue && (
              <div
                id="active-subtitle-card"
                data-testid="active-subtitle-card"
                className="p-4 rounded-xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-indigo-950/30 border border-indigo-500/30 flex flex-col gap-2 shadow-inner"
              >
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5 font-mono text-indigo-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {formatTimestamp(currentCue.start)} &rarr;{' '}
                      {formatTimestamp(currentCue.start + (currentCue.duration || 2.5))}
                    </span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 font-semibold text-[11px] border border-indigo-700/50">
                    Active Timeframe
                  </span>
                </div>

                <p
                  id="active-subtitle-cue-text"
                  data-testid="active-subtitle-cue-text"
                  className="text-sm font-medium text-neutral-100 leading-relaxed"
                >
                  "{currentCue.text}"
                </p>

                {/* Active Translations Grid */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
                  id="active-translations-grid"
                  data-testid="active-translations-grid"
                >
                  {enabledTargetLangs.map((lang) => {
                    const translated = getCueTranslation(currentCue, lang.code);
                    const isCurrentLangSpeaking = isSpeaking && currentTTSLang === lang.code;

                    return (
                      <div
                        key={lang.id}
                        id={`active-translation-${lang.code}`}
                        data-testid={`active-translation-${lang.code}`}
                        className={`p-2.5 rounded-lg text-xs border transition ${
                          isCurrentLangSpeaking
                            ? 'bg-indigo-900/40 border-indigo-400 text-indigo-200'
                            : 'bg-neutral-950/60 border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[11px] text-neutral-400">
                            {lang.name}:
                          </span>
                          {isCurrentLangSpeaking && (
                            <span
                              data-testid={`speaking-indicator-${lang.code}`}
                              className="flex items-center gap-1 text-[10px] text-indigo-300 font-medium"
                            >
                              <Volume2 className="w-3 h-3 animate-pulse" />
                              Speaking
                            </span>
                          )}
                        </div>
                        <p data-testid={`translation-text-${lang.code}`} className="text-neutral-200">
                          {translated || 'Translating...'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Multi-Column Subtitles View (Original Subtitle + Translation Columns) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-300">
                  Subtitles &amp; Translations Matrix ({filteredCues.length} segments)
                </span>
                <span className="text-[11px] text-neutral-500">
                  Click any row or play button to start learning from that timeframe
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/80 max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse" id="subtitles-columns-table">
                  <thead className="sticky top-0 z-10 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-32 whitespace-nowrap">Timeframe</th>
                      <th className="py-2.5 px-4 min-w-[220px]">Original Subtitle</th>
                      {enabledTargetLangs.map((lang) => (
                        <th key={lang.id} className="py-2.5 px-4 min-w-[220px]">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: lang.color || '#6366f1' }}
                              />
                              <span>{lang.name}</span>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                isYouTubeNativeSource(langSources[lang.code])
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              }`}
                              title={
                                langSources[lang.code] === 'youtube_native_client'
                                  ? 'Translated directly via viewer client browser (tlang repetition)'
                                  : langSources[lang.code] === 'youtube_native_android'
                                  ? 'Translated directly via Android device client shell (tlang repetition)'
                                  : isYouTubeNativeSource(langSources[lang.code])
                                  ? 'Translated by repeating YouTube timedtext request with tlang & fmt=srt'
                                  : 'Translated using fallback service'
                              }
                            >
                              {langSources[lang.code] === 'youtube_native_client'
                                ? 'YT Client'
                                : langSources[lang.code] === 'youtube_native_android'
                                ? 'YT Android'
                                : isYouTubeNativeSource(langSources[lang.code])
                                ? 'YT Native'
                                : 'Fallback'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900 text-xs">
                    {filteredCues.map((cue, idx) => {
                      const isSelected = activeCueIndex === idx;

                      return (
                        <tr
                          key={cue.id}
                          id={`subtitle-cue-row-${idx}`}
                          data-testid={`subtitle-cue-row-${idx}`}
                          data-cue-id={cue.id}
                          onClick={() => {
                            jumpToCue(idx);
                            startSync(idx);
                          }}
                          className={`cursor-pointer transition group ${
                            isSelected
                              ? 'bg-indigo-950/40 text-neutral-100 border-l-4 border-indigo-500'
                              : 'hover:bg-neutral-900/60 text-neutral-300'
                          }`}
                        >
                          {/* Column 1: Timeframe & Play button */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                title="Play from this timeframe"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  jumpToCue(idx);
                                  startSync(idx);
                                }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                                  isSelected && isSyncActive
                                    ? 'bg-indigo-600 text-white shadow'
                                    : 'bg-neutral-800 text-neutral-300 group-hover:bg-indigo-600 group-hover:text-white'
                                }`}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                              <div className="flex flex-col font-mono text-[11px] text-neutral-400">
                                <span>{formatTimestamp(cue.start)}</span>
                                <span className="text-[10px] text-neutral-600">
                                  {formatTimestamp(cue.start + (cue.duration || 2.5))}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Column 2: Original Subtitle text */}
                          <td className="py-2.5 px-4 font-medium text-neutral-200">
                            {cue.text}
                          </td>

                          {/* Columns 3+: Target Translation columns */}
                          {enabledTargetLangs.map((lang) => {
                            const trans = getCueTranslation(cue, lang.code);
                            const isRtl = lang.code === 'ar' || lang.code === 'he' || lang.code === 'fa';

                            return (
                              <td
                                key={lang.id}
                                dir={isRtl ? 'rtl' : 'ltr'}
                                className={`py-2.5 px-4 text-neutral-300 ${
                                  isRtl ? 'text-right font-arabic' : ''
                                }`}
                              >
                                {trans ? (
                                  <span>{trans}</span>
                                ) : (
                                  <span className="text-neutral-600 italic">Translating...</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Target Languages & Speech Settings Modal */}
      <LanguageSettingsModal
        isOpen={isLangSettingsOpen}
        onClose={() => setIsLangSettingsOpen(false)}
        targetLanguages={targetLanguages}
        onToggleLanguage={toggleLanguage}
        onUpdateRate={updateLanguageRate}
        onUpdateVoice={updateLanguageVoice}
        onMoveUp={moveLanguageUp}
        onMoveDown={moveLanguageDown}
        onAddLanguage={(lang) => {
          if (targetLanguages.some((l) => l.code === lang.code)) {
            setTargetLanguages((prev) =>
              prev.map((l) => (l.code === lang.code ? { ...l, enabled: true } : l))
            );
          } else {
            const newLang: TargetLanguage = {
              id: `lang-${lang.code}-${Date.now()}`,
              code: lang.code,
              name: lang.name,
              ttsRate: 1.0,
              enabled: true,
              color: '#6366f1',
            };
            setTargetLanguages((prev) => [...prev, newLang]);
          }
        }}
        onRemoveLanguage={removeLanguage}
        onTestSpeak={(lang) => {
          const testCue = currentCue || effectiveCues[0] || {
            id: 'test',
            start: 0,
            duration: 2,
            text: 'Hello, testing speech translation.',
          };
          testSpeakLang(testCue, lang);
        }}
        getVoicesForLang={getVoicesForLang}
      />

      {/* YouTube Native TimedText Subtitle Stream Modal */}
      <ObservedTimedTextModal
        isOpen={isObservedModalOpen}
        onClose={() => setIsObservedModalOpen(false)}
        observedUrl={observedTimedTextUrl || null}
        videoId={videoId}
        onSaveUrl={(url) => {
          onUpdateObservedTimedTextUrl?.(url);
        }}
      />
    </div>
  );
};
