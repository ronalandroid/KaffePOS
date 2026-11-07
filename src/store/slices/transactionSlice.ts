/* eslint-disable @typescript-eslint/no-explicit-any */
// src/store/slices/transactionSlice.ts — POS cart state plus checkout and void
// flows, including offline payment queueing.
import { ApiError, checkoutTransaction, voidTransactionRequest } from '@/lib/backendApi';
import { trackOpsEvent } from '@/lib/opsMetrics';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { enqueueOfflineOperation } from '@/lib/offlineQueue';
import { canProcessPosPaymentOffline, getOfflinePaymentBlockedMessage } from '@/lib/offlinePolicy';
import type { CartItem, KitchenOrder, Transaction } from '@/types';
import type { AppSlice, TransactionSlice } from '../types';
import { persistCache, persistCheckoutDraft, saveKitchenToLS } from '../cache';
import { makeUniqueTransactionId, mergeKitchenOrder } from '../merge';
import { markInserted } from '../dedupe';
import { updateSyncIndicators } from '../sync';
import { initialState } from '../defaults';

export const createTransactionSlice: AppSlice<TransactionSlice> = (set, get) => ({
  transactions: initialState.transactions,
  cart:         initialState.cart,
  discount:     initialState.discount,

  addToCart: (item, variant, modifiers) => {
    const mods = modifiers && modifiers.length ? modifiers : undefined;
    let cartItem: CartItem;
    if (variant || mods) {
      const basePrice = variant ? variant.price : item.price;
      const modsTotal = mods ? mods.reduce((sum, m) => sum + m.price, 0) : 0;
      const labelParts = [variant?.name, ...(mods?.map(m => m.name) ?? [])].filter(Boolean);
      // Stable id from variant + sorted modifier names so identical configurations stack
      // onto one cart line instead of creating duplicates.
      const configKey = `${variant?.name ?? ''}|${mods ? mods.map(m => m.name).slice().sort().join('+') : ''}`;
      cartItem = {
        ...item,
        qty: 1,
        price: basePrice + modsTotal,
        name: labelParts.length ? `${item.name} (${labelParts.join(', ')})` : item.name,
        // Override the menu's *available* modifiers (from ...item) with the *selected* ones.
        modifiers: mods ?? [],
        _baseId: item.id,
        id: `${item.id}__${configKey}`,
        ...(variant ? { variantId: variant.name } : {}),
      };
    } else {
      cartItem = { ...item, qty: 1 };
    }
    set(s => {
      const existing = s.cart.find(c => c.id === cartItem.id);
      const nextCart = existing
        ? s.cart.map(c => c.id === cartItem.id ? { ...c, qty: c.qty + 1 } : c)
        : [...s.cart, { ...cartItem, qty: 1 }];
      persistCheckoutDraft(s.storeId, nextCart, s.discount);
      return { cart: nextCart };
    });
  },

  removeFromCart: (id) => set(s => {
    const nextCart = s.cart.filter(c => c.id !== id);
    persistCheckoutDraft(s.storeId, nextCart, s.discount);
    return { cart: nextCart };
  }),

  updateQty: (id, qty) => set(s => {
    const nextCart = qty <= 0
      ? s.cart.filter(c => c.id !== id)
      : s.cart.map(c => c.id === id ? { ...c, qty } : c);
    persistCheckoutDraft(s.storeId, nextCart, s.discount);
    return { cart: nextCart };
  }),

  setCartItemNote: (id, note) => set(s => {
    const nextCart = s.cart.map(c => c.id === id ? { ...c, note } : c);
    persistCheckoutDraft(s.storeId, nextCart, s.discount);
    return { cart: nextCart };
  }),

  clearCart: () => set(s => {
    persistCheckoutDraft(s.storeId, [], '');
    return { cart: [], discount: '' };
  }),
  setDiscount: (d) => set(s => {
    persistCheckoutDraft(s.storeId, s.cart, d);
    return { discount: d };
  }),

  saveTransaction: async (tx) => {
    const { storeId, isOnline } = get();
    if (!storeId) throw new Error('Store belum dimuat.');
    if (!isOnline && !canProcessPosPaymentOffline(tx.method)) {
      throw new Error(getOfflinePaymentBlockedMessage(tx.method));
    }
    const existingIds = get().transactions.map(transaction => transaction.id);
    const isFirstTransaction = get().transactions.every(transaction => transaction.is_void);
    const normalizedDate = tx.date || new Date().toISOString();
    const normalizedId = makeUniqueTransactionId(tx.id, existingIds);

    const txWithId = {
      ...tx,
      id: normalizedId,
      date: normalizedDate,
      created_at: tx.created_at || normalizedDate,
      cashier: tx.cashier || 'Kasir',
      is_void: tx.is_void ?? false,
    };
    const safeSubtotal = Math.max(0, txWithId.subtotal || 0);
    const safeDiscount = Math.min(Math.max(0, txWithId.discount || 0), safeSubtotal);
    const safeTaxBase = Math.max(0, safeSubtotal - safeDiscount);
    const safeTax = Math.max(0, txWithId.tax || 0);
    const safeTotal = Math.max(0, safeTaxBase + safeTax);
    const safePaid = Math.max(0, txWithId.paid || 0);
    const safeChange = Math.max(0, safePaid - safeTotal);
    const normalizedTx = {
      ...txWithId,
      subtotal: safeSubtotal,
      discount: safeDiscount,
      tax: safeTax,
      total: safeTotal,
      paid: safePaid,
      change: safeChange,
      cogs: Math.max(0, txWithId.cogs || 0),
    };

    const queueOfflineTransaction = async (error?: unknown) => {
      if (!canProcessPosPaymentOffline(normalizedTx.method)) {
        throw error instanceof Error ? error : new Error('Metode pembayaran ini membutuhkan koneksi internet.');
      }
      const offlineTx = {
        ...normalizedTx,
        store_id: storeId,
        sync_status: 'pending' as const,
        sync_error: null,
        local_only: true,
      } satisfies Transaction;
      markInserted(offlineTx.id);
      set(s => ({
        transactions: s.transactions.some(t => t.id === offlineTx.id)
          ? s.transactions.map(t => t.id === offlineTx.id ? offlineTx : t)
          : [offlineTx, ...s.transactions],
      }));
      await enqueueOfflineOperation(storeId, {
        operation: 'transaction.create',
        payload: {
          ...normalizedTx,
          store_id: storeId,
        },
        idempotencyKey: `transaction:${normalizedTx.id}`,
        createdAt: normalizedTx.created_at,
      });
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
      await updateSyncIndicators(storeId);
      return offlineTx;
    };

    if (!isOnline) {
      return queueOfflineTransaction();
    }

    try {
      const data = await checkoutTransaction({
        ...normalizedTx,
        store_id: storeId,
      });
      const savedTx = data as Transaction;
      void trackOpsEvent({
        event_name: 'checkout',
        status: 'success',
        store_id: storeId,
        transaction_id: savedTx.id,
        metadata: { total: savedTx.total, method: savedTx.method },
      });
      void trackOpsEvent({
        event_name: 'transaction_created',
        status: 'success',
        store_id: storeId,
        transaction_id: savedTx.id,
        metadata: { total: savedTx.total, method: savedTx.method, source: 'pos_checkout', isFirstTransaction },
      });
      trackAnalyticsEvent('transaction_created', {
        store_id: storeId,
        transaction_id: savedTx.id,
        value: savedTx.total,
        payment_method: savedTx.method,
        is_first_transaction: isFirstTransaction,
      });
      if (isFirstTransaction) {
        trackAnalyticsEvent('first_transaction', {
          store_id: storeId,
          transaction_id: savedTx.id,
          value: savedTx.total,
          payment_method: savedTx.method,
        });
        void trackOpsEvent({
          event_name: 'first_transaction',
          status: 'success',
          store_id: storeId,
          transaction_id: savedTx.id,
          metadata: { total: savedTx.total, method: savedTx.method, source: 'pos_checkout' },
        });
      }
      markInserted(savedTx.id);
      set(s => ({
        transactions: s.transactions.some(t => t.id === savedTx.id)
          ? s.transactions.map(t => t.id === savedTx.id ? savedTx : t)
          : [savedTx, ...s.transactions]
      }));
      if (savedTx.kitchen_order) {
        set(s => {
          const nextOrders = mergeKitchenOrder(s.kitchenOrders, savedTx.kitchen_order as KitchenOrder);
          saveKitchenToLS(storeId, nextOrders);
          return { kitchenOrders: nextOrders };
        });
      }
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
      await get().loadChallenges(storeId).catch(() => {});
      await get().loadAll(storeId);
      return savedTx;
    } catch (error: any) {
      if (!(error instanceof ApiError)) {
        return queueOfflineTransaction(error);
      }
      void trackOpsEvent({
        event_name: 'checkout',
        status: 'failure',
        store_id: storeId,
        transaction_id: normalizedTx.id,
        error_message: error?.message || 'Checkout gagal diproses.',
        metadata: { total: normalizedTx.total, method: normalizedTx.method },
      });
      throw error;
    }
  },

  voidTransaction: async (id, reason, by) => {
    try {
      const storeId = get().storeId;
      if (!storeId) throw new Error('Store belum dimuat.');
      if (!get().isOnline) throw new Error('Void transaksi butuh koneksi internet agar stok kembali dengan benar.');
      const data = await voidTransactionRequest(id, {
        store_id: storeId,
        reason,
        void_by: by,
      });
      const voidedTx = data as Transaction;
      set(s => ({
        transactions: s.transactions.map(t => t.id === id ? voidedTx : t)
      }));
      if (voidedTx.kitchen_order) {
        set(s => {
          const nextOrders = mergeKitchenOrder(s.kitchenOrders, voidedTx.kitchen_order as KitchenOrder);
          saveKitchenToLS(storeId, nextOrders);
          return { kitchenOrders: nextOrders };
        });
      }
      persistCache(storeId, get().menu, get().inventory, get().transactions, get().expenses, get().cashFlow, get().cashRegister);
      await get().loadAll(storeId);
      return voidedTx;
    } catch (e:any) {
      const msg = e?.message || 'Gagal membatalkan transaksi';
      import('@/utils/toast').then(m => m.showToast(msg, 'error'));
      throw e;
    }
  },
});
