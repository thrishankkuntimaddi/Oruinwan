// Before the rename to Oruinwan, the app saved browser data under "chttrix" names.
// These helpers move that data to the new names once, so nobody loses settings or keys.
import logger from './logger';

const OLD = 'chttrix';
const NEW = 'oruinwan';

/** Moves localStorage keys like `chttrix_recent_searches` to `oruinwan_recent_searches`. */
export function migrateLegacyLocalStorage(storage = globalThis.localStorage) {
    try {
        if (!storage) return;
        const oldKeys = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.toLowerCase().startsWith(OLD)) oldKeys.push(key);
        }
        for (const key of oldKeys) {
            const newKey = NEW + key.slice(OLD.length);
            if (storage.getItem(newKey) === null) storage.setItem(newKey, storage.getItem(key));
            storage.removeItem(key);
        }
    } catch {
        /* storage blocked or full: nothing to move */
    }
}

// Opens a database only if it already exists (aborting the upgrade of a new one deletes it).
function openIfExists(name) {
    return new Promise((resolve) => {
        let created = false;
        const req = indexedDB.open(name);
        req.onupgradeneeded = (e) => {
            if (e.oldVersion === 0) {
                created = true;
                req.transaction.abort();
            }
        };
        req.onsuccess = () => (created ? (req.result.close(), resolve(null)) : resolve(req.result));
        req.onerror = (e) => { e.preventDefault?.(); resolve(null); };
        req.onblocked = () => resolve(null);
    });
}

function readAll(db, storeName) {
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(storeName)) return resolve([]);
        const req = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

function openTarget(name, storeName, keyPath) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(name, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName, { keyPath });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Copies records the new store does not have yet; existing ones are kept.
function copyMissing(db, storeName, keyPath, records) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        for (const record of records) {
            const get = store.get(record[keyPath]);
            get.onsuccess = () => { if (!get.result) store.put(record); };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

/**
 * Copies an old IndexedDB database (for example ChttrixE2EE) into its new name, then deletes
 * the old one. If anything fails, the old database is left alone.
 */
export async function migrateLegacyIndexedDb(oldName, newName, storeName, keyPath = 'userId') {
    if (typeof indexedDB === 'undefined') return;
    let oldDb = null;
    try {
        oldDb = await openIfExists(oldName);
        if (!oldDb) return;
        const records = await readAll(oldDb, storeName);
        oldDb.close();
        oldDb = null;
        if (records.length) {
            const newDb = await openTarget(newName, storeName, keyPath);
            try { await copyMissing(newDb, storeName, keyPath, records); } finally { newDb.close(); }
        }
        indexedDB.deleteDatabase(oldName);
    } catch (err) {
        if (oldDb) oldDb.close();
        logger.warn(`Could not move ${oldName} to ${newName}:`, err);
    }
}

const pending = new Map();

/** Runs migrateLegacyIndexedDb once per page load; later calls wait for the same run. */
export function migrateLegacyIndexedDbOnce(oldName, newName, storeName, keyPath) {
    if (!pending.has(oldName)) pending.set(oldName, migrateLegacyIndexedDb(oldName, newName, storeName, keyPath));
    return pending.get(oldName);
}
