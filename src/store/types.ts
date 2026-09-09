export type AppStateMachineState =
  | 'idle'
  | 'loading_video'
  | 'video_ready'
  | 'fetching_captions'
  | 'captions_loaded'
  | 'playing'
  | 'paused'
  | 'syncing_tts'
  | 'error';

export interface StateMachineTransition {
  id: string;
  from: AppStateMachineState;
  to: AppStateMachineState;
  action: string;
  payload?: any;
  timestamp: number;
}

export type ErrorSection =
  | 'state_machine'
  | 'network'
  | 'subtitles'
  | 'player'
  | 'system';

export interface AppErrorItem {
  id: string;
  section: ErrorSection;
  title: string;
  message: string;
  timestamp: number;
  details?: any;
  stack?: string;
  resolved?: boolean;
}

export interface NetworkRequestRecord {
  id: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  startTime: number;
  duration?: number;
  type: 'fetch' | 'xhr' | 'timedtext_interception' | 'translation_api';
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
  isPending: boolean;
}
