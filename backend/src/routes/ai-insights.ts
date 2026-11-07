/**
 * Enhanced AI business-insights computation for the KaffePOS dashboard.
 *
 * Pure: takes plain transaction/inventory/menu rows and returns a derived
 * insights payload with no database access and no side effects. Extracted
 * from routes/misc.ts so the route file stays focused on HTTP handlers.
 */
import { toNumber } from '../core';

type InsightType = 'sales_trend' | 'menu_optimization' | 'staff_performance' | 'stock_waste' | 'peak_hour';

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatHourRange(hour: number) {
  const end = Math.min(hour + 2, 24);
  return `${String(hour).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00`;
}

function extractItems(row: Record<string, unknown>): Array<Record<string, unknown>> {
  const items = row.items;
  if (Array.isArray(items)) return items as Array<Record<string, unknown>>;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function pctChange(current: number, previous: number) {
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildEnhancedAiInsights(input: {
  storeId: string;
  storeName: string;
  transactions: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  menu: Record<string, unknown>[];
}) {
  const now = new Date();
  const today = startOfDay(now);
  const last14Start = new Date(today);
  last14Start.setDate(last14Start.getDate() - 13);
  const previous14Start = new Date(last14Start);
  previous14Start.setDate(previous14Start.getDate() - 14);

  const transactions = input.transactions
    .filter((row) => row.is_void !== true)
    .map((row) => ({
      ...row,
      total: toNumber(row.total),
      subtotal: toNumber(row.subtotal),
      discount: toNumber(row.discount),
      dateValue: new Date(String(row.date ?? row.created_at ?? new Date().toISOString())),
      itemsValue: extractItems(row),
      cashierName: String(row.cashier || 'Kasir'),
    }));

  const recent = transactions.filter((row) => row.dateValue >= last14Start);
  const previous = transactions.filter((row) => row.dateValue >= previous14Start && row.dateValue < last14Start);
  const recentRevenue = recent.reduce((sum, row) => sum + row.total, 0);
  const previousRevenue = previous.reduce((sum, row) => sum + row.total, 0);
  const revenueTrendPct = pctChange(recentRevenue, previousRevenue);

  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    trendMap.set(date.toISOString().slice(0, 10), 0);
  }
  recent.forEach((row) => {
    const key = row.dateValue.toISOString().slice(0, 10);
    if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + row.total);
  });
  const salesTrend = [...trendMap.entries()].map(([date, value]) => ({
    label: new Date(date).toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3),
    value,
  }));

  const menuMap = new Map<string, { qty: number; revenue: number }>();
  recent.forEach((row) => {
    row.itemsValue.forEach((item) => {
      const name = String(item.name || item.menu_name || 'Menu');
      const current = menuMap.get(name) ?? { qty: 0, revenue: 0 };
      menuMap.set(name, {
        qty: current.qty + toNumber(item.qty),
        revenue: current.revenue + toNumber(item.subtotal || toNumber(item.price) * toNumber(item.qty)),
      });
    });
  });
  const menuPerformance = [...menuMap.entries()]
    .map(([label, data]) => ({ label, qty: data.qty, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue);
  const bestMenu = menuPerformance[0] ?? null;
  const slowMenu = menuPerformance.length > 2 ? menuPerformance[menuPerformance.length - 1] : null;

  const hourMap = new Map<number, { transactions: number; revenue: number }>();
  recent.forEach((row) => {
    const hour = Math.floor(row.dateValue.getHours() / 2) * 2;
    const current = hourMap.get(hour) ?? { transactions: 0, revenue: 0 };
    hourMap.set(hour, { transactions: current.transactions + 1, revenue: current.revenue + row.total });
  });
  const peakHours = [...hourMap.entries()]
    .map(([hour, data]) => ({ label: formatHourRange(hour), hour, ...data }))
    .sort((a, b) => b.revenue - a.revenue);
  const bestHour = peakHours[0] ?? null;

  const staffMap = new Map<string, { transactions: number; revenue: number; multiItem: number; items: number }>();
  recent.forEach((row) => {
    const qty = row.itemsValue.reduce((sum, item) => sum + toNumber(item.qty), 0);
    const current = staffMap.get(row.cashierName) ?? { transactions: 0, revenue: 0, multiItem: 0, items: 0 };
    staffMap.set(row.cashierName, {
      transactions: current.transactions + 1,
      revenue: current.revenue + row.total,
      multiItem: current.multiItem + (qty > 1 ? 1 : 0),
      items: current.items + qty,
    });
  });
  const staffPerformance = [...staffMap.entries()]
    .map(([label, data]) => ({
      label,
      transactions: data.transactions,
      revenue: data.revenue,
      upsellRate: data.transactions > 0 ? Math.round((data.multiItem / data.transactions) * 100) : 0,
      avgItems: data.transactions > 0 ? Number((data.items / data.transactions).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.upsellRate - a.upsellRate || b.revenue - a.revenue);
  const bestStaff = staffPerformance[0] ?? null;

  const lowStock = input.inventory
    .filter((item) => toNumber(item.stock) <= toNumber(item.min_stock))
    .map((item) => ({
      label: String(item.name || 'Stok'),
      stock: toNumber(item.stock),
      minStock: toNumber(item.min_stock),
      unit: String(item.unit || ''),
      risk: toNumber(item.min_stock) > 0 ? Math.round((toNumber(item.stock) / toNumber(item.min_stock)) * 100) : 0,
    }))
    .sort((a, b) => a.risk - b.risk)
    .slice(0, 5);

  const insights: Array<{
    id: string;
    type: InsightType;
    title: string;
    description: string;
    impact: string;
    confidence: number;
    metricLabel: string;
    metricValue: string;
  }> = [];

  insights.push({
    id: 'sales-trend',
    type: 'sales_trend',
    title: revenueTrendPct >= 0 ? 'Sales trend naik' : 'Sales trend perlu dijaga',
    description: revenueTrendPct >= 0
      ? `Revenue 14 hari terakhir naik ${revenueTrendPct}% dibanding periode sebelumnya. Pertahankan promo dan jam ramai yang sudah bekerja.`
      : `Revenue 14 hari terakhir turun ${Math.abs(revenueTrendPct)}%. Fokuskan promo ke menu terlaris dan jam paling ramai.`,
    impact: revenueTrendPct >= 0 ? 'Potensi menjaga momentum +8-12% revenue' : 'Potensi recovery +10-15% revenue',
    confidence: recent.length >= 20 ? 86 : 68,
    metricLabel: '14 hari',
    metricValue: `${revenueTrendPct >= 0 ? '+' : ''}${revenueTrendPct}%`,
  });

  if (bestMenu) {
    insights.push({
      id: 'menu-optimization',
      type: 'menu_optimization',
      title: `${bestMenu.label} jadi menu anchor`,
      description: `${bestMenu.label} menyumbang ${new Intl.NumberFormat('id-ID').format(bestMenu.qty)} item terjual. Letakkan di tombol atas dan jadikan bundling dengan modifier bernilai tinggi.`,
      impact: 'Estimated impact +12-18% revenue',
      confidence: bestMenu.qty >= 10 ? 88 : 70,
      metricLabel: 'Revenue menu',
      metricValue: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(bestMenu.revenue),
    });
  }

  if (bestHour) {
    insights.push({
      id: 'peak-hour',
      type: 'peak_hour',
      title: `Peak hour ${bestHour.label}`,
      description: `Jam terbaik outlet ada di ${bestHour.label}. Tambahkan promo ringan atau highlight add-on pada window ini saat traffic sedang hangat.`,
      impact: 'Potential lift +7-14% pada jam ramai',
      confidence: bestHour.transactions >= 8 ? 84 : 66,
      metricLabel: 'Transaksi',
      metricValue: `${bestHour.transactions}`,
    });
  }

  if (bestStaff && staffPerformance.length > 1) {
    insights.push({
      id: 'staff-performance',
      type: 'staff_performance',
      title: `${bestStaff.label} paling kuat upsell`,
      description: `${bestStaff.label} punya upsell rate ${bestStaff.upsellRate}%. Jadikan trainer singkat untuk script add-on dan rekomendasi menu di kasir.`,
      impact: 'Potential +5-10% average ticket',
      confidence: bestStaff.transactions >= 8 ? 82 : 64,
      metricLabel: 'Upsell rate',
      metricValue: `${bestStaff.upsellRate}%`,
    });
  }

  if (lowStock.length > 0) {
    insights.push({
      id: 'stock-waste',
      type: 'stock_waste',
      title: `${lowStock[0].label} perlu restock`,
      description: `${lowStock[0].label} sudah di bawah minimum. Prioritaskan restock bahan menu terlaris agar tidak kehilangan sales saat peak hour.`,
      impact: 'Mengurangi risiko lost sales hari ini',
      confidence: 90,
      metricLabel: 'Sisa stok',
      metricValue: `${lowStock[0].stock} ${lowStock[0].unit}`.trim(),
    });
  }

  const recommendations = [
    bestMenu ? {
      id: 'move-top-menu',
      type: 'menu_optimization' as InsightType,
      priority: 'high',
      title: `Move ${bestMenu.label} to top button`,
      action: `Pindahkan ${bestMenu.label} ke tombol paling atas dan pasangkan dengan add-on paling relevan.`,
      impact: 'Potential +18% revenue',
    } : null,
    bestHour ? {
      id: 'peak-promo',
      type: 'peak_hour' as InsightType,
      priority: 'high',
      title: `Promo ringan di ${bestHour.label}`,
      action: `Buat promo add-on atau bundle kecil pada ${bestHour.label}, bukan diskon besar sepanjang hari.`,
      impact: 'Potential +7-14% revenue saat peak hour',
    } : null,
    bestStaff && staffPerformance.length > 1 ? {
      id: 'staff-trainer',
      type: 'staff_performance' as InsightType,
      priority: 'medium',
      title: `${bestStaff.label} sebagai trainer upsell`,
      action: `Minta ${bestStaff.label} share script rekomendasi add-on ke staff lain selama briefing 10 menit.`,
      impact: 'Potential +5-10% average ticket',
    } : null,
    lowStock.length > 0 ? {
      id: 'stock-restock',
      type: 'stock_waste' as InsightType,
      priority: 'high',
      title: `Restock ${lowStock[0].label}`,
      action: `Restock ${lowStock[0].label} sebelum peak hour agar menu utama tidak kosong.`,
      impact: 'Mengurangi lost sales dan void akibat stok kosong',
    } : null,
    slowMenu ? {
      id: 'slow-menu',
      type: 'menu_optimization' as InsightType,
      priority: 'low',
      title: `Review ${slowMenu.label}`,
      action: `Uji foto, nama, atau posisi ${slowMenu.label}. Jika tetap rendah, pertimbangkan seasonal menu.`,
      impact: 'Kurangi menu clutter dan waste bahan',
    } : null,
  ].filter(Boolean).slice(0, 5);

  const stockPenalty = Math.min(20, lowStock.length * 4);
  const trendScore = Math.max(-12, Math.min(15, Math.round(revenueTrendPct / 3)));
  const dataScore = recent.length >= 30 ? 10 : recent.length >= 10 ? 5 : -5;
  const staffScore = bestStaff && bestStaff.upsellRate >= 40 ? 5 : 0;
  const kopiScore = Math.max(30, Math.min(98, 70 + trendScore + dataScore + staffScore - stockPenalty));

  return {
    storeId: input.storeId,
    storeName: input.storeName,
    generatedAt: now.toISOString(),
    cachedUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    fromCache: false,
    kopiScore: {
      score: kopiScore,
      label: kopiScore >= 85 ? 'Excellent' : kopiScore >= 72 ? 'Healthy' : kopiScore >= 60 ? 'Needs Focus' : 'At Risk',
      explanation: `${input.storeName} punya score ${kopiScore}/100 berdasarkan sales trend, menu mix, staff upsell, peak hour, dan risiko stok.`,
      drivers: [
        `Sales trend ${revenueTrendPct >= 0 ? '+' : ''}${revenueTrendPct}%`,
        `${recent.length} transaksi dianalisis`,
        lowStock.length > 0 ? `${lowStock.length} stok perlu perhatian` : 'Stok utama aman',
      ],
    },
    summary: recent.length === 0
      ? 'Belum cukup transaksi untuk analisis penuh. Mulai dari transaksi hari ini, lalu refresh insight setelah data masuk.'
      : `AI Insights membaca ${recent.length} transaksi terakhir. Fokus utama: ${bestMenu?.label || 'menu mix'}, ${bestHour?.label || 'peak hour'}, dan ${lowStock[0]?.label || 'stock health'}.`,
    insights: insights.slice(0, 5),
    recommendations,
    charts: {
      salesTrend,
      peakHours: peakHours.slice(0, 6).map(({ label, transactions: count, revenue }) => ({ label, transactions: count, revenue })),
      menuPerformance: menuPerformance.slice(0, 6),
      staffPerformance: staffPerformance.slice(0, 6),
    },
    dataCoverage: {
      transactions: recent.length,
      days: 14,
      menuItems: input.menu.length,
      inventoryItems: input.inventory.length,
    },
  };
}
