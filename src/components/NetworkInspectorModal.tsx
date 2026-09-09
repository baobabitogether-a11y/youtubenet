import React, { useState } from 'react';
import {
  Activity,
  X,
  Search,
  Trash2,
  Copy,
  Check,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  AlertCircle,
  ExternalLink,
  Code,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearNetworkLogs,
  setFilterType,
  setSearchQuery,
  setSelectedRequestId,
  setNetworkInspectorOpen,
} from '../store/networkSlice';
import { NetworkRequestRecord } from '../store/types';

export const NetworkInspectorModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { requests, filterType, searchQuery, selectedRequestId, isInspectorOpen } =
    useAppSelector((state) => state.network);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isInspectorOpen) return null;

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    // Filter by type
    if (filterType === 'timedtext') {
      if (!req.url.includes('timedtext') && req.type !== 'timedtext_interception') return false;
    } else if (filterType === 'api') {
      if (!req.url.startsWith('/api/') && !req.url.includes('/api/')) return false;
    } else if (filterType === 'translation') {
      if (!req.url.includes('translate') && req.type !== 'translation_api') return false;
    } else if (filterType === 'failed') {
      if (!req.error && (!req.status || req.status < 400)) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUrl = req.url.toLowerCase().includes(q);
      const matchMethod = req.method.toLowerCase().includes(q);
      const matchBody = req.responseBody && JSON.stringify(req.responseBody).toLowerCase().includes(q);
      return matchUrl || matchMethod || matchBody;
    }

    return true;
  });

  const selectedRequest =
    requests.find((r) => r.id === selectedRequestId) || (filteredRequests.length > 0 ? filteredRequests[0] : null);

  const handleCopy = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const generateCurl = (req: NetworkRequestRecord): string => {
    let curl = `curl -X ${req.method} '${req.url}'`;
    if (req.requestHeaders) {
      Object.entries(req.requestHeaders).forEach(([k, v]) => {
        curl += ` \\\n  -H '${k}: ${v}'`;
      });
    }
    if (req.requestBody) {
      const bodyStr = typeof req.requestBody === 'object' ? JSON.stringify(req.requestBody) : String(req.requestBody);
      curl += ` \\\n  -d '${bodyStr}'`;
    }
    return curl;
  };

  return (
    <div
      id="network-inspector-modal"
      data-testid="network-inspector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={() => dispatch(setNetworkInspectorOpen(false))}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-neutral-950/80 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-100">Live Web Network Traffic Inspector</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {requests.length} captured
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Intercepts all web requests, fetch, XHR, timedtext streams, and backend API responses in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="clear-network-logs-button"
              type="button"
              onClick={() => dispatch(clearNetworkLogs())}
              disabled={requests.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 transition"
              title="Clear all recorded logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
            <button
              id="close-network-inspector-button"
              type="button"
              onClick={() => dispatch(setNetworkInspectorOpen(false))}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Close inspector (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-neutral-900/90 border-b border-neutral-800 text-xs">
          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-neutral-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>
            {(
              [
                { key: 'all', label: 'All Requests' },
                { key: 'timedtext', label: 'YouTube TimedText / CC' },
                { key: 'api', label: 'App APIs (/api/*)' },
                { key: 'translation', label: 'Translations' },
                { key: 'failed', label: 'Errors (4xx / 5xx)' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.key}
                id={`network-filter-${filter.key}-button`}
                type="button"
                onClick={() => dispatch(setFilterType(filter.key))}
                className={`px-2.5 py-1 rounded-md transition font-medium border ${
                  filterType === filter.key
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-neutral-500" />
            <input
              id="network-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              placeholder="Search URL or body..."
              className="w-full pl-8 pr-3 py-1 text-xs bg-neutral-950 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Master-Detail Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Requests List */}
          <div className="md:col-span-5 border-r border-neutral-800 overflow-y-auto divide-y divide-neutral-800/60 bg-neutral-950/40">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No network traffic matches current filters.</p>
                <p className="mt-1 text-neutral-600">Requests will appear here as the app makes calls.</p>
              </div>
            ) : (
              filteredRequests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                const isSuccess = req.status && req.status >= 200 && req.status < 300;
                const isError = req.error || (req.status && req.status >= 400);

                return (
                  <button
                    key={req.id}
                    id={`network-request-item-${req.id}`}
                    type="button"
                    onClick={() => dispatch(setSelectedRequestId(req.id))}
                    className={`w-full text-left p-3 transition flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-950/40 border-l-4 border-blue-500 text-neutral-100'
                        : 'hover:bg-neutral-800/40 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            req.method === 'POST'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : 'bg-blue-950 text-blue-400 border border-blue-800/60'
                          }`}
                        >
                          {req.method}
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            req.isPending
                              ? 'bg-amber-950 text-amber-300 animate-pulse'
                              : isSuccess
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : isError
                              ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {req.isPending ? 'PENDING' : req.status || 'ERR'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                        {req.duration !== undefined && <span>{req.duration}ms</span>}
                        <span>{new Date(req.startTime).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* URL Path */}
                    <p className="text-xs font-mono break-all line-clamp-2 text-neutral-300">
                      {req.url}
                    </p>

                    {/* Tag badge */}
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                        {req.type}
                      </span>
                      {req.error && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-400 flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" /> {req.error}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Detailed Inspector */}
          <div className="md:col-span-7 overflow-y-auto p-4 flex flex-col gap-4 bg-neutral-900">
            {selectedRequest ? (
              <div className="flex flex-col gap-4">
                {/* Request Overview Header */}
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Request Target
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(generateCurl(selectedRequest), 'curl')}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'curl' ? 'Copied cURL!' : 'Copy as cURL'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-neutral-200 break-all bg-neutral-900 p-2 rounded border border-neutral-800">
                    <span className="text-blue-400 font-bold mr-2">{selectedRequest.method}</span>
                    {selectedRequest.url}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs font-mono">
                    <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">STATUS</span>
                      <span
                        className={`font-bold ${
                          selectedRequest.status && selectedRequest.status < 400
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {selectedRequest.status ?? 'N/A'} {selectedRequest.statusText ?? ''}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">DURATION</span>
                      <span className="text-neutral-300">{selectedRequest.duration ?? 0} ms</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-900 border border-neutral-800">
                      <span className="text-neutral-500 block text-[10px]">TIMESTAMP</span>
                      <span className="text-neutral-300">
                        {new Date(selectedRequest.startTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Request Body (if any) */}
                {selectedRequest.requestBody && (
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Request Payload
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            typeof selectedRequest.requestBody === 'object'
                              ? JSON.stringify(selectedRequest.requestBody, null, 2)
                              : String(selectedRequest.requestBody),
                            'req-body'
                          )
                        }
                        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
                      >
                        {copiedKey === 'req-body' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <pre className="text-xs font-mono bg-neutral-900 p-2.5 rounded border border-neutral-800 overflow-x-auto text-neutral-300 max-h-44">
                      {typeof selectedRequest.requestBody === 'object'
                        ? JSON.stringify(selectedRequest.requestBody, null, 2)
                        : String(selectedRequest.requestBody)}
                    </pre>
                  </div>
                )}

                {/* Response Body */}
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Response Payload
                    </span>
                    {selectedRequest.responseBody && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            typeof selectedRequest.responseBody === 'object'
                              ? JSON.stringify(selectedRequest.responseBody, null, 2)
                              : String(selectedRequest.responseBody),
                            'res-body'
                          )
                        }
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        {copiedKey === 'res-body' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'res-body' ? 'Copied!' : 'Copy Body'}</span>
                      </button>
                    )}
                  </div>

                  {selectedRequest.isPending ? (
                    <div className="p-4 text-center text-amber-400 text-xs font-mono flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Waiting for server response...</span>
                    </div>
                  ) : selectedRequest.error ? (
                    <div className="p-3 rounded bg-red-950/60 border border-red-800/60 text-xs text-red-300 font-mono">
                      Error: {selectedRequest.error}
                    </div>
                  ) : (
                    <pre className="text-xs font-mono bg-neutral-900 p-2.5 rounded border border-neutral-800 overflow-x-auto text-neutral-200 max-h-80">
                      {typeof selectedRequest.responseBody === 'object'
                        ? JSON.stringify(selectedRequest.responseBody, null, 2)
                        : String(selectedRequest.responseBody || '[Empty Response]')}
                    </pre>
                  )}
                </div>

                {/* Headers */}
                {selectedRequest.responseHeaders && Object.keys(selectedRequest.responseHeaders).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Response Headers
                    </span>
                    <div className="divide-y divide-neutral-800 text-xs font-mono bg-neutral-900 p-2 rounded border border-neutral-800">
                      {Object.entries(selectedRequest.responseHeaders).map(([k, v]) => (
                        <div key={k} className="py-1 flex justify-between gap-4">
                          <span className="text-neutral-400">{k}:</span>
                          <span className="text-neutral-200 break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
                Select a request from the list to inspect headers and body payloads.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
