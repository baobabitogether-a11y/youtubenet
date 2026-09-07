import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LinkInputBar } from './components/LinkInputBar';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitlesTeacherPanel } from './components/SubtitlesTeacherPanel';
import { VideoLibraryModal } from './components/VideoLibraryModal';
import { ShareLinkModal } from './components/ShareLinkModal';
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
import {
  DEFAULT_VIDEO_ID,
  DEFAULT_VIDEO_URL,
  parseYouTubeUrl,
  validateYouTubeUrl,
} from './utils/youtube';
import {
  parseRawCaptionData,
  decodeBase64ToUtf8,
  cleanAndFixEncoding,
  fixMojibake,
} from './utils/captionParser';
import {
  getCachedSubtitles,
  saveCachedSubtitles,
  hasCachedSubtitles,
  getLastActiveVideo,
  saveLastActiveVideo,
  getObservedTimedTextUrl,
  saveObservedTimedTextUrl,
} from './utils/subtitleCache';
import { ShieldAlert, CheckCircle2, Subtitles, X, RefreshCw } from 'lucide-react';

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
  // Determine initial video ID and URL
  const [videoId, setVideoId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get('url') || params.get('text') || params.get('link') || params.get('share') || params.get('v');
      if (sharedUrl) {
        const validation = validateYouTubeUrl(sharedUrl);
        if (validation.isValid && validation.parsed) {
          return validation.parsed.videoId;
        }
      }
      const lastActive = getLastActiveVideo();
      if (lastActive && lastActive.videoId) {
        return lastActive.videoId;
      }
    }
    return DEFAULT_VIDEO_ID;
  });

  const [currentUrl, setCurrentUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get('url') || params.get('text') || params.get('link') || params.get('share') || params.get('v');
      if (sharedUrl) {
        const validation = validateYouTubeUrl(sharedUrl);
        if (validation.isValid && validation.parsed) {
          return sharedUrl;
        }
      }
      const lastActive = getLastActiveVideo();
      if (lastActive && lastActive.url) {
        return lastActive.url;
      }
    }
    return DEFAULT_VIDEO_URL;
  });

  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [detectedFormat, setDetectedFormat] = useState<YouTubeFormatType | undefined>('standard_watch');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [interceptedData, setInterceptedData] = useState<InterceptedCaptionData | null>(null);

  // Restore cached subtitles for active video on initialization
  const [customCues, setCustomCues] = useState<CaptionCue[] | null>(() => {
    if (typeof window !== 'undefined') {
      // 1. Try dedicated persistent subtitle cache
      const cached = getCachedSubtitles(videoId);
      if (cached && cached.length > 0) {
        return cached;
      }
    }
    if (videoId === 'jNQXAC9IVRw') {
      return DEFAULT_LIBRARY_ITEMS[0].cues || null;
    }
    return null;
  });

  const [isFetchingSubtitles, setIsFetchingSubtitles] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [restoredToast, setRestoredToast] = useState<string | null>(null);

  // Shared Link feedback state (complaint if not youtube link, or success)
  const [sharedLinkComplaint, setSharedLinkComplaint] = useState<string | null>(null);
  const [sharedLinkSuccess, setSharedLinkSuccess] = useState<string | null>(null);

  // Observed YouTube TimedText URL for repeating requests with tlang & fmt=srt
  const [observedTimedTextUrl, setObservedTimedTextUrl] = useState<string | null>(() => {
    return getObservedTimedTextUrl(videoId);
  });

  useEffect(() => {
    setObservedTimedTextUrl(getObservedTimedTextUrl(videoId));
  }, [videoId]);

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

  // Persist library
  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    } catch (err) {
      console.warn('Library localStorage write failed:', err);
    }
  }, [library]);

  // Save active video session
  useEffect(() => {
    if (videoId && currentUrl) {
      saveLastActiveVideo(videoId, currentUrl);
    }
  }, [videoId, currentUrl]);

  // Automatically restore cached subtitles whenever videoId changes
  useEffect(() => {
    if (!videoId) return;

    // Check dedicated subtitle cache
    const cached = getCachedSubtitles(videoId);
    if (cached && cached.length > 0) {
      setCustomCues(cached);
      setFetchError(null);
      setRestoredToast(`Restored ${cached.length} cached subtitles`);
      const timer = setTimeout(() => setRestoredToast(null), 3000);
      return () => clearTimeout(timer);
    } else {
      // Check library state
      const libItem = library.find((item) => item.id === videoId);
      if (libItem && libItem.cues && libItem.cues.length > 0) {
        setCustomCues(libItem.cues);
        saveCachedSubtitles(videoId, libItem.cues, {
          title: libItem.title,
          originalUrl: libItem.originalUrl,
        });
        setFetchError(null);
        setRestoredToast(`Restored ${libItem.cues.length} cached subtitles from library`);
        const timer = setTimeout(() => setRestoredToast(null), 3000);
        return () => clearTimeout(timer);
      } else {
        setCustomCues(null);
        setInterceptedData(null);
      }
    }
  }, [videoId]);

  // Handler to process any shared link (via URL param, native Android intent, or Share dialog)
  const handleProcessSharedLink = useCallback((rawLink: string) => {
    setSharedLinkComplaint(null);
    setSharedLinkSuccess(null);

    const validation = validateYouTubeUrl(rawLink);
    if (!validation.isValid || !validation.parsed) {
      // COMPLAIN if it is not a YouTube link!
      const complaintText =
        validation.error ||
        `The shared link is not a YouTube URL. The app only accepts YouTube links (youtube.com, youtu.be, shorts, live, embed).`;
      setSharedLinkComplaint(complaintText);
      return false;
    }

    // Valid YouTube link: load video based on that link
    const { videoId: newId, startTime: newStart, formatType } = validation.parsed;
    setVideoId(newId);
    setCurrentUrl(rawLink);
    setStartTime(newStart);
    setDetectedFormat(formatType || 'standard_watch');
    setFetchError(null);
    setSharedLinkSuccess(`Successfully loaded YouTube video (${newId})`);

    // Check and restore cached subtitles immediately
    const cached = getCachedSubtitles(newId);
    if (cached && cached.length > 0) {
      setCustomCues(cached);
      setRestoredToast(`Restored ${cached.length} cached subtitles for shared video`);
    } else {
      setCustomCues(null);
    }

    // Clean up query param in address bar without reload
    try {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } catch {}

    const timer = setTimeout(() => setSharedLinkSuccess(null), 4000);
    return true;
  }, []);

  // Listen for initial URL share parameter on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const sharedParam =
      params.get('url') ||
      params.get('text') ||
      params.get('link') ||
      params.get('share') ||
      params.get('v');

    if (sharedParam) {
      handleProcessSharedLink(sharedParam);
    }

    // Register Android Native Shell bridge handler for shared intents
    window.onNativeSharedLinkReceived = (sharedLink: string) => {
      if (sharedLink) {
        handleProcessSharedLink(sharedLink);
      }
    };

    if (window.__pendingSharedLink) {
      handleProcessSharedLink(window.__pendingSharedLink);
      window.__pendingSharedLink = undefined;
    }

    return () => {
      delete window.onNativeSharedLinkReceived;
    };
  }, [handleProcessSharedLink]);

  // Fetch Subtitles from backend or restore from cache
  const handleFetchSubtitles = async (targetId?: string, forceRefresh = false) => {
    const idToFetch = targetId || videoId;
    if (!idToFetch) return;

    // Check if already in cache with non-empty cues (unless user specifically forces refresh)
    if (!forceRefresh) {
      const cached = getCachedSubtitles(idToFetch);
      if (cached && cached.length > 0) {
        setCustomCues(cached);
        setFetchError(null);
        setRestoredToast(`Restored ${cached.length} cached subtitles`);
        setTimeout(() => setRestoredToast(null), 3000);
        return;
      }
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

      // 1. Set active state
      setCustomCues(sanitizedCues);

      // 2. Persist in dedicated subtitle cache (independent and fast)
      saveCachedSubtitles(idToFetch, sanitizedCues, {
        title: `Video ${idToFetch}`,
        originalUrl: currentUrl,
      });

      // 3. Auto-cache into library state
      if (data.observedUrl) {
        saveObservedTimedTextUrl(idToFetch, data.observedUrl);
        setObservedTimedTextUrl(data.observedUrl);
      }
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

      setRestoredToast(`Saved ${sanitizedCues.length} subtitles to cache`);
      setTimeout(() => setRestoredToast(null), 3000);
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
          if (payload.url) {
            saveObservedTimedTextUrl(videoId, payload.url);
            setObservedTimedTextUrl(payload.url);
          }
          if (cues.length > 0) {
            setCustomCues(cues);
            // Save intercepted captions into persistent cache
            saveCachedSubtitles(videoId, cues, {
              title: `Video ${videoId}`,
              originalUrl: currentUrl,
            });
            // Update library
            setLibrary((prev) => {
              const existing = prev.find((item) => item.id === videoId);
              if (existing) {
                return prev.map((item) =>
                  item.id === videoId ? { ...item, cues } : item
                );
              }
              return [
                {
                  id: videoId,
                  originalUrl: currentUrl,
                  title: `Video ${videoId}`,
                  cues,
                  timestamp: Date.now(),
                },
                ...prev,
              ];
            });
          }
        } catch (err) {
          console.error('Error processing native intercepted caption:', err);
        }
      };
    }

    return () => {
      delete window.onNativeCaptionsInterceptedBase64;
    };
  }, [videoId, currentUrl]);

  // Flow Step 1: User inputs video URL
  const handleSelectVideo = (newId: string, rawUrl: string, parsedInfo?: ParsedYouTubeResult) => {
    setVideoId(newId);
    setCurrentUrl(rawUrl);
    setStartTime(parsedInfo?.startTime);
    setDetectedFormat(parsedInfo?.formatType || 'standard_watch');
    setFetchError(null);
    setSharedLinkComplaint(null);

    // Restore cached subtitles if present
    const cached = getCachedSubtitles(newId);
    if (cached && cached.length > 0) {
      setCustomCues(cached);
      setRestoredToast(`Restored ${cached.length} cached subtitles`);
      setTimeout(() => setRestoredToast(null), 3000);
    } else {
      const libMatch = library.find((item) => item.id === newId);
      if (libMatch && libMatch.cues && libMatch.cues.length > 0) {
        setCustomCues(libMatch.cues);
        saveCachedSubtitles(newId, libMatch.cues);
      } else {
        setCustomCues(null);
        setInterceptedData(null);
      }
    }
  };

  // Flow Step 1: User loads video from library
  const handleSelectLibraryItem = (item: LibraryVideoItem) => {
    const parsed = parseYouTubeUrl(item.originalUrl);
    setVideoId(item.id);
    setCurrentUrl(item.originalUrl);
    setStartTime(parsed?.startTime);
    setDetectedFormat(parsed?.formatType || 'standard_watch');
    setFetchError(null);
    setSharedLinkComplaint(null);

    if (item.cues && item.cues.length > 0) {
      setCustomCues(item.cues);
      saveCachedSubtitles(item.id, item.cues, {
        title: item.title,
        originalUrl: item.originalUrl,
      });
      setRestoredToast(`Restored ${item.cues.length} cached subtitles from library`);
      setTimeout(() => setRestoredToast(null), 3000);
    } else {
      const cached = getCachedSubtitles(item.id);
      if (cached && cached.length > 0) {
        setCustomCues(cached);
      } else {
        setCustomCues(null);
      }
    }
  };

  const handleSaveCurrentToLibrary = (title: string) => {
    const active = customCues && customCues.length > 0 ? customCues : (interceptedData?.cues || []);
    const newItem: LibraryVideoItem = {
      id: videoId,
      originalUrl: currentUrl,
      title: title || `Video ${videoId}`,
      cues: active,
      timestamp: Date.now(),
    };

    saveCachedSubtitles(videoId, active, { title: newItem.title, originalUrl: currentUrl });

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
        onOpenShare={() => setIsShareModalOpen(true)}
      />

      <main className="flex-1 w-full flex flex-col items-center py-6 px-4 sm:px-6">
        <div
          className={`w-full flex flex-col gap-6 transition-all duration-300 ${
            theaterMode ? 'max-w-7xl' : 'max-w-5xl'
          }`}
        >
          {/* Shared Link Complaint Banner: The app will complain if it's not a YouTube link */}
          {sharedLinkComplaint && (
            <div
              id="shared-link-complaint-banner"
              data-testid="shared-link-complaint-banner"
              className="p-4 rounded-2xl bg-red-950/80 border border-red-700/80 text-red-200 shadow-xl flex items-start justify-between gap-3 animate-fadeIn"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-red-900/60 text-red-400 shrink-0 mt-0.5">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-red-300 flex items-center gap-2">
                    <span>Invalid Video Link (Not a YouTube Link)</span>
                  </h3>
                  <p className="text-xs text-red-200/90 leading-relaxed">
                    {sharedLinkComplaint}
                  </p>
                  <p className="text-[11px] text-red-400 mt-1">
                    Please share a valid YouTube link (such as <code className="font-mono bg-red-950 px-1 py-0.5 rounded">youtube.com/watch?v=...</code>, <code className="font-mono bg-red-950 px-1 py-0.5 rounded">youtu.be/...</code>, or Shorts).
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="dismiss-complaint-button"
                onClick={() => setSharedLinkComplaint(null)}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-900/40 transition shrink-0"
                title="Dismiss complaint"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Shared Link Success Banner */}
          {sharedLinkSuccess && (
            <div
              id="shared-link-success-banner"
              data-testid="shared-link-success-banner"
              className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fadeIn shadow-lg"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">{sharedLinkSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setSharedLinkSuccess(null)}
                className="p-1 text-emerald-400 hover:text-emerald-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Restored Subtitles Notification Toast */}
          {restoredToast && (
            <div
              id="restored-subtitles-toast"
              data-testid="restored-subtitles-toast"
              className="px-4 py-2.5 rounded-xl bg-indigo-950/80 border border-indigo-700/80 text-indigo-200 text-xs flex items-center justify-between gap-3 animate-fadeIn shadow-lg"
            >
              <div className="flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{restoredToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setRestoredToast(null)}
                className="p-1 text-indigo-400 hover:text-indigo-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Step 1: Link paste, Sharing & Library Access */}
          <LinkInputBar
            currentUrl={currentUrl}
            onSelectVideo={handleSelectVideo}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onOpenShare={() => setIsShareModalOpen(true)}
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
            onFetchSubtitles={() => handleFetchSubtitles(videoId, false)}
            isFetchingSubtitles={isFetchingSubtitles}
            hasSubtitles={activeCues.length > 0}
          />

          {/* Steps 2-6: Subtitles Teacher & Multi-Column Translation Workspace */}
          <SubtitlesTeacherPanel
            cues={activeCues}
            playerRef={playerRef}
            observedTimedTextUrl={observedTimedTextUrl}
            videoId={videoId}
            onUpdateObservedTimedTextUrl={(newUrl) => {
              saveObservedTimedTextUrl(videoId, newUrl);
              setObservedTimedTextUrl(newUrl);
            }}
            onLoadCues={(newCues) => {
              setCustomCues(newCues);
              saveCachedSubtitles(videoId, newCues, {
                title: `Video ${videoId}`,
                originalUrl: currentUrl,
              });
            }}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            onFetchSubtitles={() => handleFetchSubtitles(videoId, false)}
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
        <span>•</span>
        <span>Link Sharing &amp; Persistent Subtitle Caching</span>
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

      {/* Share Link with App Modal */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        currentUrl={currentUrl}
        onLoadSharedVideo={handleProcessSharedLink}
      />

      {/* Network offline warning */}
      <OfflineIndicator />
    </div>
  );
}
