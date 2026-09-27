import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Nunito Sans and Young Serif, bundled rather than fetched from a font CDN: the page makes no
// third-party requests.
import '@fontsource-variable/nunito-sans';
import '@fontsource-variable/nunito-sans/wght-italic.css';
import '@fontsource/young-serif';

import { App } from './App';
import './app.css';

// PROTOTYPE (prototype/surfaces, never merged): ?ground=A|B|C&hero=A|B|C&garden=A|B, as the phone's
// pill; app.css and screens.tsx read them from <html>.
const params = new URLSearchParams(location.search);
const SURFACES = {
  ground: params.get('ground') ?? 'A',
  hero: params.get('hero') ?? 'A',
  garden: params.get('garden') ?? 'A',
};
Object.assign(document.documentElement.dataset, SURFACES);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
