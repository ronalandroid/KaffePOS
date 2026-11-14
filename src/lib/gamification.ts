import type { Profile, Transaction } from '@/types';

export type StaffBadgeIcon = 'award' | 'zap' | 'trending-up' | 'shield-check' | 'flame';

export type StaffBadge = {
  code: string;
  name: string;
  description: string;
  icon: StaffBadgeIcon;
  unlocked: boolean;
  progress: number;
  target: number;
};

export type StaffChallenge = {
  code: string;
  title: string;
  description: string;
  current: number;
  target: number;
  rewardPoints: number;
  completed: boolean;
};

export type StaffLeaderboardEntry = {
  name: string;
  points: number;
  transactions: number;
  rank: number;
};

export type StaffPerformanceScope = 'personal' | 'team';

export type StaffPersonalProfileStats = {
  staffName: string;
  initials: string;
  scope: StaffPerformanceScope;
  level: number;
  levelLabel: string;
  points: number;
  nextLevelPoints: number;
  levelProgress: number;
  isMaxLevel: boolean;
  isEmpty: boolean;
  dailyStreak: number;
  weeklyTransactions: number;
  weeklyRevenue: number;
  rank: number;
  totalStaff: number;
  activeStaffCount: number;
  topPerformerName: string | null;
  badges: StaffBadge[];
  challenges: StaffChallenge[];
  leaderboard: StaffLeaderboardEntry[];
};

const LEVELS = [
  { min: 0, label: 'Kasir baru' },
  { min: 120, label: 'Kasir terlatih' },
  { min: 300, label: 'Kasir andal' },
  { min: 600, label: 'Kasir senior' },
  { min: 1000, label: 'Kasir teladan' },
] as const;

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  return result;
}

