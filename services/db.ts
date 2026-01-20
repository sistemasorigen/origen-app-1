
import { initDB } from './idb-setup';
import { supabaseService } from './supabaseService';
import { InfoPointProduct, Movement, Baptism, ChildPresentation, Loan, AppEvent, AppSettings, ProductType, Song, AlabanzaApplication, AlabanzaCategory, AlabanzaArtist, PlaybackRecord } from '../types';

export const dbAPI = {
  // --- INFO POINT (SUPABASE) ---

  async getAllProducts(): Promise<InfoPointProduct[]> {
    return await supabaseService.getInfoProducts();
  },

  async addProduct(product: InfoPointProduct): Promise<void> {
    await supabaseService.saveInfoProduct(product);
  },

  async deleteProduct(code: string): Promise<void> {
    await supabaseService.deleteInfoProduct(code);
  },

  async updateProductPricesByType(type: ProductType, newPrice: number): Promise<void> {
    await supabaseService.updateInfoProductPrices(type, newPrice);
  },

  async getAllMovements(): Promise<Movement[]> {
    return await supabaseService.getInfoMovements();
  },

  async addMovement(movement: Movement): Promise<void> {
    await supabaseService.addInfoMovement(movement);
  },

  async deleteMovement(id: string): Promise<void> {
    await supabaseService.deleteInfoMovement(id);
  },

  async getAllBaptisms(): Promise<Baptism[]> {
    return await supabaseService.getBaptisms();
  },

  async addBaptism(baptism: Baptism): Promise<void> {
    await supabaseService.saveBaptism(baptism);
  },
  
  async updateBaptism(baptism: Baptism): Promise<void> {
    await supabaseService.saveBaptism(baptism);
  },

  async deleteBaptism(id: string): Promise<void> {
    await supabaseService.deleteBaptism(id);
  },

  async getAllPresentations(): Promise<ChildPresentation[]> {
    return await supabaseService.getPresentations();
  },

  async addPresentation(presentation: ChildPresentation): Promise<void> {
    await supabaseService.savePresentation(presentation);
  },

  async updatePresentation(presentation: ChildPresentation): Promise<void> {
      await supabaseService.savePresentation(presentation);
  },

  async deletePresentation(id: string): Promise<void> {
    await supabaseService.deletePresentation(id);
  },

  async getAllLoans(): Promise<Loan[]> {
    return await supabaseService.getLoans();
  },

  async addLoan(loan: Loan): Promise<void> {
    await supabaseService.saveLoan(loan);
  },
  
  async updateLoan(loan: Loan): Promise<void> {
      await supabaseService.saveLoan(loan);
  },

  async deleteLoan(id: string): Promise<void> {
    await supabaseService.deleteLoan(id);
  },

  async getAllEvents(): Promise<AppEvent[]> {
    return await supabaseService.getEvents();
  },

  async addEvent(event: AppEvent): Promise<void> {
    await supabaseService.saveEvent(event);
  },

  async updateEvent(event: AppEvent): Promise<void> {
      await supabaseService.saveEvent(event);
  },

  async deleteEvent(id: string): Promise<void> {
    await supabaseService.deleteEvent(id);
  },

  async getSettings(): Promise<AppSettings | undefined> {
    return await supabaseService.getInfoSettings();
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await supabaseService.saveInfoSettings(settings);
  },

  // --- ALABANZA (INDEXEDDB) ---

  async getAllSongs(): Promise<Song[]> {
    const db = await initDB();
    const songs = await db.getAll('songs');
    return songs;
  },

  async saveSong(song: Song): Promise<void> {
    const db = await initDB();
    await db.put('songs', song);
  },

  async deleteSong(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('songs', id);
  },

  async getAllAlabanzaApplications(): Promise<AlabanzaApplication[]> {
    const db = await initDB();
    return db.getAll('alabanza_applications');
  },

  async addAlabanzaApplication(application: AlabanzaApplication): Promise<void> {
    const db = await initDB();
    await db.put('alabanza_applications', application);
  },

  async deleteAlabanzaApplication(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('alabanza_applications', id);
  },

  async getAllAlabanzaCategories(): Promise<AlabanzaCategory[]> {
    const db = await initDB();
    const categories = await db.getAll('alabanza_categories');
    return categories;
  },

  async saveAlabanzaCategory(category: AlabanzaCategory): Promise<void> {
    const db = await initDB();
    await db.put('alabanza_categories', category);
  },

  async deleteAlabanzaCategory(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('alabanza_categories', id);
  },

  async getAllAlabanzaArtists(): Promise<AlabanzaArtist[]> {
    const db = await initDB();
    return db.getAll('alabanza_artists');
  },

  async saveAlabanzaArtist(artist: AlabanzaArtist): Promise<void> {
    const db = await initDB();
    await db.put('alabanza_artists', artist);
  },

  async deleteAlabanzaArtist(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('alabanza_artists', id);
  },

  async getAllPlaybackHistory(): Promise<PlaybackRecord[]> {
    const db = await initDB();
    return db.getAll('playback_history');
  },

  async addPlaybackRecord(record: PlaybackRecord): Promise<void> {
    const db = await initDB();
    await db.put('playback_history', record);
  }
};
