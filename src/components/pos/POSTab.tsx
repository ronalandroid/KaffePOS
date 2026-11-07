/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/pos/POSTab.tsx — KaffePOS v5 (GAN iteration-1: warm dark luxury)
// Container for the POS screen. Owns the cross-cutting checkout state (cart
// totals, payment/loyalty flow, modal visibility) and composes the catalog grid,
// cart panel, and the payment/receipt/voucher modals. Presentational markup lives
// in the sibling Pos*.tsx files.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/hooks/useStore';
import PrintActionSheet from '@/components/pos/PrintActionSheet';
import PosProductGrid from '@/components/pos/PosProductGrid';
import PosCartPanel from '@/components/pos/PosCartPanel';
import PosPaymentModal from '@/components/pos/PosPaymentModal';
import PosReceiptModal from '@/components/pos/PosReceiptModal';
import PosVoucherModal from '@/components/pos/PosVoucherModal';
import type { Profile, Transaction } from '@/types';
import type { SubscriptionAccess } from '@/lib/subscriptionAccess';
import { canProcessPosPaymentOffline, getOfflinePaymentBlockedMessage } from '@/lib/offlinePolicy';
import { buildStockDeductionPlan, calculateProductHpp } from '@/lib/stockEngine';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import {
  addLoyaltyStamp,
  createPayment,
  getLoyaltyOverview,
  getPaymentOrderStatus,
  redeemLoyaltyReward,
  searchLoyaltyPassports,
  type SecurePaymentCreateResponse,
  type SecurePaymentOrderStatus,
} from '@/lib/backendApi';
import { enqueueOfflineOperation } from '@/lib/offlineQueue';
import { dispatchUpgradePrompt } from '@/lib/upgradePrompts';
import {
  calculateLoyaltyRewardDiscount,
  canRedeemReward,
  normalizeLoyaltyPhone,
  readCachedLoyaltyOverview,
  writeCachedLoyaltyOverview,
  type LoyaltyOverview,
  type LoyaltyPassport,
  type LoyaltyReward,
} from '@/lib/loyalty';
import { useModalBehavior } from '@/hooks/useModalBehavior';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { trackOpsEvent } from '@/lib/opsMetrics';
import { fRp, getPaymentMessage, makeIdempotencyKey, type PaymentPhase } from './posHelpers';

interface Props {
  toast:   { showToast: (m: string, t?: 'success' | 'error' | 'warning' | 'info') => void };
  profile: Profile | null;
  subscriptionAccess: SubscriptionAccess;
}

