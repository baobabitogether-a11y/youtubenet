import React from 'react';
import { Youtube, Subtitles, Share2, Activity, AlertTriangle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import { setNetworkInspectorOpen } from '../store/networkSlice';
import { setInspectorOpen } from '../store/errorsSlice';

interface NavbarProps {
  onOpenLibrary?: () => void;
  libraryCount?: number;
  onOpenShare?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLibrary,
  libraryCount,
  onOpenShare,
}) => {
  const dispatch = useAppDispatch();
  const { requests } = useAppSelector((state) => state.network);
  const { errors } = useAppSelector((state) => state.errors);

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20 text-white">
            <Youtube className="w-5 h-5 fill-white stroke-none" />
          </div>
          <div>
            <span className="font-semibold text-base sm:text-lg text-neutral-100 tracking-tight flex items-center gap-2">
              YouTube Language Learning
            </span>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Synchronized timed subtitles &amp; multi-language speech translation
            </p>
          </div>
        </div>

        {/* Right side: inspectors, share link & library info */}
        <div className="flex items-center gap-2">
          {/* Always accessible Network Inspector */}
          <button
            type="button"
            id="navbar-network-inspector-button"
            data-testid="navbar-network-inspector-button"
            onClick={() => dispatch(setNetworkInspectorOpen(true))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-800/60 bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 text-xs font-medium transition active:scale-95"
            title="Inspect web requests & responses"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Network</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-900/80 text-[10px] font-mono font-bold text-blue-200">
              {requests.length}
            </span>
          </button>

          {/* Always accessible Errors Inspector */}
          <button
            type="button"
            id="navbar-error-inspector-button"
            data-testid="navbar-error-inspector-button"
            onClick={() => dispatch(setInspectorOpen(true))}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition active:scale-95 ${
              errors.length > 0
                ? 'border-red-700/80 bg-red-950/60 hover:bg-red-900/80 text-red-300 animate-pulse'
                : 'border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300'
            }`}
            title="Inspect app errors & Redux state machine"
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${errors.length > 0 ? 'text-red-400' : 'text-neutral-400'}`}
            />
            <span className="hidden sm:inline">Errors</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                errors.length > 0 ? 'bg-red-600 text-white' : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              {errors.length}
            </span>
          </button>

          {onOpenShare && (
            <button
              type="button"
              id="navbar-share-link-button"
              data-testid="navbar-share-link-button"
              onClick={onOpenShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold transition active:scale-95 shadow-sm"
              title="Share a video link with the app"
            >
              <Share2 className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Share Link</span>
            </button>
          )}

          {onOpenLibrary && (
            <button
              type="button"
              id="navbar-library-button"
              onClick={onOpenLibrary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition active:scale-95"
            >
              <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Library {libraryCount !== undefined ? `(${libraryCount})` : ''}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

