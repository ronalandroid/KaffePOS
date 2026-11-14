




/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/menu/MenuTab.tsx
import { memo, useState, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, X, ChevronDown, Image, Search, ShoppingBag } from 'lucide-react';
import ProductPlaceholder from '@/components/ui/ProductPlaceholder';
import { useStore } from '@/hooks/useStore';
import DeleteConfirmSheet from '@/components/ui/DeleteConfirmSheet';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import Switch from '@/components/ui/Switch';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePagination } from '@/hooks/usePagination';
import type { MenuItem } from '@/types';

const fRp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);
const EMPTY: Partial<MenuItem> = { name:'', price:0, category:'Coffee', image_url:'', description:'', recipe:[], variants:[], modifiers:[], is_available:true };
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PAGE_SIZE = 24;

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-[24px] bg-slate-100 animate-pulse" />)}</div>;
});

type OptionRow = { name: string; price: number };
type OptionRowsEditorProps = {
  title: string; subtitle: string; addLabel: string; emptyHint: string;
  rows: OptionRow[];
  onAdd: () => void;
  onUpdate: (idx: number, key: 'name' | 'price', val: string) => void;
  onRemove: (idx: number) => void;
};
const OptionRowsEditor = memo(function OptionRowsEditor({ title, subtitle, addLabel, emptyHint, rows, onAdd, onUpdate, onRemove }: OptionRowsEditorProps) {
  return (
    <div className="border-t border-slate-100 pt-5 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[13px] font-black text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-400 font-medium">{subtitle}</p>
        </div>
        <button type="button" onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-black active:scale-95 transition-colors border border-orange-100">
          <Plus size={14}/>{addLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs">{emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-2xl p-2.5 shadow-sm">
              <input
                value={row.name}
                onChange={e => onUpdate(idx, 'name', e.target.value)}
                placeholder="Nama (mis. Large / Extra Shot)"
                aria-label="Nama opsi"
                className="flex-1 min-w-0 h-11 border border-slate-100 rounded-xl px-3 text-xs focus:outline-none focus:border-orange-400 bg-slate-50 font-bold text-slate-700"
              />
              <div className="w-28 relative shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-300 pointer-events-none">Rp</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={row.price || ''}
                  onChange={e => onUpdate(idx, 'price', e.target.value)}
                  placeholder="0"
                  aria-label="Harga opsi"
                  className="w-full h-11 border border-slate-100 rounded-xl pl-8 pr-2 text-xs focus:outline-none focus:border-orange-400 text-right font-black bg-slate-50"
                />
              </div>
              <button type="button" onClick={() => onRemove(idx)} aria-label="Hapus opsi"
                className="w-9 h-9 flex items-center justify-center text-red-400 bg-red-50 rounded-xl active:scale-90 transition-all">
                <X size={16}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default function MenuTab({ toast }:any) {
  const { menu, inventory, saveMenuItem, deleteMenuItem } = useStore();
  const [showModal,    setShowModal]    = useState(false);
  const [form,         setForm]         = useState<Partial<MenuItem>>(EMPTY);
  const [cat,          setCat]          = useState('All');
  const [search,       setSearch]       = useState('');
  const [,             setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem|null>(null); // konfirmasi hapus
  const imgRef = useRef<HTMLInputElement>(null);
  const dSearch = useDebouncedValue(search, 300);

  const cats     = useMemo(() => ['All', ...new Set(menu.map(m => m.category))], [menu]);
  const filtered = useMemo(() => menu.filter(m => (cat==='All'||m.category===cat) && (!dSearch||m.name.toLowerCase().includes(dSearch.toLowerCase()))), [menu,cat,dSearch]);
  const { visibleItems, hasMore, remaining, loadMore } = usePagination(filtered, { pageSize: PAGE_SIZE, resetKeys: [cat, dSearch] });

  const openNew  = () => { setForm({ ...EMPTY, recipe: [], variants: [], modifiers: [] }); setShowModal(true); };
  const openNewCombo = () => {
    setForm({
      ...EMPTY,
      name: 'Paket Kombo Hemat ',
      category: 'Paket Kombo',
      description: 'Bundling minuman + pastry/snack hemat',
      recipe: inventory.slice(0, 2).map((ing) => ({ matId: ing.id, qty: 1 })),
      variants: [
        { name: 'Regular Combo', price: 0 },
        { name: 'Upsize Large Combo', price: 5000 },
      ],
      modifiers: [
        { name: 'Extra Espresso Shot', price: 6000 },
        { name: 'Ganti Oat Milk', price: 8000 },
      ],
    });
    setShowModal(true);
  };
  const openEdit = (item: MenuItem) => { setForm({ ...item, recipe: item.recipe ? [...item.recipe] : [], variants: item.variants ? [...item.variants] : [], modifiers: item.modifiers ? [...item.modifiers] : [] }); setShowModal(true); };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) { toast.showToast('Gunakan PNG, JPG, atau WEBP', 'warning'); return; }
    if (file.size > 1024*1024) { toast.showToast('Foto maks 1MB','warning'); return; }
    if (file.name.toLowerCase().endsWith('.svg')) { toast.showToast('Format SVG tidak didukung untuk keamanan', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, image_url: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.showToast('Nama menu wajib diisi','warning'); return; }
    if (!form.price || form.price <= 0) { toast.showToast('Harga harus lebih dari 0','warning'); return; }
    const incompleteRecipe = (form.recipe || []).some((line) => !line.matId || !line.qty || line.qty <= 0);
    if (incompleteRecipe) {
      toast.showToast('Lengkapi bahan resep atau hapus baris yang kosong.', 'warning');
      return;
    }
    // Drop blank variant/modifier rows so the backend (name required) doesn't 400.
    const cleanVariants = (form.variants || []).map(v => ({ ...v, name: v.name.trim() })).filter(v => v.name);
    const cleanModifiers = (form.modifiers || []).map(m => ({ ...m, name: m.name.trim() })).filter(m => m.name);
    setSaving(true);
    try {
      await saveMenuItem({ ...form, variants: cleanVariants, modifiers: cleanModifiers });
      setShowModal(false);
      toast.showToast(form.id ? 'Menu diperbarui!' : 'Menu ditambahkan!', 'success');
    }
    catch (err:any) { toast.showToast(normalizeUserFacingError(err, 'Menu belum bisa disimpan. Periksa kembali data menu.'), 'error'); }
    finally { setSaving(false); }
  };

  const toggleAvailable = async (item: MenuItem) => {
    try {
      await saveMenuItem({ ...item, is_available: !item.is_available });
    } catch (err) {
      toast.showToast(normalizeUserFacingError(err, 'Status menu belum bisa diubah. Coba lagi.'), 'error');
    }
  };

  const addRecipeLine = () => setForm(f => ({ ...f, recipe: [...(f.recipe||[]), { matId: '', qty: 0 }] }));
  const updateRecipeLine = (idx: number, key: 'matId'|'qty', val:any) => {
    setForm(f => { const r = [...(f.recipe||[])]; r[idx] = { ...r[idx], [key]: key==='qty'?parseFloat(val)||0:val }; return { ...f, recipe: r }; });
  };
  const removeRecipeLine = (idx: number) => setForm(f => ({ ...f, recipe: (f.recipe||[]).filter((_,i) => i!==idx) }));

  // Variant (single-select size) + modifier (multi-select priced add-on) editors.
  const addVariant    = () => setForm(f => ({ ...f, variants: [...(f.variants||[]), { name: '', price: 0 }] }));
  const updateVariant = (idx: number, key: 'name'|'price', val: string) =>
    setForm(f => { const v = [...(f.variants||[])]; v[idx] = { ...v[idx], [key]: key==='price'?parseInt(val)||0:val }; return { ...f, variants: v }; });
  const removeVariant = (idx: number) => setForm(f => ({ ...f, variants: (f.variants||[]).filter((_,i) => i!==idx) }));
  const addModifier    = () => setForm(f => ({ ...f, modifiers: [...(f.modifiers||[]), { name: '', price: 0 }] }));
  const updateModifier = (idx: number, key: 'name'|'price', val: string) =>
    setForm(f => { const m = [...(f.modifiers||[])]; m[idx] = { ...m[idx], [key]: key==='price'?parseInt(val)||0:val }; return { ...f, modifiers: m }; });
  const removeModifier = (idx: number) => setForm(f => ({ ...f, modifiers: (f.modifiers||[]).filter((_,i) => i!==idx) }));

  const getStockStatus = (item: MenuItem) => {
    if (!item.recipe?.length) return null;
    return item.recipe.some(r => { const m = inventory.find(i => i.id === r.matId); return !m || m.stock < r.qty; }) ? 'low' : 'ok';
  };

  const getProductStatus = (item: MenuItem) => {
    const stockStatus = getStockStatus(item);
    if (!item.is_available) {
      return { label: 'Habis', className: 'bg-rose-50 text-rose-700 border-rose-100' };
    }
    if (stockStatus === 'low') {
      return { label: 'Menipis', className: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    return { label: 'Aman', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  };

  return (
    <div className="kaffe-app-bg kaffe-responsive-surface flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="z-10 border-b border-[var(--brand-panel-border)] bg-white px-4 pt-5 pb-3 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Produk</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              <span className="kaffe-num">{menu.length}</span> produk · <span className="kaffe-num">{menu.filter(m => m.is_available).length}</span> aktif dijual
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={openNewCombo}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-panel-border)] bg-white px-4 text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)]">
              <Plus size={16} className="text-[var(--brand-orange-text)]"/>Paket Kombo
            </button>
            <button type="button" onClick={openNew}
              className="kaffe-gradient-cta inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-bold sm:flex-none">
              <Plus size={16}/>Tambah Produk
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80 md:shrink-0">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
            <label htmlFor="menu-search" className="sr-only">Cari nama menu</label>
            <input
              id="menu-search"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Cari nama menu..."
              className="h-11 w-full rounded-xl border border-[var(--brand-panel-border)] bg-[var(--brand-canvas)] pl-11 pr-4 font-medium text-slate-800 placeholder:text-slate-500 transition-colors focus:border-[#FF6A00]/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/15"
            />
          </div>
          <div className="kaffe-scroll-tabs kaffe-command-bar -mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
            {cats.map(c=>(
              <button type="button"
                key={c}
                onClick={()=>setCat(c)}
                aria-pressed={cat===c}
                className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-bold transition-colors ${
                  cat===c
                    ? 'border border-[#FF6A00]/50 bg-[var(--brand-orange-soft)] text-[var(--brand-orange-text)]'
                    : 'border border-[var(--brand-panel-border)] bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {c === 'All' ? 'Semua' : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 pb-24 sm:p-5 lg:p-8 lg:pb-8">
        {search !== dSearch ? <LoadingSkeleton /> : filtered.length===0 ? (
          <div className="kaffe-empty-state flex flex-col items-center justify-center rounded-[20px] px-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-canvas)] text-stone-300">
               <ShoppingBag size={28} />
            </div>
            <p className="font-display text-base font-extrabold text-slate-800">Belum ada menu di kategori ini</p>
            <p className="mt-1 max-w-xs text-center text-[13px] font-medium text-slate-500">
              Tambahkan produk pertama agar kasir bisa mulai transaksi dengan cepat.
            </p>
          </div>
        ) : (
          <>
            <div className="kaffe-card-grid kaffe-product-grid grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
              {visibleItems.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onToggleAvailable={toggleAvailable}
                  getProductStatus={getProductStatus}
                  getStockStatus={getStockStatus}
                />
              ))}
            </div>

            <div className="kaffe-table-surface hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--brand-panel-border)] bg-[var(--brand-canvas)] text-[12px] font-semibold text-slate-600">
                    <th className="px-5 py-3">Produk</th>
                    <th className="px-5 py-3">Kategori</th>
                    <th className="px-5 py-3 text-right">Harga</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Dijual</th>
                    <th className="px-5 py-3 text-right"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-hairline)]">
                  {visibleItems.map((item) => {
                    const status = getProductStatus(item);
                    return (
                      <tr key={item.id} className={`transition-colors hover:bg-[#FCFBF9] ${!item.is_available ? 'bg-slate-50 text-slate-500' : 'bg-white'}`}>
                        <td className="px-5 py-3">
                          <div className={`flex items-center gap-3 ${!item.is_available ? 'opacity-60' : ''}`}>
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-[var(--brand-hairline)]">
                              {item.image_url
                                ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                : <ProductPlaceholder category={item.category} iconSize={18} />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                              <p className="mt-0.5 text-[12px] font-medium text-slate-500">{item.recipe?.length ? `${item.recipe.length} bahan resep` : 'Tanpa resep'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[13px] font-medium text-slate-600">{item.category}</td>
                        <td className="px-5 py-3 text-right text-[14px] font-bold text-slate-900 kaffe-num">{fRp(item.price)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
                        </td>
                        <td className="px-5 py-1">
                          <Switch
                            checked={!!item.is_available}
                            onChange={() => toggleAvailable(item)}
                            label={`${item.is_available ? 'Nonaktifkan' : 'Aktifkan'} ${item.name}`}
                            className="-ml-1.5"
                          />
                        </td>
                        <td className="px-5 py-1">
                          <div className="flex items-center justify-end">
                            <button type="button" aria-label={`Edit ${item.name}`} onClick={()=>openEdit(item)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-orange-text)]"><Edit size={16}/></button>
                            <button type="button" aria-label={`Hapus ${item.name}`} onClick={() => setDeleteTarget(item)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button type="button" onClick={loadMore} className="mt-4 h-11 w-full rounded-xl border border-[var(--brand-panel-border)] bg-white text-[13px] font-bold text-slate-700 hover:bg-[var(--brand-canvas)]">
                Muat Lebih Banyak ({remaining} lagi)
              </button>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal-content bg-white shadow-2xl">
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 pt-6 pb-4 border-b border-slate-100 z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xl text-slate-900 tracking-tight">{form.id?'Edit Menu':'Menu Baru'}</h3>
                <button type="button"
                  onClick={()=>setShowModal(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 active:bg-slate-100"
                >
                  <X size={20}/>
                </button>
              </div>
            </div>
            <form onSubmit={handleSave} className="px-5 pb-6 pt-4 space-y-4">

              {/* FOTO UPLOAD */}
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block">FOTO MENU</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center">
                    {form.image_url
                      ? <img src={form.image_url} alt="" className="w-full h-full object-cover"/>
                      : <ProductPlaceholder {...(form.category ? { category: form.category } : {})} iconSize={24} />
                    }
                  </div>
                  <div className="flex-1 space-y-2">
                    <button type="button" onClick={()=>imgRef.current?.click()}
                      className="w-full py-2.5 border-2 border-orange-200 text-orange-600 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95">
                      <Image size={14}/>Upload Foto
                    </button>
                    {form.image_url&&(
                      <button type="button" onClick={()=>setForm(f=>({...f,image_url:''}))}
                        className="w-full py-2 border border-slate-200 text-slate-400 rounded-xl text-xs active:scale-95">
                        Hapus Foto
                      </button>
                    )}
                    <p className="text-[11px] text-slate-400">JPG/PNG maks 1MB</p>
                  </div>
                </div>
                <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload}/>
              </div>

              {/* NAMA & HARGA */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-slate-700 pl-0.5">NAMA MENU *</label>
                  <input
                    value={form.name||''}
                    onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                    placeholder="Contoh: Kopi Susu Aren"
                    className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-slate-700 pl-0.5">HARGA (Rp) *</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.price||''}
                      onChange={e=>setForm(f=>({...f,price:parseInt(e.target.value)||0}))}
                      placeholder="25000"
                      className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-slate-700 pl-0.5">KATEGORI</label>
                    <div className="relative">
                      <select
                        value={form.category||'Coffee'}
                        onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                        className="w-full h-12 border border-slate-200 rounded-2xl px-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all appearance-none"
                      >
                        {['Coffee','Non-Coffee','Food','Snack','Other'].map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-slate-700 pl-0.5">DESKRIPSI (OPSIONAL)</label>
                <textarea
                  value={form.description||''}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  rows={2}
                  placeholder="Kopi susu dengan gula aren asli..."
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-all resize-none"
                />
              </div>

              {/* RESEP */}
              <div className="border-t border-slate-100 pt-5 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-black text-slate-800">RESEP BAHAN BAKU</p>
                    <p className="text-[11px] text-slate-400 font-medium">Stok gudang otomatis berkurang saat terjual</p>
                  </div>
                  <button
                    type="button"
                    onClick={addRecipeLine}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-black active:scale-95 transition-colors border border-orange-100"
                  >
                    <Plus size={14}/>Tambah Bahan
                  </button>
                </div>
                {inventory.length===0?(
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-amber-700 text-xs font-bold">Belum ada bahan di Gudang. Tambahkan stok dulu untuk membuat resep.</p>
                    <p className="text-amber-500 text-xs mt-0.5">Tambah bahan di tab Gudang terlebih dahulu</p>
                  </div>
                ):(form.recipe||[]).length===0?(
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-slate-400 text-xs">Belum ada resep. Menu tetap bisa dijual, tetapi stok tidak akan berkurang otomatis.</p>
                  </div>
                ):(
                  <div className="space-y-2.5">
                    {(form.recipe||[]).map((r,idx)=>(
                      <div key={idx} className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-2xl p-2.5 shadow-sm">
                        <div className="flex-1 min-w-0 relative">
                          <select
                            value={r.matId}
                            onChange={e=>updateRecipeLine(idx,'matId',e.target.value)}
                            className="w-full h-11 border border-slate-100 rounded-xl px-3 text-xs focus:outline-none focus:border-orange-400 bg-slate-50 appearance-none font-bold text-slate-700"
                          >
                            <option value="">-- Pilih Bahan --</option>
                            {inventory.map(inv=><option key={inv.id} value={inv.id}>{inv.name} ({inv.stock} {inv.unit})</option>)}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={14} />
                          </div>
                        </div>
                        <div className="w-24 relative shrink-0">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={r.qty||''}
                            onChange={e=>updateRecipeLine(idx,'qty',e.target.value)}
                            placeholder="0.0"
                            step="0.1"
                            className="w-full h-11 border border-slate-100 rounded-xl px-3 text-xs focus:outline-none focus:border-orange-400 text-center font-black bg-slate-50"
                          />
                        </div>
                        <span className="text-[11px] font-black text-slate-400 w-8 shrink-0">
                          {inventory.find(i=>i.id===r.matId)?.unit||'unit'}
                        </span>
                        <button
                          type="button"
                          onClick={()=>removeRecipeLine(idx)}
                          className="w-9 h-9 flex items-center justify-center text-red-400 bg-red-50 rounded-xl active:scale-90 transition-all"
                        >
                          <X size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* VARIAN + MODIFIER */}
              <OptionRowsEditor
                title="VARIAN UKURAN"
                subtitle="Pilihan tunggal saat checkout (mis. S/M/L). Harga menggantikan harga dasar."
                addLabel="Tambah Varian"
                emptyHint="Belum ada varian. Menu memakai satu harga."
                rows={form.variants || []}
                onAdd={addVariant} onUpdate={updateVariant} onRemove={removeVariant}
              />
              <OptionRowsEditor
                title="TAMBAHAN (MODIFIER)"
                subtitle="Pilihan ganda berbayar (mis. Extra Shot, Oat Milk). Harga ditambahkan."
                addLabel="Tambah Modifier"
                emptyHint="Belum ada tambahan."
                rows={form.modifiers || []}
                onAdd={addModifier} onUpdate={updateModifier} onRemove={removeModifier}
              />

              {/* TOGGLE AVAILABLE */}
              <div
                onClick={()=>setForm(f=>({...f,is_available:!f.is_available}))}
                className="flex items-center justify-between py-4 px-4 bg-slate-50 rounded-2xl cursor-pointer active:bg-slate-100 transition-colors mt-4"
              >
                <div>
                  <p className="text-sm font-black text-slate-800">Tersedia untuk dijual</p>
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Tampil di halaman POS</p>
                </div>
                <div className={`h-[26px] w-12 rounded-full transition-all relative shrink-0 ${form.is_available?'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]':'bg-slate-200'}`}>
                  <div className={`h-[22px] w-[22px] bg-white rounded-full absolute top-0.5 shadow-sm transition-all duration-300 ${form.is_available?'left-[24px]':'left-0.5'}`}/>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-14 bg-slate-900 text-white font-black rounded-2xl active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all mt-6"
              >
                {form.id ? 'Perbarui Menu' : 'Simpan Menu Baru'}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi hapus menu */}
      <DeleteConfirmSheet
        visible={!!deleteTarget}
        title={`Hapus "${deleteTarget?.name}"?`}
        message="Menu ini akan dihapus permanen. Resep terkait juga akan hilang."
        onConfirm={() => deleteTarget && deleteMenuItem(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