export default function POSTab({ toast, profile, subscriptionAccess }: Props) {
  // Individual selectors instead of a broad useStore() destructure: POSTab now only
  // re-renders when a slice it actually reads changes (e.g. kitchen realtime events that
  // update kitchenOrders no longer force a full re-render of the checkout screen).
  const storeId = useStore((s) => s.storeId);
  const menu = useStore((s) => s.menu);
  const inventory = useStore((s) => s.inventory);
  const unitConversions = useStore((s) => s.unitConversions);
  const cart = useStore((s) => s.cart);
  const discount = useStore((s) => s.discount);
  const transactions = useStore((s) => s.transactions);
  const isOnline = useStore((s) => s.isOnline);
  const clearCart = useStore((s) => s.clearCart);
  const setDiscount = useStore((s) => s.setDiscount);
  const saveTransaction = useStore((s) => s.saveTransaction);
  const storeSettings = useStore((s) => s.storeSettings);
  const kitchenOrders = useStore((s) => s.kitchenOrders);
  const loadAll = useStore((s) => s.loadAll);

  const [showPay,    setShowPay]    = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showVouchers, setShowVouchers] = useState(false);
  const [method,     setMethod]     = useState<'Tunai'|'Transfer'|'QRIS'>('Tunai');
  const [cash,       setCash]       = useState('');
  const [showRcpt,   setShowRcpt]   = useState(false);
  const [lastTx,     setLastTx]     = useState<Transaction | null>(null);
  const [custName,   setCustName]   = useState('');   // ← Nama pelanggan
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Synchronous re-entry guard: state/disabled lags a render, so a fast double-tap
  // could run checkout twice (duplicate transaction / double stock deduction).
  const checkoutInFlight = useRef(false);
  // Set when the payment modal closes so an in-flight status poll stops touching state.
  const pollCancelledRef = useRef(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>('idle');
  const [paymentOrder, setPaymentOrder] = useState<SecurePaymentCreateResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<SecurePaymentOrderStatus | null>(null);
  const [loyaltyOverview, setLoyaltyOverview] = useState<LoyaltyOverview | null>(null);
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltySearching, setLoyaltySearching] = useState(false);
  const [loyaltyPassport, setLoyaltyPassport] = useState<LoyaltyPassport | null>(null);
  const [loyaltyReward, setLoyaltyReward] = useState<LoyaltyReward | null>(null);

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart]);
  const discAmt  = useMemo(() => {
    if (!discount) return 0;
    const rawDiscount = discount.endsWith('%')
      ? Math.round(subtotal * parseInt(discount) / 100)
      : parseInt(discount) || 0;
    return Math.min(Math.max(0, rawDiscount), subtotal);
  }, [subtotal, discount]);
  const taxPct = storeSettings?.tax_percent || 0;
  const taxableBase = Math.max(0, subtotal - discAmt);
  const taxAmt = Math.round(taxableBase * taxPct / 100);
  const total  = taxableBase + taxAmt;
  const paid   = method === 'Tunai' ? parseInt(cash) || 0 : total;
  const change = Math.max(0, paid - total);
  const currentMonthTransactionCount = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      if (tx.is_void) return false;
      const txDate = new Date(tx.date);
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }).length;
  }, [transactions]);
  const lastTxKitchenOrder = useMemo(() => {
    if (!lastTx) return null;
    return kitchenOrders.find((order) => order.transaction_id === lastTx.id) || lastTx.kitchen_order || null;
  }, [kitchenOrders, lastTx]);

  useEffect(() => {
    if (!showPay || !storeId) return;
    const cached = readCachedLoyaltyOverview(storeId);
    if (cached) setLoyaltyOverview(cached);
    if (!isOnline) return;
    getLoyaltyOverview(storeId)
      .then((data) => {
        setLoyaltyOverview(data);
        writeCachedLoyaltyOverview(storeId, data);
      })
      .catch(() => {
        // Loyalty is supportive; checkout must remain usable even when this fetch fails.
      });
  }, [isOnline, showPay, storeId]);

  const loyaltyRewards = useMemo(
    () => (loyaltyOverview?.rewards || []).filter((reward) => reward.is_active),
    [loyaltyOverview?.rewards],
  );

  const loyaltySettings = loyaltyOverview?.settings;

  const handleLoyaltySearch = useCallback(async () => {
    if (!storeId) return;
    const normalizedPhone = normalizeLoyaltyPhone(loyaltyPhone || custName);
    if (normalizedPhone.length < 4 && !custName.trim()) {
      toast.showToast('Isi nomor HP atau nama pelanggan untuk mencari Kopi Passport.', 'warning');
      return;
    }
    try {
      setLoyaltySearching(true);
      const localPassports = loyaltyOverview?.passports || [];
      if (!isOnline) {
        const query = (normalizedPhone || custName).toLowerCase();
        const found = localPassports.find((passport) => (
          `${passport.customer_name || ''} ${passport.customer_phone}`.toLowerCase().includes(query)
        ));
        if (found) {
          setLoyaltyPassport(found);
          setLoyaltyPhone(found.customer_phone);
          if (!custName.trim() && found.customer_name) setCustName(found.customer_name);
          return;
        }
        toast.showToast('Passport belum ada di cache offline. Stamp akan tetap bisa diantrikan.', 'info');
        return;
      }
      const result = await searchLoyaltyPassports(storeId, normalizedPhone || custName);
      const found = result.items[0] || null;
      setLoyaltyPassport(found);
      if (found) {
        setLoyaltyPhone(found.customer_phone);
        if (!custName.trim() && found.customer_name) setCustName(found.customer_name);
        toast.showToast('Kopi Passport ditemukan.', 'success');
      } else {
        toast.showToast('Passport belum ditemukan. Stamp akan membuat passport baru setelah bayar.', 'info');
      }
    } catch (error) {
      toast.showToast(normalizeUserFacingError(error, 'Pencarian loyalty gagal.'), 'warning');
    } finally {
      setLoyaltySearching(false);
    }
  }, [custName, isOnline, loyaltyOverview?.passports, loyaltyPhone, storeId, toast]);

  const handleApplyLoyaltyReward = useCallback((reward: LoyaltyReward) => {
    if (!loyaltyPassport) {
      toast.showToast('Pilih Kopi Passport dulu sebelum menukar reward.', 'warning');
      return;
    }
    if (!canRedeemReward(loyaltyPassport, reward)) {
      toast.showToast('Poin atau stamp pelanggan belum cukup untuk reward ini.', 'warning');
      return;
    }
    const rewardDiscount = calculateLoyaltyRewardDiscount(reward, subtotal);
    if (reward.type !== 'free_item' && rewardDiscount <= 0) {
      toast.showToast('Reward ini belum punya nominal diskon untuk transaksi ini.', 'warning');
      return;
    }
    setLoyaltyReward(reward);
    if (rewardDiscount > 0) setDiscount(String(rewardDiscount));
    toast.showToast(`${reward.name} diterapkan ke transaksi.`, 'success');
  }, [loyaltyPassport, setDiscount, subtotal, toast]);

  const handleClearLoyaltyReward = useCallback(() => {
    setLoyaltyReward(null);
    setDiscount('');
  }, [setDiscount]);


  const finishPaidPayment = useCallback(async (status: SecurePaymentOrderStatus) => {
    setPaymentStatus(status);
    setPaymentPhase('success');
    if (storeId) {
      await loadAll(storeId).catch(() => {
        // Stock was deducted server-side. If the refresh fails, the local inventory view is
        // stale and the cashier could oversell — warn them instead of failing silently.
        toast.showToast('Pembayaran sukses, tapi stok perlu di-refresh manual.', 'warning');
        trackAnalyticsEvent('inventory_refresh_failed', { store_id: storeId || undefined });
      });
    }
    if (status.transaction) setLastTx(status.transaction);
    trackAnalyticsEvent('payment_completed', {
      store_id: storeId || undefined,
      order_id: status.order_id,
      transaction_id: status.transaction_id || undefined,
      value: status.gross_amount,
    });
    void trackOpsEvent({
      event_name: 'payment_completed',
      status: 'success',
      ...(storeId ? { store_id: storeId } : {}),
      ...(status.transaction_id ? { transaction_id: status.transaction_id } : {}),
      metadata: { orderId: status.order_id, grossAmount: status.gross_amount },
    });
    clearCart();
    setCustName('');
    setLoyaltyPhone('');
    setLoyaltyPassport(null);
    setLoyaltyReward(null);
    setShowPay(false);
    setShowRcpt(true);
    toast.showToast('Pembayaran berhasil. Struk digital siap.', 'success');
  }, [clearCart, loadAll, storeId, toast]);

  const pollPaymentOrder = useCallback(async (orderId: string, fallbackPhase: PaymentPhase = 'pending') => {
    pollCancelledRef.current = false;
    setPaymentPhase(fallbackPhase);
    let latest: SecurePaymentOrderStatus | null = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (pollCancelledRef.current) return latest;
      latest = await getPaymentOrderStatus(orderId);
      if (pollCancelledRef.current) return latest;
      setPaymentStatus(latest);
      console.info('[KaffePOS payment]', {
        orderId,
        status: latest.status,
        transactionStatus: latest.transaction_status,
        transactionId: latest.transaction_id,
        attempt: attempt + 1,
      });
      if (latest.status === 'completed') {
        await finishPaidPayment(latest);
        return latest;
      }
      if (latest.status === 'failed' || latest.status === 'cancelled') {
        const failedPhase = latest.transaction_status === 'expire'
          ? 'expired'
          : latest.transaction_status === 'deny'
            ? 'denied'
            : latest.status === 'cancelled'
              ? 'cancelled'
              : 'failed';
        setPaymentPhase(failedPhase);
        toast.showToast(getPaymentMessage(failedPhase) || 'Pembayaran gagal, silakan coba lagi.', 'error');
        return latest;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt < 3 ? 1200 : 2500));
    }
    if (pollCancelledRef.current) return latest;
    setPaymentPhase('pending');
    toast.showToast('Pembayaran masih diproses. Status akan diperbarui otomatis dari gateway pembayaran.', 'info');
    return latest;
  }, [finishPaidPayment, toast]);

  const handleCheckout = useCallback(async () => {
    if (checkoutInFlight.current) return;
    if (!cart.length) return;
    if (!storeId) {
      toast.showToast('Toko belum siap. Sinkronkan ulang data toko dulu.', 'warning');
      return;
    }
    if (!isOnline && !canProcessPosPaymentOffline(method)) {
      toast.showToast(getOfflinePaymentBlockedMessage(method), 'warning');
      return;
    }
    if (method === 'Tunai' && paid < total) {
      toast.showToast('Uang bayar kurang', 'warning');
      return;
    }
    if (
      subscriptionAccess.transactionLimit !== -1 &&
      currentMonthTransactionCount >= subscriptionAccess.transactionLimit
    ) {
      toast.showToast('Paket gratis sudah mencapai 100 transaksi bulan ini. Upgrade untuk lanjut tanpa batas.', 'warning');
      dispatchUpgradePrompt({
        trigger: 'transaction_limit_blocked',
        promptKey: 'transaction_limit_blocked',
        recommendedPlan: 'kopi_susu',
        title: 'Batas transaksi gratis sudah tercapai',
        description: 'Upgrade ke Kopi Susu atau Signature untuk membuka transaksi tanpa batas dan menjaga kasir tetap bisa melayani pelanggan.',
        metadata: {
          used: currentMonthTransactionCount,
          limit: subscriptionAccess.transactionLimit,
        },
      });
      return;
    }
    const stockPlan = buildStockDeductionPlan(cart.map((cartItem) => ({
      id: cartItem.id,
      ...(cartItem._baseId ? { _baseId: cartItem._baseId } : {}),
      name: cartItem.name,
      qty: cartItem.qty,
      menu_item_id: cartItem._baseId || cartItem.id,
    })), menu, inventory, unitConversions);
    if (!stockPlan.ok) {
      toast.showToast('Stok bahan berubah. Periksa ulang keranjang sebelum checkout.', 'warning');
      return;
    }

    const cogs = cart.reduce((s, c) => {
      const base = menu.find(m => m.id === (c._baseId || c.id));
      if (!base) return s;
      return s + calculateProductHpp(base, inventory, unitConversions).totalCost * c.qty;
    }, 0);

    const todayStr = new Date().toDateString();
    const todayTxs = transactions.filter(t => new Date(t.date).toDateString() === todayStr);
    const count = todayTxs.length;
    const group = Math.floor(count / 100);
    const letter = String.fromCharCode(65 + Math.min(group, 25)); // A-Z mask
    const num = (count % 100) + 1;
    const uniqueSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const orderId = `ORDER #${letter}${String(num).padStart(3, '0')}-${uniqueSuffix}`;

    const tx = {
      id: orderId,
      store_id: storeId || 'temp',
      date:        new Date().toISOString(),
      items:       cart.map(c => ({
        name: c.name,
        qty: c.qty,
        price: c.price,
        subtotal: c.price * c.qty,
        menu_item_id: c._baseId || c.id,
        note: c.note?.trim() || null,
      })),
      subtotal, discount: discAmt, discount_label: loyaltyReward ? `Loyalty: ${loyaltyReward.name}` : (discount || null),
      tax: taxAmt, total, cogs: Math.round(cogs),
      paid, change, method,
      customer_name: custName.trim() || null,   // ← Simpan nama pelanggan
      cashier:     profile?.display_name || profile?.username || 'Kasir',
      note: null, is_void: false, void_reason: null, void_at: null, void_by: null,
      created_at:  new Date().toISOString(),
    };

    // QRIS hands the in-flight guard to its async poll, which releases it only when the
    // payment is terminal. The finally below must NOT release it early, or the cashier
    // could fire a second payment order for the same cart (double-charge).
    let deferGuardRelease = false;
    try {
      checkoutInFlight.current = true;
      setCheckingOut(true);
      setPaymentPhase('idle');
      setPaymentStatus(null);
      if (method === 'QRIS') {
        if (!isOnline) {
          toast.showToast(getOfflinePaymentBlockedMessage('QRIS'), 'warning');
          return;
        }

        setPaymentPhase('creating');
        trackAnalyticsEvent('payment_started', { store_id: storeId, value: total, method: 'QRIS' });
        void trackOpsEvent({
          event_name: 'payment_started',
          status: 'success',
          store_id: storeId,
          metadata: { total, method: 'QRIS' },
        });
        const payment = await createPayment({
          store_id: storeId,
          discount_amount: discAmt,
          items: cart.map((item) => ({
            id: item._baseId || item.id,
            qty: item.qty,
            variant_name: item.variantId ?? null,
            note: item.note?.trim() || null,
          })),
          customer: {
            name: custName.trim() || null,
            email: profile?.email || null,
          },
        });

        setPaymentOrder(payment);
        setPaymentPhase('pending');
        if (payment.payment_url) {
          toast.showToast('Membuka halaman pembayaran aman...', 'info');
          const paymentWindow = window.open(payment.payment_url, '_blank', 'noopener,noreferrer');
          if (!paymentWindow) {
            // The open() runs after an await, so it's outside the click gesture and
            // the popup can be blocked — fall back to a full redirect so the
            // customer still reaches the payment page.
            window.location.assign(payment.payment_url);
            return;
          }
          // The poll now owns the guard until the payment reaches a terminal state.
          deferGuardRelease = true;
          pollPaymentOrder(payment.order_id, 'pending')
            .catch(() => {
              toast.showToast('Gagal memantau pembayaran. Silakan refresh halaman.', 'error');
            })
            .finally(() => {
              setCheckingOut(false);
              checkoutInFlight.current = false;
            });
        } else {
          toast.showToast('Link pembayaran tidak tersedia. Coba lagi.', 'error');
        }
        return;
      }

      const savedTx = await saveTransaction(tx as unknown as Transaction);
      const normalizedLoyaltyPhone = normalizeLoyaltyPhone(loyaltyPhone);
      if (storeId && (loyaltyPassport || normalizedLoyaltyPhone.length >= 4)) {
        const stampPayload = {
          store_id: storeId,
          ...(loyaltyPassport ? { passport_id: loyaltyPassport.id } : { customer_phone: normalizedLoyaltyPhone }),
          customer_name: custName.trim() || loyaltyPassport?.customer_name || null,
          transaction_id: savedTx.id,
          transaction_amount: total,
          note: 'Checkout Kopi Passport',
          idempotency_key: makeIdempotencyKey(`loyalty-stamp:${savedTx.id}`),
        };
        try {
          if (!isOnline || savedTx.sync_status === 'pending') {
            await enqueueOfflineOperation(storeId, {
              operation: 'loyalty.stamp.create',
              payload: stampPayload,
              idempotencyKey: stampPayload.idempotency_key,
            });
          } else {
            const stampResult = await addLoyaltyStamp(stampPayload);
            setLoyaltyPassport(stampResult.passport);
          }
        } catch {
          await enqueueOfflineOperation(storeId, {
            operation: 'loyalty.stamp.create',
            payload: stampPayload,
            idempotencyKey: stampPayload.idempotency_key,
          });
        }
      }

      if (storeId && loyaltyPassport && loyaltyReward) {
        const redemptionPayload = {
          store_id: storeId,
          passport_id: loyaltyPassport.id,
          reward_id: loyaltyReward.id,
          transaction_id: savedTx.id,
          transaction_amount: subtotal,
          idempotency_key: makeIdempotencyKey(`loyalty-redemption:${savedTx.id}:${loyaltyReward.id}`),
        };
        try {
          if (!isOnline || savedTx.sync_status === 'pending') {
            await enqueueOfflineOperation(storeId, {
              operation: 'loyalty.redemption.create',
              payload: redemptionPayload,
              idempotencyKey: redemptionPayload.idempotency_key,
            });
          } else {
            await redeemLoyaltyReward(redemptionPayload);
          }
        } catch {
          await enqueueOfflineOperation(storeId, {
            operation: 'loyalty.redemption.create',
            payload: redemptionPayload,
            idempotencyKey: redemptionPayload.idempotency_key,
          });
        }
      }
      setLastTx(savedTx);
      clearCart();
      setCustName('');
      setLoyaltyPhone('');
      setLoyaltyPassport(null);
      setLoyaltyReward(null);
      setShowPay(false);
      setShowMobileCart(false);
      setShowRcpt(true);
      toast.showToast(
        savedTx.sync_status === 'pending'
          ? 'Transaksi tersimpan offline dan akan disinkronkan otomatis.'
          : 'Transaksi berhasil',
        'success',
      );
    } catch (e:any) {
      toast.showToast(normalizeUserFacingError(e, 'Checkout belum bisa diproses. Coba lagi.'), 'warning');
    } finally {
      // QRIS keeps the guard until its poll settles; everything else releases here.
      if (!deferGuardRelease) {
        setCheckingOut(false);
        checkoutInFlight.current = false;
      }
    }
  }, [cart, change, clearCart, currentMonthTransactionCount, custName, discAmt, discount, inventory, isOnline, loyaltyPassport, loyaltyPhone, loyaltyReward, menu, method, paid, pollPaymentOrder, profile, saveTransaction, storeId, subscriptionAccess.transactionLimit, subtotal, taxAmt, toast, total, transactions, unitConversions]);

  const closePaymentModal = useCallback(() => {
    pollCancelledRef.current = true;
    setShowPay(false);
  }, []);
  const closeReceiptModal = useCallback(() => setShowRcpt(false), []);
  const closeVoucherModal = useCallback(() => setShowVouchers(false), []);
  const paymentModal = useModalBehavior<HTMLDivElement>({
    open: showPay,
    onClose: closePaymentModal,
  });
  const receiptModal = useModalBehavior<HTMLDivElement>({
    open: showRcpt && Boolean(lastTx),
    onClose: closeReceiptModal,
  });
  const voucherModal = useModalBehavior<HTMLDivElement>({
    open: showVouchers,
    onClose: closeVoucherModal,
  });
  const shareReceiptToWhatsApp = useCallback(() => {
    const tx = lastTx;
    if (!tx) return;
    const lines = [
      `Struk ${storeSettings?.store_name || 'KaffePOS'}`,
      `No: ${tx.id}`,
      tx.customer_name ? `Pelanggan: ${tx.customer_name}` : null,
      '',
      ...tx.items.map((item: any) => `${item.qty}x ${item.name} - ${fRp(item.subtotal)}`),
      '',
      `Total: ${fRp(tx.total)}`,
      `Bayar: ${tx.method}`,
      'Terima kasih.',
    ].filter(Boolean);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  }, [lastTx, storeSettings?.store_name]);

  return (
    <div className="kaffe-responsive-surface flex-1 flex overflow-hidden bg-stone-50">
      {/* ── KIRI: GRID MENU ── */}
      <PosProductGrid
        total={total}
        onOpenMobileCart={() => setShowMobileCart(true)}
        toast={toast}
      />

      {/* ── KANAN: SIDEBAR CHECKOUT PERSISTEN (TABLET/DESKTOP/MOBILE) ── */}
      <PosCartPanel
        subtotal={subtotal}
        discAmt={discAmt}
        taxAmt={taxAmt}
        taxPct={taxPct}
        total={total}
        showMobileCart={showMobileCart}
        onCloseMobileCart={() => setShowMobileCart(false)}
        onOpenPay={() => setShowPay(true)}
      />

      {/* ── UNIFIED PAYMENT MODAL ── */}
      {showPay && (
        <PosPaymentModal
          paymentModal={paymentModal}
          onClose={closePaymentModal}
          onCheckout={handleCheckout}
          onOpenVouchers={() => setShowVouchers(true)}
          subtotal={subtotal}
          discAmt={discAmt}
          taxAmt={taxAmt}
          total={total}
          method={method}
          setMethod={setMethod}
          cash={cash}
          setCash={setCash}
          paid={paid}
          change={change}
          custName={custName}
          setCustName={setCustName}
          checkingOut={checkingOut}
          paymentPhase={paymentPhase}
          paymentOrder={paymentOrder}
          paymentStatus={paymentStatus}
          loyaltyPhone={loyaltyPhone}
          setLoyaltyPhone={setLoyaltyPhone}
          onLoyaltySearch={handleLoyaltySearch}
          loyaltySearching={loyaltySearching}
          loyaltyPassport={loyaltyPassport}
          loyaltySettings={loyaltySettings}
          loyaltyRewards={loyaltyRewards}
          loyaltyReward={loyaltyReward}
          onApplyLoyaltyReward={handleApplyLoyaltyReward}
          onClearLoyaltyReward={handleClearLoyaltyReward}
        />
      )}

      {/* ── RECEIPT MODAL ── */}
      {showRcpt && lastTx && (
        <PosReceiptModal
          receiptModal={receiptModal}
          lastTx={lastTx}
          lastTxKitchenOrder={lastTxKitchenOrder}
          onClose={closeReceiptModal}
          onPrint={() => setShowPrintSheet(true)}
          onShareWhatsApp={shareReceiptToWhatsApp}
        />
      )}

      {/* Action Sheets */}
      <PrintActionSheet visible={showPrintSheet} onClose={() => setShowPrintSheet(false)} transaction={lastTx} storeSettings={storeSettings} allowThermalPrint={subscriptionAccess.features.thermal_print} toast={toast}/>

      {/* ── VOUCHER MODAL ── */}
      {showVouchers && (
        <PosVoucherModal
          voucherModal={voucherModal}
          onClose={closeVoucherModal}
          toast={toast}
        />
      )}
    </div>
  );
}
