// src/store/slices/inventorySlice.ts — inventory items, stock opname, unit
// conversions, and bulk import. Optimistic updates with offline-queue fallback.
import {
  commitStockBulkImport,
  createExpense,
  createInventoryAdjustment,
  createInventoryItem,
  createStockUnitConversion,
  deleteStockUnitConversion,
  removeInventoryItem,
  updateInventoryItem,
  updateStockUnitConversion,
} from '@/lib/backendApi';
import type { Expense, InventoryItem, StockUnitConversion } from '@/types';
import type { AppSlice, InventorySlice } from '../types';
import { makeClientId, persistCache } from '../cache';
import { markInserted } from '../dedupe';
import { addPendingWrite } from '../sync';
import { initialState } from '../defaults';

export const createInventorySlice: AppSlice<InventorySlice> = (set, get) => ({
  inventory:       initialState.inventory,
  unitConversions: initialState.unitConversions,

  saveInventoryItem: async (item) => {
    const { storeId, inventory } = get();
    if (!storeId) throw new Error('Store belum dimuat');

    const qty       = typeof item.qty === 'string' ? parseFloat(item.qty) : (item.qty || 0);
    const totalCost = typeof item.cost === 'string' ? parseFloat(item.cost) : (item.cost || 0);
    const minStock  = typeof item.minStock === 'string' ? parseFloat(item.minStock) : (item.minStock || 5);
    const unitCost  = qty > 0 ? totalCost / qty  : 0;
    const baseUnit = item.unit || 'pcs';
    const purchaseUnit = item.purchaseUnit || baseUnit;
    const conversionRatio = typeof item.conversionRatio === 'string'
      ? parseFloat(item.conversionRatio)
      : (item.conversionRatio || 1);

    if (qty < 0 || totalCost < 0 || minStock < 0 || unitCost < 0) {
      throw new Error('Qty, biaya, dan stok minimum tidak boleh negatif.');
    }

    if (item.type === 'new') {
      const tempId = makeClientId('inv');
      const optimistic: InventoryItem = {
        id: tempId, store_id: storeId,
        name: item.name, stock: qty,
        unit: baseUnit,
        sku: item.sku || null,
        base_unit: baseUnit,
        purchase_unit: purchaseUnit,
        conversion_ratio: conversionRatio,
        is_active: item.isActive ?? true,
        min_stock: minStock, cost_per_unit: unitCost,
      };
      const newInv = [...get().inventory, optimistic].sort((a,b) => a.name.localeCompare(b.name));
      set({ inventory: newInv });
      persistCache(storeId, get().menu, newInv, get().transactions, get().expenses, get().cashFlow, get().cashRegister);

      let data: InventoryItem | null = null;
      try {
        data = await createInventoryItem({
          id: tempId,
          store_id: storeId, name: item.name, stock: qty,
          sku: item.sku || null,
          unit: baseUnit,
          base_unit: baseUnit,
          purchase_unit: purchaseUnit,
          conversion_ratio: conversionRatio,
          min_stock: minStock,
          cost_per_unit: unitCost,
          is_active: item.isActive ?? true,
        });
      } catch {
        addPendingWrite(storeId, {
          table: 'inventory',
          op: 'insert',
          data: {
            id: tempId,
            store_id: storeId, name: item.name, stock: qty,
            sku: item.sku || null,
            unit: baseUnit,
            base_unit: baseUnit,
            purchase_unit: purchaseUnit,
            conversion_ratio: conversionRatio,
            min_stock: minStock,
            cost_per_unit: unitCost,
            is_active: item.isActive ?? true,
          }
        });
        import('@/utils/toast').then(m => m.showToast('Stok disimpan offline dan akan disinkronkan otomatis', 'success'));
        return;
      }
      if (data) {
        markInserted(data.id);
        set(s => ({ inventory: s.inventory.map(i => i.id === tempId ? data as InventoryItem : i) }));
        persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        if (totalCost > 0) {
          const expId = makeClientId('exp');
          let expData: Expense | null = null;
          try {
            expData = await createExpense({
              id: expId,
              store_id: storeId, date: new Date().toISOString(),
              description: `Beli ${item.name}`, amount: totalCost, category: 'Bahan Baku', source: 'inventory',
            });
          } catch {
            addPendingWrite(storeId, {
              table: 'expenses',
              op: 'insert',
              data: {
                id: expId,
                store_id: storeId, date: new Date().toISOString(),
                description: `Beli ${item.name}`, amount: totalCost, category: 'Bahan Baku', source: 'inventory',
              }
            });
          }
          if (expData) {
            markInserted(expData.id);
            set(s => ({ expenses: [expData as Expense, ...s.expenses] }));
          }
        }
      }

    } else if (item.type === 'edit') {
      const existing = inventory.find(i => i.id === item.id);
      const newCost  = qty > 0 ? unitCost : (existing?.cost_per_unit || 0);
      set(s => ({ inventory: s.inventory.map(i => i.id === item.id
        ? {
            ...i,
            name: item.name,
            stock: qty,
            unit: item.unit || i.unit,
            sku: item.sku ?? i.sku ?? null,
            base_unit: item.unit || i.base_unit || i.unit,
            purchase_unit: item.purchaseUnit || i.purchase_unit || item.unit || i.unit,
            conversion_ratio: conversionRatio || i.conversion_ratio || 1,
            is_active: item.isActive ?? i.is_active ?? true,
            min_stock: minStock,
            cost_per_unit: newCost,
          }
        : i
      )}));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
      try {
        await updateInventoryItem(item.id!, {
          name: item.name,
          stock: qty,
          sku: item.sku,
          unit: item.unit,
          base_unit: item.unit,
          purchase_unit: item.purchaseUnit,
          conversion_ratio: conversionRatio || undefined,
          is_active: item.isActive,
          min_stock: minStock,
          cost_per_unit: newCost,
        });
      } catch (error) {
        if (existing) {
          set(s => ({ inventory: s.inventory.map(i => i.id === item.id ? existing : i) }));
          persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        }
        throw error;
      }

    } else {
      const existing = inventory.find(i => i.id === item.id);
      if (!existing) return;
      const newStock = existing.stock + qty;
      const newCost  = newStock > 0
        ? (existing.stock * existing.cost_per_unit + totalCost) / newStock
        : existing.cost_per_unit;
      set(s => ({ inventory: s.inventory.map(i => i.id === item.id
        ? { ...i, stock: newStock, cost_per_unit: newCost } : i
      )}));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
      try {
        await updateInventoryItem(item.id!, {
          stock: newStock, cost_per_unit: newCost,
        });
      } catch (error) {
        set(s => ({ inventory: s.inventory.map(i => i.id === item.id ? existing : i) }));
        persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        throw error;
      }
      if (totalCost > 0) {
        const expId = makeClientId('exp');
        let expData: Expense | null = null;
        try {
          expData = await createExpense({
            id: expId,
            store_id: storeId, date: new Date().toISOString(),
            description: `Restock ${item.name}`, amount: totalCost, category: 'Bahan Baku', source: 'inventory',
          });
        } catch {
          addPendingWrite(storeId, {
            table: 'expenses',
            op: 'insert',
            data: {
              id: expId,
              store_id: storeId, date: new Date().toISOString(),
              description: `Restock ${item.name}`, amount: totalCost, category: 'Bahan Baku', source: 'inventory',
            }
          });
        }
        if (expData) {
          markInserted(expData.id);
          set(s => ({ expenses: [expData as Expense, ...s.expenses] }));
        }
      }
    }
  },

  adjustInventoryStock: async ({ inventoryId, countedStock, reason, note }) => {
    const { storeId, inventory, isOnline } = get();
    if (!storeId) throw new Error('Store belum dimuat.');
    if (!isOnline) {
      throw new Error('Opname stok membutuhkan koneksi internet agar stok fisik dan sistem tetap sinkron.');
    }
    if (!Number.isFinite(countedStock) || countedStock < 0) {
      throw new Error('Jumlah stok hasil opname tidak boleh negatif.');
    }
    const existing = inventory.find((item) => item.id === inventoryId);
    if (!existing) {
      throw new Error('Bahan baku tidak ditemukan. Muat ulang halaman lalu coba lagi.');
    }

    const updated = await createInventoryAdjustment({
      store_id: storeId,
      inventory_id: inventoryId,
      counted_stock: countedStock,
      reason,
      note: note ?? null,
    });
    set(s => ({ inventory: s.inventory.map(item => item.id === inventoryId ? updated : item) }));
    persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister, get().unitConversions);
    return updated;
  },

  deleteInventoryItem: async (id) => {
    const { storeId } = get();
    if (!storeId) return;
    try {
      set(s => ({ inventory: s.inventory.filter(i => i.id !== id) }));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
      try {
        await removeInventoryItem(id);
      } catch {
        addPendingWrite(storeId, { table: 'inventory', op: 'delete', id, data: {} });
        import('@/utils/toast').then(m => m.showToast('Penghapusan stok dijadwalkan saat online kembali', 'success'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal menghapus inventaris';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
    }
  },

  saveStockUnitConversion: async (conversion) => {
    const { storeId } = get();
    if (!storeId) throw new Error('Store belum dimuat.');
    if (conversion.ratio <= 0) throw new Error('Rasio konversi harus lebih dari 0.');

    const id = conversion.id || makeClientId('conv');
    const optimistic: StockUnitConversion = {
      id,
      store_id: storeId,
      ingredient_id: conversion.ingredient_id ?? null,
      from_unit: conversion.from_unit,
      to_unit: conversion.to_unit,
      ratio: conversion.ratio,
      is_active: conversion.is_active ?? true,
      ...(conversion.created_at ? { created_at: conversion.created_at } : {}),
      ...(conversion.updated_at ? { updated_at: conversion.updated_at } : {}),
    };
    const existing = get().unitConversions.find((entry) => entry.id === id);

    set(s => ({
      unitConversions: s.unitConversions.some(entry => entry.id === id)
        ? s.unitConversions.map(entry => entry.id === id ? { ...entry, ...optimistic } : entry)
        : [...s.unitConversions, optimistic],
    }));
    persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister, get().unitConversions);

    try {
      const payload = {
        id,
        store_id: storeId,
        ingredient_id: optimistic.ingredient_id,
        from_unit: optimistic.from_unit,
        to_unit: optimistic.to_unit,
        ratio: optimistic.ratio,
        is_active: optimistic.is_active,
      };
      const saved = existing
        ? await updateStockUnitConversion(id, payload)
        : await createStockUnitConversion(payload);
      set(s => ({
        unitConversions: s.unitConversions.map(entry => entry.id === id ? saved : entry),
      }));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister, get().unitConversions);
      return saved;
    } catch (error) {
      addPendingWrite(storeId, {
        table: 'inventory_unit_conversions',
        op: existing ? 'update' : 'insert',
        id,
        data: {
          id,
          store_id: storeId,
          ingredient_id: optimistic.ingredient_id,
          from_unit: optimistic.from_unit,
          to_unit: optimistic.to_unit,
          ratio: optimistic.ratio,
          is_active: optimistic.is_active,
        },
      });
      import('@/utils/toast').then(m => m.showToast('Konversi disimpan offline dan akan disinkronkan otomatis', 'success'));
      return optimistic;
    }
  },

  deleteStockUnitConversion: async (id) => {
    const { storeId } = get();
    if (!storeId) return;
    const existing = get().unitConversions.find((entry) => entry.id === id);
    set(s => ({ unitConversions: s.unitConversions.filter(entry => entry.id !== id) }));
    persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister, get().unitConversions);
    try {
      await deleteStockUnitConversion(id);
    } catch {
      if (existing) {
        set(s => ({ unitConversions: [...s.unitConversions, existing] }));
        persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister, get().unitConversions);
      }
      addPendingWrite(storeId, { table: 'inventory_unit_conversions', op: 'delete', id, data: {} });
    }
  },

  commitStockBulkImportRows: async (mode, rows) => {
    const { storeId, isOnline } = get();
    if (!storeId) throw new Error('Store belum dimuat.');
    if (!isOnline) {
      throw new Error('Import bulk membutuhkan koneksi internet agar data produk, bahan, resep, dan stok tersimpan utuh.');
    }

    const result = await commitStockBulkImport({
      store_id: storeId,
      mode,
      rows,
    });
    await get().loadAll(storeId);
    return result;
  },
});
