import type { PhotoFiles } from '../core/photos';

/** A fake photo store for the core seam tests: which prepared JPEG was moved in under which filename. */
export function photoStore() {
  const stored = new Map<string, string>();
  const files: PhotoFiles = {
    store: (source, filename) => void stored.set(filename, source),
    remove: (filename) => void stored.delete(filename),
    removeAll: () => stored.clear(),
  };
  return { files, stored: () => Object.fromEntries(stored) };
}
