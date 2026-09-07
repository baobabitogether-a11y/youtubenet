import React, { useState, useMemo } from 'react';
import {
  Clipboard,
  Play,
  X,
  RotateCcw,
  Link2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FolderHeart,
  Share2,
} from 'lucide-react';
import {
  parseYouTubeUrl,
  formatTypeName,
  DEFAULT_VIDEO_URL,
  SAMPLE_YOUTUBE_URL_FORMATS,
  validateYouTubeUrl,
} from '../utils/youtube';
import { ParsedYouTubeResult } from '../types';
import { formatTimestamp } from '../utils/captionParser';

interface LinkInputBarProps {
  currentUrl: string;
  onSelectVideo: (videoId: string, rawUrl: string, parsedInfo?: ParsedYouTubeResult) => void;
  onOpenLibrary?: () => void;
  onOpenShare?: () => void;
  libraryCount?: number;
}

export const LinkInputBar: React.FC<LinkInputBarProps> = ({
  currentUrl,
  onSelectVideo,
  onOpenLibrary,
  onOpenShare,
  libraryCount,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showFormatsTray, setShowFormatsTray] = useState(false);

  // Real-time parsed result of current input
  const liveParsed = useMemo(() => {
    const text = inputValue.trim();
    if (!text) return null;
    return parseYouTubeUrl(text);
  }, [inputValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const target = inputValue.trim() || currentUrl;
    if (!target) {
      setError('Please paste a YouTube link or video ID');
      return;
    }

    const validation = validateYouTubeUrl(target);
    if (!validation.isValid || !validation.parsed) {
      setError(
        validation.error ||
          'Could not recognize a YouTube video in the provided text. The app only supports YouTube links.'
      );
      return;
    }

    onSelectVideo(validation.parsed.videoId, target, validation.parsed);
    setInputValue('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputValue(text);
        setError(null);
        // Auto-play if immediately recognized as YouTube
        const validation = validateYouTubeUrl(text);
        if (validation.isValid && validation.parsed) {
          onSelectVideo(validation.parsed.videoId, text, validation.parsed);
          setInputValue('');
        } else if (text.trim().startsWith('http')) {
          // If pasted a non-YouTube link, complain immediately!
          setError(
            validation.error || 'The pasted link is not a YouTube link. Only YouTube links can be played.'
          );
        }
      }
    } catch {
      setError('Clipboard access denied. Please paste manually into the input box.');
    }
  };

  const handleLoadDefault = () => {
    setError(null);
    setInputValue('');
    const parsed = parseYouTubeUrl(DEFAULT_VIDEO_URL);
    if (parsed) {
      onSelectVideo(parsed.videoId, DEFAULT_VIDEO_URL, parsed);
    }
  };

  const handleSelectSampleFormat = (sampleUrl: string) => {
    setError(null);
    setInputValue(sampleUrl);
    const parsed = parseYouTubeUrl(sampleUrl);
    if (parsed) {
      onSelectVideo(parsed.videoId, sampleUrl, parsed);
      setInputValue('');
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative flex items-center w-full rounded-2xl bg-neutral-900 border border-neutral-700/80 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 transition-all shadow-inner">
          <div className="pl-4 pr-2 text-neutral-400 shrink-0">
            <Link2 className="w-5 h-5" />
          </div>

          <input
            id="youtube-url-input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste any YouTube URL (watch, youtu.be, shorts, live, embed, iframe, timestamp, etc.)"
            className="w-full py-3.5 bg-transparent text-neutral-100 placeholder-neutral-500 text-xs sm:text-sm md:text-base focus:outline-none"
          />

          <div className="flex items-center gap-1.5 pr-2 shrink-0">
            {inputValue && (
              <button
                type="button"
                id="clear-input-button"
                onClick={() => {
                  setInputValue('');
                  setError(null);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              id="paste-clipboard-button"
              onClick={handlePaste}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 hover:text-white transition"
              title="Paste from clipboard"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paste</span>
            </button>

            <button
              type="submit"
              id="play-video-button"
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-medium transition shadow-md shadow-red-600/20 active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play</span>
            </button>
          </div>
        </div>

        {/* Live validation preview badge */}
        {liveParsed && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs animate-fade-in">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Recognized:
            </span>
            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-200 font-semibold text-[11px] border border-neutral-700">
              {formatTypeName(liveParsed.formatType)}
            </span>
            <span className="font-mono text-neutral-400 text-[11px]">
              ID: <span className="text-neutral-200">{liveParsed.videoId}</span>
            </span>
            {liveParsed.startTime !== undefined && (
              <span className="flex items-center gap-1 text-amber-400 text-[11px] bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                <Clock className="w-3 h-3" />
                Starts at {formatTimestamp(liveParsed.startTime)} ({liveParsed.startTime}s)
              </span>
            )}
            {liveParsed.listId && (
              <span className="text-purple-400 text-[11px] bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40">
                Playlist Attached
              </span>
            )}
          </div>
        )}

        {/* Error message if invalid URL */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs sm:text-sm px-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick controls row */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            {onOpenShare && (
              <button
                type="button"
                id="linkbar-share-link-button"
                data-testid="linkbar-share-link-button"
                onClick={onOpenShare}
                className="inline-flex items-center gap-1.5 text-red-200 hover:text-white bg-red-950/70 hover:bg-red-900 px-3 py-1.5 rounded-lg border border-red-800/60 transition text-xs font-semibold shadow-sm active:scale-95"
                title="Share link with the app"
              >
                <Share2 className="w-3.5 h-3.5 text-red-400" />
                <span>Share Link with App</span>
              </button>
            )}

            {onOpenLibrary && (
              <button
                type="button"
                id="open-library-button"
                data-testid="open-library-button"
                onClick={onOpenLibrary}
                className="inline-flex items-center gap-1.5 text-indigo-200 hover:text-white bg-indigo-950/70 hover:bg-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-800/60 transition text-xs font-medium shadow-sm"
                title="Open cached video and subtitles library"
              >
                <FolderHeart className="w-3.5 h-3.5 text-indigo-400" />
                <span>My Library {libraryCount !== undefined ? `(${libraryCount})` : ''}</span>
              </button>
            )}
          </div>

          <span className="text-[11px] text-neutral-500 hidden sm:inline">
            Paste any YouTube URL or video ID (standard, shorts, embed, timestamped)
          </span>
        </div>
      </form>
    </div>
  );
};
