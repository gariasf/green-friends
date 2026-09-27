// The bundled Care Guides (ADR-0008), with nothing from React Native, so the Web view reads the
// same. Relative imports, as in src/core: the Web view's build has no `@/`.
import bundled from '../../assets/care-guides.json';
import type { CareGuides } from '../core/careGuide';

/** `src/core/careGuide.test.ts` checks the rules this cast takes on trust. */
export const guides = bundled as unknown as CareGuides;
