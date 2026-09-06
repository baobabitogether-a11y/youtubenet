export interface VideoItem {
  id: string;
  originalUrl: string;
  title?: string;
  timestamp: number;
}

export interface PlayerOptions {
  autoplay: boolean;
  theaterMode: boolean;
  loop: boolean;
}

export type YouTubeFormatType =
  | 'standard_watch'
  | 'short_link'
  | 'shorts'
  | 'live'
  | 'embed'
  | 'iframe_code'
  | 'legacy_v'
  | 'attribution'
  | 'raw_id'
  | 'text_extracted'
  | 'playlist_video'
  | 'mobile_watch';

export interface ParsedYouTubeResult {
  videoId: string;
  formatType: YouTubeFormatType;
  startTime?: number; // In seconds (e.g. from t=1m30s)
  listId?: string; // e.g. from list=PL...
  cleanWatchUrl: string;
  embedUrl: string;
}

export interface CaptionCue {
  id: string;
  start: number; // in seconds
  duration: number; // in seconds
  text: string;
}

export interface TargetLanguage {
  id: string;
  code: string;
  name: string;
  ttsRate: number; // 0.5 to 2.0
  enabled: boolean;
  color?: string;
}

export type SyncPlayOrder = 'video_first' | 'tts_first';

export interface TTSStatus {
  isSpeaking: boolean;
  currentLang?: string;
  currentText?: string;
  engine: 'android_native' | 'web_speech';
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  isReady: () => boolean;
}

export interface InterceptedCaptionData {
  id: string;
  url: string;
  videoId: string;
  timestamp: number;
  method: string;
  status: number;
  contentType: string;
  format: 'xml' | 'json3' | 'vtt' | 'unknown';
  rawData: string;
  bytes: number;
  cues: CaptionCue[];
  source: 'native_webview_interceptor' | 'simulated_test';
}

declare global {
  interface Window {
    AndroidNativeShell?: {
      isNativeShell: () => boolean;
      showToast: (msg: string) => void;
      speak?: (text: string, lang: string, rate: number, utteranceId: string) => boolean;
      stopSpeaking?: () => void;
      isSpeaking?: () => boolean;
    };
    onNativeCaptionsInterceptedBase64?: (base64Json: string) => void;
    onNativeTTSDone?: (utteranceId: string) => void;
    onNativeTTSError?: (utteranceId: string, errorMsg?: string) => void;
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

