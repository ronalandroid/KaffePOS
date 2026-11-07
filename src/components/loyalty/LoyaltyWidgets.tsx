/** Presentational widgets for the loyalty tab (badges, stamp grid, cards, states). */
import { Coffee, Gift, Loader2, Plus, Sparkles, Stamp, TicketPercent, UserRound } from 'lucide-react';
import type { LoyaltyPassport, LoyaltyReward, LoyaltySettings } from '@/lib/loyalty';
import { canRedeemReward, getStampProgress, getTierLabel, getTierProgress } from '@/lib/loyalty';
import { fRp, fNum } from './loyaltyFormat';

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-[#FF6A00] transition-all duration-700 ease-out"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}

export function TierBadge({ tier }: { tier: LoyaltyPassport['tier'] }) {
  const label = getTierLabel(tier);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-700"
      title="Tier naik otomatis dari total transaksi pelanggan."
    >
      <Sparkles size={12} />
      {label}
    </span>
  );
}

export function PassportStampGrid({ passport, settings }: { passport: LoyaltyPassport; settings: LoyaltySettings }) {
  const progress = getStampProgress(passport, settings);
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {Array.from({ length: progress.required }).map((_, index) => {
        const filled = index < progress.current;
        return (
          <div
            key={index}
            className={`flex aspect-square items-center justify-center rounded-2xl border transition-all duration-300 ${
              filled
                ? 'border-orange-100 bg-orange-50 text-[#FF6A00] shadow-sm'
                : 'border-slate-100 bg-white text-slate-200'
            }`}
            aria-label={`Stamp ${index + 1}${filled ? ' terisi' : ' kosong'}`}
            title={filled ? `Stamp ${index + 1} sudah terisi` : `Stamp ${index + 1} belum terisi`}
          >
            {filled ? <Coffee size={20} strokeWidth={2.6} /> : <Stamp size={18} strokeWidth={2} />}
          </div>
        );
      })}
    </div>
  );
}

export function StampCard({ passport, settings }: { passport: LoyaltyPassport; settings: LoyaltySettings }) {
  const stampProgress = getStampProgress(passport, settings);
  const tierProgress = getTierProgress(passport);
  return (
    <section
      className="kaffe-panel rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--brand-panel-shadow-hover)] md:p-6"
      title="Kopi Passport menampilkan stamp, poin, tier, dan progress reward pelanggan."
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#FF6A00]">
            <UserRound size={22} />
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-extrabold text-slate-900">
                {passport.customer_name || 'Pelanggan Kopi'}
              </h3>
              <TierBadge tier={passport.tier} />
            </div>
            <p className="text-sm font-semibold text-slate-500">{passport.customer_phone}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Poin</p>
            <p className="mt-1 text-lg font-black text-slate-900">{fNum(passport.available_points)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stamp</p>
            <p className="mt-1 text-lg font-black text-slate-900">{passport.available_stamps}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-orange-100/80 bg-gradient-to-br from-orange-50/80 via-white to-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-[#FF6A00]">Kopi Passport</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {stampProgress.current}/{stampProgress.required} stamp menuju reward
            </p>
          </div>
          {stampProgress.completedCards > 0 ? (
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 shadow-sm">
              {stampProgress.completedCards} kartu penuh
            </span>
          ) : null}
        </div>
        <PassportStampGrid passport={passport} settings={settings} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{tierProgress.label}</p>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            {fRp(tierProgress.current)} / {fRp(tierProgress.target)}
          </p>
        </div>
        <ProgressBar value={tierProgress.percent} />
      </div>
    </section>
  );
}

export function RewardCard({ reward, passport }: { reward: LoyaltyReward; passport: LoyaltyPassport | null }) {
  const redeemable = canRedeemReward(passport, reward);
  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 ${
        reward.is_active ? 'border-slate-100 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-70'
      }`}
      title={redeemable ? 'Reward ini sudah bisa ditukar pelanggan.' : 'Pelanggan belum memenuhi syarat reward ini.'}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#FF6A00]">
          {reward.type === 'free_item' ? <Gift size={19} /> : <TicketPercent size={19} />}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
            redeemable ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
          }`}
        >
          {redeemable ? 'Siap tukar' : 'Belum cukup'}
        </span>
      </div>
      <p className="text-sm font-black text-slate-900">{reward.name}</p>
      <p className="mt-1 min-h-[36px] text-xs font-semibold leading-relaxed text-slate-500">
        {reward.description || 'Reward loyalty untuk pelanggan setia.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {reward.points_cost > 0 ? (
          <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            {fNum(reward.points_cost)} poin
          </span>
        ) : null}
        {reward.stamps_cost > 0 ? (
          <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-700">
            {reward.stamps_cost} stamp
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="kaffe-app-bg kaffe-responsive-surface flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="kaffe-panel rounded-2xl p-6">
          <div className="flex items-center justify-center gap-3 py-16 text-sm font-bold text-slate-400">
            <Loader2 size={26} className="animate-spin text-[#FF6A00]" />
            Memuat Kopi Passport...
          </div>
        </section>
      </div>
    </div>
  );
}

export function EmptyState({ onFocus }: { onFocus: () => void }) {
  return (
    <section className="kaffe-panel rounded-2xl border-dashed p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#FF6A00]">
            <Coffee size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">Belum ada pelanggan loyalty</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">
              Cari nomor pelanggan atau tambahkan stamp pertama setelah checkout.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFocus}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 text-xs font-black uppercase tracking-wider text-white shadow-[0_12px_26px_rgba(255,106,0,0.18)] transition-all active:scale-95 hover:-translate-y-0.5"
        >
          Tambah Pelanggan
          <Plus size={16} />
        </button>
      </div>
    </section>
  );
}

