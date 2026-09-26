import type { NativeIntent } from 'expo-router';

import { APP_PAIRING_LINK } from '@/src/core/sync';

/**
 * A Pairing link opened on this phone (`greenfriends://pair#k=…`) has no screen: useSync takes it
 * from Linking. Here it only stays off the router, which would show "Unmatched route".
 */
export const redirectSystemPath: NativeIntent['redirectSystemPath'] = ({ path, initial }) => {
  if (!path.startsWith(APP_PAIRING_LINK) && !/^\/pair([/?#]|$)/.test(path)) return path;
  return initial ? '/' : null;
};
