import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { initGlobalNetworkAndErrorInterceptors } from './utils/networkInterceptor';
import App from './App.tsx';
import './index.css';

// Initialize global network traffic and runtime error interception
initGlobalNetworkAndErrorInterceptors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
