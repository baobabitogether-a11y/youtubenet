import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { CaptionCue, TargetLanguage, SyncPlayOrder, YouTubePlayerHandle } from '../types';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { SUPPORTED_TARGET_LANGUAGES } from '../lib/translateService';
import { formatTimestamp } from '../utils/captionParser';
import { isAndroidNativeTTS } from '../lib/ttsEngine';

interface SubtitlesTeacherPanelProps {
  cues: CaptionCue[];
  playerRef: React.RefObject<YouTubePlayerHandle | null>;
  onLoadCues?: (cues: CaptionCue[]) => void;
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
    enabled: true,
    color: '#ef4444',
  },
  {
    id: 'lang-en',
    code: 'en',
    name: 'English',
    ttsRate: 1.0,
    enabled: true,
    color: '#3b82f6',
  },
];

const SAMPLE_TEACHER_CUES: CaptionCue[] = [
  { id: 'cue-1', start: 0.0, duration: 3.2, text: 'Hello, welcome to this video lesson!' },
  { id: 'cue-2', start: 3.5, duration: 3.0, text: 'Today we are practicing subtitles with automatic translation.' },
  { id: 'cue-3', start: 6.8, duration: 3.5, text: 'The player will automatically pause and speak each translation.' },
  { id: 'cue-4', start: 10.5, duration: 3.2, text: 'You can customize the speaking speed and order of languages.' },
  { id: 'cue-5', start: 14.0, duration: 3.0, text: 'Enjoy practicing and learning new languages easily!' },
];

