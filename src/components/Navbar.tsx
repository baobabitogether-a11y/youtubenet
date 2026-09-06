import React from 'react';
import { Play, Download, Smartphone, Youtube } from 'lucide-react';

interface NavbarProps {
  onOpenApkGuide: () => void;
  isInstallable: boolean;
  onInstall: () => void;
  isInstalled: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenApkGuide,
  isInstallable,
  onInstall,
  isInstalled,
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
              YouTube Viewer
            </span>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Paste & stream any YouTube video
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Install button if browser prompt ready */}
          {isInstallable && !isInstalled && (
            <button
              id="install-pwa-button"
              onClick={onInstall}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-medium transition shadow-sm active:scale-95"
              title="Install native app on device"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
          )}

          {/* APK / Android Guide modal trigger */}
          <button
            id="open-apk-guide-button"
            onClick={onOpenApkGuide}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-neutral-700 hover:border-neutral-600 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-xs sm:text-sm font-medium transition shadow-sm active:scale-95"
            title="Download APK or Build Android App"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="hidden xs:inline">Get APK / Android</span>
            <span className="xs:hidden">APK</span>
          </button>
        </div>
      </div>
    </header>
  );
};
