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

