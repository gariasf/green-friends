import type { PhotoFiles } from '../core/photos';

/**
 * A fake photo store for the core seam tests: which prepared JPEG was moved in under which
 * filename. A stored file reads back as the text of its source, and a written one as its bytes.
 */
export function photoStore() {
  const stored = new Map<string, string>();
  const files: PhotoFiles = {
    store: (source, filename) => void stored.set(filename, source),
    write: (filename, bytes) => void stored.set(filename, new TextDecoder().decode(bytes)),
    read: (filename) => {
      const source = stored.get(filename);
      if (source === undefined) throw new Error(`No file ${filename}`);
      return new TextEncoder().encode(source);
    },
    remove: (filename) => void stored.delete(filename),
    removeAll: () => stored.clear(),
  };
  return { files, stored: () => Object.fromEntries(stored) };
}
