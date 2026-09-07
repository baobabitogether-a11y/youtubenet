import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { LinkInputBar } from './components/LinkInputBar';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitlesTeacherPanel } from './components/SubtitlesTeacherPanel';
import { VideoLibraryModal } from './components/VideoLibraryModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  VideoItem,
  LibraryVideoItem,
  InterceptedCaptionData,
  ParsedYouTubeResult,
  YouTubeFormatType,
  YouTubePlayerHandle,
  CaptionCue,
} from './types';
import { DEFAULT_VIDEO_ID, DEFAULT_VIDEO_URL, parseYouTubeUrl } from './utils/youtube';
import { parseRawCaptionData, decodeBase64ToUtf8, cleanAndFixEncoding, fixMojibake } from './utils/captionParser';

const LIBRARY_STORAGE_KEY = 'yt_video_library_v2';

const DEFAULT_LIBRARY_ITEMS: LibraryVideoItem[] = [
  {
    id: 'jNQXAC9IVRw',
    originalUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    title: 'Me at the zoo',
    cues: [
      { id: 'cue-1', start: 1.2, duration: 3.2, text: 'All right, so here we are in front of the elephants.' },
      { id: 'cue-2', start: 4.5, duration: 3.0, text: 'The cool thing about these guys is that...' },
      { id: 'cue-3', start: 7.6, duration: 3.5, text: '...they have really, really, really long trunks.' },
      { id: 'cue-4', start: 11.2, duration: 2.8, text: 'And that is cool.' },
      { id: 'cue-5', start: 14.1, duration: 4.2, text: 'And that is pretty much all there is to say.' },
    ],
    timestamp: Date.now(),
  },
];

