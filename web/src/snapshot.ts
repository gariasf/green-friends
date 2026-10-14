import { RELAY_URL, SNAPSHOT_LAYOUT, deriveSyncKeys } from '../../src/core/sync';

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

/**
 * A request to the relay that no cache answers, at an address of its own each time: a browser may
 * still hold a Snapshot kept from before the relay said `no-store` (spec #99). The relay reads
 * only the path. A `cache` mode would add request headers; this adds none, so the request stays
 * simple and needs no CORS preflight, which the relay doesn't answer.
 */
const fresh = (method: 'GET' | 'HEAD') => (url: string) =>
  fetch(`${url}?at=${Date.now()}`, { method });

/**
 * The garden's latest Snapshot, opened into its Export, when the relay took it and which upload it
 * is (`version`, as snapshotVersion has it); null where the relay has none for this key. Throws for
 * a relay that can't be reached or a Snapshot that won't open.
 */
export async function loadSnapshot(
  key: Uint8Array,
  get: (url: string) => Promise<Response> = fresh('GET'),
): Promise<{ zip: Uint8Array; takenAt: Date | null; version: string | null } | null> {
  const { gardenId, encryptionKey } = await deriveSyncKeys(key, sha256);
  const response = await get(`${RELAY_URL}/gardens/${gardenId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The relay answered HTTP ${response.status}`);
  // The relay always dates a Snapshot; without a date, the page says none rather than a wrong one.
  const lastModified = response.headers.get('Last-Modified');
  const takenAt = lastModified ? new Date(lastModified) : null;
  const version = versionOf(response);
  const sealed = new Uint8Array(await response.arrayBuffer());
  const aes = await crypto.subtle.importKey('raw', encryptionKey, 'AES-GCM', false, ['decrypt']);
  // iv | ciphertext | tag, and WebCrypto takes the tag at the ciphertext's end.
  const iv = sealed.subarray(0, SNAPSHOT_LAYOUT.ivLength);
  const opened = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aes,
    sealed.subarray(iv.length),
  );
  return { zip: new Uint8Array(opened), takenAt, version };
}

/**
 * Which upload the garden's latest Snapshot is, asked with HEAD so nothing is downloaded (spec
 * #99), for telling whether a newer one came; null where the relay has none for this key. Throws
 * for a relay that can't be reached.
 */
export async function snapshotVersion(
  key: Uint8Array,
  head: (url: string) => Promise<Response> = fresh('HEAD'),
): Promise<string | null> {
  const { gardenId } = await deriveSyncKeys(key, sha256);
  const response = await head(`${RELAY_URL}/gardens/${gardenId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The relay answered HTTP ${response.status}`);
  return versionOf(response);
}

/** A Snapshot's ETag, exact for each upload; its date, to the second, where none is readable. */
function versionOf(response: Response): string | null {
  return response.headers.get('ETag') ?? response.headers.get('Last-Modified');
}

/**
 * The key, kept in IndexedDB once a Pairing link has brought it, so a laptop pairs once. Only this
 * origin can read it, and it never leaves the browser.
 */
export function storedKey(): Promise<Uint8Array | undefined> {
  return keyStore('readonly', (store) => store.get('key'));
}

export function storeKey(key: Uint8Array): Promise<unknown> {
  return keyStore('readwrite', (store) => store.put(key, 'key'));
}

function keyStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open('green-friends', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('keys');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = run(open.result.transaction('keys', mode).objectStore('keys'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}
