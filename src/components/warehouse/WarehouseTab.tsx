 
 
 
 
 
import { memo, useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Archive, X, AlertTriangle, Search, RefreshCw, ChefHat, Calculator, Upload, CheckCircle2, FileSpreadsheet, Truck } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { createPurchaseOrder, getPurchaseOrders, receivePurchaseOrder } from '@/lib/backendApi';
import DeleteConfirmSheet from '@/components/ui/DeleteConfirmSheet';
import { InventoryRow } from '@/components/warehouse/InventoryRow';
import type { BulkImportMode } from '@/lib/stockEngine';
import {
  buildBulkImportPreview,
  calculateGrossMargin,
  calculateProductHpp,
  parseStockImportCsv,
  type BulkImportRow,
} from '@/lib/stockEngine';
import { getRecipeSaveErrorMessage, normalizeUserFacingError } from '@/lib/errorMessages';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { InventoryItem, InventoryItemUpdate, MenuItem, PurchaseOrder } from '@/types';

const fRp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);
const WarehouseSkeleton = memo(function WarehouseSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-[24px] bg-slate-100 animate-pulse" />)}</div>;
});

interface WarehouseForm {
  id: string;
  name: string;
  qty: string;
  cost: string;
  unit: string;
  minStock: string;
  type: 'new' | 'edit' | 'restock';
}

const WAREHOUSE_SECTION_ITEMS = [
  { id: 'summary', label: 'Ringkasan Stok', icon: Archive },
  { id: 'ingredients', label: 'Bahan Baku', icon: Plus },
  { id: 'po', label: 'Purchase Order (PO)', icon: Truck },
  { id: 'conversions', label: 'Konversi Satuan', icon: RefreshCw },
  { id: 'recipes', label: 'Resep / Porsi', icon: ChefHat },
  { id: 'hpp', label: 'HPP & Margin', icon: Calculator },
  { id: 'import', label: 'Impor Bulk', icon: Upload },
] as const;

import type { ToastType } from '@/types';
type ToastApi = { showToast: (message: string, type?: ToastType) => void };

