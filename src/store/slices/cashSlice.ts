// src/store/slices/cashSlice.ts — expenses, cash flow, and cash register entries
// with optimistic writes and offline-queue fallback.
import {
  createCashFlow,
  createCashRegister,
  createExpense,
  removeExpense,
  updateCashRegisterEntry,
} from '@/lib/backendApi';
import type { CashFlowEntry, CashRegister, Expense } from '@/types';
import type { AppSlice, CashSlice } from '../types';
import { persistCache } from '../cache';
import { markInserted } from '../dedupe';
import { addPendingWrite } from '../sync';
import { initialState } from '../defaults';

export const createCashSlice: AppSlice<CashSlice> = (set, get) => ({
  expenses:     initialState.expenses,
  cashFlow:     initialState.cashFlow,
  cashRegister: initialState.cashRegister,

  saveExpense: async (exp) => {
    const { storeId } = get();
    if (!storeId) return;
    try {
      if ((exp.amount || 0) <= 0) throw new Error('Jumlah pengeluaran harus lebih dari 0.');
      const optimisticId = exp.id || (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      const payload = {
        id: optimisticId,
        store_id: storeId,
        date: new Date().toISOString(),
        source: 'cashier' as const,
        ...exp,
      };
      markInserted(optimisticId);
      set(s => ({ expenses: [{ ...payload } as Expense, ...s.expenses] }));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);

      try {
        const data = await createExpense({
          ...payload,
        });
        if (data) {
          set(s => ({
            expenses: s.expenses.map(existing => existing.id === optimisticId ? data as Expense : existing)
          }));
          persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        }
      } catch {
        addPendingWrite(storeId, { table: 'expenses', op: 'insert', data: payload as unknown as Record<string, unknown> });
        import('@/utils/toast').then(m => m.showToast('Pengeluaran disimpan offline dan akan disinkronkan otomatis', 'success'));
        return;
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error && e.message) || 'Gagal mencatat pengeluaran';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      throw e;
    }
  },

  deleteExpense: async (id) => {
    set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
    if (get().storeId) {
      persistCache(get().storeId!, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
    }
    try {
      await removeExpense(id);
    } catch {
      addPendingWrite(get().storeId, { table: 'expenses', op: 'delete', id, data: {} });
      import('@/utils/toast').then(m => m.showToast('Penghapusan pengeluaran dijadwalkan saat online kembali', 'success'));
    }
  },

  saveCashFlow: async (entry) => {
    const { storeId } = get();
    if (!storeId) return;
    try {
      const optimisticId = entry.id || (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cf_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      const payload = {
        id: optimisticId,
        store_id: storeId,
        date: new Date().toISOString(),
        ...entry,
      };
      markInserted(optimisticId);
      set(s => ({ cashFlow: [{ ...payload } as CashFlowEntry, ...s.cashFlow] }));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);

      try {
        const data = await createCashFlow({
          ...payload,
        });
        if (data) {
          set(s => ({
            cashFlow: s.cashFlow.map(existing => existing.id === optimisticId ? data as CashFlowEntry : existing)
          }));
          persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        }
      } catch {
        addPendingWrite(storeId, { table: 'cash_flow', op: 'insert', data: payload as unknown as Record<string, unknown> });
        import('@/utils/toast').then(m => m.showToast('Arus kas disimpan offline dan akan disinkronkan otomatis', 'success'));
        return;
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error && e.message) || 'Gagal menyimpan arus kas';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      throw e;
    }
  },

  saveCashRegister: async (entry) => {
    const { storeId } = get();
    if (!storeId) return;
    try {
      const optimisticId = entry.id || (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cr_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      const payload = {
        id: optimisticId,
        store_id: storeId,
        date: new Date().toISOString(),
        ...entry,
      };
      markInserted(optimisticId);
      set(s => ({ cashRegister: [{ ...payload } as CashRegister, ...s.cashRegister] }));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);

      try {
        const data = await createCashRegister({
          ...payload,
        });
        if (data) {
          set(s => ({
            cashRegister: s.cashRegister.map(existing => existing.id === optimisticId ? data as CashRegister : existing)
          }));
          persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        }
      } catch {
        addPendingWrite(storeId, { table: 'cash_register', op: 'insert', data: payload as unknown as Record<string, unknown> });
        import('@/utils/toast').then(m => m.showToast('Register kasir disimpan offline dan akan disinkronkan otomatis', 'success'));
        return;
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error && e.message) || 'Gagal menyimpan register kasir';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      throw e;
    }
  },

  updateCashRegister: async (id, entry) => {
    const { storeId, cashRegister } = get();
    if (!storeId) return;

    const existingEntry = cashRegister.find((item) => item.id === id);
    if (!existingEntry) throw new Error('Saldo kasir tidak ditemukan');

    const nextEntry = {
      ...existingEntry,
      ...entry,
      id,
      store_id: existingEntry.store_id || storeId,
    } as CashRegister;

    try {
      set((s) => ({
        cashRegister: s.cashRegister.map((item) => (item.id === id ? nextEntry : item)),
      }));
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);

      try {
        const data = await updateCashRegisterEntry(id, {
          amount: nextEntry.amount,
          note: nextEntry.note ?? null,
          opened_by: nextEntry.opened_by,
          date: nextEntry.date,
        });
        if (data) {
          set((s) => ({
            cashRegister: s.cashRegister.map((item) => (item.id === id ? data as CashRegister : item)),
          }));
          persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
        }
      } catch {
        addPendingWrite(storeId, {
          table: 'cash_register',
          op: 'update',
          id,
          data: {
            amount: nextEntry.amount,
            note: nextEntry.note ?? null,
            opened_by: nextEntry.opened_by,
            date: nextEntry.date,
          },
        });
        import('@/utils/toast').then(m => m.showToast('Perubahan saldo kasir disimpan offline dan akan disinkronkan otomatis', 'success'));
        return;
      }
    } catch (e: unknown) {
      const msg = (e instanceof Error && e.message) || 'Gagal memperbarui register kasir';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      throw e;
    }
  },
});
