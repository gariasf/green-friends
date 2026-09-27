import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Nunito Sans, bundled rather than fetched from a font CDN: the page makes no third-party requests.
import '@fontsource-variable/nunito-sans';
import '@fontsource-variable/nunito-sans/wght-italic.css';

import { App } from './App';
import './app.css';

// PROTOTYPE (ticket #54, never merged): ?weights=A|B|C picks a weight set, the pill switches.
const weights = new URLSearchParams(location.search).get('weights') ?? 'A';
document.documentElement.dataset.weights = weights;
const switcher = document.createElement('div');
switcher.className = 'weights-switcher';
switcher.append('Weights');
for (const key of ['A', 'B', 'C']) {
  const link = document.createElement('a');
  link.textContent = key;
  link.href = `?weights=${key}${location.hash}`;
  link.setAttribute('aria-current', String(key === weights));
  // The hash changes as the page is used; keep it when switching.
  link.onclick = () => (link.href = `?weights=${key}${location.hash}`);
  switcher.append(link);
}
document.body.append(switcher);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
