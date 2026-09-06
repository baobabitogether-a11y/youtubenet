import React, { useState } from 'react';
import {
  FileText,
  Terminal,
  Download,
  Copy,
  Check,
  Search,
  Zap,
  Radio,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InterceptedCaptionData } from '../types';
import {
  formatTimestamp,
  cuesToSrt,
  cuesToVtt,
  SAMPLE_YOUTUBE_TIMEDTEXT_XML,
  SAMPLE_YOUTUBE_TIMEDTEXT_JSON3,
  parseRawCaptionData,
} from '../utils/captionParser';

interface CaptionsInspectorProps {
  interceptedData: InterceptedCaptionData | null;
  onSimulate: (raw: string, format: 'xml' | 'json3') => void;
  onClear: () => void;
  isNativeShell: boolean;
  onSeekTo?: (seconds: number) => void;
}

export const CaptionsInspector: React.FC<CaptionsInspectorProps> = ({
  interceptedData,
  onSimulate,
  onClear,
  isNativeShell,
  onSeekTo,
}) => {
  const [activeTab, setActiveTab] = useState<'transcript' | 'raw' | 'network'>('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredCues = interceptedData?.cues.filter((c) =>
    c.text.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-xl">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-neutral-850 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                Network Caption Interceptor
              </h3>
              {isNativeShell ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Native Android Shell Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
                  Web Mode / Ready for APK
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Captures HTTP requests to <code className="text-neutral-300">youtube.com/api/timedtext</code> and inspects raw response data
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Quick simulation buttons for testing in web browser */}
          <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-lg border border-neutral-700/60">
            <span className="text-[11px] text-neutral-400 px-1 font-medium hidden sm:inline">
              Test Traffic:
            </span>
            <button
              onClick={() => onSimulate(SAMPLE_YOUTUBE_TIMEDTEXT_XML, 'xml')}
              className="px-2 py-1 rounded text-xs font-medium bg-neutral-700/70 hover:bg-neutral-700 text-neutral-200 transition"
              title="Simulate YouTube XML TimedText HTTP response"
            >
              XML
            </button>
            <button
              onClick={() => onSimulate(SAMPLE_YOUTUBE_TIMEDTEXT_JSON3, 'json3')}
              className="px-2 py-1 rounded text-xs font-medium bg-neutral-700/70 hover:bg-neutral-700 text-neutral-200 transition"
              title="Simulate YouTube JSON3 TimedText HTTP response"
            >
              JSON3
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 flex flex-col gap-4">
          {interceptedData ? (
            <>
              {/* Traffic summary pill bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-bold">
                    {interceptedData.method} {interceptedData.status}
                  </span>
                  <span className="text-neutral-400">
                    Format: <strong className="text-neutral-200 uppercase">{interceptedData.format}</strong>
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-neutral-400">
                    Payload: <strong className="text-neutral-200">{(interceptedData.bytes / 1024).toFixed(2)} KB</strong>
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-neutral-400">
                    Cues: <strong className="text-neutral-200">{interceptedData.cues.length} lines</strong>
                  </span>
                </div>

                <button
                  onClick={onClear}
                  className="text-neutral-500 hover:text-red-400 transition text-[11px]"
                >
                  Clear Intercept
                </button>
              </div>

              {/* Sub tabs */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === 'transcript'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Parsed Transcript ({interceptedData.cues.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === 'raw'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Raw Body Data</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('network')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === 'network'
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>HTTP Request Details</span>
                  </button>
                </div>

                {/* Export dropdown / buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      handleDownload(
                        interceptedData.rawData,
                        `captions.${interceptedData.format === 'json3' ? 'json' : 'xml'}`,
                        interceptedData.contentType
                      )
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                    title="Download raw file"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Raw</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownload(
                        cuesToSrt(interceptedData.cues),
                        'captions.srt',
                        'text/plain'
                      )
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                    title="Download as SubRip .SRT"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>.SRT</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownload(
                        cuesToVtt(interceptedData.cues),
                        'captions.vtt',
                        'text/vtt'
                      )
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
                    title="Download as WebVTT"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span>.VTT</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Parsed Transcript */}
              {activeTab === 'transcript' && (
                <div className="flex flex-col gap-3">
                  {/* Search bar inside captions */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search within intercepted captions..."
                      className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {filteredCues.length > 0 ? (
                      filteredCues.map((cue) => (
                        <div
                          key={cue.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 transition group"
                        >
                          <div className="flex items-center gap-1 text-[11px] font-mono text-red-400 font-semibold shrink-0 pt-0.5">
                            <Clock className="w-3 h-3 text-red-500" />
                            <span>{formatTimestamp(cue.start)}</span>
                          </div>
                          <p className="text-xs text-neutral-200 flex-1 leading-relaxed">
                            {cue.text}
                          </p>
                          <button
                            onClick={() => handleCopy(cue.text, cue.id)}
                            className="p-1 rounded text-neutral-500 hover:text-neutral-200 transition opacity-0 group-hover:opacity-100"
                            title="Copy line"
                          >
                            {copied === cue.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-neutral-500 py-6 text-center">
                        No cues found matching &quot;{searchQuery}&quot;
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Raw Body Data */}
              {activeTab === 'raw' && (
                <div className="relative">
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                    <button
                      onClick={() => handleCopy(interceptedData.rawData, 'raw')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 transition shadow"
                    >
                      {copied === 'raw' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Raw</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="max-h-72 overflow-auto p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-300 whitespace-pre leading-relaxed">
                    {interceptedData.rawData}
                  </pre>
                </div>
              )}

              {/* Tab 3: HTTP Request Details */}
              {activeTab === 'network' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                    <div>
                      <span className="text-neutral-500 block text-[10px] uppercase">
                        Intercepted Endpoint URL
                      </span>
                      <p className="text-neutral-200 break-all pt-0.5">
                        {interceptedData.url}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-800/80">
                      <div>
                        <span className="text-neutral-500 text-[10px] uppercase block">
                          Method
                        </span>
                        <span className="text-emerald-400 font-semibold">
                          {interceptedData.method}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[10px] uppercase block">
                          Status Code
                        </span>
                        <span className="text-emerald-400 font-semibold">
                          {interceptedData.status} OK
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[10px] uppercase block">
                          Content-Type
                        </span>
                        <span className="text-neutral-300">
                          {interceptedData.contentType}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[10px] uppercase block">
                          Captured via
                        </span>
                        <span className="text-amber-400">
                          shouldInterceptRequest
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-neutral-400 text-xs">
                    <p className="font-sans leading-relaxed">
                      💡 <strong>In the Android APK Shell</strong>, this data is extracted directly from the byte stream in <code className="text-neutral-200">MainActivity.kt</code> before being decoded by the video player, allowing offline caching, translation, or semantic search.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
                <Radio className="w-6 h-6 text-neutral-500" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-200 mb-1">
                Waiting for Caption Network Request
              </h4>
              <p className="text-xs text-neutral-400 max-w-md mb-4 leading-relaxed">
                When running in the Android APK, clicking subtitles (CC) in the video player triggers an HTTP request to YouTube&apos;s <code className="text-neutral-300">/timedtext</code> endpoint, automatically captured here with full raw data.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => onSimulate(SAMPLE_YOUTUBE_TIMEDTEXT_XML, 'xml')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-medium transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Load Sample YouTube XML Captions</span>
                </button>
                <button
                  onClick={() => onSimulate(SAMPLE_YOUTUBE_TIMEDTEXT_JSON3, 'json3')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-medium transition"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Load Sample JSON3 Captions</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
