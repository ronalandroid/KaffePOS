import { useState, useMemo } from 'react';
import { X, Users, ArrowRightLeft, Merge, Trash2, Receipt, Utensils, Plus, Check } from 'lucide-react';
import type { OpenBill } from '@/types';
import { DEFAULT_FLOOR_TABLES, ORDER_TYPE_META, fRp } from './posHelpers';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedTable: string;
  selectedPax: number;
  onSelectTableAndPax: (tableNumber: string, pax: number) => void;
  openBills: OpenBill[];
  activeOpenBillId: string | null;
  onRecallOpenBill: (bill: OpenBill) => void;
  onMoveTable: (billId: string, newTableNumber: string) => Promise<void>;
  onMergeBills: (sourceBillId: string, targetBillId: string) => Promise<void>;
  onCancelOpenBill: (billId: string) => Promise<void>;
};

export default function PosTableAndBillModal({
  open,
  onClose,
  selectedTable,
  selectedPax,
  onSelectTableAndPax,
  openBills,
  activeOpenBillId,
  onRecallOpenBill,
  onMoveTable,
  onMergeBills,
  onCancelOpenBill,
}: Props) {
  const [activeTab, setActiveTab] = useState<'floor' | 'bills'>('floor');
  const [zoneFilter, setZoneFilter] = useState<string>('Semua');
  const [paxInput, setPaxInput] = useState<number>(selectedPax || 2);
  const [movingBillId, setMovingBillId] = useState<string | null>(null);
  const [mergingSourceBillId, setMergingSourceBillId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const billByTable = useMemo(() => {
    const map = new Map<string, OpenBill>();
    for (const bill of openBills) {
      if (bill.status === 'open' && bill.table_number) {
        map.set(bill.table_number, bill);
      }
    }
    return map;
  }, [openBills]);

  const filteredTables = useMemo(
    () =>
      DEFAULT_FLOOR_TABLES.filter(
        (t) => zoneFilter === 'Semua' || t.zone === zoneFilter,
      ),
    [zoneFilter],
  );

  if (!open) return null;

  const occupiedCount = billByTable.size;
  const availableCount = DEFAULT_FLOOR_TABLES.length - occupiedCount;

  const handleTableClick = async (tableId: string) => {
    const occupiedBill = billByTable.get(tableId);

    // Mode Pindah Meja: pindahkan bill yang dipilih ke meja kosong ini
    if (movingBillId) {
      if (occupiedBill && occupiedBill.id !== movingBillId) {
        return;
      }
      try {
        setBusyId(movingBillId);
        await onMoveTable(movingBillId, tableId);
        setMovingBillId(null);
      } finally {
        setBusyId(null);
      }
      return;
    }

    // Mode Gabung Meja: gabungkan bill asal ke bill meja tujuan
    if (mergingSourceBillId && occupiedBill && occupiedBill.id !== mergingSourceBillId) {
      try {
        setBusyId(occupiedBill.id);
        await onMergeBills(mergingSourceBillId, occupiedBill.id);
        setMergingSourceBillId(null);
      } finally {
        setBusyId(null);
      }
      return;
    }

    // Jika meja sudah ada Open Bill, panggil ke kasir
    if (occupiedBill) {
      onRecallOpenBill(occupiedBill);
      onClose();
      return;
    }

    // Jika meja kosong, pilih meja untuk pesanan saat ini
    onSelectTableAndPax(tableId, paxInput);
    onClose();
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
        aria-labelledby="pos-table-modal-title"
        className="kaffe-panel kaffe-modal-panel flex max-h-[90vh] w-full max-w-[780px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-orange-50 text-[#FF6A00]">
                <Utensils size={16} />
              </span>
              <h3 id="pos-table-modal-title" className="font-display text-xl font-black tracking-tight text-stone-900">
                Manajemen Meja & Open Bill
              </h3>
            </div>
            <p className="mt-1 text-xs font-semibold text-stone-400">
              Pilih meja kosong, panggil tagihan tersimpan (Open Bill), pindah meja, atau gabung tagihan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup manajemen meja"
            className="rounded-2xl border border-stone-100 bg-stone-50 p-2.5 text-stone-400 transition-colors hover:bg-orange-50 hover:text-[#FF6A00]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top switcher & Pax control */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-6 py-3.5">
          <div className="flex items-center gap-2 rounded-2xl bg-stone-200/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('floor')}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'floor'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Denah Meja ({availableCount} Kosong • {occupiedCount} Terisi)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bills')}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'bills'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Daftar Open Bill ({openBills.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold text-stone-500">
              <Users size={14} className="text-stone-400" /> Jumlah Tamu (Pax):
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPaxInput(n)}
                  className={`size-8 rounded-xl text-xs font-black tabular-nums transition-colors ${
                    paxInput === n
                      ? 'bg-[#FF6A00] text-white shadow-sm'
                      : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active action banner for Move / Merge */}
        {(movingBillId || mergingSourceBillId) && (
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-6 py-3 text-xs font-bold text-amber-800">
            <span>
              {movingBillId
                ? 'Mode Pindah Meja aktif: Ketuk meja KOSONG tujuan pada denah di bawah.'
                : 'Mode Gabung Meja aktif: Ketuk meja TERISI tujuan untuk menggabungkan seluruh item tagihan.'}
            </span>
            <button
              type="button"
              onClick={() => {
                setMovingBillId(null);
                setMergingSourceBillId(null);
              }}
              className="rounded-lg bg-amber-200/70 px-3 py-1 text-[11px] font-black uppercase text-amber-900 hover:bg-amber-300"
            >
              Batal
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'floor' ? (
            <div>
              {/* Zone filter */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {['Semua', 'Indoor', 'Outdoor', 'VIP & Bar'].map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setZoneFilter(zone)}
                      className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${
                        zoneFilter === zone
                          ? 'bg-stone-900 text-white'
                          : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {zone}
                    </button>
                  ))}
                </div>
                {selectedTable && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTableAndPax('', paxInput);
                      onClose();
                    }}
                    className="text-xs font-bold text-stone-400 hover:text-rose-500"
                  >
                    Lepas Pilihan Meja ({selectedTable})
                  </button>
                )}
              </div>

              {/* Floor plan grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {filteredTables.map((t) => {
                  const bill = billByTable.get(t.id);
                  const isSelected = selectedTable === t.id;
                  const isActiveBill = bill && bill.id === activeOpenBillId;

                  return (
                    <div
                      key={t.id}
                      className={`flex flex-col justify-between rounded-2xl border-2 p-4 transition-colors ${
                        bill
                          ? isActiveBill
                            ? 'border-[#FF6A00] bg-orange-50/90'
                            : 'border-amber-300 bg-amber-50/60'
                          : isSelected
                            ? 'border-[#FF6A00] bg-orange-50/40'
                            : 'border-stone-200/80 bg-white hover:border-emerald-400 hover:bg-emerald-50/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void handleTableClick(t.id)}
                        disabled={Boolean(busyId)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-base font-black text-stone-900">{t.label}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              bill
                                ? 'bg-[#FF6A00] text-white'
                                : isSelected
                                  ? 'bg-orange-100 text-[#FF6A00]'
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {bill ? 'Terisi' : isSelected ? 'Dipilih' : 'Kosong'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-stone-400">
                          {t.zone} • Kapasitas {t.capacity} kursi
                        </p>

                        {bill ? (
                          <div className="mt-3 rounded-xl bg-white/90 p-2.5 border border-amber-200/70">
                            <p className="truncate text-xs font-black text-stone-800">
                              {bill.customer_name || 'Tamu Dine-In'} ({bill.pax} Pax)
                            </p>
                            <p className="mt-0.5 font-mono text-xs font-black text-[#FF6A00]">
                              {fRp(bill.total)}
                            </p>
                            <p className="mt-0.5 text-[10px] font-bold text-stone-400">
                              {bill.items.reduce((s, i) => s + i.qty, 0)} menu • Ketuk untuk buka
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            {isSelected ? <Check size={14} /> : <Plus size={14} />}
                            <span>{isSelected ? `Aktif (${selectedPax} Pax)` : 'Pilih Meja Ini'}</span>
                          </div>
                        )}
                      </button>

                      {/* Quick table actions when occupied */}
                      {bill && (
                        <div className="mt-2.5 flex items-center gap-1.5 border-t border-amber-200/60 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMovingBillId(bill.id);
                              setMergingSourceBillId(null);
                            }}
                            title="Pindah ke meja kosong lain"
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-black uppercase text-stone-600 border border-stone-200 hover:border-[#FF6A00] hover:text-[#FF6A00]"
                          >
                            <ArrowRightLeft size={11} /> Pindah
                          </button>
                          {occupiedCount > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setMergingSourceBillId(bill.id);
                                setMovingBillId(null);
                              }}
                              title="Gabung tagihan ke meja terisi lain"
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-black uppercase text-stone-600 border border-stone-200 hover:border-[#FF6A00] hover:text-[#FF6A00]"
                            >
                              <Merge size={11} /> Gabung
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Open Bills List */
            <div className="space-y-3">
              {openBills.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center">
                  <Receipt size={32} className="mx-auto mb-3 text-stone-300" />
                  <p className="font-display text-base font-black text-stone-700">Belum Ada Open Bill Aktif</p>
                  <p className="mt-1 text-xs font-medium text-stone-400">
                    Masukkan pesanan ke keranjang lalu tekan tombol &ldquo;Simpan Bill&rdquo; untuk menyimpan tagihan meja yang belum dibayar.
                  </p>
                </div>
              ) : (
                openBills.map((bill) => {
                  const orderMeta = ORDER_TYPE_META[bill.order_type] || ORDER_TYPE_META.dine_in;
                  return (
                    <div
                      key={bill.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${orderMeta.badgeClass}`}>
                            {orderMeta.shortLabel}
                          </span>
                          {bill.table_number && (
                            <span className="rounded-full bg-stone-900 px-2.5 py-0.5 text-[10px] font-black uppercase text-white">
                              Meja {bill.table_number}
                            </span>
                          )}
                          <span className="text-xs font-bold text-stone-400">• {bill.pax} Pax</span>
                        </div>
                        <p className="mt-1.5 truncate font-display text-base font-black text-stone-900">
                          {bill.customer_name || (bill.table_number ? `Tamu Meja ${bill.table_number}` : 'Open Bill Pelanggan')}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-stone-500">
                          {bill.items.map((it) => `${it.qty}x ${it.name}`).join(', ')}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Total Tagihan</p>
                          <p className="font-mono text-lg font-black text-[#FF6A00]">{fRp(bill.total)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onRecallOpenBill(bill);
                            onClose();
                          }}
                          className="rounded-xl bg-[#FF6A00] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-[#E05A00]"
                        >
                          Buka / Bayar
                        </button>
                        <button
                          type="button"
                          onClick={() => void onCancelOpenBill(bill.id)}
                          aria-label={`Batalkan open bill ${bill.customer_name || bill.table_number || ''}`}
                          className="rounded-xl border border-stone-200 p-2.5 text-stone-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
