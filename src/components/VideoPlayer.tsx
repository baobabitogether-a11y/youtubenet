import React, { useState } from 'react';
import {
  ExternalLink,
  Share2,
  Maximize2,
  Minimize2,
  Code2,
  Check,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { getYouTubeEmbedUrl, formatTypeName } from '../utils/youtube';
import { YouTubeFormatType } from '../types';
import { formatTimestamp } from '../utils/captionParser';
import { Clock } from 'lucide-react';

interface VideoPlayerProps {
  videoId: string;
  originalUrl: string;
  theaterMode: boolean;
  onToggleTheater: () => void;
  startTime?: number;
  detectedFormat?: YouTubeFormatType;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  originalUrl,
  theaterMode,
  onToggleTheater,
  startTime,
  detectedFormat,
}) => {
  const [autoplay, setAutoplay] = useState(false);
  const [loop, setLoop] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const embedUrl = getYouTubeEmbedUrl(videoId, { autoplay, loop, startTime });
  const directWatchUrl = startTime && startTime > 0
    ? `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}s`
    : `https://www.youtube.com/watch?v=${videoId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directWatchUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyEmbed = async () => {
    const code = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Video Viewport Container */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-2xl border border-neutral-800 ring-1 ring-neutral-700/40">
        <div className="aspect-video w-full bg-neutral-950">
          <iframe
            key={`${videoId}-${autoplay}-${loop}`}
            src={embedUrl}
            title="YouTube Video Player"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      {/* Video Details & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
        {/* Left: Video ID, Format Badge & Direct Link */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
          <span className="px-2 py-1 rounded-md bg-neutral-800 font-mono text-neutral-300 border border-neutral-700/60">
            ID: {videoId}
          </span>
          {detectedFormat && (
            <span className="px-2 py-1 rounded-md bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 text-[11px] font-medium">
              {formatTypeName(detectedFormat)}
            </span>
          )}
          {startTime !== undefined && startTime > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-950/40 text-amber-400 border border-amber-800/40 text-[11px] font-medium">
              <Clock className="w-3 h-3" />
              <span>Starts @ {formatTimestamp(startTime)}</span>
            </span>
          )}
          <a
            id="open-in-youtube-link"
            href={directWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-red-400 hover:text-red-300 transition hover:underline ml-1"
          >
            <span>Watch on YouTube</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Right: Controls & Sharing */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Autoplay toggle */}
          <button
            id="toggle-autoplay-button"
            type="button"
            onClick={() => setAutoplay(!autoplay)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              autoplay
                ? 'bg-red-600/20 text-red-300 border-red-500/50'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
            }`}
            title="Toggle autoplay"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autoplay: {autoplay ? 'ON' : 'OFF'}</span>
          </button>

          {/* Loop toggle */}
          <button
            id="toggle-loop-button"
            type="button"
            onClick={() => setLoop(!loop)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              loop
                ? 'bg-red-600/20 text-red-300 border-red-500/50'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
            }`}
            title="Toggle loop playback"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Loop: {loop ? 'ON' : 'OFF'}</span>
          </button>

          {/* Theater mode toggle */}
          <button
            id="toggle-theater-mode-button"
            type="button"
            onClick={onToggleTheater}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              theaterMode
                ? 'bg-neutral-700 text-neutral-100 border-neutral-600'
                : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-neutral-100'
            }`}
            title={theaterMode ? 'Exit theater mode' : 'Enter theater mode'}
          >
            {theaterMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Normal</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Theater</span>
              </>
            )}
          </button>

          {/* Copy link */}
          <button
            id="copy-video-link-button"
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 border border-neutral-700 transition"
            title="Copy watch link"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          {/* Copy embed code */}
          <button
            id="copy-embed-code-button"
            type="button"
            onClick={handleCopyEmbed}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 border border-neutral-700 transition"
            title="Copy iframe embed snippet"
          >
            {copiedEmbed ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied Embed</span>
              </>
            ) : (
              <>
                <Code2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Embed</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
