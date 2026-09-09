import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Workflow,
  ChevronDown,
  ChevronUp,
  Radio,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store';
import { setNetworkInspectorOpen } from '../store/networkSlice';
import { setInspectorOpen } from '../store/errorsSlice';

export const FloatingDiagnosticDock: React.FC = () => {
  const dispatch = useAppDispatch();
  const { requests } = useAppSelector((state) => state.network);
  const { errors } = useAppSelector((state) => state.errors);
  const { currentState } = useAppSelector((state) => state.stateMachine);

  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const pendingRequests = requests.filter((r) => r.isPending).length;

  return (
    <aside
      id="floating-diagnostic-dock"
      data-testid="floating-diagnostic-dock"
      aria-label="Developer diagnostics dock"
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 font-sans select-none"
    >
      {isMinimized ? (
        <button
          id="expand-diagnostic-dock-button"
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 shadow-2xl backdrop-blur-md transition text-xs font-semibold"
          title="Expand Network & Error Inspectors"
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>{requests.length}</span>
          </div>
          {errors.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
          <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-900/95 border border-neutral-800 shadow-2xl backdrop-blur-md text-xs">
          {/* State Machine Status Badge */}
          <div
            id="state-machine-status-badge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-300 font-mono text-[11px]"
            title={`Redux State Machine: ${currentState}`}
          >
            <Workflow className="w-3 h-3 text-purple-400" />
            <span className="text-purple-300 font-medium">{currentState}</span>
          </div>

          {/* Network Inspector Button (Requirement 2) */}
          <button
            id="open-network-inspector-floating-button"
            data-testid="open-network-inspector-floating-button"
            type="button"
            onClick={() => dispatch(setNetworkInspectorOpen(true))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-800/60 transition active:scale-95 font-medium"
            title="Inspect all web requests and responses"
          >
            <div className="relative">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              {pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <span>Network</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-900/80 text-[10px] font-mono font-bold text-blue-200">
              {requests.length}
            </span>
          </button>

          {/* Error Inspector Button (Requirement 3) */}
          <button
            id="open-error-inspector-floating-button"
            data-testid="open-error-inspector-floating-button"
            type="button"
            onClick={() => dispatch(setInspectorOpen(true))}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition active:scale-95 font-medium ${
              errors.length > 0
                ? 'bg-red-950/70 hover:bg-red-900/80 text-red-300 border-red-700/80 animate-pulse'
                : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
            }`}
            title="Inspect application errors & state machine actions"
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${errors.length > 0 ? 'text-red-400' : 'text-neutral-400'}`}
            />
            <span>Errors</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                errors.length > 0
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              {errors.length}
            </span>
          </button>

          {/* Minimize toggle */}
          <button
            id="minimize-diagnostic-dock-button"
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
            title="Minimize Dock"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};
