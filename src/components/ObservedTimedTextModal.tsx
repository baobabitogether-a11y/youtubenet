import React, { useState } from 'react';
import {
  Radio,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Play,
  FileCode,
  Globe,
  Layers,
} from 'lucide-react';
import { buildYouTubeTranslatedTimedTextUrl, fetchYouTubeNativeTranslation } from '../lib/translateService';
import { SAMPLE_OBSERVED_TIMEDTEXT_URL } from '../utils/subtitleCache';
import { CaptionCue } from '../types';

interface ObservedTimedTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  observedUrl: string | null;
  videoId?: string;
  onSaveUrl: (url: string) => void;
}

export const ObservedTimedTextModal: React.FC<ObservedTimedTextModalProps> = ({
  isOpen,
  onClose,
  observedUrl,
  videoId,
  onSaveUrl,
}) => {
  const [urlInput, setUrlInput] = useState<string>(observedUrl || '');
  const [testLang, setTestLang] = useState<string>('en');
  const [testFormat, setTestFormat] = useState<'srt' | 'json3'>('srt');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    source: string;
    count?: number;
    sampleCues?: CaptionCue[];
    error?: string;
    modifiedUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentUrlToUse = (urlInput || observedUrl || '').trim();
  const transformedPreview = currentUrlToUse
    ? buildYouTubeTranslatedTimedTextUrl(currentUrlToUse, testLang, testFormat)
    : '';

  const handleTestTranslation = async () => {
    if (!currentUrlToUse) return;
    setIsLoading(true);
    setTestResult(null);

    try {
      const res = await fetchYouTubeNativeTranslation({
        observedUrl: currentUrlToUse,
        targetLang: testLang,
        format: testFormat,
        videoId,
      });

      setTestResult({
        success: res.success,
        source: res.source,
        count: res.cues?.length || 0,
        sampleCues: res.cues?.slice(0, 4),
        error: res.error,
        modifiedUrl: res.modifiedUrl || transformedPreview,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        source: 'error',
        error: err.message || 'Failed to test translation request',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTransformed = () => {
    if (!transformedPreview) return;
    navigator.clipboard.writeText(transformedPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (urlInput.trim()) {
      onSaveUrl(urlInput.trim());
    }
    onClose();
  };

  return (
    <div
      id="observed-timedtext-modal"
      data-testid="observed-timedtext-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                YouTube Native Subtitle Stream
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Default Translation Source
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Repeats observed timedtext request with target language (tlang) and format (fmt=srt). Falls back to Google Translate.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* Strategy explanation card */}
          <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Active Translation Pipeline
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                1. YouTube Native (tlang) → 2. Fallback (GTX)
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              When video subtitles are observed, the app repeats the exact request URL to retrieve YouTube's official synchronized translations in real time. If YouTube returns an error or no captions, the system instantly engages Google Translate as an automated fallback.
            </p>
          </div>

          {/* Observed TimedText URL input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                Observed Subtitle Request URL
              </label>
              <button
                type="button"
                onClick={() => setUrlInput(SAMPLE_OBSERVED_TIMEDTEXT_URL)}
                className="text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2"
              >
                Load Sample Observed Request
              </button>
            </div>
            <textarea
              rows={3}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/api/timedtext?v=...&lang=...&signature=..."
              className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 font-mono focus:outline-none focus:border-red-500 transition resize-none"
            />
            {observedUrl && (
              <p className="text-[11px] text-neutral-500">
                Current active URL: <span className="font-mono text-neutral-400 truncate inline-block max-w-md align-bottom">{observedUrl}</span>
              </p>
            )}
          </div>

          {/* Controls to test repetition */}
          <div className="p-4 rounded-2xl bg-neutral-950/50 border border-neutral-800 space-y-4">
            <h3 className="text-xs font-semibold text-neutral-300">
              Transform &amp; Test Repetition
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Target Language (tlang parameter)
                </label>
                <select
                  value={testLang}
                  onChange={(e) => setTestLang(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="en">English (tlang=en)</option>
                  <option value="it">Italian (tlang=it)</option>
                  <option value="ar">Arabic (tlang=ar)</option>
                  <option value="es">Spanish (tlang=es)</option>
                  <option value="fr">French (tlang=fr)</option>
                  <option value="de">German (tlang=de)</option>
                  <option value="ja">Japanese (tlang=ja)</option>
                  <option value="ru">Russian (tlang=ru)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">
                  Output Format (fmt parameter)
                </label>
                <select
                  value={testFormat}
                  onChange={(e) => setTestFormat(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="srt">SRT (fmt=srt) - Recommended</option>
                  <option value="json3">JSON3 (fmt=json3)</option>
                </select>
              </div>
            </div>

            {/* Transformed URL Preview */}
            {transformedPreview && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Modified Request URL:</span>
                  <button
                    type="button"
                    onClick={handleCopyTransformed}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copied ? 'Copied' : 'Copy URL'}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 break-all max-h-20 overflow-y-auto">
                  {transformedPreview}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestTranslation}
                disabled={isLoading || !currentUrlToUse}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white transition flex items-center gap-2 shadow-md"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Repeating TimedText Request...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Test YouTube Native Translation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test results banner */}
          {testResult && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-200'
                  : 'bg-amber-950/60 border-amber-700/80 text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  {testResult.success
                    ? `YouTube Native Translation Succeeded (${testResult.count} cues translated to ${testLang.toUpperCase()})`
                    : `YouTube Native Request Notice: ${testResult.error || 'Triggered fallback'}`}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900/60 border border-neutral-700">
                  Source: {testResult.source}
                </span>
              </div>

              {testResult.sampleCues && testResult.sampleCues.length > 0 && (
                <div className="space-y-1 pt-2">
                  <span className="text-[11px] text-emerald-300 font-semibold">Sample Translated Cues:</span>
                  <div className="space-y-1">
                    {testResult.sampleCues.map((c, i) => (
                      <div key={i} className="font-mono text-[11px] bg-neutral-900/80 p-1.5 rounded border border-neutral-800">
                        [{c.start.toFixed(1)}s]: {c.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/80">
          <div className="text-xs text-neutral-400">
            {currentUrlToUse ? '✓ TimedText URL is active' : 'Waiting for timedtext observation or input'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition shadow-lg"
            >
              Save &amp; Apply URL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
