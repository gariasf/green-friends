import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Nunito Sans and Young Serif, bundled rather than fetched from a font CDN: the page makes no
// third-party requests.
import '@fontsource-variable/nunito-sans';
import '@fontsource-variable/nunito-sans/wght-italic.css';
import '@fontsource/young-serif';

import { App } from './App';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
