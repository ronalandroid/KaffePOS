import { useState, useEffect, useMemo } from 'react';
import { X, Wallet, ArrowDownCircle, ArrowUpCircle, CheckCircle2, History } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { createShiftClosing, getShiftClosings } from '@/lib/backendApi';
import type { Profile, ShiftClosing } from '@/types';
import { fRp } from './posHelpers';

type Props = {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  toast: { showToast: (m: string, t?: 'success' | 'error' | 'warning' | 'info') => void };
};

export default function PosShiftModal({ open, onClose, profile, toast }: Props) {
  const storeId = useStore((s) => s.storeId);
  const transactions = useStore((s) => s.transactions);
  const cashFlow = useStore((s) => s.cashFlow);
  const cashRegister = useStore((s) => s.cashRegister);
  const expenses = useStore((s) => s.expenses);
  const saveCashRegister = useStore((s) => s.saveCashRegister);
  const updateCashRegister = useStore((s) => s.updateCashRegister);
  const saveCashFlow = useStore((s) => s.saveCashFlow);

  const [tab, setTab] = useState<'shift' | 'cash_io' | 'history'>('shift');
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [ioType, setIoType] = useState<'in' | 'out'>('out');
  const [ioAmount, setIoAmount] = useState('');
  const [ioDesc, setIoDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<ShiftClosing[]>([]);

  const todayIsoDate = new Date().toISOString().slice(0, 10);
  const todayString = new Date().toDateString();

  const todayRegister = useMemo(
    () =>
      cashRegister.find(
        (r) =>
          String(r.date).slice(0, 10) === todayIsoDate ||
          new Date(r.date).toDateString() === todayString,
      ) || null,
    [cashRegister, todayIsoDate, todayString],
  );

  useEffect(() => {
    if (todayRegister) {
      setOpeningCashInput(String(todayRegister.amount || 0));
    }
  }, [todayRegister]);

  useEffect(() => {
    if (!open || !storeId) return;
    void getShiftClosings(storeId).then((res) => setShiftHistory(res.items));
  }, [open, storeId]);

  const metrics = useMemo(() => {
    const todayTx = transactions.filter(
      (tx) => !tx.is_void && new Date(tx.date).toDateString() === todayString,
    );
    const cashSales = todayTx
      .filter((tx) => tx.method === 'Tunai')
      .reduce((sum, tx) => sum + tx.total, 0);
    const nonCashSales = todayTx
      .filter((tx) => tx.method !== 'Tunai')
      .reduce((sum, tx) => sum + tx.total, 0);

    const todayFlows = cashFlow.filter(
      (cf) => new Date(cf.date).toDateString() === todayString,
    );
    const cashIn = todayFlows
      .filter((cf) => cf.type === 'in')
      .reduce((sum, cf) => sum + cf.amount, 0);
    const cashOutFlow = todayFlows
      .filter((cf) => cf.type === 'out')
      .reduce((sum, cf) => sum + cf.amount, 0);

    const todayCashierExpenses = expenses
      .filter(
        (ex) =>
          new Date(ex.date).toDateString() === todayString &&
          (!ex.source || ex.source === 'cashier'),
      )
      .reduce((sum, ex) => sum + ex.amount, 0);

    const openingCash = todayRegister?.amount ?? (parseInt(openingCashInput, 10) || 0);
    const cashOut = cashOutFlow + todayCashierExpenses;
    const expectedCash = openingCash + cashSales + cashIn - cashOut;

    return {
      txCount: todayTx.length,
      cashSales,
      nonCashSales,
      totalSales: cashSales + nonCashSales,
      cashIn,
      cashOut,
      openingCash,
      expectedCash,
    };
  }, [transactions, cashFlow, expenses, todayRegister, openingCashInput, todayString]);

  if (!open) return null;

  const actualCash = actualCashInput === '' ? metrics.expectedCash : parseInt(actualCashInput, 10) || 0;
  const variance = actualCash - metrics.expectedCash;
  const cashierName = profile?.display_name || profile?.username || 'Kasir';

  const handleSaveOpeningCash = async () => {
    const amount = Math.max(0, parseInt(openingCashInput, 10) || 0);
    try {
      setSaving(true);
      if (todayRegister) {
        await updateCashRegister(todayRegister.id, {
          amount,
          note: 'Update modal buka shift POS',
          opened_by: cashierName,
        });
      } else {
        await saveCashRegister({
          date: todayIsoDate,
          amount,
          note: 'Modal awal buka shift POS',
          opened_by: cashierName,
        });
      }
      toast.showToast(`Modal awal shift ${fRp(amount)} tersimpan.`, 'success');
    } catch {
      toast.showToast('Gagal menyimpan modal awal laci.', 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseShift = async () => {
    if (!storeId) return;
    try {
      setSaving(true);
      const saved = await createShiftClosing({
        store_id: storeId,
        cashier_name: cashierName,
        opened_at: todayRegister?.created_at || new Date().toISOString(),
        opening_cash: metrics.openingCash,
        expected_cash: metrics.expectedCash,
        actual_cash: actualCash,
        variance,
        total_sales: metrics.totalSales,
        total_non_cash: metrics.nonCashSales,
        cash_in: metrics.cashIn,
        cash_out: metrics.cashOut,
        transactions_count: metrics.txCount,
        notes: shiftNotes.trim() || null,
      });
      setShiftHistory((prev) => [saved, ...prev]);
      setShiftNotes('');
      toast.showToast('Rekap Tutup Shift Kasir berhasil disimpan ke Cloud.', 'success');
      setTab('history');
    } catch {
      toast.showToast('Gagal menyimpan rekap shift kasir.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCashIo = async () => {
    const amount = parseInt(ioAmount, 10) || 0;
    if (amount <= 0) {
      toast.showToast('Masukkan nominal kas masuk/keluar yang valid.', 'warning');
      return;
    }
    try {
      setSaving(true);
      await saveCashFlow({
        date: new Date().toISOString(),
        type: ioType,
        amount,
        description: ioDesc.trim() || (ioType === 'in' ? 'Kas Masuk Laci POS' : 'Kas Keluar Laci POS'),
      });
      setIoAmount('');
      setIoDesc('');
      toast.showToast(
        `${ioType === 'in' ? 'Kas Masuk' : 'Kas Keluar'} ${fRp(amount)} tercatat di laci kasir.`,
        'success',
      );
      setTab('shift');
    } catch {
      toast.showToast('Gagal mencatat mutasi kas laci.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="kaffe-modal-overlay fixed inset-0 z-[75] flex items-end justify-center bg-stone-900/60 backdrop-blur-sm md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-shift-modal-title"
        className="kaffe-panel kaffe-modal-panel flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6A00]">
              <Wallet size={20} />
            </span>
            <div>
              <h3 id="pos-shift-modal-title" className="font-display text-xl font-black tracking-tight text-stone-900">
                Shift Kasir & Laci Uang
              </h3>
              <p className="text-xs font-semibold text-stone-400">
                Kasir Aktif: {cashierName} • Rekap Kas Sistem vs Fisik Aktual
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal shift kasir"
            className="rounded-2xl border border-stone-100 bg-stone-50 p-2.5 text-stone-400 transition-colors hover:bg-orange-50 hover:text-[#FF6A00]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-2 border-b border-stone-100 bg-stone-50/70 px-6 py-3">
          {[
            { id: 'shift', label: 'Buka / Tutup Shift' },
            { id: 'cash_io', label: 'Kas Masuk / Keluar' },
            { id: 'history', label: `Riwayat Shift (${shiftHistory.length})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as 'shift' | 'cash_io' | 'history')}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                tab === item.id
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-white text-stone-500 border border-stone-200 hover:text-stone-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'shift' && (
            <>
              {/* Modal Awal Buka Shift */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="shift-opening-cash" className="block text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1.5">
                      Modal Awal Laci Kasir (Buka Shift)
                    </label>
                    <input
                      id="shift-opening-cash"
                      type="number"
                      value={openingCashInput}
                      onChange={(e) => setOpeningCashInput(e.target.value)}
                      placeholder="Contoh: 200000"
                      className="h-11 w-full rounded-xl border border-stone-200 bg-white px-4 font-mono text-base font-black text-stone-900 focus:border-[#FF6A00] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveOpeningCash()}
                    disabled={saving}
                    className="h-11 rounded-xl bg-stone-900 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    {todayRegister ? 'Update Modal' : 'Buka Shift'}
                  </button>
                </div>
              </div>

              {/* Ringkasan Kas Sistem */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-stone-100 bg-white p-3.5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Penjualan Tunai</p>
                  <p className="mt-1 font-mono text-sm font-black text-emerald-600">{fRp(metrics.cashSales)}</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-3.5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">QRIS & Transfer</p>
                  <p className="mt-1 font-mono text-sm font-black text-sky-600">{fRp(metrics.nonCashSales)}</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-3.5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Kas Masuk Laci</p>
                  <p className="mt-1 font-mono text-sm font-black text-emerald-700">+{fRp(metrics.cashIn)}</p>
                </div>
                <div className="rounded-2xl border border-stone-100 bg-white p-3.5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Kas Keluar / Biaya</p>
                  <p className="mt-1 font-mono text-sm font-black text-rose-600">-{fRp(metrics.cashOut)}</p>
                </div>
              </div>

              {/* Rekonsiliasi Kas Aktual vs Sistem */}
              <div className="rounded-2xl border-2 border-stone-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-stone-400">Saldo Tunai Sistem (Expected)</p>
                    <p className="text-[11px] font-medium text-stone-400">Modal Awal + Tunai + Kas Masuk - Kas Keluar</p>
                  </div>
                  <p className="font-mono text-2xl font-black text-stone-900">{fRp(metrics.expectedCash)}</p>
                </div>

                <div>
                  <label htmlFor="shift-actual-cash" className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-2">
                    Hitung Uang Fisik Aktual di Laci (Rp)
                  </label>
                  <input
                    id="shift-actual-cash"
                    type="number"
                    value={actualCashInput}
                    onChange={(e) => setActualCashInput(e.target.value)}
                    placeholder={String(metrics.expectedCash)}
                    className="h-12 w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-4 font-mono text-xl font-black text-stone-900 focus:border-[#FF6A00] focus:bg-white focus:outline-none"
                  />
                </div>

                <div
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                    variance === 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : variance > 0
                        ? 'border-sky-200 bg-sky-50 text-sky-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  <span className="text-xs font-black uppercase tracking-wider">
                    Selisih Kas (Variance)
                  </span>
                  <span className="font-mono text-base font-black">
                    {variance === 0
                      ? 'PAS / KLOP (Rp 0)'
                      : `${variance > 0 ? '+' : ''}${fRp(variance)}`}
                  </span>
                </div>

                <div>
                  <label htmlFor="shift-closing-notes" className="block text-[11px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
                    Catatan Tutup Shift (Opsional)
                  </label>
                  <input
                    id="shift-closing-notes"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="Contoh: Shift Pagi selesai, uang pecahan lengkap"
                    className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-xs font-bold text-stone-700 focus:border-[#FF6A00] focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleCloseShift()}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6A00] py-4 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-[#E05A00] disabled:opacity-50"
                >
                  <CheckCircle2 size={18} /> Simpan Rekap & Tutup Shift Kasir
                </button>
              </div>
            </>
          )}

          {tab === 'cash_io' && (
            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs font-bold text-stone-500">
                Catat uang tunai yang masuk atau keluar dari laci kasir di luar transaksi penjualan (contoh: tambah uang kembalian atau beli es batu darurat).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIoType('out')}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs font-black uppercase ${
                    ioType === 'out'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-stone-200 bg-white text-stone-500'
                  }`}
                >
                  <ArrowUpCircle size={16} /> Kas Keluar Laci
                </button>
                <button
                  type="button"
                  onClick={() => setIoType('in')}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs font-black uppercase ${
                    ioType === 'in'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-stone-200 bg-white text-stone-500'
                  }`}
                >
                  <ArrowDownCircle size={16} /> Kas Masuk Laci
                </button>
              </div>

              <div>
                <label htmlFor="cash-io-amount" className="block text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1.5">
                  Nominal (Rp)
                </label>
                <input
                  id="cash-io-amount"
                  type="number"
                  value={ioAmount}
                  onChange={(e) => setIoAmount(e.target.value)}
                  placeholder="Contoh: 25000"
                  className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 font-mono text-lg font-black text-stone-900 focus:border-[#FF6A00] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cash-io-desc" className="block text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1.5">
                  Keterangan
                </label>
                <input
                  id="cash-io-desc"
                  value={ioDesc}
                  onChange={(e) => setIoDesc(e.target.value)}
                  placeholder={ioType === 'out' ? 'Contoh: Beli es batu kristal 2 pack' : 'Contoh: Tambah uang receh kembalian'}
                  className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-xs font-bold text-stone-700 focus:border-[#FF6A00] focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSaveCashIo()}
                disabled={saving}
                className="w-full rounded-2xl bg-stone-900 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-stone-800 disabled:opacity-50"
              >
                Simpan Mutasi Laci Kasir
              </button>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {shiftHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center">
                  <History size={28} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-sm font-black text-stone-700">Belum Ada Riwayat Tutup Shift</p>
                  <p className="mt-1 text-xs font-medium text-stone-400">
                    Rekap tutup shift yang disimpan kasir akan tercatat di sini beserta selisih kasnya.
                  </p>
                </div>
              ) : (
                shiftHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display text-sm font-black text-stone-900">
                          Shift {item.cashier_name} ({item.transactions_count} Transaksi)
                        </p>
                        <p className="text-[11px] font-semibold text-stone-400">
                          Ditutup: {new Date(item.closed_at).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-xs font-black ${
                          item.variance === 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.variance > 0
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {item.variance === 0
                          ? 'Selisih Rp 0 (Klop)'
                          : `Selisih ${item.variance > 0 ? '+' : ''}${fRp(item.variance)}`}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-100 pt-2.5 text-xs">
                      <div>
                        <span className="text-stone-400 font-bold">Sistem: </span>
                        <span className="font-mono font-black text-stone-700">{fRp(item.expected_cash)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 font-bold">Aktual: </span>
                        <span className="font-mono font-black text-stone-900">{fRp(item.actual_cash)}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 font-bold">Total Omzet: </span>
                        <span className="font-mono font-black text-[#FF6A00]">{fRp(item.total_sales)}</span>
                      </div>
                    </div>
                    {item.notes && (
                      <p className="mt-2 text-[11px] font-semibold text-stone-500">Catatan: {item.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
