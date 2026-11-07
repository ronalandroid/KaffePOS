/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/slices/menuSlice.ts — menu CRUD with optimistic updates + offline queue.
import { createMenuItem, removeMenuItem, updateMenuItem } from '@/lib/backendApi';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { menuItemSchema } from '@/utils/validation';
import type { MenuItem } from '@/types';
import type { AppSlice, MenuSlice } from '../types';
import { makeClientId, persistCache } from '../cache';
import { markInserted } from '../dedupe';
import { addPendingWrite } from '../sync';
import { initialState } from '../defaults';

export const createMenuSlice: AppSlice<MenuSlice> = (set, get) => ({
  menu: initialState.menu,

  saveMenuItem: async (item) => {
    // ── Input Sanitization ──
    if (!item.id) { // Only for new items
      const validation = menuItemSchema.safeParse(item);
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }
    }
    const { storeId, menu, customCats } = get();
    if (!storeId) throw new Error('Store belum dimuat');
    const stdCats = ['Coffee', 'Non-Coffee', 'Snack'];

    try {
      if (item.id) {
        const updated = menu.map(m => m.id === item.id ? { ...m, ...item } as MenuItem : m);
        const freshCats = [...new Set(updated.map(m => m.category))].filter(c => c && !stdCats.includes(c));
        set({ menu: updated, customCats: freshCats });
        persistCache(storeId, updated, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        try {
          await updateMenuItem(item.id, {
            name: item.name, price: item.price, category: item.category,
            image_url: item.image_url || '', description: item.description || '',
            recipe: item.recipe || [], variants: item.variants || [], modifiers: item.modifiers || [],
            is_available: item.is_available ?? true,
          });
        } catch (error) {
          set({ menu, customCats });
          persistCache(storeId, menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
          throw error;
        }
      } else {
        const tempId = makeClientId('menu');
        const optimistic: MenuItem = {
          id: tempId, store_id: storeId,
          name: item.name || '', price: item.price || 0,
          category: item.category || 'Coffee', image_url: item.image_url || '',
          description: item.description || '', recipe: item.recipe || [],
          variants: item.variants || [], modifiers: item.modifiers || [], is_available: item.is_available ?? true,
          sort_order: menu.length,
        };
        const newMenu = [...menu, optimistic];
        const freshCats = [...new Set(newMenu.map(m => m.category))].filter(c => c && !stdCats.includes(c));
        set({ menu: newMenu, customCats: freshCats });
        persistCache(storeId, newMenu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);

        let data: MenuItem | null = null;
        try {
          data = await createMenuItem({
            id: tempId,
            store_id: storeId, name: item.name, price: item.price || 0,
            category: item.category || 'Coffee', image_url: item.image_url || '',
            description: item.description || '', recipe: item.recipe || [],
            variants: item.variants || [], modifiers: item.modifiers || [], sort_order: menu.length,
            is_available: item.is_available ?? true,
          });
        } catch {
          addPendingWrite(storeId, {
            table: 'menu_items',
            op: 'insert',
            data: {
              id: tempId,
              store_id: storeId, name: item.name, price: item.price || 0,
              category: item.category || 'Coffee', image_url: item.image_url || '',
              description: item.description || '', recipe: item.recipe || [],
              variants: item.variants || [], modifiers: item.modifiers || [], sort_order: menu.length, is_available: item.is_available ?? true,
            }
          });
          import('@/utils/toast').then(m => m.showToast('Menu disimpan offline dan akan disinkronkan otomatis', 'success'));
          return;
        }
        if (data) {
          markInserted(data.id);
          set(s => ({ menu: s.menu.map(m => m.id === tempId ? data as MenuItem : m) }));
          persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        }
      }
    } catch (e:any) {
      throw new Error(normalizeUserFacingError(e, 'Menu belum bisa disimpan. Periksa kembali data menu.'));
    }
  },

  deleteMenuItem: async (id) => {
    const { storeId } = get();
    if (!storeId) return;
    set(s => ({ menu: s.menu.filter(m => m.id !== id) }));
    persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
    try {
      await removeMenuItem(id);
    } catch {
      addPendingWrite(storeId, { table: 'menu_items', op: 'delete', id, data: {} });
      import('@/utils/toast').then(m => m.showToast('Penghapusan menu dijadwalkan saat online kembali', 'success'));
    }
  },
});