export const SubtitlesTeacherPanel: React.FC<SubtitlesTeacherPanelProps> = ({
  cues,
  playerRef,
  onLoadCues,
}) => {
  const [targetLanguages, setTargetLanguages] = useState<TargetLanguage[]>(() => {
    try {
      const saved = localStorage.getItem('yt_teacher_languages_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure it has Italian and Arabic available
          const hasIt = parsed.some((l: any) => l.code === 'it');
          const hasAr = parsed.some((l: any) => l.code === 'ar');
          if (hasIt && hasAr) return parsed;
        }
      }
    } catch {}
    return DEFAULT_TARGET_LANGUAGES;
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

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
  const [selectedNewLang, setSelectedNewLang] = useState<string>('fr');
  const [isAddingLang, setIsAddingLang] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Persist languages and play order
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

  const effectiveCues = cues && cues.length > 0 ? cues : [];

  const {
    activeCueIndex,
    isSyncActive,
    isSpeaking,
    currentTTSLang,
    currentTTSText,
    translations,
    ttsEngineType,
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
  });

  // Reordering helpers (Move Up / Move Down)
  const moveLanguageUp = (index: number) => {
    if (index === 0) return;
    setTargetLanguages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const moveLanguageDown = (index: number) => {
    if (index >= targetLanguages.length - 1) return;
    setTargetLanguages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const updateLanguageRate = (id: string, newRate: number) => {
    setTargetLanguages((prev) =>
      prev.map((lang) => (lang.id === id ? { ...lang, ttsRate: Math.max(0.4, Math.min(2.5, newRate)) } : lang))
    );
  };

  const toggleLanguageEnabled = (id: string) => {
    setTargetLanguages((prev) =>
      prev.map((lang) => (lang.id === id ? { ...lang, enabled: !lang.enabled } : lang))
    );
  };

  const removeLanguage = (id: string) => {
    setTargetLanguages((prev) => prev.filter((lang) => lang.id !== id));
  };

  const handleAddLanguage = () => {
    const info = SUPPORTED_TARGET_LANGUAGES.find((l) => l.code === selectedNewLang);
    if (!info) return;

    if (targetLanguages.some((l) => l.code === info.code)) {
      return;
    }

    const newLang: TargetLanguage = {
      id: `lang-${info.code}-${Date.now()}`,
      code: info.code,
      name: info.name,
      ttsRate: 1.0,
      enabled: true,
      color: info.color,
    };

    setTargetLanguages((prev) => [...prev, newLang]);
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

      const lines = content.split(/\r?\n/);
      const parsedCues: CaptionCue[] = [];
      let idx = 1;

      // Simple SRT parser
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
            textLines.push(lines[i].trim().replace(/<[^>]+>/g, ''));
            i++;
          }
          const text = textLines.join(' ');
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
    reader.readAsText(file);
  };

  const currentCue =
    activeCueIndex >= 0 && activeCueIndex < effectiveCues.length
      ? effectiveCues[activeCueIndex]
      : effectiveCues.length > 0
      ? effectiveCues[0]
      : null;

  return (
    <div className="w-full rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl overflow-hidden flex flex-col">
      {/* Top Banner & Mode Header */}
      <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-900">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
              <span>Subtitles Teacher &amp; Time-Sync TTS</span>
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                Interactive Learning
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Pauses YouTube video at each subtitle record, speaks target translations via TTS, and automatically resumes playback.
            </p>
          </div>
        </div>

        {/* TTS Engine Detection Status */}
        <div className="flex items-center gap-2">
          {isAndroidNativeTTS() ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-emerald-400 text-xs font-medium">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Native TTS Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/40 text-blue-300 text-xs font-medium">
              <Globe className="w-3.5 h-3.5" />
              <span>Web Speech TTS Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Control Center */}
      <div className="p-4 sm:p-5 flex flex-col gap-5">
        {/* Sync Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
          {/* Master Play / Pause / Skip */}
          <div className="flex items-center gap-2">
            <button
              id="sync-teacher-play-button"
              type="button"
              disabled={effectiveCues.length === 0}
              onClick={() => {
                if (isSyncActive) {
                  pauseSync();
                } else {
                  startSync();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                isSyncActive
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
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
              disabled={effectiveCues.length === 0 || activeCueIndex <= 0}
              onClick={prevCue}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Subtitle Cue"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={effectiveCues.length === 0 || activeCueIndex >= effectiveCues.length - 1}
              onClick={nextCue}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Subtitle Cue"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Real-time Status Indicator */}
          <div className="flex items-center gap-3 text-xs">
            {effectiveCues.length > 0 ? (
              <span className="text-neutral-400 font-mono">
                Cue <span className="text-neutral-100 font-semibold">{activeCueIndex >= 0 ? activeCueIndex + 1 : 1}</span> of {effectiveCues.length}
              </span>
            ) : (
              <span className="text-amber-400">No subtitles loaded yet</span>
            )}

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
        </div>

        {/* Section 1: Play Order & Source Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Order of playing: Video First vs TTS First */}
          <div className="p-3.5 rounded-xl bg-neutral-950/40 border border-neutral-800 flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Segment Playback Order</span>
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">sync order</span>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                id="play-order-video-first-button"
                data-testid="play-order-video-first-button"
                onClick={() => setPlayOrder('video_first')}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex flex-col items-start gap-1 text-left ${
                  playOrder === 'video_first'
                    ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-sm'
                    : 'bg-neutral-800/60 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <span className="font-semibold flex items-center gap-1">
                  <span>1. Video First</span>
                  {playOrder === 'video_first' && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                </span>
                <span className="text-[10px] text-neutral-400">
                  Plays clip &rarr; Pauses &rarr; TTS translates &rarr; Resumes
                </span>
              </button>

              <button
                type="button"
                id="play-order-tts-first-button"
                data-testid="play-order-tts-first-button"
                onClick={() => setPlayOrder('tts_first')}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex flex-col items-start gap-1 text-left ${
                  playOrder === 'tts_first'
                    ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/50 shadow-sm'
                    : 'bg-neutral-800/60 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <span className="font-semibold flex items-center gap-1">
                  <span>2. TTS First</span>
                  {playOrder === 'tts_first' && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                </span>
                <span className="text-[10px] text-neutral-400">
                  TTS translates &rarr; Plays video clip &rarr; Next
                </span>
              </button>
            </div>
          </div>

          {/* Subtitle Source & Samples */}
          <div className="p-3.5 rounded-xl bg-neutral-950/40 border border-neutral-800 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Subtitle Source ({effectiveCues.length} cues)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="load-sample-cues-button"
                  data-testid="load-sample-cues-button"
                  onClick={handleLoadSample}
                  className="text-[11px] px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                  title="Load test practice subtitles"
                >
                  Load Sample Cues
                </button>
                <label className="cursor-pointer text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Upload .SRT</span>
                  <input
                    type="file"
                    accept=".srt,.vtt,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span>Detected from: {cues && cues.length > 0 ? 'YouTube TimedText / Intercepted Stream' : 'None yet (click Load Sample or turn on Captions)'}</span>
              {effectiveCues.length > 0 && (
                <span className="text-emerald-400 font-medium">Ready to Sync</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Target Translation Languages & Per-Language TTS Rate & Playback Order */}
        <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <span>Target Translation Languages</span>
                <span className="text-[11px] text-neutral-400 font-normal">
                  (Played sequentially in the order listed below)
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Configure target languages, individual speaking rates, voice selection, and playback sequence.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="preset-italian-arabic-button"
                data-testid="preset-italian-arabic-button"
                onClick={() => {
                  setTargetLanguages([
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
                  ]);
                }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-800/60 transition flex items-center gap-1 font-medium"
                title="Quick Setup: Italian & Arabic for language practice"
              >
                <span>Preset: Italian + Arabic</span>
              </button>

              {isAddingLang ? (
                <div className="flex items-center gap-2">
                  <select
                    id="add-target-language-select"
                    data-testid="add-target-language-select"
                    value={selectedNewLang}
                    onChange={(e) => setSelectedNewLang(e.target.value)}
                    className="text-xs bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    {SUPPORTED_TARGET_LANGUAGES.filter(
                      (l) => !targetLanguages.some((tl) => tl.code === l.code)
                    ).map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    id="confirm-add-target-language-button"
                    data-testid="confirm-add-target-language-button"
                    onClick={handleAddLanguage}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingLang(false)}
                    className="px-2 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="add-target-language-button"
                  data-testid="add-target-language-button"
                  onClick={() => setIsAddingLang(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Target Language</span>
                </button>
              )}
            </div>
          </div>

          {/* List of Target Languages with Reordering, Rate Sliders, and Voice Dropdown */}
          <div className="flex flex-col gap-2.5 mt-1" id="target-languages-list" data-testid="target-languages-list">
            {targetLanguages.map((lang, index) => (
              <div
                key={lang.id}
                id={`target-language-card-${lang.code}`}
                data-testid={`target-language-card-${lang.code}`}
                className={`p-3 rounded-xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                  lang.enabled
                    ? currentTTSLang === lang.code
                      ? 'bg-indigo-950/30 border-indigo-500/60 ring-1 ring-indigo-500/40'
                      : 'bg-neutral-900 border-neutral-800'
                    : 'bg-neutral-900/40 border-neutral-800/40 opacity-60'
                }`}
              >
                {/* Left: Sequence badge, Enable Checkbox, Language Label & Reorder Arrows */}
                <div className="flex items-center gap-3">
                  {/* Sequence Order Badge */}
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-xs font-bold text-neutral-300 font-mono">
                    {index + 1}
                  </span>

                  {/* Reorder Buttons: Up & Down */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveLanguageUp(index)}
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      title="Move Up in Playback Sequence"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === targetLanguages.length - 1}
                      onClick={() => moveLanguageDown(index)}
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      title="Move Down in Playback Sequence"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Toggle enable */}
                  <input
                    type="checkbox"
                    checked={lang.enabled}
                    onChange={() => toggleLanguageEnabled(lang.id)}
                    className="w-4 h-4 rounded text-indigo-600 bg-neutral-800 border-neutral-700 focus:ring-0 cursor-pointer"
                    title={lang.enabled ? 'Disable Language' : 'Enable Language'}
                  />

                  {/* Language Title & Code */}
                  <div>
                    <div className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
                      <span>{lang.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono text-[10px]">
                        {lang.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Sequential TTS Voice {index + 1}
                    </div>
                  </div>
                </div>

                {/* Right: Voice Selection, TTS Playback Rate Slider & Actions */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {/* Voice Selection Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-neutral-400 whitespace-nowrap">Voice:</span>
                    <select
                      id={`tts-voice-select-${lang.code}`}
                      data-testid={`tts-voice-select-${lang.code}`}
                      value={lang.voice || ''}
                      disabled={!lang.enabled}
                      onChange={(e) => updateLanguageVoice(lang.id, e.target.value)}
                      className="text-xs bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 max-w-[135px] truncate"
                    >
                      <option value="">Default Voice</option>
                      {getVoicesForLang(lang.code).length > 0 ? (
                        getVoicesForLang(lang.code).map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value={`System-${lang.code}-1`}>Natural {lang.code.toUpperCase()} 1</option>
                          <option value={`System-${lang.code}-2`}>Studio {lang.code.toUpperCase()} 2</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* TTS Rate Controls */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-neutral-400 whitespace-nowrap">Rate:</span>
                    <input
                      id={`tts-rate-slider-${lang.code}`}
                      data-testid={`tts-rate-slider-${lang.code}`}
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={lang.ttsRate}
                      disabled={!lang.enabled}
                      onChange={(e) => updateLanguageRate(lang.id, parseFloat(e.target.value))}
                      className="w-20 sm:w-24 accent-indigo-500 cursor-pointer"
                    />
                    <span
                      id={`tts-rate-value-${lang.code}`}
                      data-testid={`tts-rate-value-${lang.code}`}
                      className="text-xs font-mono font-medium text-indigo-300 w-9 text-right"
                    >
                      {lang.ttsRate.toFixed(1)}x
                    </span>
                  </div>

                  {/* Test Speak Button */}
                  <button
                    type="button"
                    id={`test-speak-button-${lang.code}`}
                    data-testid={`test-speak-button-${lang.code}`}
                    onClick={() => {
                      const testCue = currentCue || effectiveCues[0] || {
                        id: 'test',
                        start: 0,
                        duration: 2,
                        text: 'Hello, testing speech translation.',
                      };
                      testSpeakLang(testCue, lang);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 text-xs transition"
                    title="Test Voice Preview"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Test</span>
                  </button>

                  {/* Remove Button */}
                  {targetLanguages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLanguage(lang.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition"
                      title="Remove Language"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Active Subtitle Preview & Full Segment Cue List */}
        <div className="flex flex-col gap-3">
          {/* Active Highlight Card */}
          {currentCue && (
            <div
              id="active-subtitle-card"
              data-testid="active-subtitle-card"
              className="p-4 rounded-xl bg-gradient-to-r from-neutral-900 to-indigo-950/20 border border-indigo-500/30 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="flex items-center gap-1.5 font-mono text-indigo-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {formatTimestamp(currentCue.start)} &rarr; {formatTimestamp(currentCue.start + (currentCue.duration || 2))}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 font-semibold text-[11px]">
                  Active Segment
                </span>
              </div>

              {/* Original Subtitle Text */}
              <p
                id="active-subtitle-cue-text"
                data-testid="active-subtitle-cue-text"
                className="text-sm font-medium text-neutral-100 leading-relaxed"
              >
                "{currentCue.text}"
              </p>

              {/* Live Translations for Active Cue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1" id="active-translations-grid" data-testid="active-translations-grid">
                {targetLanguages.filter((l) => l.enabled).map((lang) => {
                  const translated = translations[currentCue.id]?.[lang.code] || 'Translating…';
                  const isCurrentLangSpeaking = isSpeaking && currentTTSLang === lang.code;

                  return (
                    <div
                      key={lang.id}
                      id={`active-translation-${lang.code}`}
                      data-testid={`active-translation-${lang.code}`}
                      className={`p-2 rounded-lg text-xs border transition ${
                        isCurrentLangSpeaking
                          ? 'bg-indigo-900/40 border-indigo-400 text-indigo-200'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[11px] text-neutral-400">{lang.name}:</span>
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
                      <p data-testid={`translation-text-${lang.code}`} className="text-neutral-200">{translated}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search & All Cues Interactive Table */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-300">
                All Subtitle Segments ({effectiveCues.length})
              </span>
              <input
                type="text"
                placeholder="Filter subtitles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-neutral-950 text-neutral-200 border border-neutral-800 rounded-lg px-2.5 py-1 w-44 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950/60 divide-y divide-neutral-900">
              {effectiveCues.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
                  <span>No subtitle segments currently loaded.</span>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition"
                  >
                    Load Sample Practice Cues
                  </button>
                </div>
              ) : (
                effectiveCues
                  .filter((cue) =>
                    cue.text.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((cue, idx) => {
                    const isSelected = activeCueIndex === idx;

                    return (
                      <div
                        key={cue.id}
                        id={`subtitle-cue-row-${idx}`}
                        data-testid={`subtitle-cue-row-${idx}`}
                        data-cue-id={cue.id}
                        onClick={() => jumpToCue(idx)}
                        className={`p-2.5 flex items-start justify-between gap-3 text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-950/40 text-indigo-200'
                            : 'hover:bg-neutral-900/70 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1">
                          <span className="font-mono text-neutral-500 text-[11px] pt-0.5 whitespace-nowrap">
                            {formatTimestamp(cue.start)}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-neutral-200">{cue.text}</p>
                            {/* Translations preview */}
                            <div className="flex flex-wrap gap-2 mt-1">
                              {targetLanguages.filter((l) => l.enabled).map((lang) => {
                                const trans = translations[cue.id]?.[lang.code];
                                if (!trans) return null;
                                return (
                                  <span
                                    key={lang.id}
                                    className="text-[10px] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800"
                                  >
                                    <strong className="text-neutral-300">{lang.code}:</strong> {trans}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToCue(idx);
                          }}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition"
                        >
                          Jump
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
