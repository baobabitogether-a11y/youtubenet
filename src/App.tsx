import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { LinkInputBar } from './components/LinkInputBar';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoHistory } from './components/VideoHistory';
import { CaptionsInspector } from './components/CaptionsInspector';
import { SubtitlesTeacherPanel } from './components/SubtitlesTeacherPanel';
import { ApkGuideModal } from './components/ApkGuideModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { usePWAInstall } from './hooks/usePWAInstall';
import {
  VideoItem,
  InterceptedCaptionData,
  ParsedYouTubeResult,
  YouTubeFormatType,
  YouTubePlayerHandle,
  CaptionCue,
} from './types';
import { DEFAULT_VIDEO_ID, DEFAULT_VIDEO_URL, parseYouTubeUrl } from './utils/youtube';
import { parseRawCaptionData } from './utils/captionParser';

const STORAGE_KEY = 'yt_viewer_history_v1';

export default function App() {
  const [videoId, setVideoId] = useState<string>(DEFAULT_VIDEO_ID);
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_VIDEO_URL);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [detectedFormat, setDetectedFormat] = useState<YouTubeFormatType | undefined>('standard_watch');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [isApkGuideOpen, setIsApkGuideOpen] = useState<boolean>(false);
  const [interceptedData, setInterceptedData] = useState<InterceptedCaptionData | null>(null);
  const [customCues, setCustomCues] = useState<CaptionCue[] | null>(null);
  const [isNativeShell, setIsNativeShell] = useState<boolean>(false);

  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  const [history, setHistory] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore
    }
    return [
      {
        id: DEFAULT_VIDEO_ID,
        originalUrl: DEFAULT_VIDEO_URL,
        timestamp: Date.now(),
      },
    ];
  });

  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Detect Android Native Shell bridge & register global listener
  useEffect(() => {
    if (typeof window !== 'undefined' && window.AndroidNativeShell?.isNativeShell?.()) {
      setIsNativeShell(true);
    }

    // Listener called by Android MainActivity.kt evaluateJavascript
    window.onNativeCaptionsInterceptedBase64 = (base64Payload: string) => {
      try {
        const decodedString = atob(base64Payload);
        const payload = JSON.parse(decodedString);
        const { format, cues } = parseRawCaptionData(payload.rawData || '');

        const data: InterceptedCaptionData = {
          id: `native-${Date.now()}`,
          url: payload.url || 'https://www.youtube.com/api/timedtext',
          videoId,
          timestamp: payload.timestamp || Date.now(),
          method: 'GET',
          status: payload.status || 200,
          contentType: payload.contentType || 'text/xml',
          format,
          rawData: payload.rawData || '',
          bytes: payload.bytes || payload.rawData?.length || 0,
          cues,
          source: 'native_webview_interceptor',
        };

        setInterceptedData(data);
        if (window.AndroidNativeShell?.showToast) {
          window.AndroidNativeShell.showToast(`Intercepted ${cues.length} caption cues!`);
        }
      } catch (err) {
        console.error('Error processing native intercepted caption:', err);
      }
    };

    return () => {
      delete window.onNativeCaptionsInterceptedBase64;
    };
  }, [videoId]);

  // Persist history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  const handleSelectVideo = (newId: string, rawUrl: string, parsedInfo?: ParsedYouTubeResult) => {
    setVideoId(newId);
    setCurrentUrl(rawUrl);
    setStartTime(parsedInfo?.startTime);
    setDetectedFormat(parsedInfo?.formatType || 'standard_watch');

    setHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== newId);
      const updated: VideoItem = {
        id: newId,
        originalUrl: rawUrl,
        timestamp: Date.now(),
      };
      return [updated, ...filtered.slice(0, 19)];
    });
  };

  const handleHistorySelect = (item: VideoItem) => {
    const parsed = parseYouTubeUrl(item.originalUrl);
    setVideoId(item.id);
    setCurrentUrl(item.originalUrl);
    setStartTime(parsed?.startTime);
    setDetectedFormat(parsed?.formatType || 'standard_watch');
  };

  const handleRemoveHistoryItem = (idToRemove: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleSimulateCaption = (raw: string, format: 'xml' | 'json3') => {
    const { cues } = parseRawCaptionData(raw);
    const data: InterceptedCaptionData = {
      id: `sim-${Date.now()}`,
      url: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ru&fmt=${format === 'json3' ? 'json3' : 'srv3'}&sparams=caps,expire,v`,
      videoId,
      timestamp: Date.now(),
      method: 'GET',
      status: 200,
      contentType: format === 'json3' ? 'application/json; charset=utf-8' : 'text/xml; charset=utf-8',
      format,
      rawData: raw,
      bytes: new Blob([raw]).size,
      cues,
      source: 'simulated_test',
    };
    setInterceptedData(data);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-red-500/30 selection:text-red-200">
      <Navbar
        onOpenApkGuide={() => setIsApkGuideOpen(true)}
        isInstallable={isInstallable}
        onInstall={install}
        isInstalled={isInstalled}
      />

      <main className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-6">
        <div
          className={`w-full transition-all duration-300 ${
            theaterMode ? 'max-w-6xl' : 'max-w-4xl'
          } flex flex-col gap-5`}
        >
          {/* Link paste & submit bar */}
          <LinkInputBar
            currentUrl={currentUrl}
            onSelectVideo={handleSelectVideo}
          />

          {/* Main Video Player */}
          <VideoPlayer
            ref={playerRef}
            videoId={videoId}
            originalUrl={currentUrl}
            theaterMode={theaterMode}
            onToggleTheater={() => setTheaterMode(!theaterMode)}
            startTime={startTime}
            detectedFormat={detectedFormat}
          />

          {/* Subtitles Teacher & Time-Sync TTS Controller */}
          <SubtitlesTeacherPanel
            cues={customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || [])}
            playerRef={playerRef}
            onLoadCues={(newCues) => setCustomCues(newCues)}
          />

          {/* Network Traffic & Captions Inspector (Option 2) */}
          <CaptionsInspector
            interceptedData={interceptedData}
            onSimulate={handleSimulateCaption}
            onClear={() => setInterceptedData(null)}
            isNativeShell={isNativeShell}
          />

          {/* History of viewed videos */}
          <VideoHistory
            history={history}
            activeVideoId={videoId}
            onSelect={handleHistorySelect}
            onRemove={handleRemoveHistoryItem}
            onClear={handleClearHistory}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 py-4 px-6 text-center text-xs text-neutral-500 flex flex-wrap items-center justify-center gap-4">
        <span>YouTube Video Viewer</span>
        <span>•</span>
        <button
          onClick={() => setIsApkGuideOpen(true)}
          className="hover:text-neutral-300 underline underline-offset-2 transition text-red-400"
        >
          Option 2: Native Android APK Shell Project &amp; Source
        </button>
      </footer>

      {/* APK & Android Installation Modal with Option 2 Interceptor Project */}
      <ApkGuideModal
        isOpen={isApkGuideOpen}
        onClose={() => setIsApkGuideOpen(false)}
        isInstallable={isInstallable}
        onInstall={install}
      />

      {/* Network offline warning */}
      <OfflineIndicator />
    </div>
  );
}
