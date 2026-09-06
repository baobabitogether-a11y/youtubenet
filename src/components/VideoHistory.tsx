import React from 'react';
import { History, Play, Trash2, Clock, Tag } from 'lucide-react';
import { VideoItem } from '../types';
import { getYouTubeThumbnailUrl, parseYouTubeUrl, formatTypeName } from '../utils/youtube';
import { formatTimestamp } from '../utils/captionParser';

interface VideoHistoryProps {
  history: VideoItem[];
  activeVideoId: string;
  onSelect: (item: VideoItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const VideoHistory: React.FC<VideoHistoryProps> = ({
  history,
  activeVideoId,
  onSelect,
  onRemove,
  onClear,
}) => {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-3 mt-4 pt-4 border-t border-neutral-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
          <History className="w-4 h-4 text-red-500" />
          <span>Recently Viewed ({history.length})</span>
        </div>
        <button
          id="clear-all-history-button"
          onClick={onClear}
          className="text-xs text-neutral-400 hover:text-red-400 transition flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {history.map((item) => {
          const isActive = item.id === activeVideoId;
          const parsed = parseYouTubeUrl(item.originalUrl);
          const formattedDate = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={`${item.id}-${item.timestamp}`}
              className={`group relative flex gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-neutral-800/90 border-red-500/60 shadow-md ring-1 ring-red-500/30'
                  : 'bg-neutral-900/60 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
              }`}
              onClick={() => onSelect(item)}
            >
              {/* Thumbnail with play overlay */}
              <div className="relative w-28 h-16 rounded-lg overflow-hidden shrink-0 bg-neutral-950">
                <img
                  src={getYouTubeThumbnailUrl(item.id)}
                  alt={`YouTube thumbnail for ${item.id}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Play className="w-5 h-5 text-white fill-white" />
                </div>
                {isActive && (
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white leading-none">
                    PLAYING
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col justify-between flex-1 min-w-0 pr-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-mono font-medium text-neutral-200 truncate">
                      {item.id}
                    </p>
                    {parsed && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/50">
                        {formatTypeName(parsed.formatType)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {item.originalUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formattedDate}</span>
                  </div>
                  {parsed?.startTime !== undefined && parsed.startTime > 0 && (
                    <span className="text-amber-400 font-medium">
                      @{formatTimestamp(parsed.startTime)}
                    </span>
                  )}
                </div>
              </div>

              {/* Remove single item button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="absolute top-2 right-2 p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition opacity-0 group-hover:opacity-100"
                title="Remove from history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