function dayKey(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function normalizeName(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function resolveStaffName(profile: Profile | null | undefined) {
  return profile?.display_name?.trim() || profile?.username?.trim() || profile?.email?.split('@')[0] || 'Kasir';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KS';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'KS';
}

function isNonVoid(transaction: Transaction) {
  return !transaction.is_void;
}

function belongsToStaff(transaction: Transaction, staffName: string) {
  return normalizeName(transaction.cashier || 'Kasir') === normalizeName(staffName);
}

function isToday(transaction: Transaction, now: Date) {
  return dayKey(new Date(transaction.date)) === dayKey(now);
}

function isThisWeek(transaction: Transaction, now: Date) {
  return new Date(transaction.date) >= startOfWeek(now);
}

function getUpsellCount(transactions: Transaction[]) {
  return transactions.filter((transaction) => {
    const itemCount = transaction.items.reduce((sum, item) => sum + (item.qty || 0), 0);
    return transaction.total >= 50000 || itemCount >= 3;
  }).length;
}

export function calculateTransactionPoints(transaction: Transaction) {
  if (transaction.is_void) return 0;

  const itemCount = transaction.items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const upsellBonus = transaction.total >= 50000 ? 8 : 0;
  const basketBonus = Math.min(Math.max(itemCount - 1, 0) * 2, 8);
  const qrisBonus = transaction.method === 'QRIS' ? 2 : 0;

  return 10 + upsellBonus + basketBonus + qrisBonus;
}

export function calculateDailyStreak(transactions: Transaction[], now = new Date()) {
  const activeDays = new Set(
    transactions
      .filter(isNonVoid)
      .map((transaction) => dayKey(new Date(transaction.date))),
  );

  let streak = 0;
  const cursor = startOfDay(now);

  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getLevel(points: number) {
  const index = LEVELS.reduce((current, level, levelIndex) => (points >= level.min ? levelIndex : current), 0);
  const current = LEVELS[index] || LEVELS[0];
  const next = LEVELS[index + 1];
  const nextLevelPoints = next?.min ?? points;
  const span = Math.max(nextLevelPoints - current.min, 1);
  const levelProgress = next ? Math.min(Math.round(((points - current.min) / span) * 100), 100) : 100;

  return {
    level: index + 1,
    levelLabel: current.label,
    nextLevelPoints,
    levelProgress,
    isMaxLevel: !next,
  };
}

function buildLeaderboard(
  transactions: Transaction[],
  staffName: string,
  now: Date,
  options: { includeFallbackStaff: boolean },
): StaffLeaderboardEntry[] {
  const buckets = new Map<string, { points: number; transactions: number }>();

  transactions
    .filter((transaction) => isNonVoid(transaction) && isThisWeek(transaction, now))
    .forEach((transaction) => {
      const name = transaction.cashier?.trim() || 'Kasir';
      const current = buckets.get(name) || { points: 0, transactions: 0 };
      buckets.set(name, {
        points: current.points + calculateTransactionPoints(transaction),
        transactions: current.transactions + 1,
      });
    });

  if (options.includeFallbackStaff && !buckets.has(staffName)) {
    buckets.set(staffName, { points: 0, transactions: 0 });
  }

  return [...buckets.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.points - a.points || b.transactions - a.transactions || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildBadges(params: {
  weeklyTransactions: number;
  weeklyUpsells: number;
  weeklyVoids: number;
  dailyStreak: number;
  completedKitchenOrders: number;
}) {
  const badgeDefinitions: StaffBadge[] = [
    {
      code: 'speed-demon',
      name: '15 transaksi seminggu',
      description: 'Selesaikan 15 transaksi dalam minggu ini.',
      icon: 'zap',
      progress: params.weeklyTransactions,
      target: 15,
      unlocked: params.weeklyTransactions >= 15,
    },
    {
      code: 'upsell-king',
      name: 'Transaksi besar',
      description: 'Catat 5 transaksi senilai Rp 50.000 ke atas atau berisi 3 item ke atas dalam minggu ini.',
      icon: 'trending-up',
      progress: params.weeklyUpsells,
      target: 5,
      unlocked: params.weeklyUpsells >= 5,
    },
    {
      code: 'zero-voids',
      name: 'Tanpa void',
      description: 'Seminggu penuh tanpa transaksi void.',
      icon: 'shield-check',
      progress: params.weeklyVoids === 0 && params.weeklyTransactions > 0 ? 1 : 0,
      target: 1,
      unlocked: params.weeklyVoids === 0 && params.weeklyTransactions > 0,
    },
    {
      code: 'streak-flame',
      name: '3 hari berturut-turut',
      description: 'Ada transaksi 3 hari berturut-turut.',
      icon: 'flame',
      progress: params.dailyStreak,
      target: 3,
      unlocked: params.dailyStreak >= 3,
    },
    {
      code: 'kds-ready',
      name: '10 pesanan dapur',
      description: 'Selesaikan 10 pesanan di layar dapur.',
      icon: 'award',
      progress: params.completedKitchenOrders,
      target: 10,
      unlocked: params.completedKitchenOrders >= 10,
    },
  ];

  return badgeDefinitions.map((badge) => ({
    ...badge,
    progress: Math.min(badge.progress, badge.target),
  }));
}

function buildChallenges(params: {
  todayTransactions: number;
  todayQris: number;
  todayRevenue: number;
  todayVoids: number;
}) {
  return [
    {
      code: 'daily-10-checkouts',
      title: '10 transaksi hari ini',
      description: 'Selesaikan 10 transaksi sebelum tutup kasir.',
      current: params.todayTransactions,
      target: 10,
      rewardPoints: 50,
    },
    {
      code: 'qris-3',
      title: '3 pembayaran QRIS',
      description: 'Terima 3 pembayaran lewat QRIS hari ini.',
      current: params.todayQris,
      target: 3,
      rewardPoints: 25,
    },
    {
      code: 'revenue-500k',
      title: 'Penjualan Rp 500 rb',
      description: 'Capai total penjualan Rp 500.000 hari ini.',
      current: params.todayRevenue,
      target: 500000,
      rewardPoints: 60,
    },
    {
      code: 'zero-void-day',
      title: 'Tanpa void hari ini',
      description: 'Tutup hari tanpa transaksi void.',
      current: params.todayVoids === 0 && params.todayTransactions > 0 ? 1 : 0,
      target: 1,
      rewardPoints: 20,
    },
  ].map((challenge) => ({
    ...challenge,
    completed: challenge.current >= challenge.target,
  }));
}

export function buildStaffPersonalProfileStats(params: {
  transactions: Transaction[];
  profile: Profile | null | undefined;
  scope?: StaffPerformanceScope;
  displayName?: string;
  bonusPoints?: number;
  // Authoritative lifetime transaction-points computed server-side over the FULL history.
  // The local `transactions` cache is windowed (~500), so when this is provided we use it
  // for points/level instead of the local sum — keeping XP consistent across devices.
  lifetimePoints?: number;
  now?: Date;
}): StaffPersonalProfileStats {
  const now = params.now ?? new Date();
  const scope = params.scope ?? 'personal';
  const staffName = params.displayName?.trim() || (scope === 'team' ? 'Tim Outlet' : resolveStaffName(params.profile));
  const staffTransactions = scope === 'team'
    ? params.transactions
    : params.transactions.filter((transaction) => belongsToStaff(transaction, staffName));
  const activeStaffTransactions = staffTransactions.filter(isNonVoid);
  const weeklyTransactions = activeStaffTransactions.filter((transaction) => isThisWeek(transaction, now));
  const todayTransactions = activeStaffTransactions.filter((transaction) => isToday(transaction, now));
  const earnedPoints = params.lifetimePoints != null
    ? params.lifetimePoints
    : activeStaffTransactions.reduce((sum, transaction) => sum + calculateTransactionPoints(transaction), 0);
  const points = earnedPoints + Math.max(0, params.bonusPoints ?? 0);
  const dailyStreak = calculateDailyStreak(activeStaffTransactions, now);
  const leaderboard = buildLeaderboard(params.transactions, staffName, now, { includeFallbackStaff: scope === 'personal' });
  const ownRank = scope === 'personal'
    ? leaderboard.find((entry) => normalizeName(entry.name) === normalizeName(staffName))?.rank ?? leaderboard.length
    : leaderboard[0]?.rank ?? 0;
  const weeklyVoids = staffTransactions.filter((transaction) => transaction.is_void && isThisWeek(transaction, now)).length;
  const completedKitchenOrders = weeklyTransactions.filter((transaction) => {
    const status = transaction.kitchen_order?.overall_status;
    return status === 'served' || status === 'completed';
  }).length;
  const level = getLevel(points);
  const activeStaffCount = new Set(
    params.transactions
      .filter((transaction) => isNonVoid(transaction) && isThisWeek(transaction, now))
      .map((transaction) => transaction.cashier?.trim() || 'Kasir'),
  ).size;

  return {
    staffName,
    initials: getInitials(staffName),
    scope,
    ...level,
    points,
    isEmpty: activeStaffTransactions.length === 0,
    dailyStreak,
    weeklyTransactions: weeklyTransactions.length,
    weeklyRevenue: weeklyTransactions.reduce((sum, transaction) => sum + transaction.total, 0),
    rank: ownRank,
    totalStaff: Math.max(leaderboard.length, scope === 'personal' ? 1 : 0),
    activeStaffCount,
    topPerformerName: leaderboard[0]?.name ?? null,
    badges: buildBadges({
      weeklyTransactions: weeklyTransactions.length,
      weeklyUpsells: getUpsellCount(weeklyTransactions),
      weeklyVoids,
      dailyStreak,
      completedKitchenOrders,
    }),
    challenges: buildChallenges({
      todayTransactions: todayTransactions.length,
      todayQris: todayTransactions.filter((transaction) => transaction.method === 'QRIS').length,
      todayRevenue: todayTransactions.reduce((sum, transaction) => sum + transaction.total, 0),
      todayVoids: staffTransactions.filter((transaction) => transaction.is_void && isToday(transaction, now)).length,
    }),
    leaderboard,
  };
}
