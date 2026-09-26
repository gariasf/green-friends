import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { RELAY_URL } from '../../src/core/sync';
import { App } from './App';
import './app.css';

// PROTOTYPE (prototype/web-design): the dev server reaches the relay through its proxy, since the
// relay's CORS allows only the deployed origin.
if (import.meta.env.DEV) {
  const realFetch = fetch;
  globalThis.fetch = (input, init) =>
    realFetch(typeof input === 'string' ? input.replace(RELAY_URL, '/relay') : input, init);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