export default function WarehouseTab({ toast }: { toast: ToastApi }) {
  const {
    storeId,
    inventory,
    menu,
    unitConversions,
    saveInventoryItem,
    adjustInventoryStock,
    deleteInventoryItem,
    saveStockUnitConversion,
    deleteStockUnitConversion,
    saveMenuItem,
    commitStockBulkImportRows,
    loadAll,
  } = useStore();
  const [section, setSection] = useState<'summary'|'ingredients'|'po'|'conversions'|'recipes'|'hpp'|'import'>('summary');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poSupplier, setPoSupplier] = useState('');
  const [poIngredientId, setPoIngredientId] = useState('');
  const [poQty, setPoQty] = useState('');
  const [poTotalCost, setPoTotalCost] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poSaving, setPoSaving] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    void getPurchaseOrders(storeId).then((res) => setPurchaseOrders(res.items));
  }, [storeId]);
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState<WarehouseForm>({ id:'', name:'', qty:'', cost:'', unit:'gr', minStock:'5', type:'new' });
  const [search,       setSearch]       = useState('');
  const [saving,       setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{id:string;name:string}|null>(null);
  const [conversionForm, setConversionForm] = useState({ ingredient_id: '', from_unit: '', to_unit: 'pcs', ratio: '1' });
  const [recipeForm, setRecipeForm] = useState({ product_id: '', ingredient_id: '', qty: '', unit_reference: '' });
  const [recipeError, setRecipeError] = useState('');
  const [importMode, setImportMode] = useState<BulkImportMode>('create_only');
  const [importText, setImportText] = useState('');
  const [importRows, setImportRows] = useState<BulkImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [opnameTarget, setOpnameTarget] = useState<InventoryItem | null>(null);
  const [opnameForm, setOpnameForm] = useState({ countedStock: '', reason: 'Opname stok fisik', note: '' });
  const [opnameSaving, setOpnameSaving] = useState(false);
  const saveInFlight = useRef(false);
  const conversionInFlight = useRef(false);
  const dSearch = useDebouncedValue(search, 300);

  const filtered = useMemo(() =>
    inventory.filter(i => !dSearch || i.name.toLowerCase().includes(dSearch.toLowerCase()))
  , [inventory, dSearch]);

  const lowStock = inventory.filter(i => i.stock <= i.min_stock);
  const activeInventory = inventory.filter(i => i.is_active !== false);
  const inventoryValue = inventory.reduce((sum, item) => sum + item.stock * item.cost_per_unit, 0);
  const hppRows = useMemo(
    () => menu.map((product) => {
      const hpp = calculateProductHpp(product, inventory, unitConversions);
      const margin = calculateGrossMargin(product.price, hpp.totalCost);
      return { product, hpp, margin };
    }),
    [inventory, menu, unitConversions],
  );
  const importPreview = useMemo(
    () => buildBulkImportPreview(importRows, { inventory, menu, conversions: unitConversions, mode: importMode }),
    [importMode, importRows, inventory, menu, unitConversions],
  );
  // Which menus use each inventory item
  const usedInMenu = useMemo(() => {
    const map: Record<string, string[]> = {};
    menu.forEach((m: MenuItem) => {
      (m.recipe||[]).forEach(r => {
        if (!map[r.matId]) map[r.matId] = [];
        if (!map[r.matId].includes(m.name)) map[r.matId].push(m.name);
      });
    });
    return map;
  }, [menu]);

  const openNew     = () => { setForm({ id:'', name:'', qty:'', cost:'', unit:'gr', minStock:'5', type:'new' }); setShowModal(true); };
  const openRestock = (item: InventoryItem) => { setForm({ id:item.id, name:item.name, qty:'', cost:'', unit:item.unit, minStock:String(item.min_stock||5), type:'restock' }); setShowModal(true); };
  const openEdit    = (item: InventoryItem) => { setForm({ id:item.id, name:item.name, qty:String(item.stock), cost:String(Math.round(item.cost_per_unit * item.stock)), unit:item.unit, minStock:String(item.min_stock||5), type:'edit' }); setShowModal(true); };
  const openOpname = (item: InventoryItem) => {
    setOpnameTarget(item);
    setOpnameForm({ countedStock: String(item.stock), reason: 'Opname stok fisik', note: '' });
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveInFlight.current) return;
    if (!form.name || !form.qty) { toast.showToast('Nama dan jumlah wajib diisi', 'warning'); return; }
    const qty = Number(form.qty);
    const cost = Number(form.cost || 0);
    const minStock = Number(form.minStock || 0);
    if (qty < 0 || cost < 0 || minStock < 0) {
      toast.showToast('Qty, biaya, dan stok minimum tidak boleh negatif', 'warning');
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    try {
      await saveInventoryItem(form as unknown as InventoryItemUpdate);
      setShowModal(false);
      const msg = form.type==='new' ? 'Bahan ditambahkan!' : form.type==='edit' ? 'Bahan diperbarui!' : 'Stok diperbarui!';
      toast.showToast(msg, 'success');
    } catch (e: unknown) {
      toast.showToast(normalizeUserFacingError(e, 'Bahan baku belum bisa disimpan. Periksa kembali isian stok.'), 'error');
    } finally {
      setSaving(false);
      saveInFlight.current = false;
    }
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opnameTarget) return;
    const countedStock = Number(opnameForm.countedStock);
    if (!Number.isFinite(countedStock) || countedStock < 0) {
      toast.showToast('Jumlah stok hasil opname tidak boleh negatif.', 'warning');
      return;
    }
    if (!opnameForm.reason.trim()) {
      toast.showToast('Alasan opname wajib diisi.', 'warning');
      return;
    }

    setOpnameSaving(true);
    try {
      await adjustInventoryStock({
        inventoryId: opnameTarget.id,
        countedStock,
        reason: opnameForm.reason.trim(),
        note: opnameForm.note.trim() || null,
      });
      setOpnameTarget(null);
      toast.showToast('Opname stok disimpan', 'success');
    } catch (error: unknown) {
      toast.showToast(normalizeUserFacingError(error, 'Opname stok belum bisa disimpan. Periksa stok fisik lalu coba lagi.'), 'error');
    } finally {
      setOpnameSaving(false);
    }
  };

  const handleSaveConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conversionInFlight.current) return;
    const ratio = Number(conversionForm.ratio || 0);
    if (!conversionForm.from_unit || !conversionForm.to_unit || ratio <= 0) {
      toast.showToast('Satuan asal, tujuan, dan rasio wajib valid', 'warning');
      return;
    }
    conversionInFlight.current = true;
    try {
      await saveStockUnitConversion({
        ingredient_id: conversionForm.ingredient_id || null,
        from_unit: conversionForm.from_unit,
        to_unit: conversionForm.to_unit,
        ratio,
        is_active: true,
      });
      setConversionForm({ ingredient_id: '', from_unit: '', to_unit: 'pcs', ratio: '1' });
      toast.showToast('Konversi satuan disimpan', 'success');
    } catch (error: unknown) {
      toast.showToast(normalizeUserFacingError(error, 'Konversi satuan belum bisa disimpan. Periksa satuan dan rasio.'), 'error');
    } finally {
      conversionInFlight.current = false;
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = menu.find((item) => item.id === recipeForm.product_id);
    const ingredient = inventory.find((item) => item.id === recipeForm.ingredient_id);
    const qty = Number(recipeForm.qty || 0);
    setRecipeError('');
    if (!product) {
      const message = 'Pilih produk yang akan diberi resep.';
      setRecipeError(message);
      toast.showToast(message, 'warning');
      return;
    }
    if (!ingredient) {
      const message = 'Pilih bahan baku untuk resep.';
      setRecipeError(message);
      toast.showToast(message, 'warning');
      return;
    }
    if (qty <= 0) {
      const message = 'Jumlah bahan per porsi harus lebih dari 0.';
      setRecipeError(message);
      toast.showToast(message, 'warning');
      return;
    }

    const nextRecipe = [
      ...(product.recipe || []).filter((line) => line.matId !== ingredient.id),
      { matId: ingredient.id, qty, unit_reference: recipeForm.unit_reference || ingredient.base_unit || ingredient.unit },
    ];

    try {
      await saveMenuItem({ ...product, recipe: nextRecipe });
      setRecipeForm({ product_id: product.id, ingredient_id: '', qty: '', unit_reference: '' });
      toast.showToast('Resep produk diperbarui', 'success');
    } catch (error: unknown) {
      const message = getRecipeSaveErrorMessage(error);
      setRecipeError(message);
      toast.showToast(message, 'error');
    }
  };

  const handleImportText = (value: string) => {
    setImportText(value);
    const parsed = parseStockImportCsv(value);
    setImportRows(parsed.rows);
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    handleImportText(text);
  };

  const handleCommitImport = async () => {
    if (importPreview.errors.length > 0 || importPreview.validRows.length === 0) {
      toast.showToast('Perbaiki baris error sebelum import', 'warning');
      return;
    }

    setImporting(true);
    try {
      const result = await commitStockBulkImportRows(importMode, importPreview.validRows);
      setImportText('');
      setImportRows([]);
      toast.showToast(`Import stok selesai: ${result.committed.ingredients} bahan, ${result.committed.products} produk, ${result.committed.recipes} resep`, 'success');
    } catch (error: unknown) {
      toast.showToast(normalizeUserFacingError(error, 'Import stok gagal diproses. Periksa data lalu coba lagi.'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    const ing = inventory.find((i) => i.id === poIngredientId);
    const qtyNum = Number(poQty);
    const totalCostNum = Number(poTotalCost);
    if (!poSupplier.trim() || !ing || qtyNum <= 0 || totalCostNum < 0) {
      toast.showToast('Isi nama supplier, bahan baku, dan jumlah pesanan PO.', 'warning');
      return;
    }
    try {
      setPoSaving(true);
      const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(purchaseOrders.length + 1).padStart(3, '0')}`;
      const unitCost = Math.round(totalCostNum / qtyNum);
      const created = await createPurchaseOrder({
        store_id: storeId,
        po_number: poNumber,
        supplier_name: poSupplier.trim(),
        status: 'ordered',
        items: [
          {
            inventory_id: ing.id,
            name: ing.name,
            qty: qtyNum,
            unit: ing.unit,
            cost_per_unit: unitCost,
          },
        ],
        total_amount: totalCostNum,
        notes: poNotes.trim() || null,
      });
      setPurchaseOrders((prev) => [created, ...prev]);
      setPoSupplier('');
      setPoIngredientId('');
      setPoQty('');
      setPoTotalCost('');
      setPoNotes('');
      toast.showToast(`Purchase Order ${poNumber} berhasil dibuat.`, 'success');
    } catch (error) {
      toast.showToast(normalizeUserFacingError(error, 'Gagal membuat Purchase Order.'), 'error');
    } finally {
      setPoSaving(false);
    }
  };

  const handleReceivePo = async (po: PurchaseOrder) => {
    if (!storeId) return;
    try {
      setPoSaving(true);
      const updated = await receivePurchaseOrder(po.id, storeId);
      setPurchaseOrders((prev) => prev.map((item) => (item.id === po.id ? updated : item)));
      for (const line of po.items) {
        const ing = inventory.find((i) => i.id === line.inventory_id);
        if (ing) {
          await saveInventoryItem({
            type: 'restock',
            id: ing.id,
            name: ing.name,
            qty: line.qty,
            cost: line.qty * line.cost_per_unit,
            unit: ing.unit,
          }).catch(() => {});
        }
      }
      await loadAll(storeId).catch(() => {});
      toast.showToast(`Barang PO ${po.po_number} diterima & stok gudang otomatis bertambah.`, 'success');
    } catch (error) {
      toast.showToast(normalizeUserFacingError(error, 'Gagal menerima barang PO.'), 'error');
    } finally {
      setPoSaving(false);
    }
  };

  return (
    <div className="kaffe-app-bg kaffe-responsive-surface flex-1 flex flex-col overflow-hidden">
      <div className="z-10 border-b border-[var(--brand-panel-border)] bg-white px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Stok</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              Bahan baku, konversi, resep, dan HPP. Restock dicatat sebagai pembelian dan tidak mengurangi saldo kasir.
            </p>
          </div>
          <div className={`shrink-0 gap-2 ${section === 'ingredients' || section === 'summary' ? 'flex' : 'hidden md:flex'}`}>
            <button type="button" onClick={openNew} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--brand-panel-border)] bg-white px-4 text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]">
              <Plus size={16} className="text-[var(--brand-orange-text)]"/>Bahan Baru
            </button>
            <button type="button" onClick={()=>{setForm({id:'',name:'',qty:'',cost:'',unit:'gr',minStock:'5',type:'restock'});setShowModal(true);}}
              className="kaffe-gradient-cta inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold sm:flex-none">
              <Archive size={16}/>Restock
            </button>
          </div>
        </div>

        <nav aria-label="Bagian stok" className="kaffe-scroll-tabs -mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {WAREHOUSE_SECTION_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button type="button"
                key={id}
                onClick={() => setSection(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3 text-[13px] transition-colors ${
                  active
                    ? 'font-bold text-[var(--brand-orange-text)] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[#FF6A00]'
                    : 'font-semibold text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={15} />{label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-5 lg:p-8 lg:pb-8">
        {lowStock.length > 0 && section === 'summary' && (
          <div className="mb-4 flex items-start gap-3 rounded-[20px] border border-rose-200 bg-rose-50 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600"/>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-rose-800">{lowStock.length} bahan stok kritis</p>
              <p className="mt-0.5 text-[13px] font-medium text-rose-700">{lowStock.map(i=>i.name).join(', ')}</p>
            </div>
          </div>
        )}
        {section === 'ingredients' && <div className="relative mb-4 md:max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Cari bahan baku..."
            aria-label="Cari bahan baku"
            className="h-11 w-full rounded-xl border border-[var(--brand-panel-border)] bg-white pl-11 pr-4 font-medium text-slate-800 placeholder:text-slate-500 transition-colors focus:border-[#FF6A00]/60 focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/15"
          />
        </div>}
        {section === 'summary' && (
          <div className="space-y-5">
            <div className="kaffe-card-grid grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="kaffe-metric-card p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-slate-600">Bahan Aktif</p>
                <p className="mt-2 font-display text-[26px] font-extrabold leading-tight text-slate-900 kaffe-num">{activeInventory.length}</p>
              </div>
              <div className="kaffe-metric-card p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-slate-600">Stok Kritis</p>
                <p className={`mt-2 font-display text-[26px] font-extrabold leading-tight kaffe-num ${lowStock.length ? 'text-rose-700' : 'text-emerald-700'}`}>{lowStock.length}</p>
              </div>
              <div className="kaffe-metric-card p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-slate-600">Nilai Stok</p>
                <p className="mt-2 truncate font-display text-[22px] font-extrabold leading-tight text-slate-900 kaffe-num sm:text-[26px]">{fRp(inventoryValue)}</p>
              </div>
              <div className="kaffe-metric-card p-4 sm:p-5">
                <p className="text-[12.5px] font-semibold text-slate-600">Resep Aktif</p>
                <p className="mt-2 font-display text-[26px] font-extrabold leading-tight text-slate-900 kaffe-num">{menu.filter(item => item.recipe?.length).length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="kaffe-card p-5">
                <p className="font-display text-[15px] font-extrabold text-slate-900 mb-3">Bahan Perlu Restock</p>
                {lowStock.length === 0 ? (
                  <p className="text-[13px] font-medium text-slate-500">Semua bahan utama aman.</p>
                ) : lowStock.slice(0, 6).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-[var(--brand-hairline)] last:border-0">
                    <span className="text-[13.5px] font-semibold text-slate-800">{item.name}</span>
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[12px] font-bold text-rose-700 kaffe-num">{item.stock} {item.unit}</span>
                  </div>
                ))}
              </div>
              <div className="kaffe-card p-5">
                <p className="font-display text-[15px] font-extrabold text-slate-900 mb-3">HPP Belum Lengkap</p>
                {hppRows.filter(row => !row.hpp.complete).length === 0 ? (
                  <p className="text-[13px] font-medium text-slate-500">Semua resep yang aktif punya HPP valid.</p>
                ) : hppRows.filter(row => !row.hpp.complete).slice(0, 6).map(row => (
                  <div key={row.product.id} className="flex items-center justify-between py-2 border-b border-[var(--brand-hairline)] last:border-0">
                    <span className="text-[13.5px] font-semibold text-slate-800">{row.product.name}</span>
                    <span className="text-[12px] font-bold text-amber-700">{row.hpp.warnings.length} catatan</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === 'ingredients' && (search !== dSearch ? <WarehouseSkeleton /> : filtered.length === 0 ? (
          <div className="kaffe-empty-state flex flex-col items-center justify-center rounded-[20px] px-6">
             <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-canvas)] text-stone-300"><Archive size={28} /></div>
             <p className="font-display text-base font-extrabold text-slate-800">Belum ada bahan baku</p>
             <p className="mt-1 max-w-xs text-center text-[13px] font-medium text-slate-500">
               Tambahkan bahan pertama agar stok dan resep menu bisa terpantau.
             </p>
          </div>
        ) : (
            <div className="kaffe-card-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
            {filtered.map(item => {
          const inMenus = usedInMenu[item.id] || [];
          return (
            <InventoryRow
              key={item.id}
              item={item}
              usedInMenus={inMenus}
              onEdit={openEdit}
              onRestock={openRestock}
              onOpname={openOpname}
              onDelete={(item) => setDeleteTarget({id: item.id, name: item.name})}
            />
          );
            })}
          </div>
        ))}

        {section === 'po' && (
          <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
            <form onSubmit={handleCreatePo} className="kaffe-card p-5 space-y-3 h-fit">
              <p className="font-display text-[15px] font-extrabold text-slate-900">Buat Purchase Order (PO Supplier)</p>
              <input
                aria-label="Nama Supplier"
                value={poSupplier}
                onChange={(e) => setPoSupplier(e.target.value)}
                placeholder="Nama Supplier (contoh: PT Kopi Nusantara)"
                className="w-full h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
              />
              <select
                aria-label="Bahan Baku PO"
                value={poIngredientId}
                onChange={(e) => setPoIngredientId(e.target.value)}
                className="w-full h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
              >
                <option value="">Pilih bahan baku yang dipesan</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Stok: {item.stock} {item.unit})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Jumlah Order PO"
                  type="number"
                  step="0.01"
                  value={poQty}
                  onChange={(e) => setPoQty(e.target.value)}
                  placeholder="Qty Order"
                  className="h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
                />
                <input
                  aria-label="Total Tagihan Supplier (Rp)"
                  type="number"
                  value={poTotalCost}
                  onChange={(e) => setPoTotalCost(e.target.value)}
                  placeholder="Total Harga (Rp)"
                  className="h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
                />
              </div>
              <input
                aria-label="Catatan PO"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="Catatan pengiriman / termin pembayaran"
                className="w-full h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"
              />
              <button
                type="submit"
                disabled={poSaving}
                className="kaffe-gradient-cta w-full h-11 rounded-xl text-[14px] font-bold disabled:opacity-50"
              >
                {poSaving ? 'Menyimpan...' : 'Terbitkan PO Supplier'}
              </button>
            </form>

            <div className="space-y-3">
              {purchaseOrders.length === 0 ? (
                <div className="kaffe-card p-8 text-center text-slate-500 font-medium text-[13px]">
                  Belum ada Purchase Order (PO) ke supplier. Buat PO di sebelah kiri untuk memantau pesanan bahan baku dan menambah stok otomatis saat barang datang.
                </div>
              ) : (
                purchaseOrders.map((po) => (
                  <div key={po.id} className="kaffe-card p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-[#FF6A00]">{po.po_number}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            po.status === 'received'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {po.status === 'received' ? 'Barang Diterima' : 'Menunggu Pengiriman'}
                        </span>
                      </div>
                      <p className="mt-1 font-black text-slate-900">{po.supplier_name}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {po.items.map((it) => `${it.name}: ${it.qty} ${it.unit}`).join(', ')}
                      </p>
                      {po.notes && <p className="mt-1 text-[11px] font-semibold text-slate-400">Catatan: {po.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[12px] font-medium text-slate-500">Nilai PO</p>
                        <p className="font-mono text-base font-black text-slate-900">{fRp(po.total_amount)}</p>
                      </div>
                      {po.status !== 'received' && (
                        <button
                          type="button"
                          onClick={() => void handleReceivePo(po)}
                          disabled={poSaving}
                          className="h-11 rounded-xl bg-emerald-700 px-4 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          Terima Barang
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {section === 'conversions' && (
          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
            <form onSubmit={handleSaveConversion} className="kaffe-card p-5 space-y-3">
              <p className="font-display text-[15px] font-extrabold text-slate-900">Tambah Konversi</p>
              <select aria-label="Bahan baku asal" value={conversionForm.ingredient_id} onChange={e=>setConversionForm(f=>({...f,ingredient_id:e.target.value}))} className="w-full h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15">
                <option value="">Global / semua bahan</option>
                {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Satuan asal" value={conversionForm.from_unit} onChange={e=>setConversionForm(f=>({...f,from_unit:e.target.value}))} placeholder="mika / bal" className="h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"/>
                <input aria-label="Satuan tujuan" value={conversionForm.to_unit} onChange={e=>setConversionForm(f=>({...f,to_unit:e.target.value}))} placeholder="pcs / gram" className="h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"/>
              </div>
              <input aria-label="Rasio konversi" type="number" step="0.0001" value={conversionForm.ratio} onChange={e=>setConversionForm(f=>({...f,ratio:e.target.value}))} placeholder="15" className="h-11 w-full border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"/>
              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold text-[14px] hover:bg-slate-800">Simpan Konversi</button>
            </form>
            <div className="kaffe-card overflow-hidden">
              {unitConversions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-medium text-[13px]">Belum ada konversi unit. Tambahkan konversi saat bahan dibeli dan dipakai dalam satuan berbeda.</div>
              ) : unitConversions.map(conversion => {
                const ingredient = inventory.find(item => item.id === conversion.ingredient_id);
                return (
                  <div key={conversion.id} className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--brand-hairline)] last:border-0">
                    <div>
                      <p className="text-sm font-black text-slate-800">1 {conversion.from_unit} = {conversion.ratio.toLocaleString('id-ID')} {conversion.to_unit}</p>
                      <p className="text-[11px] font-bold text-slate-400">{ingredient?.name || 'Global'}</p>
                    </div>
                    <button type="button" onClick={()=>deleteStockUnitConversion(conversion.id)} className="h-11 px-3 rounded-xl text-rose-700 text-[13px] font-bold hover:bg-rose-50">Hapus</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section === 'recipes' && (
          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
            <form onSubmit={handleSaveRecipe} className="kaffe-card p-5 space-y-3">
              <p className="font-display text-[15px] font-extrabold text-slate-900">Tambah Resep</p>
              <select aria-label="Produk" value={recipeForm.product_id} onChange={e=>setRecipeForm(f=>({...f,product_id:e.target.value}))} className="w-full h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15">
                <option value="">Pilih produk</option>
                {menu.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select aria-label="Bahan baku resep" value={recipeForm.ingredient_id} onChange={e=>setRecipeForm(f=>({...f,ingredient_id:e.target.value}))} className="w-full h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15">
                <option value="">Pilih bahan</option>
                {inventory.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Jumlah bahan per porsi" type="number" step="0.0001" value={recipeForm.qty} onChange={e=>setRecipeForm(f=>({...f,qty:e.target.value}))} placeholder="Qty / porsi" className="h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"/>
                <input aria-label="Satuan rujukan" value={recipeForm.unit_reference} onChange={e=>setRecipeForm(f=>({...f,unit_reference:e.target.value}))} placeholder="pcs / gram" className="h-11 border border-[var(--brand-panel-border)] rounded-xl px-3 font-medium text-slate-800 bg-white focus:outline-none focus:border-[#FF6A00]/60 focus:ring-4 focus:ring-[#FF6A00]/15"/>
              </div>
              {recipeError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">{recipeError}</p>
              )}
              <button type="submit" className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold text-[14px] hover:bg-slate-800">Simpan Resep</button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hppRows.map(({ product, hpp }) => (
                <div key={product.id} className="kaffe-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-800">{product.name}</p>
                      <p className="text-[11px] font-bold text-slate-400">{product.recipe?.length || 0} bahan resep</p>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${hpp.complete?'bg-emerald-50 text-emerald-600':'bg-amber-50 text-amber-600'}`}>{hpp.complete?'Lengkap':'Perlu Cek'}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {hpp.lines.length === 0 ? <p className="text-xs font-bold text-slate-300">Tanpa resep</p> : hpp.lines.map(line => (
                      <div key={line.ingredientId} className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">{line.ingredientName}</span>
                        <span className="text-slate-800">{line.baseQty.toLocaleString('id-ID')} {line.baseUnit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'hpp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {hppRows.map(({ product, hpp, margin }) => (
              <div key={product.id} className="kaffe-card p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-black text-slate-800">{product.name}</p>
                    <p className="text-[11px] font-bold text-slate-400">{product.category}</p>
                  </div>
                  {hpp.complete ? <CheckCircle2 size={18} className="text-emerald-500"/> : <AlertTriangle size={18} className="text-amber-500"/>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[12px] font-medium text-slate-500">Harga</p><p className="font-bold text-slate-900 kaffe-num">{fRp(product.price)}</p></div>
                  <div><p className="text-[12px] font-medium text-slate-500">HPP</p><p className="font-bold text-slate-900 kaffe-num">{fRp(hpp.totalCost)}</p></div>
                  <div><p className="text-[12px] font-medium text-slate-500">Margin</p><p className="font-bold text-emerald-700 kaffe-num">{margin.marginPercent}%</p></div>
                  <div><p className="text-[12px] font-medium text-slate-500">Laba</p><p className="font-bold text-slate-900 kaffe-num">{fRp(margin.grossProfit)}</p></div>
                </div>
                {!hpp.complete && <p className="mt-3 text-[11px] font-bold text-amber-600">{hpp.warnings[0]}</p>}
              </div>
            ))}
          </div>
        )}

        {section === 'import' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
            <div className="kaffe-card p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-slate-700 font-black"><FileSpreadsheet size={18}/> CSV Import</div>
                <div className="flex gap-2">
                  <select aria-label="Mode impor" value={importMode} onChange={e=>setImportMode(e.target.value as BulkImportMode)} className="h-10 border border-slate-200 rounded-xl px-3 text-xs font-black">
                    <option value="create_only">Create only</option>
                    <option value="update_existing">Update existing</option>
                    <option value="upsert">Upsert</option>
                  </select>
                  <input aria-label="Pilih file CSV" type="file" accept=".csv,text/csv" onChange={e=>handleImportFile(e.target.files?.[0])} className="max-w-44 text-xs font-bold"/>
                </div>
              </div>
              <textarea
                value={importText}
                onChange={e=>handleImportText(e.target.value)}
                aria-label="CSV data"
                className="w-full min-h-72 border border-slate-200 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder={'kind,name,stock,base_unit,total_cost,from_unit,to_unit,ratio,product_name,ingredient_name,qty_per_serving,price,category\ningredient,Gula Aren,10,kg,45000,,,,,,,\nconversion,,,,,kg,gram,1000,,,,,\nproduct,Kopi Susu,,,,,,,,,,18000,Coffee\nrecipe,,,,,,,,Kopi Susu,Gula Aren,20,,'}
              />
            </div>
            <div className="kaffe-card p-5 h-fit">
              <p className="font-display text-[15px] font-extrabold text-slate-900 mb-3">Preview Import</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(importPreview.summary).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-slate-500">{key}</p>
                    <p className="text-xl font-black text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              {importPreview.errors.length > 0 && (
                <div className="space-y-2 mb-4">
                  {importPreview.errors.slice(0, 5).map(error => (
                    <div key={`${error.rowNumber}-${error.message}`} className="rounded-xl bg-rose-50 text-rose-600 p-3 text-xs font-bold">
                      Baris {error.rowNumber}: {error.message}
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={handleCommitImport} disabled={importing || importPreview.errors.length > 0 || importPreview.validRows.length === 0} className="kaffe-gradient-cta w-full h-12 rounded-xl text-[15px] font-bold disabled:opacity-40">
                {importing ? 'Mengimpor...' : 'Commit Import'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div 
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal-content bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-xl text-slate-900 tracking-tight">
                {form.type==='new'?'Bahan Baru':form.type==='edit'?'Edit Bahan':'Restock Bahan'}
              </h3>
              <button type="button" 
                onClick={()=>setShowModal(false)} 
                aria-label="Tutup modal"
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 active:bg-slate-100"
              >
                <X size={20}/>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              {form.type!=='restock' ? (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-700 pl-0.5">Nama Bahan *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    placeholder="Biji Kopi Arabica"
                    className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all" />
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="font-bold text-orange-700">{form.name}</p>
                  <p className="text-orange-500 text-xs">Menambah stok yang sudah ada tanpa memotong saldo buka kasir</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-700 pl-0.5">
                    {form.type==='new'?'Stok Awal':form.type==='edit'?'Jumlah Stok':'Jumlah Restock'} *
                  </label>
                  <input type="number" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}
                    placeholder="0" step="0.1"
                    className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-700 pl-0.5">Satuan</label>
                  <select aria-label="Satuan bahan" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}
                    className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all appearance-none">
                    {['gr','kg','ml','L','pcs','btl','bks','lbr','sachet'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700 pl-0.5">Total Biaya Beli (Rp)</label>
                <input type="number" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))}
                  placeholder="0"
                  className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all" />
                <p className="text-[11px] text-slate-400 pl-0.5 font-medium">
                  {form.qty && form.cost
                    ? `HPP per ${form.unit}: ${fRp(parseInt(form.cost)/(parseFloat(form.qty)||1))}`
                    : 'Isi untuk hitung HPP/unit otomatis'}
                </p>
              </div>
              {form.type !== 'restock' && (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-700 pl-0.5">Stok Minimum (Peringatan)</label>
                  <input type="number" value={form.minStock} onChange={e=>setForm(f=>({...f,minStock:e.target.value}))}
                    placeholder="5"
                    className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all" />
                  <p className="text-[11px] text-slate-400 pl-0.5 font-medium">Peringatan muncul saat stok ≤ nilai ini</p>
                </div>
              )}
              <button 
                type="submit" 
                disabled={saving}
                className="kaffe-gradient-cta w-full h-14 rounded-2xl text-[19px] font-extrabold disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {saving&&<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {saving?'Menyimpan...':'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {opnameTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setOpnameTarget(null)}
        >
          <div className="modal-content bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight">Opname Stok</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">{opnameTarget.name}</p>
              </div>
              <button type="button"
                onClick={()=>setOpnameTarget(null)}
                aria-label="Tutup opname"
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 active:bg-slate-100"
              >
                <X size={20}/>
              </button>
            </div>
            <form onSubmit={handleSaveOpname} className="space-y-3">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[12px] font-semibold text-slate-500">Stok sistem sekarang</p>
                <p className="text-lg font-black text-slate-900 mt-1">{opnameTarget.stock.toLocaleString('id-ID')} {opnameTarget.unit}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700 pl-0.5">Stok fisik hasil hitung *</label>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={opnameForm.countedStock}
                  onChange={e=>setOpnameForm(f=>({...f,countedStock:e.target.value}))}
                  className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700 pl-0.5">Alasan *</label>
                <input
                  value={opnameForm.reason}
                  onChange={e=>setOpnameForm(f=>({...f,reason:e.target.value}))}
                  className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700 pl-0.5">Catatan</label>
                <textarea
                  value={opnameForm.note}
                  onChange={e=>setOpnameForm(f=>({...f,note:e.target.value}))}
                  className="w-full min-h-20 border border-slate-200 rounded-2xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all"
                  placeholder="Opsional"
                />
              </div>
              <button
                type="submit"
                disabled={opnameSaving}
                className="kaffe-gradient-cta w-full h-14 rounded-2xl text-[19px] font-extrabold disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {opnameSaving&&<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
                {opnameSaving?'Menyimpan...':'Simpan Opname'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi hapus bahan baku */}
      <DeleteConfirmSheet
        visible={!!deleteTarget}
        title={`Hapus "${deleteTarget?.name}"?`}
        message="Bahan baku ini akan dihapus permanen. Resep menu yang menggunakan bahan ini akan terpengaruh."
        onConfirm={() => deleteTarget && deleteInventoryItem(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
