

import { openDB, DBSchema } from 'idb';
import { Song, AlabanzaApplication, AlabanzaCategory, AlabanzaArtist, PlaybackRecord } from '../types';

export interface OrigenDB extends DBSchema {
  products: {
    key: string; // code
    value: any;
    indexes: { 'by-type': string; 'by-size': string };
  };
  movements: {
    key: string; // id
    value: any;
    indexes: { 'by-code': string; 'by-date': string; 'by-type': string };
  };
  baptisms: {
    key: string;
    value: any;
    indexes: { 'by-pending': number; 'by-date': string };
  };
  presentations: {
    key: string;
    value: any;
    indexes: { 'by-pending': number; 'by-date': string };
  };
  loans: {
    key: string;
    value: any;
    indexes: { 'by-status': string; 'by-date': string };
  };
  events: {
    key: string;
    value: any;
    indexes: { 'by-date': string };
  };
  settings: {
    key: string;
    value: any;
  };
  songs: {
    key: string; // id
    value: Song;
    indexes: { 'by-date': string };
  };
  alabanza_applications: {
    key: string; // id
    value: AlabanzaApplication;
    indexes: { 'by-date': string; 'by-status': string };
  };
  alabanza_categories: {
    key: string; // id
    value: AlabanzaCategory;
  };
  alabanza_artists: {
    key: string; // id
    value: AlabanzaArtist;
  };
  playback_history: {
    key: string; // id
    value: PlaybackRecord;
    indexes: { 'by-date': string; 'by-song': string };
  }
}

export const DB_NAME = 'OrigenDB';
export const DB_VERSION = 5; // Incremented for Playback History

export const initDB = async () => {
  return openDB<OrigenDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Products Store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'code' });
        productStore.createIndex('by-type', 'type');
        productStore.createIndex('by-size', 'size');
      }

      // Movements Store
      if (!db.objectStoreNames.contains('movements')) {
        const moveStore = db.createObjectStore('movements', { keyPath: 'id' });
        moveStore.createIndex('by-code', 'productCode');
        moveStore.createIndex('by-date', 'date');
        moveStore.createIndex('by-type', 'type');
      }

      // Baptisms Store
      if (!db.objectStoreNames.contains('baptisms')) {
        const baptismStore = db.createObjectStore('baptisms', { keyPath: 'id' });
        baptismStore.createIndex('by-pending', 'isPending');
        baptismStore.createIndex('by-date', 'createdAt');
      }

      // Presentations Store
      if (!db.objectStoreNames.contains('presentations')) {
        const presStore = db.createObjectStore('presentations', { keyPath: 'id' });
        presStore.createIndex('by-pending', 'isPending');
        presStore.createIndex('by-date', 'scheduledDate');
      }

      // Loans Store
      if (!db.objectStoreNames.contains('loans')) {
        const loanStore = db.createObjectStore('loans', { keyPath: 'id' });
        loanStore.createIndex('by-status', 'status');
        loanStore.createIndex('by-date', 'loanDate');
      }

      // Events Store
      if (!db.objectStoreNames.contains('events')) {
        const eventStore = db.createObjectStore('events', { keyPath: 'id' });
        eventStore.createIndex('by-date', 'createdAt');
      }

      // Settings Store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Songs Store
      if (!db.objectStoreNames.contains('songs')) {
        const songStore = db.createObjectStore('songs', { keyPath: 'id' });
        songStore.createIndex('by-date', 'addedAt');
      }

      // Alabanza Applications Store
      if (!db.objectStoreNames.contains('alabanza_applications')) {
        const appStore = db.createObjectStore('alabanza_applications', { keyPath: 'id' });
        appStore.createIndex('by-date', 'timestamp');
        appStore.createIndex('by-status', 'status');
      }

      // Alabanza Categories Store
      if (!db.objectStoreNames.contains('alabanza_categories')) {
        db.createObjectStore('alabanza_categories', { keyPath: 'id' });
      }

      // Alabanza Artists Store
      if (!db.objectStoreNames.contains('alabanza_artists')) {
        db.createObjectStore('alabanza_artists', { keyPath: 'id' });
      }

      // Playback History Store
      if (!db.objectStoreNames.contains('playback_history')) {
        const historyStore = db.createObjectStore('playback_history', { keyPath: 'id' });
        historyStore.createIndex('by-date', 'timestamp');
        historyStore.createIndex('by-song', 'songId');
      }
    },
  });
};