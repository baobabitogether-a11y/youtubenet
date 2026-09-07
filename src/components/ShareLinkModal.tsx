import React, { useState } from 'react';
import {
  Share2,
  X,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  validateYouTubeUrl,
  SAMPLE_INVALID_LINKS,
  DEFAULT_VIDEO_URL,
} from '../utils/youtube';
import { ParsedYouTubeResult } from '../types';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onLoadSharedVideo: (videoId: string, rawUrl: string, parsedInfo?: ParsedYouTubeResult) => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  onLoadSharedVideo,
}) => {
  const [inputUrl, setInputUrl] = useState('');
  const [complaint, setComplaint] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedAppShare, setCopiedAppShare] = useState(false);

  if (!isOpen) return null;

  const handleShareSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setComplaint(null);
    setSuccessMsg(null);

    const target = inputUrl.trim();
    if (!target) {
      setComplaint('Please enter or paste a link to share with the app.');
      return;
    }

    const result = validateYouTubeUrl(target);
    if (!result.isValid || !result.parsed) {
      // The app complains loudly if it's not a youtube link!
      setComplaint(
        result.error ||
          'Not a YouTube link! Only YouTube links (watch, youtu.be, shorts, live, embed) can be loaded.'
      );
      return;
    }

    // Successfully recognized YouTube video
    setSuccessMsg(`Valid YouTube video identified (${result.parsed.videoId})! Loading video & restoring cached subtitles...`);
    setTimeout(() => {
      onLoadSharedVideo(result.parsed!.videoId, target, result.parsed);
      setInputUrl('');
      setComplaint(null);
      setSuccessMsg(null);
      onClose();
    }, 600);
  };

  const handlePasteClipboard = async () => {
    setComplaint(null);
    setSuccessMsg(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text);
        const result = validateYouTubeUrl(text);
        if (!result.isValid) {
          setComplaint(result.error || 'The pasted link is not a YouTube link.');
        }
      }
    } catch {
      setComplaint('Clipboard access denied. Please paste manually into the field.');
    }
  };

  const handleSelectSample = (sampleUrl: string) => {
    setInputUrl(sampleUrl);
    setComplaint(null);
    setSuccessMsg(null);
    const result = validateYouTubeUrl(sampleUrl);
    if (!result.isValid) {
      setComplaint(result.error || 'This is not a YouTube link.');
    }
  };

  const handleCopyAppShareLink = () => {
    const shareableUrl = `${window.location.origin}${window.location.pathname}?url=${encodeURIComponent(
      currentUrl || DEFAULT_VIDEO_URL
    )}`;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedAppShare(true);
    setTimeout(() => setCopiedAppShare(false), 2000);
  };

  return (
    <div
      id="share-link-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="share-link-modal-card"
        className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                <span>Share Link with App</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Paste or share any video link. The app will verify it is a YouTube link before loading.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-share-modal-button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Input Form */}
          <form onSubmit={handleShareSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-neutral-300">
              Paste or enter shared link:
            </label>

            <div className="relative flex items-center w-full rounded-xl bg-neutral-950 border border-neutral-700/80 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 transition shadow-inner">
              <div className="pl-3 pr-2 text-neutral-500">
                <Link2 className="w-4 h-4" />
              </div>

              <input
                id="share-link-input"
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (complaint) setComplaint(null);
                  if (successMsg) setSuccessMsg(null);
                }}
                placeholder="https://www.youtube.com/watch?v=... or youtu.be/..."
                className="w-full py-2.5 bg-transparent text-neutral-100 placeholder-neutral-500 text-xs sm:text-sm focus:outline-none"
                autoFocus
              />

              <div className="flex items-center gap-1 pr-2 shrink-0">
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputUrl('');
                      setComplaint(null);
                    }}
                    className="p-1 rounded text-neutral-400 hover:text-white"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  id="share-paste-button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition"
                >
                  <Clipboard className="w-3 h-3" />
                  <span className="hidden sm:inline">Paste</span>
                </button>
              </div>
            </div>

            {/* Error / Complaint Banner (The app complains if it's not a YouTube link) */}
            {complaint && (
              <div
                id="share-link-complaint-banner"
                className="p-3.5 rounded-xl bg-red-950/60 border border-red-700/80 text-red-200 text-xs flex items-start gap-3 animate-fadeIn shadow-sm"
              >
                <div className="p-1 rounded-md bg-red-900/60 text-red-400 shrink-0 mt-0.5">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-red-300">
                    Not a YouTube Link!
                  </p>
                  <p className="leading-relaxed text-red-200/90">
                    {complaint}
                  </p>
                </div>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div
                id="share-link-success-banner"
                className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              id="submit-shared-link-button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-red-600/20 active:scale-95 transition"
            >
              <span>Load Shared Video</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Test Links Section to immediately test compliance */}
          <div className="space-y-2.5 pt-3 border-t border-neutral-800">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Test Link Sharing &amp; Validation:
            </span>

            <div className="space-y-1.5">
              <p className="text-[11px] text-neutral-400">
                Click an invalid link to test how the app complains, or a valid YouTube link to load it:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* Invalid Links */}
                {SAMPLE_INVALID_LINKS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSample(sample.url)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-800/40 transition"
                    title={`Test invalid link (${sample.reason})`}
                  >
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span>Test {sample.label}</span>
                  </button>
                ))}

                {/* Valid YouTube Sample */}
                <button
                  type="button"
                  onClick={() => handleSelectSample('https://youtu.be/jNQXAC9IVRw')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/40 transition"
                  title="Test valid YouTube link"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Test Valid YouTube (youtu.be)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Web Share Target & URL Parameter Guide */}
          <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Direct Link Sharing Support</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              You can also share links directly from any browser or external app by appending{' '}
              <code className="px-1 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono">?url=YOUR_YOUTUBE_URL</code>{' '}
              to the app URL. When installed as a PWA or Android APK, selecting &quot;Share&quot; in YouTube will open the video directly in this app.
            </p>

            <button
              type="button"
              id="copy-app-share-link-button"
              onClick={handleCopyAppShareLink}
              className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 pt-1"
            >
              {copiedAppShare ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Share link copied to clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy shareable app link for current video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
