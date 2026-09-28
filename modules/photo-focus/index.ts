import { requireNativeModule } from 'expo';

import type { Focus } from '@/src/core/photos';

const PhotoFocus = requireNativeModule<{ findFocus(uri: string): Promise<Focus> }>('PhotoFocus');

/** The Focal point of the photo at `uri`, found by Apple Vision on the phone (ADR-0010). */
export function findFocus(uri: string): Promise<Focus> {
  return PhotoFocus.findFocus(uri);
}
