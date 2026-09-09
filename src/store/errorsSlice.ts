import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppErrorItem, ErrorSection } from './types';

interface ErrorsSliceState {
  errors: AppErrorItem[];
  selectedSection: ErrorSection | 'all';
  isInspectorOpen: boolean;
}

const initialState: ErrorsSliceState = {
  errors: [],
  selectedSection: 'all',
  isInspectorOpen: false,
};

export const errorsSlice = createSlice({
  name: 'errors',
  initialState,
  reducers: {
    addError: (
      state,
      action: PayloadAction<{
        section: ErrorSection;
        title: string;
        message: string;
        details?: any;
        stack?: string;
      }>
    ) => {
      const errorItem: AppErrorItem = {
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        section: action.payload.section,
        title: action.payload.title,
        message: action.payload.message,
        timestamp: Date.now(),
        details: action.payload.details,
        stack: action.payload.stack,
        resolved: false,
      };
      state.errors.unshift(errorItem);
      // Keep last 100 errors
      if (state.errors.length > 100) {
        state.errors.pop();
      }
    },
    resolveError: (state, action: PayloadAction<string>) => {
      const item = state.errors.find((e) => e.id === action.payload);
      if (item) {
        item.resolved = true;
      }
    },
    clearErrorsBySection: (state, action: PayloadAction<ErrorSection>) => {
      state.errors = state.errors.filter((e) => e.section !== action.payload);
    },
    clearAllErrors: (state) => {
      state.errors = [];
    },
    setSelectedSection: (state, action: PayloadAction<ErrorSection | 'all'>) => {
      state.selectedSection = action.payload;
    },
    setInspectorOpen: (state, action: PayloadAction<boolean>) => {
      state.isInspectorOpen = action.payload;
    },
    toggleInspectorOpen: (state) => {
      state.isInspectorOpen = !state.isInspectorOpen;
    },
  },
});

export const {
  addError,
  resolveError,
  clearErrorsBySection,
  clearAllErrors,
  setSelectedSection,
  setInspectorOpen,
  toggleInspectorOpen,
} = errorsSlice.actions;

export default errorsSlice.reducer;
