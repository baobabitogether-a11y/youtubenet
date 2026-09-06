import React, { useState } from 'react';
import {
  FolderHeart,
  Play,
  Trash2,
  BookmarkPlus,
  X,
  Clock,
  Subtitles,
  ExternalLink,
  Search,
  Check,
} from 'lucide-react';
import { LibraryVideoItem, CaptionCue } from '../types';

interface VideoLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: LibraryVideoItem[];
  currentVideoId: string;
  currentCues: CaptionCue[];
  onSelectVideo: (item: LibraryVideoItem) => void;
  onSaveCurrentToLibrary: (title: string) => void;
  onRemoveFromLibrary: (id: string) => void;
}

export const VideoLibraryModal: React.FC<VideoLibraryModalProps> = ({
  isOpen,
  onClose,
  library,
  currentVideoId,
  currentCues,
  onSelectVideo,
  onSaveCurrentToLibrary,
  onRemoveFromLibrary,
}) => {
  const [search, setSearch] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const filtered = library.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase())
  );

  const isCurrentAlreadySaved = library.some((item) => item.id === currentVideoId);

  const handleSave = () => {
    const titleToUse = saveTitle.trim() || `Video ${currentVideoId}`;
    onSaveCurrentToLibrary(titleToUse);
    setSaveTitle('');
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div
      id="video-library-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="video-library-modal-card"
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderHeart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                <span>Cached Video &amp; Subtitle Library</span>
                <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-neutral-800 text-neutral-400">
                  {library.length} items
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Quickly switch between cached videos and their saved subtitle cues.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-library-modal-button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Save Current Video Action Banner */}
        <div className="p-4 bg-neutral-950/60 border-b border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-neutral-300 flex items-center gap-2">
            <span className="font-mono text-neutral-400">Active: {currentVideoId}</span>
            <span className="text-neutral-600">•</span>
            <span className="text-indigo-300 font-medium">
              {currentCues.length} subtitle cues loaded
            </span>
          </div>

          {isSaving ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Name this lesson..."
                className="text-xs bg-neutral-900 text-neutral-200 border border-neutral-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 flex-1 sm:w-48"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSaving(false)}
                className="px-2 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs transition"
              >
                Cancel
              </button>
            </div>
          ) : savedSuccess ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <Check className="w-4 h-4" />
              <span>Saved to Library!</span>
            </div>
          ) : (
            <button
              type="button"
              id="save-current-video-button"
              onClick={() => setIsSaving(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isCurrentAlreadySaved ? 'Update in Library' : 'Save Active Video & Subtitles'}</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-neutral-900/60 border-b border-neutral-800/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search saved videos or IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-950 text-neutral-200 text-xs border border-neutral-800 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Video List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No matching videos in library.
            </div>
          ) : (
            filtered.map((item) => {
              const isCurrent = item.id === currentVideoId;

              return (
                <div
                  key={item.id}
                  id={`library-item-${item.id}`}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-indigo-950/20 border-indigo-500/50 ring-1 ring-indigo-500/30'
                      : 'bg-neutral-950/40 hover:bg-neutral-800/40 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail preview */}
                    <img
                      src={`https://img.youtube.com/vi/${item.id}/mqdefault.jpg`}
                      alt={item.title}
                      className="w-16 h-10 object-cover rounded-lg bg-neutral-800 border border-neutral-700/60 flex-shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-neutral-200 truncate">
                          {item.title}
                        </h3>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Loaded
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1 font-mono">
                        <span>ID: {item.id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Subtitles className="w-3 h-3" />
                          {item.cues?.length || 0} cues cached
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      id={`load-library-video-${item.id}`}
                      onClick={() => {
                        onSelectVideo(item);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Load</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveFromLibrary(item.id)}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition"
                      title="Remove from library"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