export default function App() {
  const [videoId, setVideoId] = useState<string>(DEFAULT_VIDEO_ID);
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_VIDEO_URL);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [detectedFormat, setDetectedFormat] = useState<YouTubeFormatType | undefined>('standard_watch');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [interceptedData, setInterceptedData] = useState<InterceptedCaptionData | null>(null);
  const [customCues, setCustomCues] = useState<CaptionCue[] | null>(() => {
    return DEFAULT_LIBRARY_ITEMS[0].cues || null;
  });
  const [isFetchingSubtitles, setIsFetchingSubtitles] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const playerRef = useRef<YouTubePlayerHandle | null>(null);

  // Cached Video and Subtitle Library
  const [library, setLibrary] = useState<LibraryVideoItem[]>(() => {
    try {
      const saved = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    return DEFAULT_LIBRARY_ITEMS;
  });

  // Fetch Subtitles from backend
  const handleFetchSubtitles = async (targetId?: string) => {
    const idToFetch = targetId || videoId;
    if (!idToFetch) return;

    // Check if already in library with non-empty cues
    const cachedItem = library.find((item) => item.id === idToFetch);
    if (cachedItem && cachedItem.cues && cachedItem.cues.length > 0) {
      setCustomCues(cachedItem.cues);
      return;
    }

    setIsFetchingSubtitles(true);
    setFetchError(null);

    try {
      const res = await fetch('/api/fetch-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: idToFetch }),
      });

      const data = await res.json();
      if (!res.ok || !data.cues || data.cues.length === 0) {
        throw new Error(data.error || 'No subtitles found for this video.');
      }

      // Ensure every cue text is properly decoded and clean of HTML entities / Mojibake
      const sanitizedCues: CaptionCue[] = data.cues.map((c: CaptionCue) => ({
        ...c,
        text: cleanAndFixEncoding(c.text),
      }));

      setCustomCues(sanitizedCues);

      // Auto-cache into library
      setLibrary((prev) => {
        const existing = prev.find((item) => item.id === idToFetch);
        if (existing) {
          return prev.map((item) =>
            item.id === idToFetch ? { ...item, cues: sanitizedCues } : item
          );
        }
        const newItem: LibraryVideoItem = {
          id: idToFetch,
          originalUrl: currentUrl,
          title: `Video ${idToFetch}`,
          cues: sanitizedCues,
          timestamp: Date.now(),
        };
        return [newItem, ...prev];
      });
    } catch (err: any) {
      console.warn('Subtitles fetch error:', err);
      setFetchError(err.message || 'Failed to fetch subtitles.');
    } finally {
      setIsFetchingSubtitles(false);
    }
  };

  // Detect Android Native Shell bridge & register global listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.onNativeCaptionsInterceptedBase64 = (base64Payload: string) => {
        try {
          // Robust UTF-8 Base64 decoding (prevents ASCII/Latin-1 character corruption)
          const decodedString = decodeBase64ToUtf8(base64Payload);
          const payload = JSON.parse(decodedString);
          
          // Ensure rawData is properly decoded and parsed
          const cleanRawData = fixMojibake(payload.rawData || '');
          const { format, cues } = parseRawCaptionData(cleanRawData);

          const data: InterceptedCaptionData = {
            id: `native-${Date.now()}`,
            url: payload.url || 'https://www.youtube.com/api/timedtext',
            videoId,
            timestamp: payload.timestamp || Date.now(),
            method: 'GET',
            status: payload.status || 200,
            contentType: payload.contentType || 'text/xml',
            format,
            rawData: cleanRawData,
            bytes: payload.bytes || cleanRawData.length || 0,
            cues,
            source: 'native_webview_interceptor',
          };

          setInterceptedData(data);
          if (cues.length > 0) {
            setCustomCues(cues);
          }
        } catch (err) {
          console.error('Error processing native intercepted caption:', err);
        }
      };
    }

    return () => {
      delete window.onNativeCaptionsInterceptedBase64;
    };
  }, [videoId]);

  // Persist library
  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    } catch {
      // Ignore
    }
  }, [library]);

  // Flow Step 1: User inputs video URL
  const handleSelectVideo = (newId: string, rawUrl: string, parsedInfo?: ParsedYouTubeResult) => {
    setVideoId(newId);
    setCurrentUrl(rawUrl);
    setStartTime(parsedInfo?.startTime);
    setDetectedFormat(parsedInfo?.formatType || 'standard_watch');
    setFetchError(null);

    // Check if video is already in library with cached subtitles
    const cachedItem = library.find((item) => item.id === newId);
    if (cachedItem && cachedItem.cues && cachedItem.cues.length > 0) {
      setCustomCues(cachedItem.cues);
    } else {
      setCustomCues(null);
      setInterceptedData(null);
    }
  };

  // Flow Step 1: User loads video from library (cached videoID and subtitles)
  const handleSelectLibraryItem = (item: LibraryVideoItem) => {
    const parsed = parseYouTubeUrl(item.originalUrl);
    setVideoId(item.id);
    setCurrentUrl(item.originalUrl);
    setStartTime(parsed?.startTime);
    setDetectedFormat(parsed?.formatType || 'standard_watch');
    setFetchError(null);
    if (item.cues && item.cues.length > 0) {
      setCustomCues(item.cues);
    } else {
      setCustomCues(null);
    }
  };

  const handleSaveCurrentToLibrary = (title: string) => {
    const activeCues = customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || []);
    const newItem: LibraryVideoItem = {
      id: videoId,
      originalUrl: currentUrl,
      title: title || `Video ${videoId}`,
      cues: activeCues,
      timestamp: Date.now(),
    };

    setLibrary((prev) => {
      const filtered = prev.filter((i) => i.id !== videoId);
      return [newItem, ...filtered];
    });
  };

  const handleRemoveFromLibrary = (idToRemove: string) => {
    setLibrary((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const activeCues = customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-red-500/30 selection:text-red-200">
      <Navbar
        onOpenLibrary={() => setIsLibraryOpen(true)}
        libraryCount={library.length}
      />

      <main className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-6">
        <div
          className={`w-full transition-all duration-300 ${
            theaterMode ? 'max-w-6xl' : 'max-w-4xl'
          } flex flex-col gap-5`}
        >
          {/* Step 1: Link paste & Library Access */}
          <LinkInputBar
            currentUrl={currentUrl}
            onSelectVideo={handleSelectVideo}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            libraryCount={library.length}
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
            onFetchSubtitles={handleFetchSubtitles}
            isFetchingSubtitles={isFetchingSubtitles}
            hasSubtitles={activeCues.length > 0}
          />

          {/* Steps 2-6: Subtitles Teacher & Multi-Column Translation Workspace */}
          <SubtitlesTeacherPanel
            cues={activeCues}
            playerRef={playerRef}
            onLoadCues={(newCues) => setCustomCues(newCues)}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onFetchSubtitles={handleFetchSubtitles}
            isFetchingSubtitles={isFetchingSubtitles}
            fetchError={fetchError}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-900 py-4 px-6 text-center text-xs text-neutral-500 flex flex-wrap items-center justify-center gap-2">
        <span>YouTube Language Learning</span>
        <span>•</span>
        <span>Synchronized Subtitles &amp; Multi-Language Translation</span>
      </footer>

      {/* Video & Subtitle Library Modal */}
      <VideoLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        library={library}
        currentVideoId={videoId}
        currentCues={activeCues}
        onSelectVideo={handleSelectLibraryItem}
        onSaveCurrentToLibrary={handleSaveCurrentToLibrary}
        onRemoveFromLibrary={handleRemoveFromLibrary}
      />

      {/* Network offline warning */}
      <OfflineIndicator />
    </div>
  );
}
