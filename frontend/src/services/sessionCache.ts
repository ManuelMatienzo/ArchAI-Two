/** Account- and room-scoped recovery. API responses are never cached by the service worker. */
let database: Promise<IDBDatabase> | undefined;
const open = () =>
  (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('archai-sessions', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
export async function readSessionCache<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('session').objectStore('session').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}
export async function writeSessionCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('session', 'readwrite');
      tx.objectStore('session').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* The live session remains available if private browsing disables IndexedDB. */
  }
}
