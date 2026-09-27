import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Nunito Sans, bundled rather than fetched from a font CDN: the page makes no third-party requests.
import '@fontsource-variable/nunito-sans';
import '@fontsource-variable/nunito-sans/wght-italic.css';
// PROTOTYPE (prototype/title-fonts, never merged): the title faces to compare.
import '@fontsource-variable/fraunces';
import '@fontsource/young-serif';
import '@fontsource-variable/bricolage-grotesque';

import { App } from './App';
import './app.css';

// PROTOTYPE: ?title=A|B|C|D picks the titles' face, the pill switches.
const titleFont = new URLSearchParams(location.search).get('title') ?? 'A';
document.documentElement.dataset.title = titleFont;
const switcher = document.createElement('div');
switcher.className = 'title-switcher';
switcher.append('Titles');
for (const key of ['A', 'B', 'C', 'D']) {
  const link = document.createElement('a');
  link.textContent = key;
  link.href = `?title=${key}${location.hash}`;
  link.setAttribute('aria-current', String(key === titleFont));
  link.onclick = () => (link.href = `?title=${key}${location.hash}`);
  switcher.append(link);
}
document.body.append(switcher);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
