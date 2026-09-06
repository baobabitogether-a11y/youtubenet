import React from 'react';
import { Youtube, Subtitles } from 'lucide-react';

interface NavbarProps {
  onOpenLibrary?: () => void;
  libraryCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLibrary,
  libraryCount,
}) => {
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

        {/* Right side: quick status / library info */}
        {onOpenLibrary && (
          <button
            type="button"
            id="navbar-library-button"
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs font-medium transition"
          >
            <Subtitles className="w-3.5 h-3.5 text-indigo-400" />
            <span>My Library {libraryCount !== undefined ? `(${libraryCount})` : ''}</span>
          </button>
        )}
      </div>
    </header>
  );
};

