import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Trash2,
  Copy,
  Check,
  CheckCircle,
  Clock,
  Workflow,
  Globe,
  Subtitles,
  PlaySquare,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearErrorsBySection,
  clearAllErrors,
  setSelectedSection,
  setInspectorOpen,
  resolveError,
  addError,
} from '../store/errorsSlice';
import { transition } from '../store/stateMachineSlice';
import { ErrorSection } from '../store/types';

export const ErrorInspectorModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { errors, selectedSection, isInspectorOpen } = useAppSelector((state) => state.errors);
  const { currentState, previousState, history: stateMachineHistory, lastAction } = useAppSelector(
    (state) => state.stateMachine
  );

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'errors' | 'state_machine'>('errors');

  if (!isInspectorOpen) return null;

  // Filter errors by selected section
  const filteredErrors =
    selectedSection === 'all'
      ? errors
      : errors.filter((err) => err.section === selectedSection);

  // Group error counts
  const counts: Record<ErrorSection | 'all', number> = {
    all: errors.length,
    state_machine: errors.filter((e) => e.section === 'state_machine').length,
    network: errors.filter((e) => e.section === 'network').length,
    subtitles: errors.filter((e) => e.section === 'subtitles').length,
    player: errors.filter((e) => e.section === 'player').length,
    system: errors.filter((e) => e.section === 'system').length,
  };

  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      appStateMachine: {
        currentState,
        previousState,
        lastAction,
        historyCount: stateMachineHistory.length,
      },
      errorSummary: counts,
      errors,
      stateMachineHistory: stateMachineHistory.slice(0, 20),
    };
    try {
      navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Helper to simulate a test error across any section for verification
  const handleSimulateTestError = (section: ErrorSection) => {
    dispatch(
      addError({
        section,
        title: `Simulated ${section.replace('_', ' ').toUpperCase()} Error`,
        message: `Diagnostic test error triggered at ${new Date().toLocaleTimeString()} for section: ${section}`,
        details: {
          testTriggeredBy: 'User/Dev Diagnostic',
          currentState,
          randomToken: Math.random().toString(36).substring(7),
        },
      })
    );
  };

  const getSectionIcon = (section: ErrorSection) => {
    switch (section) {
      case 'state_machine':
        return <Workflow className="w-4 h-4 text-purple-400" />;
      case 'network':
        return <Globe className="w-4 h-4 text-blue-400" />;
      case 'subtitles':
        return <Subtitles className="w-4 h-4 text-emerald-400" />;
      case 'player':
        return <PlaySquare className="w-4 h-4 text-amber-400" />;
      case 'system':
        return <Cpu className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div
      id="error-inspector-modal"
      data-testid="error-inspector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={() => dispatch(setInspectorOpen(false))}
    >
      <div
        className="relative w-full max-w-5xl h-[88vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-neutral-950/90 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-100">Application Errors & Redux State Machine</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    errors.length > 0
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  {errors.length === 0 ? '0 Errors (Healthy)' : `${errors.length} Errors`}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Segmented error logs, Redux state machine transitions, and diagnostic inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-error-report-button"
              type="button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition"
              title="Copy diagnostic report to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Report!' : 'Copy Report'}</span>
            </button>
            <button
              id="clear-all-errors-button"
              type="button"
              onClick={() => dispatch(clearAllErrors())}
              disabled={errors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
            <button
              id="close-error-inspector-button"
              type="button"
              onClick={() => dispatch(setInspectorOpen(false))}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex items-center justify-between px-5 py-2 bg-neutral-950/60 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              id="tab-errors-list-button"
              type="button"
              onClick={() => setActiveTab('errors')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'errors'
                  ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Error Sections ({errors.length})</span>
            </button>

            <button
              id="tab-state-machine-button"
              type="button"
              onClick={() => setActiveTab('state_machine')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'state_machine'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Redux State Machine</span>
              <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-mono text-[10px]">
                {currentState}
              </span>
            </button>
          </div>

          {/* Quick error simulator trigger for testing */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-500 text-[11px] hidden sm:inline">Test Trigger:</span>
            <button
              type="button"
              onClick={() => handleSimulateTestError('state_machine')}
              className="px-2 py-1 rounded text-[11px] bg-neutral-800 hover:bg-neutral-700 text-purple-300 border border-neutral-700"
            >
              +State Error
            </button>
            <button
              type="button"
              onClick={() => handleSimulateTestError('subtitles')}
              className="px-2 py-1 rounded text-[11px] bg-neutral-800 hover:bg-neutral-700 text-emerald-300 border border-neutral-700"
            >
              +Caption Error
            </button>
          </div>
        </div>

        {/* View Mode 1: Divided Error Sections */}
        {activeTab === 'errors' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Section Selector Sidebar */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-950/40 p-3 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-2 py-1 hidden md:block">
                Error Domains
              </span>

              {(
                [
                  { id: 'all', label: 'All Errors', icon: <Layers className="w-4 h-4 text-neutral-300" /> },
                  { id: 'state_machine', label: 'State Machine & Actions', icon: <Workflow className="w-4 h-4 text-purple-400" /> },
                  { id: 'network', label: 'Network & HTTP API', icon: <Globe className="w-4 h-4 text-blue-400" /> },
                  { id: 'subtitles', label: 'Subtitles & Captions', icon: <Subtitles className="w-4 h-4 text-emerald-400" /> },
                  { id: 'player', label: 'Video Player & Iframe', icon: <PlaySquare className="w-4 h-4 text-amber-400" /> },
                  { id: 'system', label: 'System & Unhandled', icon: <Cpu className="w-4 h-4 text-red-400" /> },
                ] as const
              ).map((sec) => {
                const count = counts[sec.id];
                const isSelected = selectedSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    id={`error-section-btn-${sec.id}`}
                    type="button"
                    onClick={() => dispatch(setSelectedSection(sec.id))}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition whitespace-nowrap md:whitespace-normal ${
                      isSelected
                        ? 'bg-neutral-800 text-white font-semibold shadow-sm border border-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {sec.icon}
                      <span>{sec.label}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        count > 0
                          ? 'bg-red-950 text-red-300 border border-red-800/60'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {selectedSection !== 'all' && counts[selectedSection] > 0 && (
                <button
                  type="button"
                  onClick={() => dispatch(clearErrorsBySection(selectedSection as ErrorSection))}
                  className="mt-auto px-3 py-1.5 text-xs text-neutral-400 hover:text-red-400 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear this section</span>
                </button>
              )}
            </div>

            {/* Error Items List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-neutral-900">
              {filteredErrors.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500">
                  <CheckCircle className="w-10 h-10 text-emerald-500/40 mb-3" />
                  <p className="text-sm font-medium text-neutral-300">No errors recorded in this section.</p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    The app is operating normally. If errors occur in this category, they will be captured and categorized here.
                  </p>
                </div>
              ) : (
                filteredErrors.map((err) => (
                  <div
                    key={err.id}
                    id={`error-item-${err.id}`}
                    className={`p-3.5 rounded-xl border transition flex flex-col gap-2 ${
                      err.resolved
                        ? 'bg-neutral-950/40 border-neutral-800 opacity-60'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {getSectionIcon(err.section)}
                        <span className="text-xs font-bold text-neutral-200">{err.title}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                          {err.section}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-neutral-500">
                          {new Date(err.timestamp).toLocaleTimeString()}
                        </span>
                        {!err.resolved && (
                          <button
                            type="button"
                            onClick={() => dispatch(resolveError(err.id))}
                            className="text-neutral-500 hover:text-emerald-400 transition p-1"
                            title="Mark as resolved"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-red-300 font-mono bg-red-950/30 p-2.5 rounded border border-red-900/40 break-all">
                      {err.message}
                    </p>

                    {err.details && (
                      <div className="text-[11px] font-mono text-neutral-400 bg-neutral-900 p-2 rounded border border-neutral-800 overflow-x-auto max-h-36">
                        <span className="text-neutral-500 block text-[10px] uppercase mb-1">Details:</span>
                        <pre>{typeof err.details === 'object' ? JSON.stringify(err.details, null, 2) : String(err.details)}</pre>
                      </div>
                    )}

                    {err.stack && (
                      <details className="text-[10px] font-mono text-neutral-500">
                        <summary className="cursor-pointer hover:text-neutral-300">View Stack Trace</summary>
                        <pre className="mt-1 p-2 bg-neutral-900 rounded overflow-x-auto text-neutral-400">
                          {err.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* View Mode 2: State Machine Visualizer & History */}
        {activeTab === 'state_machine' && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-neutral-900">
            {/* Current State Machine Status */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-purple-400" />
                  <span>Current App State Machine Status</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  {currentState}
                </span>
              </div>

              {/* State Machine Pipeline Diagram */}
              <div className="flex flex-wrap items-center gap-2 py-2">
                {(
                  [
                    'idle',
                    'loading_video',
                    'video_ready',
                    'fetching_captions',
                    'captions_loaded',
                    'playing',
                    'syncing_tts',
                  ] as const
                ).map((st, i) => {
                  const isCurrent = currentState === st;
                  return (
                    <React.Fragment key={st}>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
                          isCurrent
                            ? 'bg-purple-600 text-white font-bold ring-2 ring-purple-400 shadow-md'
                            : 'bg-neutral-800/80 text-neutral-400'
                        }`}
                      >
                        {st}
                      </span>
                      {i < 6 && <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono mt-1">
                <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">CURRENT STATE</span>
                  <span className="text-purple-300 font-bold">{currentState}</span>
                </div>
                <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">PREVIOUS STATE</span>
                  <span className="text-neutral-300">{previousState || 'None (Initial)'}</span>
                </div>
                <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800 col-span-2 sm:col-span-1">
                  <span className="text-neutral-500 block text-[10px]">LAST ACTION DISPATCHED</span>
                  <span className="text-neutral-200">{lastAction || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Redux State Machine Transition History */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Transition Audit Trail ({stateMachineHistory.length} events)
                </h3>
              </div>

              <div className="divide-y divide-neutral-800 rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden">
                {stateMachineHistory.length === 0 ? (
                  <div className="p-6 text-center text-neutral-500 text-xs font-mono">
                    No state machine transitions recorded yet. Interacting with the video player or subtitles will record state actions here.
                  </div>
                ) : (
                  stateMachineHistory.map((tr) => (
                    <div key={tr.id} className="p-3 flex items-center justify-between gap-3 text-xs font-mono hover:bg-neutral-900/60 transition">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-purple-300 font-bold">
                          {tr.action}
                        </span>
                        <div className="flex items-center gap-1.5 text-neutral-300">
                          <span className="text-neutral-400">{tr.from}</span>
                          <span className="text-purple-400">➔</span>
                          <span className="text-neutral-100 font-bold">{tr.to}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-neutral-500 text-[11px]">
                        {tr.payload && (
                          <span className="text-neutral-400 truncate max-w-xs">
                            {JSON.stringify(tr.payload)}
                          </span>
                        )}
                        <span>{new Date(tr.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
