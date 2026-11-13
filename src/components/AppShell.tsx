




/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/AppShell.tsx — KaffePOS v5 — FAST INIT: cache storeId, show instantly
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy, useMemo } from 'react';
import { WifiOff, RefreshCw, LogOut, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/hooks/useStore';
import { createStore, getStores, getSubscriptionUsageLimits, type SubscriptionUsageLimits } from '@/lib/backendApi';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { getStoreCacheKey } from '@/utils/sessionIsolation';
import { ToastContainer, useToast } from './ui/Toast';
import DailyOpeningModal, { useNeedsOpeningCash } from './pos/DailyOpeningModal';
import SyncConflictCenter from './sync/SyncConflictCenter';
import AppVersionSync from './sync/AppVersionSync';
import type { Tab, ToastType } from '@/types';
import { isPostUpdateSyncPending, markPostUpdateSyncComplete, readUpgradeReport } from '@/lib/appUpgrade';
import { subscriptionManager } from '@/services/SubscriptionManager';
import { canAccessTab, getDefaultTabForRole } from '@/lib/accessControl';
import { selectStoreForBootstrap } from '@/lib/storeContext';
import { trackOpsEvent } from '@/lib/opsMetrics';
import { trackAnalyticsEvent } from '@/lib/analytics';
import UpgradeModal from './subscription/UpgradeModal';
import SmartUpgradeBanner from './subscription/SmartUpgradeBanner';
import NotificationBell from './notifications/NotificationBell';
import NotificationCenter from './notifications/NotificationCenter';
import CelebrationHost from './gamification/Celebration';
import BetaFeedbackButton from './beta/BetaFeedbackButton';
import { NAV, LS_LAST_TAB, EXPLICIT_SIGNOUT_KEY, getCachedStoreId, setCachedStoreId, getLastTabStorageKey, getValidTab, createLoadedTabsState } from './AppShell.helpers';
import { TabError, TabSpinner, AppLoading } from './AppShellChrome';
import { AppSidebarNav, AppBottomNav } from './AppShellNav';
import { IS_PAYMENT_DISABLED } from '@/lib/paymentMode';
import {
  cacheSubscriptionUsageLimits,
  daysSince,
  dispatchUpgradePrompt,
  getOrCreateUpgradeFirstSeen,
  markUpgradePromptDismissed,
  readCachedSubscriptionUsageLimits,
  shouldThrottleUpgradePrompt,
  type UpgradePromptRequest,
} from '@/lib/upgradePrompts';
const LOGO_ICON = '/logo-kaffeposappicon.svg';

const DashboardTab = lazy(() => import('./dashboard/Dashboard'));
const StaffPersonalProfileTab = lazy(() => import('./gamification/StaffPersonalProfile'));
const ChallengesTab = lazy(() => import('./challenges/ChallengesPage'));
const ReferralDashboardTab = lazy(() => import('./referrals/ReferralDashboardPage'));
const AffiliateDashboardTab = lazy(() => import('./affiliate/AffiliateDashboardPage'));
const POSTab       = lazy(() => import('./pos/POSTab'));
const LoyaltyTab   = lazy(() => import('./loyalty/LoyaltyTab'));
const KitchenTab   = lazy(() => import('./kitchen/KitchenTab'));
const WarehouseTab = lazy(() => import('./warehouse/WarehouseTab'));
const MenuTab      = lazy(() => import('./menu/MenuTab'));
const HistoryTab   = lazy(() => import('./history/HistoryTab'));
const ReportTab    = lazy(() => import('./report/ReportTab'));
const SettingsTab  = lazy(() => import('./settings/SettingsTab'));

export default function AppShell() {
  const { user, profile, isPro, subscriptionAccess, refreshProfile, role, can, signOut } = useAuth();
  const {
    storeId,
    loadAll,
    cleanup,
    syncing,
    cashRegister,
    isOnline,
    saveCashRegister,
    syncStatus,
    pendingSyncCount,
    failedSyncCount,
    flushPending,
    transactions,
    activeChallenges,
    challengeProgress,
    storeSettings,
  } = useStore();

  const [tab, setTab] = useState<Tab>(() => {
    try {
      return getValidTab(localStorage.getItem(LS_LAST_TAB)) ?? 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [loadedTabs, setLoadedTabs] = useState<Record<Tab, boolean>>(() => createLoadedTabsState(tab));
  const hasOpenChallenge = activeChallenges.some((challenge) => (
    challenge.is_active && !challengeProgress.some((progress) => progress.challenge_id === challenge.id && progress.is_completed)
  ));

  const [ready,   setReady]   = useState(false);
  const [message, setMessage] = useState('Memuat...');
  const [postUpdateSyncing, setPostUpdateSyncing] = useState(false);
  const [postUpdateNotice, setPostUpdateNotice] = useState(() => readUpgradeReport());
  const [showSyncCenter, setShowSyncCenter] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] = useState<SubscriptionUsageLimits | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptRequest | null>(null);
  const [upgradeBannerDismissedAt, setUpgradeBannerDismissedAt] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { toasts, showToast, dismissToast, showDownloadSuccess, showDownloadError } = useToast();

  const runSafeUpdateSync = useCallback(async () => {
    const tasks = await Promise.allSettled([
      refreshProfile(),
      subscriptionManager.getStatus(true).then(() => undefined),
      storeId ? loadAll(storeId) : Promise.resolve(),
    ]);
    const failed = tasks.find((task) => task.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }, [loadAll, refreshProfile, storeId]);

  useEffect(() => {
    const handleGlobalToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        showToast(detail.message, detail.type);
      }
    };
    window.addEventListener('kaffepos-toast', handleGlobalToast);
    return () => window.removeEventListener('kaffepos-toast', handleGlobalToast);
  }, [showToast]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'kaffepos-open-notifications') {
        setNotificationsOpen(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const handleUpgradePrompt = (event: Event) => {
      const detail = (event as CustomEvent<UpgradePromptRequest>).detail;
      if (!detail) return;
      setUpgradePrompt({
        recommendedPlan: 'signature',
        ...detail,
      });
    };

    window.addEventListener('kaffepos-upgrade-prompt', handleUpgradePrompt as EventListener);
    return () => window.removeEventListener('kaffepos-upgrade-prompt', handleUpgradePrompt as EventListener);
  }, []);

  // ── Dialog saldo kasir harian ─────────────────────────────────
  // Tunggu data ready DAN syncing=false agar tidak false positive
  const needsOpening  = useNeedsOpeningCash(cashRegister, syncing, ready);
  const [showOpening, setShowOpening] = useState(false);
  useEffect(() => {
    if (needsOpening) {
      // Tampilkan setelah perlu (data sudah dikonfirmasi belum ada)
      setShowOpening(true);
    } else {
      setShowOpening(false);
    }
  }, [needsOpening]);

  // ── Sync offline queue saat online kembali ───────────────────
  useEffect(() => {
    if (!isOnline) return;
    const OFFLINE_KEY = 'kpos_opening_offline_queue';
    try {
      const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
      if (queue.length === 0) return;
      // Sync semua antrian di background
      localStorage.removeItem(OFFLINE_KEY);
      queue.forEach((entry:any) => {
        saveCashRegister(entry as Partial<any>).catch(() => {});
      });
    } catch { /* ignore */ }
  }, [isOnline, saveCashRegister]);

  const initDone    = useRef(false);
  const isMounted   = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; cleanup(); };
    // Mount/unmount lifecycle only — cleanup() must run exactly once on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const uid = user?.id || profile?.id;
    if (!uid || initDone.current) return;
    initDone.current = true;

    const init = async () => {
      const uid = user?.id || profile?.id;
      if (!uid) return;
      const cachedId = uid ? getCachedStoreId(uid) : null;
      try { localStorage.removeItem(EXPLICIT_SIGNOUT_KEY); } catch { /* ignore */ }

      setMessage('Menyiapkan toko...');
      try {
        const response = await getStores();
        const canCreateStore = can('can_manage_settings');
        const assignedStoreId = role === 'cashier' ? profile?.assigned_store_id ?? null : null;
        const decision = selectStoreForBootstrap({
          stores: response.items,
          cachedStoreId: cachedId,
          assignedStoreId,
          canCreateStore,
        });

        if (decision.shouldClearCachedStore) {
          localStorage.removeItem(getStoreCacheKey(uid));
        }

        let activeStore = decision.store;

        if (!activeStore) {
          if (!decision.needsOwnerStoreCreation) {
            setMessage('Akun kasir belum terhubung ke outlet.');
            showToast('Akun kasir belum terhubung ke outlet. Minta Owner/Admin menyiapkan akses kasir.', 'warning');
            if (isMounted.current) setReady(true);
            return;
          }
          setMessage('Membuat toko baru...');
          activeStore = await createStore({
            store_name: `Kedai ${profile?.username || user?.email?.split('@')[0] || 'Kopi'}`,
          });
        }

        if (!activeStore?.id) throw new Error('ID toko tidak ditemukan');

        setCachedStoreId(uid, activeStore.id);
        if (role === 'cashier' && assignedStoreId && activeStore.id !== assignedStoreId) {
          void refreshProfile();
        }
        console.info('[AppShell] Active store prepared', { storeId: activeStore.id, userId: uid });
        if (isMounted.current) setReady(true);
        loadAll(activeStore.id).catch(() => {});

      } catch (e:any) {
        console.error('[AppShell] init failed:', e);
        if (isMounted.current) {
          showToast(normalizeUserFacingError(e, 'Aplikasi belum bisa memuat data toko. Cek koneksi lalu coba lagi.'), 'error');
          // Jika gagal total, tampilkan UI kosong agar tidak stuck di spinner
          setReady(true);
        }
      }
    };

    init();
    // Re-initialise store data only when the user/store identity changes. loadAll, can,
    // and showToast are stable helpers pulled in via closure; keying off them would re-run init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id, profile?.assigned_store_id, role, refreshProfile]);

  // Reset tampilan saat logout; pembersihan cache dilakukan di AuthContext
  useEffect(() => {
    if (!user?.id) {
      initDone.current = false;
      setReady(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!ready || !user?.id || !storeId || !isPostUpdateSyncPending() || postUpdateSyncing) return;

    let cancelled = false;
    setPostUpdateSyncing(true);

    const runPostUpdateSync = async () => {
      const tasks = await Promise.allSettled([
        refreshProfile(),
        subscriptionManager.getStatus(true).then(() => undefined),
        loadAll(storeId),
      ]);

      if (cancelled) return;

      const hasFailure = tasks.some((task) => task.status === 'rejected');
      if (!hasFailure) {
        markPostUpdateSyncComplete();
        if (postUpdateNotice?.firstLaunchAfterUpdate || (postUpdateNotice?.recoveredKeys.length ?? 0) > 0) {
          showToast('Data lama berhasil dipulihkan dan disinkronkan setelah update.', 'success');
        }
      } else {
        console.warn('[Upgrade] Post-update sync still pending', tasks);
      }

      setPostUpdateSyncing(false);
    };

    void runPostUpdateSync();

    return () => {
      cancelled = true;
    };
  }, [loadAll, postUpdateNotice?.firstLaunchAfterUpdate, postUpdateNotice?.recoveredKeys.length, postUpdateSyncing, ready, refreshProfile, showToast, storeId, user?.id]);

  useEffect(() => {
    if (!ready || !storeId || !user?.id) return;
    let cancelled = false;

    const cached = readCachedSubscriptionUsageLimits(storeId);
    if (cached) setSubscriptionUsage(cached);

    getSubscriptionUsageLimits(storeId)
      .then((usage) => {
        if (cancelled) return;
        setSubscriptionUsage(usage);
        cacheSubscriptionUsageLimits(storeId, usage);
      })
      .catch(() => {
        if (!cancelled && cached) setSubscriptionUsage(cached);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, storeId, user?.id, transactions.length]);

  const localMonthlyTransactionCount = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      if (tx.is_void) return false;
      const txDate = new Date(tx.date);
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }).length;
  }, [transactions]);

  const effectiveUsage = useMemo(() => {
    if (subscriptionUsage) return subscriptionUsage;
    const limit = subscriptionAccess.transactionLimit;
    const percent = limit > 0 ? Math.min(100, Math.round((localMonthlyTransactionCount / limit) * 100)) : 0;
    const firstSeen = getOrCreateUpgradeFirstSeen(user?.id || profile?.id, profile?.created_at ?? null);
    return {
      storeId: storeId || '',
      ownerId: profile?.owner_id || profile?.id || '',
      currentPlan: subscriptionAccess.plan,
      transactionLimit: limit,
      transactionsUsed: localMonthlyTransactionCount,
      transactionsRemaining: limit > 0 ? Math.max(limit - localMonthlyTransactionCount, 0) : null,
      percentUsed: percent,
      period: { type: 'monthly' as const, startsAt: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() },
      firstActivityAt: firstSeen,
      daysSinceFirstActivity: daysSince(firstSeen),
      shouldShowTransactionLimitPrompt: limit > 0 && percent >= 80 && localMonthlyTransactionCount < limit,
      shouldShowAppAgePrompt: subscriptionAccess.plan === 'secangkir' && daysSince(firstSeen) >= 14,
      isTrial: subscriptionAccess.isTrial,
      trialEndsAt: subscriptionAccess.expiryDate,
      trialDaysRemaining: subscriptionAccess.isTrial ? subscriptionAccess.daysRemaining : null,
      shouldShowTrialUpgradePrompt: subscriptionAccess.isTrial && [4, 1, 0].includes(subscriptionAccess.daysRemaining ?? -1),
    };
  }, [localMonthlyTransactionCount, profile?.created_at, profile?.id, profile?.owner_id, storeId, subscriptionAccess.daysRemaining, subscriptionAccess.expiryDate, subscriptionAccess.isTrial, subscriptionAccess.plan, subscriptionAccess.transactionLimit, subscriptionUsage, user?.id]);

  const transactionLimitPromptKey = `transaction_limit_80:${storeId || 'local'}`;
  const appAgePromptKey = `app_age_14_days:${user?.id || profile?.id || 'local'}`;
  const showTransactionLimitBanner = useMemo(() => Boolean(
    effectiveUsage.transactionLimit > 0 &&
    effectiveUsage.percentUsed >= 80 &&
    effectiveUsage.transactionsUsed < effectiveUsage.transactionLimit &&
    !shouldThrottleUpgradePrompt(storeId, transactionLimitPromptKey, 3)
    // upgradeBannerDismissedAt is intentionally kept as a recompute trigger: dismissing the
    // banner updates it so shouldThrottleUpgradePrompt() is re-evaluated against fresh storage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [effectiveUsage.percentUsed, effectiveUsage.transactionLimit, effectiveUsage.transactionsUsed, storeId, transactionLimitPromptKey, upgradeBannerDismissedAt]);

  useEffect(() => {
    if (!ready || !user?.id || upgradePrompt) return;
    if (subscriptionAccess.isTrial) return;
    if (!effectiveUsage.shouldShowAppAgePrompt) return;
    if (shouldThrottleUpgradePrompt(user.id, appAgePromptKey, 14)) return;

    dispatchUpgradePrompt({
      trigger: 'app_age_14_days',
      promptKey: appAgePromptKey,
      recommendedPlan: 'signature',
      title: 'Sudah 14 hari memakai KaffePOS',
      description: role === 'cashier'
        ? 'Outlet ini sudah aktif dipakai. Minta Owner/Admin meninjau paket Signature saat fitur premium mulai dibutuhkan.'
        : 'Jika operasional sudah mulai rutin, paket Signature membuka AI Insight, multi kasir, laporan lanjutan, dan printer thermal dalam satu paket.',
      metadata: { daysSinceFirstActivity: effectiveUsage.daysSinceFirstActivity },
    });
  }, [appAgePromptKey, effectiveUsage.daysSinceFirstActivity, effectiveUsage.shouldShowAppAgePrompt, ready, role, subscriptionAccess.isTrial, upgradePrompt, user?.id]);

  useEffect(() => {
    if (!ready || !user?.id || upgradePrompt) return;
    if (!subscriptionAccess.isTrial || subscriptionAccess.daysRemaining === null) return;
    const daysLeft = subscriptionAccess.daysRemaining;
    const daysUsed = 14 - daysLeft;
    const isExpiredPrompt = daysLeft <= 0;
    if (![10, 13].includes(daysUsed) && !isExpiredPrompt) return;
    const promptKey = isExpiredPrompt ? `secangkir_trial_expired:${user.id}` : `secangkir_trial_day_${daysUsed}:${user.id}`;
    if (shouldThrottleUpgradePrompt(user.id, promptKey, 1)) return;

    const message = isExpiredPrompt
      ? 'Trial Signature sudah selesai. Pilih paket agar fitur premium tetap aktif.'
      : daysUsed === 10
      ? `Trial Signature tersisa ${daysLeft} hari. Semua fitur premium masih aktif.`
      : `Trial Signature tersisa ${daysLeft} hari. Pilih paket agar fitur premium tetap aktif.`;
    showToast(message, 'info');
    if (typeof Notification !== 'undefined') {
      const sendNotification = () => new Notification('KaffePOS Closed Beta', {
        body: message,
        tag: isExpiredPrompt ? 'kaffepos-trial-expired' : `kaffepos-trial-day-${daysUsed}`,
      });
      if (Notification.permission === 'granted') {
        sendNotification();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') sendNotification();
        }).catch(() => {});
      }
    }
    dispatchUpgradePrompt({
      trigger: isExpiredPrompt ? 'trial_expired' : `trial_day_${daysUsed}`,
      promptKey,
      recommendedPlan: 'signature',
      title: isExpiredPrompt ? 'Trial Signature sudah selesai' : `Trial Signature tersisa ${daysLeft} hari`,
      description: role === 'cashier'
        ? 'Minta Owner/Admin memilih paket agar fitur premium tetap aktif setelah trial.'
        : isExpiredPrompt
          ? 'Pilih paket agar Gamification, Advanced Kopi Passport Loyalty, AI Insights, dan Notification Center tetap aktif untuk operasional cafe.'
          : 'Upgrade ke Signature kapan saja agar Gamification, Advanced Kopi Passport Loyalty, AI Insights, dan Notification Center tetap aktif setelah trial.',
      metadata: { daysUsed, daysLeft, trialEndsAt: subscriptionAccess.expiryDate },
    });
  }, [ready, role, showToast, subscriptionAccess.daysRemaining, subscriptionAccess.expiryDate, subscriptionAccess.isTrial, upgradePrompt, user?.id]);

  useEffect(() => {
    const userId = user?.id || profile?.id;
    if (!userId) return;
    try {
      const scopedTab = getValidTab(localStorage.getItem(getLastTabStorageKey(userId)));
      const fallbackTab = getValidTab(localStorage.getItem(LS_LAST_TAB));
      const requestedTab = scopedTab ?? fallbackTab ?? getDefaultTabForRole(role);
      const nextTab = canAccessTab(role, requestedTab) ? requestedTab : getDefaultTabForRole(role);
      setTab(nextTab);
      setLoadedTabs(createLoadedTabsState(nextTab));
    } catch {
      const defaultTab = getDefaultTabForRole(role);
      setTab(defaultTab);
      setLoadedTabs(createLoadedTabsState(defaultTab));
    }
  }, [user?.id, profile?.id, role]);

  useEffect(() => {
    setLoadedTabs((current) => {
      if (current[tab]) return current;
      return { ...current, [tab]: true };
    });
  }, [tab]);

  const changeTab = useCallback(async (t: Tab) => {
    if (!canAccessTab(role, t)) {
      showToast('Akses fitur ini hanya untuk Owner/Admin.', 'warning');
      const fallbackTab = getDefaultTabForRole(role);
      setTab(fallbackTab);
      return;
    }
    setTab(t);
    if (t === 'loyalty' || t === 'performance' || t === 'challenges') {
      const eventName = t === 'loyalty' ? 'loyalty_used' : 'gamification_used';
      trackAnalyticsEvent(eventName, { tab: t, store_id: storeId || undefined });
      void trackOpsEvent({
        event_name: eventName,
        status: 'success',
        ...(storeId ? { store_id: storeId } : {}),
        metadata: { tab: t },
      });
    }
    try {
      localStorage.setItem(LS_LAST_TAB, t);
      const userId = user?.id || profile?.id;
      if (userId) {
        localStorage.setItem(getLastTabStorageKey(userId), t);
      }
    } catch { /* ignore */ }
    if (Capacitor.isNativePlatform()) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch { /* ignore */ }
    }
  }, [user?.id, profile?.id, role, showToast, storeId],   );

  useEffect(() => {
    if (canAccessTab(role, tab)) return;
    void changeTab(getDefaultTabForRole(role));
  }, [changeTab, role, tab]);

  useEffect(() => {
    const openTab = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: Tab }>).detail;
      if (detail?.tab && NAV.some((entry) => entry.id === detail.tab) && canAccessTab(role, detail.tab)) {
        void changeTab(detail.tab);
      }
    };

    window.addEventListener('kaffepos-open-tab', openTab as EventListener);
    return () => window.removeEventListener('kaffepos-open-tab', openTab as EventListener);
  }, [changeTab, role]);

  // Memoised so the tab components receiving `toast` as a prop keep a stable reference
  // across AppShell re-renders instead of a fresh object on every render.
  const toast = useMemo(() => ({
    showToast: (m: string, t?: ToastType) => showToast(m, t),
    showDownloadSuccess,
    showDownloadError
  }), [showToast, showDownloadSuccess, showDownloadError]);

  const renderTabPanel = (tabId: Tab, name: string, node: React.ReactNode) => {
    if (!canAccessTab(role, tabId)) return null;
    if (!loadedTabs[tabId]) return null;
    const isActive = tab === tabId;
    return (
      <section
        key={tabId}
        className={isActive ? 'kaffe-responsive-surface flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden' : 'hidden'}
        aria-hidden={!isActive}
      >
        <TabError name={name}>{node}</TabError>
      </section>
    );
  };

  if (!ready) return <AppLoading message={message} />;

  return (
    <div className="kaffe-app-bg kaffe-responsive-surface fixed inset-0 flex overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="kaffe-sidebar hidden lg:flex flex-col w-[76px] xl:w-[248px] shrink-0 border-r z-50">
        <div className="flex flex-col items-center gap-3 px-3 pt-5 pb-3 xl:flex-row xl:justify-between xl:gap-2 xl:px-4 xl:pb-4">
          <button
            type="button"
            onClick={() => changeTab('dashboard')}
            aria-label="Buka Dashboard"
            className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 text-left"
          >
            <img src={LOGO_ICON} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <span className="hidden min-w-0 xl:block">
              <span className="block whitespace-nowrap font-display text-[17px] font-extrabold leading-tight tracking-tight text-slate-900">
                Kaffe<span className="text-[#FF6A00]">POS</span>
              </span>
              <span className="block truncate text-[11px] font-semibold text-slate-500">
                {storeSettings?.store_name || 'Toko kamu'}
              </span>
            </span>
          </button>
          <NotificationBell onOpen={() => setNotificationsOpen(true)} className="h-11 w-11 shrink-0 rounded-xl" />
        </div>

        <AppSidebarNav role={role} tab={tab} changeTab={changeTab} syncing={syncing} hasOpenChallenge={hasOpenChallenge} />

        <div className="border-t border-[var(--brand-hairline)] p-3">
          <div className="flex flex-col items-center gap-2 rounded-xl px-0 py-2 xl:flex-row xl:gap-3 xl:px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 font-display text-sm font-extrabold text-[var(--brand-orange-text)]">
              {(profile?.display_name || profile?.username || user?.email || 'K').trim().charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-[13px] font-bold text-slate-900">{profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Pengguna'}</p>
              <p className="truncate text-[11px] font-semibold text-slate-500">{role === 'cashier' ? 'Kasir' : 'Owner / Admin'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(EXPLICIT_SIGNOUT_KEY, '1');
                void signOut();
              }}
              aria-label="Keluar"
              title="Keluar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="kaffe-responsive-surface flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* ── MOBILE / TABLET TOP BAR ── */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--brand-panel-border)] bg-white px-3 sm:px-4 lg:hidden">
          <button
            type="button"
            onClick={() => changeTab('dashboard')}
            aria-label="Buka Dashboard"
            className="flex min-w-0 items-center gap-2 rounded-xl text-left"
          >
            <img src={LOGO_ICON} alt="" className="h-8 w-8 shrink-0 object-contain" />
            <span className="min-w-0">
              <span className="block whitespace-nowrap font-display text-[15px] font-extrabold leading-tight tracking-tight text-slate-900">
                Kaffe<span className="text-[#FF6A00]">POS</span>
              </span>
              <span className="block truncate text-[11px] font-semibold leading-tight text-slate-500">
                {storeSettings?.store_name || 'Toko kamu'}
              </span>
            </span>
          </button>
          <NotificationBell onOpen={() => setNotificationsOpen(true)} />
        </header>

        <AppVersionSync
          ready={ready}
          storeId={storeId}
          userId={user?.id}
          onSync={runSafeUpdateSync}
          showToast={showToast}
        />

        {postUpdateNotice && (postUpdateNotice.firstLaunchAfterUpdate || postUpdateNotice.recoveredKeys.length > 0) ? (
          <div className="flex-shrink-0 border-b border-emerald-100 bg-emerald-50 px-3 py-2 sm:px-5" role="status">
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-emerald-900">
                <span className="font-extrabold">Update berhasil dipulihkan.</span>{' '}
                {postUpdateSyncing
                  ? 'Data lama sedang diselaraskan dengan server.'
                  : 'Pengaturan, tema, dan konteks toko lama sudah dibaca kembali.'}
              </p>
              <button
                type="button"
                onClick={() => setPostUpdateNotice(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-emerald-800 hover:bg-emerald-100"
                aria-label="Tutup notifikasi update"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : null}

        {!IS_PAYMENT_DISABLED && showTransactionLimitBanner && (
          <SmartUpgradeBanner
            used={effectiveUsage.transactionsUsed}
            limit={effectiveUsage.transactionLimit}
            percent={effectiveUsage.percentUsed}
            role={role}
            onDismiss={() => {
              markUpgradePromptDismissed(storeId, transactionLimitPromptKey);
              setUpgradeBannerDismissedAt(Date.now());
            }}
            onUpgrade={() => {
              dispatchUpgradePrompt({
                trigger: 'transaction_limit_80',
                promptKey: transactionLimitPromptKey,
                recommendedPlan: 'kopi_susu',
                title: 'Transaksi gratis hampir mencapai batas',
                description: role === 'cashier'
                  ? 'Paket gratis outlet ini hampir penuh. Minta Owner/Admin upgrade agar transaksi kasir tetap berjalan tanpa batas.'
                  : 'Upgrade ke Kopi Susu atau Signature untuk transaksi tanpa batas dan akses laporan yang lebih lengkap.',
                metadata: {
                  used: effectiveUsage.transactionsUsed,
                  limit: effectiveUsage.transactionLimit,
                  percent: effectiveUsage.percentUsed,
                },
              });
            }}
          />
        )}

        {/* ── Status Banner ───────────────────────────── */}
        {(!isOnline || syncStatus === 'syncing' || syncStatus === 'sync_failed' || syncStatus === 'sync_success') && (
          <div className={`kaffe-status-banner px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2 sm:gap-3 flex-shrink-0 z-50 ${
            syncStatus === 'sync_failed'
              ? 'bg-rose-500'
              : syncStatus === 'sync_success'
                ? 'bg-emerald-500'
                : syncStatus === 'syncing'
                  ? 'bg-slate-900'
                  : 'bg-amber-500'
          }`}>
            {syncStatus === 'syncing' ? <RefreshCw size={12} className="text-white animate-spin" /> : <WifiOff size={12} className="text-white" />}
            <p className="min-w-0 break-words text-white text-[12px] font-bold leading-tight">
              {syncStatus === 'sync_failed'
                ? `${failedSyncCount || pendingSyncCount} data gagal sinkron`
                : syncStatus === 'sync_success'
                  ? 'Semua data tersinkron'
                  : syncStatus === 'syncing'
                    ? `Sinkronisasi ${pendingSyncCount || 1} data...`
                    : `Mode Offline Aktif${pendingSyncCount ? ` (${pendingSyncCount} pending)` : ''}`}
            </p>
            {syncStatus === 'sync_failed' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSyncCenter(true)}
                  className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/30 transition-colors"
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => void flushPending()}
                  className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/30 transition-colors"
                >
                  Ulangi
                </button>
              </>
            )}
            {(pendingSyncCount > 0 && syncStatus !== 'sync_failed') && (
              <button
                type="button"
                onClick={() => setShowSyncCenter(true)}
                className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/30 transition-colors"
              >
                Lihat
              </button>
            )}
          </div>
        )}

        <main className="kaffe-responsive-surface flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px))' }}>
          <Suspense fallback={<TabSpinner />}>
            {renderTabPanel('dashboard', 'Beranda', <DashboardTab />)}
            {renderTabPanel('performance', 'Performa', <StaffPersonalProfileTab profile={profile} role={role} />)}
            {renderTabPanel('challenges', 'Misi Harian', <ChallengesTab profile={profile} role={role} subscriptionAccess={subscriptionAccess} />)}
            {renderTabPanel('referrals', 'Referral', <ReferralDashboardTab toast={toast} />)}
            {renderTabPanel('affiliate', 'Affiliate', <AffiliateDashboardTab toast={toast} />)}
            {renderTabPanel('pos', 'POS', <POSTab toast={toast} profile={profile} subscriptionAccess={subscriptionAccess} />)}
            {renderTabPanel('loyalty', 'Loyalty', <LoyaltyTab toast={toast} profile={profile} role={role} subscriptionAccess={subscriptionAccess} />)}
            {renderTabPanel('kitchen', 'Dapur', <KitchenTab toast={toast} profile={profile} />)}
            {renderTabPanel('warehouse', 'Stok', <WarehouseTab toast={toast} />)}
            {renderTabPanel('menu', 'Menu', <MenuTab toast={toast} />)}
            {renderTabPanel('history', 'Riwayat', <HistoryTab toast={toast} subscriptionAccess={subscriptionAccess} />)}
            {renderTabPanel('report', 'Laporan', <ReportTab toast={toast} subscriptionAccess={subscriptionAccess} />)}
            {renderTabPanel('settings', 'Pengaturan', <SettingsTab toast={toast} isPro={isPro} profile={profile} subscriptionAccess={subscriptionAccess} />)}
          </Suspense>
        </main>

        {/* ── MOBILE NAV (Bottom) ── */}
        <AppBottomNav role={role} tab={tab} changeTab={changeTab} syncing={syncing} hasOpenChallenge={hasOpenChallenge} />
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <SyncConflictCenter
        open={showSyncCenter}
        onClose={() => setShowSyncCenter(false)}
        storeId={storeId}
        role={role}
        onRetryAll={flushPending}
      />
      <UpgradeModal
        open={Boolean(upgradePrompt)}
        onClose={() => setUpgradePrompt(null)}
        role={role}
        currentPlan={effectiveUsage.currentPlan || subscriptionAccess.plan}
        recommendedPlan={upgradePrompt?.recommendedPlan || 'signature'}
        trigger={upgradePrompt?.trigger}
        promptKey={upgradePrompt?.promptKey}
        title={upgradePrompt?.title}
        description={upgradePrompt?.description}
        storeId={storeId}
        toast={toast}
        metadata={upgradePrompt?.metadata}
      />
      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        storeId={storeId}
      />
      <CelebrationHost />
      <BetaFeedbackButton storeId={storeId} toast={toast} hideTrigger={tab === 'pos' || tab === 'kitchen'} />

      {/* Dialog saldo kasir harian wajib */}
      {showOpening && (
        <DailyOpeningModal
          cashierName={profile?.display_name || profile?.username || 'Kasir'}
          toast={{ showToast }}
          onDone={() => setShowOpening(false)}
        />
      )}
    </div>
  );
}
