/**
 * Oruinwan collab provider: syncs a Y.Doc with the server over an existing
 * Socket.IO connection (the app's authenticated socket). Copy this file into
 * a client (web: client/src/lib/collab/, phone: mobile/src/data/live/).
 *
 * Depends only on: yjs, y-protocols, lib0 and a socket.io-client Socket.
 * Protocol reference: docs/api/collab.md.
 *
 *   import * as Y from 'yjs';
 *   import { CollabProvider } from './collab-provider.js';
 *
 *   const provider = new CollabProvider(socket, 'knowledge', pageId, {
 *     user: { name: 'Ada', color: '#f59e0b' },   // shown to others via awareness
 *   });
 *   provider.on('synced', () => editor.bind(provider.doc.getText('content')));
 *   provider.on('status', (s) => ...);          // 'connecting' | 'connected' | 'synced' | 'offline' | 'closed' | 'error'
 *   provider.on('error', ({ code, message }) => ...);
 *   provider.on('saved', ({ savedAt }) => ...);
 *   ...
 *   provider.destroy();
 *
 * Rules: never seed the doc yourself (the server seeds it from the stored
 * content); wait for 'synced' before binding an editor; when provider.readOnly
 * is true keep the editor read-only (local edits are not sent).
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const ORIGIN = 'collab-provider';

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (data && data.type === 'Buffer' && Array.isArray(data.data)) return Uint8Array.from(data.data);
  return null;
}

export class CollabProvider {
  /**
   * @param {import('socket.io-client').Socket} socket  connected (or connecting) app socket
   * @param {'note'|'knowledge'|'whiteboard'} docType
   * @param {string} docId     note id, knowledge page id, or meeting id (whiteboard)
   * @param {{ doc?: Y.Doc, user?: object }} [opts]
   */
  constructor(socket, docType, docId, opts = {}) {
    this.socket = socket;
    this.docType = docType;
    this.docId = docId;
    this.doc = opts.doc || new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    if (opts.user) this.awareness.setLocalStateField('user', opts.user);
    this.readOnly = false;
    this.joined = false;
    this.synced = false;
    this.status = 'connecting';
    this.destroyed = false;
    this._listeners = new Map();

    const mine = (p) => p && p.docType === this.docType && p.docId === this.docId;

    this._onSync = (p) => {
      if (!mine(p) || !this.joined) return;
      const msg = toBytes(p.msg);
      if (!msg) return;
      const decoder = decoding.createDecoder(msg);
      const encoder = encoding.createEncoder();
      const type = syncProtocol.readSyncMessage(decoder, encoder, this.doc, ORIGIN);
      // Reply to the server's step 1 with our missing updates (writers only).
      if (encoding.length(encoder) > 0 && !this.readOnly) this._send('collab:sync', encoding.toUint8Array(encoder));
      if (type === syncProtocol.messageYjsSyncStep2 && !this.synced) {
        this.synced = true;
        this._setStatus('synced');
        this._fire('synced', { readOnly: this.readOnly });
      }
    };
    this._onAwareness = (p) => {
      if (!mine(p)) return;
      const msg = toBytes(p.msg);
      if (msg) awarenessProtocol.applyAwarenessUpdate(this.awareness, msg, ORIGIN);
    };
    this._onSaved = (p) => { if (mine(p)) this._fire('saved', p); };
    this._onError = (p) => { if (mine(p)) this._fire('error', p); };
    this._onClosed = (p) => {
      if (!mine(p)) return;
      this.joined = false;
      this._setStatus('closed');
      this._fire('closed', p);
    };
    this._onConnect = () => this._join();
    this._onDisconnect = () => {
      this.joined = false;
      this.synced = false;
      const others = Array.from(this.awareness.getStates().keys()).filter((id) => id !== this.doc.clientID);
      awarenessProtocol.removeAwarenessStates(this.awareness, others, ORIGIN);
      this._setStatus('offline');
    };

    this._onDocUpdate = (update, origin) => {
      if (origin === ORIGIN || !this.joined || this.readOnly) return;
      const enc = encoding.createEncoder();
      syncProtocol.writeUpdate(enc, update);
      this._send('collab:sync', encoding.toUint8Array(enc));
    };
    this._onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === ORIGIN || !this.joined) return;
      const changed = added.concat(updated, removed);
      this._send('collab:awareness', awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
    };

    socket.on('collab:sync', this._onSync);
    socket.on('collab:awareness', this._onAwareness);
    socket.on('collab:saved', this._onSaved);
    socket.on('collab:error', this._onError);
    socket.on('collab:closed', this._onClosed);
    socket.on('connect', this._onConnect);
    socket.on('disconnect', this._onDisconnect);
    this.doc.on('update', this._onDocUpdate);
    this.awareness.on('update', this._onAwarenessUpdate);

    if (socket.connected) this._join();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event).delete(fn);
  }

  _fire(event, payload) {
    (this._listeners.get(event) || []).forEach((fn) => {
      try { fn(payload); } catch (err) { console.error('[collab]', err); }
    });
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this._fire('status', status);
  }

  _send(event, msg) {
    this.socket.emit(event, { docType: this.docType, docId: this.docId, msg });
  }

  _join() {
    if (this.destroyed) return;
    this.socket.emit('collab:join', { docType: this.docType, docId: this.docId }, (res) => {
      if (this.destroyed) return;
      if (!res || !res.ok) {
        this._setStatus('error');
        this._fire('error', res || { code: 'SERVER_ERROR', message: 'Join failed' });
        return;
      }
      this.readOnly = !!res.readOnly;
      this.joined = true;
      this._setStatus('connected');
      // Ask for what we are missing (the server answers with sync step 2).
      const enc = encoding.createEncoder();
      syncProtocol.writeSyncStep1(enc, this.doc);
      this._send('collab:sync', encoding.toUint8Array(enc));
      if (this.awareness.getLocalState() !== null) {
        this._send('collab:awareness', awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
      }
    });
  }

  /** Leave the document and stop listening. The Y.Doc is left intact for the caller. */
  destroy() {
    if (this.destroyed) return;
    if (this.joined) {
      awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy');
      this._send('collab:awareness', awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
      this.socket.emit('collab:leave', { docType: this.docType, docId: this.docId });
    }
    this.destroyed = true;
    this.joined = false;
    this.socket.off('collab:sync', this._onSync);
    this.socket.off('collab:awareness', this._onAwareness);
    this.socket.off('collab:saved', this._onSaved);
    this.socket.off('collab:error', this._onError);
    this.socket.off('collab:closed', this._onClosed);
    this.socket.off('connect', this._onConnect);
    this.socket.off('disconnect', this._onDisconnect);
    this.doc.off('update', this._onDocUpdate);
    this.awareness.off('update', this._onAwarenessUpdate);
    this.awareness.destroy();
    this._setStatus('closed');
    this._listeners.clear();
  }
}

export default CollabProvider;
