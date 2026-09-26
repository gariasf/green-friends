import { RELAY_URL, SNAPSHOT_LAYOUT, deriveSyncKeys, fromBase64url } from '../../src/core/sync';

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

/** The key a Pairing link carries after its `#k=` (spec #35): 32 bytes, 43 in base64url, or null for anything else. */
export function keyFromFragment(fragment: string): Uint8Array | null {
  const match = /^#k=([A-Za-z0-9_-]{43})$/.exec(fragment);
  return match ? fromBase64url(match[1]) : null;
}

/**
 * The garden's latest Snapshot, opened into its Export, and when the relay took it; null where the
 * relay has none for this key. Throws for a relay that can't be reached or a Snapshot that won't open.
 */
export async function loadSnapshot(
  key: Uint8Array,
  get: (url: string) => Promise<Response> = fetch,
): Promise<{ zip: Uint8Array; takenAt: Date | null } | null> {
  const { gardenId, encryptionKey } = await deriveSyncKeys(key, sha256);
  const response = await get(`${RELAY_URL}/gardens/${gardenId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The relay answered HTTP ${response.status}`);
  const lastModified = response.headers.get('Last-Modified');
  const sealed = new Uint8Array(await response.arrayBuffer());
  const aes = await crypto.subtle.importKey('raw', encryptionKey, 'AES-GCM', false, ['decrypt']);
  // iv | ciphertext | tag, and WebCrypto takes the tag at the ciphertext's end.
  const iv = sealed.subarray(0, SNAPSHOT_LAYOUT.ivLength);
  const opened = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aes,
    sealed.subarray(iv.length),
  );
  return {
    zip: new Uint8Array(opened),
    // The relay always dates it; without a date, the page says none rather than a wrong one.
    takenAt: lastModified ? new Date(lastModified) : null,
  };
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
