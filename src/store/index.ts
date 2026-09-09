import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import stateMachineReducer from './stateMachineSlice';
import errorsReducer from './errorsSlice';
import networkReducer from './networkSlice';

export const store = configureStore({
  reducer: {
    stateMachine: stateMachineReducer,
    errors: errorsReducer,
    network: networkReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Allow Error objects, Response payloads, and raw traces
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
