import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppStateMachineState, StateMachineTransition } from './types';

interface StateMachineSliceState {
  currentState: AppStateMachineState;
  previousState: AppStateMachineState | null;
  history: StateMachineTransition[];
  lastAction: string | null;
}

const initialState: StateMachineSliceState = {
  currentState: 'idle',
  previousState: null,
  history: [],
  lastAction: null,
};

// Define valid state transitions
const VALID_TRANSITIONS: Record<AppStateMachineState, AppStateMachineState[]> = {
  idle: ['loading_video', 'error'],
  loading_video: ['video_ready', 'fetching_captions', 'error', 'idle'],
  video_ready: ['fetching_captions', 'playing', 'paused', 'loading_video', 'error'],
  fetching_captions: ['captions_loaded', 'video_ready', 'error'],
  captions_loaded: ['playing', 'paused', 'syncing_tts', 'loading_video', 'error'],
  playing: ['paused', 'syncing_tts', 'loading_video', 'error'],
  paused: ['playing', 'syncing_tts', 'loading_video', 'error'],
  syncing_tts: ['playing', 'paused', 'error'],
  error: ['idle', 'loading_video', 'video_ready', 'fetching_captions'],
};

export const stateMachineSlice = createSlice({
  name: 'stateMachine',
  initialState,
  reducers: {
    transition: (
      state,
      action: PayloadAction<{
        to: AppStateMachineState;
        actionName: string;
        payload?: any;
        force?: boolean;
      }>
    ) => {
      const { to, actionName, payload, force } = action.payload;
      const from = state.currentState;

      const isValid = force || (VALID_TRANSITIONS[from] && VALID_TRANSITIONS[from].includes(to));
      
      const transitionEntry: StateMachineTransition = {
        id: `trans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        from,
        to,
        action: actionName,
        payload,
        timestamp: Date.now(),
      };

      state.history.unshift(transitionEntry);
      if (state.history.length > 50) {
        state.history.pop();
      }

      state.previousState = from;
      state.currentState = to;
      state.lastAction = actionName;

      if (!isValid) {
        console.warn(`[StateMachine Warning] Invalid transition from "${from}" to "${to}" via "${actionName}"`);
      }
    },
    resetStateMachine: (state) => {
      state.previousState = state.currentState;
      state.currentState = 'idle';
      state.lastAction = 'RESET';
    },
  },
});

export const { transition, resetStateMachine } = stateMachineSlice.actions;
export default stateMachineSlice.reducer;
