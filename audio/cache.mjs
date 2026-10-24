// Byte-bounded LRU: a few long stereo buffers cannot grow until GC stalls audio.
export class BufferCache {
  constructor(maxBytes = 160 * 1024 ** 2) { this.maxBytes = maxBytes; this.bytes = 0; this.entries = new Map(); }
  get(key) {
    const value = this.entries.get(key);
    if (value) { this.entries.delete(key); this.entries.set(key, value); }
    return value;
  }
  set(key, value) {
    const bytes = value.buffer.length * value.buffer.numberOfChannels * 4;
    this.delete(key);
    if (bytes > this.maxBytes) return;
    while (this.bytes + bytes > this.maxBytes && this.entries.size) this.delete(this.entries.keys().next().value);
    this.entries.set(key, { ...value, bytes }); this.bytes += bytes;
  }
  delete(key) { const old = this.entries.get(key); if (old) { this.bytes -= old.bytes; this.entries.delete(key); } }
}

const DATABASE = 'mono-render-cache-v1';
const MAX_DISK_BYTES = 384 * 1024 ** 2;
async function openCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const db=request.result;
      if(!db.objectStoreNames.contains('renders'))db.createObjectStore('renders',{keyPath:'key'});
      if(!db.objectStoreNames.contains('metadata'))db.createObjectStore('metadata',{keyPath:'key'}).createIndex('used','used');
    };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function readDisk(key) {
  let db;
  try {
    db = await openCache();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['renders','metadata'], 'readwrite'), store = tx.objectStore('renders');
      const request = store.get(key); let result = null;
      request.onsuccess = () => { result = request.result || null; if (result) tx.objectStore('metadata').put({key,bytes:result.bytes,used:Date.now()}); };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error);
    });
  } catch { return null; } finally { db?.close(); }
}
export async function writeDisk(record) {
  let db;
  try {
    if (record.bytes > MAX_DISK_BYTES) return;
    db = await openCache();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['renders','metadata'], 'readwrite'), store = tx.objectStore('renders');
      store.put(record);
      const metadata=tx.objectStore('metadata');
      metadata.put({key:record.key,bytes:record.bytes,used:Date.now()});
      const request = metadata.index('used').openCursor(null, 'prev');
      let bytes = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        bytes += cursor.value.bytes;
        if (bytes > MAX_DISK_BYTES) {store.delete(cursor.primaryKey);cursor.delete();}
        cursor.continue();
      };
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  } catch { /* Private mode or a full quota must not interrupt playback. */ }
  finally { db?.close(); }
}
