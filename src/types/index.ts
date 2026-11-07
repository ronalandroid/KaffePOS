import type { Permission, UserRole } from '@/lib/accessControl';
 
 
 
 
 
export type Tab = 'dashboard' | 'performance' | 'challenges' | 'referrals' | 'affiliate' | 'pos' | 'loyalty' | 'kitchen' | 'warehouse' | 'menu' | 'history' | 'report' | 'settings';
export interface StoreSettings {
  id: string; owner_id: string; store_name: string;
  address?: string; whatsapp?: string; tagline?: string;
  receipt_header?: string; receipt_footer?: string; tax_percent?: number;
  logo_url?: string; logo_base64?: string;
  logo_position?: 'left'|'center'|'right'; logo_size?: number;
  show_logo_on_receipt?: boolean;
  paper_width?: '58mm'|'80mm'; is_pro?: boolean;
  receipt_font_size?: 'small'|'medium'|'large';
  receipt_show_address?: boolean;
  receipt_show_whatsapp?: boolean;
  receipt_show_tax?: boolean;
  receipt_show_cashier?: boolean;
  receipt_show_trx_id?: boolean;
  receipt_divider?: 'dash'|'equal'|'star'|'dot';
  receipt_custom_line1?: string;
  receipt_custom_line2?: string;
  currency?: string;
  email?: string;
  website?: string;
  created_at?: string; updated_at?: string;
}
export interface MenuItem {
  id: string; store_id: string; name: string; price: number;
  category: string; image_url?: string; description?: string;
  recipe?: RecipeItem[]; variants?: Variant[]; modifiers?: Modifier[];
  is_available: boolean; sort_order?: number;
  created_at?: string; updated_at?: string;
}
export interface RecipeItem { matId: string; qty: number; unit_reference?: string; note?: string; }
export interface Variant    { name: string; price: number; }
// A priced, multi-selectable add-on (e.g. "Extra Shot", "Oat Milk"). Single-select size
// lives in Variant; modifiers stack and each adds its price to the cart line.
export interface Modifier   { name: string; price: number; }
export interface CartItem extends MenuItem {
  qty: number; variantId?: string; _baseId?: string; note?: string; modifiers?: Modifier[];
}
export interface InventoryItem {
  id: string; store_id: string; name: string;
  stock: number; unit: string; min_stock: number;
  cost_per_unit: number;
  sku?: string | null | undefined;
  base_unit?: string | null | undefined;
  purchase_unit?: string | null | undefined;
  conversion_ratio?: number | null | undefined;
  is_active?: boolean;
  created_at?: string; updated_at?: string;
}
export interface InventoryItemUpdate {
  type: 'new' | 'edit' | 'add' | 'restock';
  id?: string;
  name: string;
  qty: string | number;
  cost: string | number;
  unit?: string | undefined;
  minStock?: string | number | undefined;
  sku?: string | undefined;
  purchaseUnit?: string | undefined;
  conversionRatio?: string | number | undefined;
  isActive?: boolean | undefined;
}
export interface StockUnitConversion {
  id: string;
  store_id: string;
  ingredient_id?: string | null;
  from_unit: string;
  to_unit: string;
  ratio: number;
  is_active: boolean;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}
export type OrderType = 'dine_in' | 'takeaway' | 'gofood' | 'grabfood' | 'shopeefood';

export interface OpenBillItem {
  id?: string;
  name: string;
  qty: number;
  price: number;
  menu_item_id?: string | null;
  note?: string | null;
  station?: KitchenStation | null;
  variant?: string | null;
  category?: string | null;
}

export interface OpenBill {
  id: string;
  store_id: string;
  table_number?: string | null;
  order_type: OrderType;
  customer_name?: string | null;
  pax: number;
  items: OpenBillItem[];
  subtotal: number;
  discount: number;
  discount_label?: string | null;
  tax: number;
  service_charge?: number;
  total: number;
  note?: string | null;
  cashier?: string | null;
  status: 'open' | 'paid' | 'cancelled' | 'merged';
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  inventory_id: string;
  name: string;
  qty: number;
  unit: string;
  cost_per_unit: number;
}

export interface PurchaseOrder {
  id: string;
  store_id: string;
  po_number: string;
  supplier_name: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  total_amount: number;
  notes?: string | null;
  ordered_at: string;
  received_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftClosing {
  id: string;
  store_id: string;
  cashier_id?: string | null;
  cashier_name: string;
  opened_at: string;
  closed_at: string;
  opening_cash: number;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  total_sales: number;
  total_non_cash: number;
  cash_in: number;
  cash_out: number;
  transactions_count: number;
  notes?: string | null;
  created_at: string;
}

export interface Transaction {
  id: string; store_id: string; date: string;
  items: TransactionItem[]; subtotal: number;
  discount: number; discount_label?: string|null;
  tax: number; service_charge?: number; total: number; cogs?: number;
  paid: number; change: number; method: 'Tunai'|'Transfer'|'QRIS';
  customer_name?: string|null;   // Nama pelanggan (optional)
  cashier?: string; note?: string|null;
  order_type?: OrderType;
  table_number?: string|null;
  pax?: number;
  open_bill_id?: string|null;
  is_void: boolean; void_reason?: string|null;
  void_at?: string|null; void_by?: string|null;
  sync_status?: 'synced' | 'pending' | 'syncing' | 'failed' | 'conflicted';
  sync_error?: string | null;
  local_only?: boolean;
  created_at?: string;
  kitchen_order?: KitchenOrder | null;
}
export interface TransactionItem {
  name:string;
  qty:number;
  price:number;
  subtotal:number;
  menu_item_id?: string;
  note?: string|null;
  station?: KitchenStation|null;
}
export type KitchenStation = 'kitchen' | 'bar' | 'dessert' | 'other';
export type KitchenOrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
export interface KitchenOrderItem {
  id: string;
  order_id: string;
  menu_item_id?: string | null;
  item_name: string;
  qty: number;
  note?: string | null;
  station: KitchenStation;
  item_status: KitchenOrderStatus;
  status_version: number;
  created_at: string;
  updated_at: string;
}
export interface KitchenOrder {
  id: string;
  store_id: string;
  transaction_id?: string | null;
  order_number: string;
  source: 'cashier' | 'waiter' | 'web' | 'app';
  customer_name?: string | null;
  table_number?: string | null;
  overall_status: KitchenOrderStatus;
  created_by?: string | null;
  created_by_name?: string | null;
  status_version: number;
  cancelled_reason?: string | null;
  created_at: string;
  updated_at: string;
  items: KitchenOrderItem[];
}
export type KitchenRealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';
export interface KitchenRealtimeEvent {
  id: string;
  type: 'order_created' | 'order_updated' | 'order_cancelled' | 'item_status_changed' | 'order_status_changed' | 'snapshot_required';
  store_id: string;
  order_id?: string | null;
  created_at: string;
  payload?: {
    order?: KitchenOrder | null;
    transactionId?: string;
    itemId?: string;
    reason?: string;
  } & Record<string, unknown>;
}
export interface Expense {
  id: string; store_id: string; date: string;
  description: string; amount: number; category: string;
  cashier?: string; source?: 'cashier'|'inventory'; created_at?: string;
}
export interface CashFlowEntry {
  id: string; store_id: string; date: string;
  type: 'in'|'out'; amount: number; description?: string; created_at?: string;
}
export interface CashRegister {
  id: string; store_id: string; date: string;
  amount: number; note?: string|null; opened_by: string; created_at?: string;
}
export interface Profile {
  id: string; username?: string; display_name?: string;
  email?: string; avatar_url?: string;
  role?: UserRole; permissions?: Permission[];
  account_status?: 'active' | 'inactive';
  owner_id?: string;
  assigned_store_id?: string;
  assigned_store_name?: string;
  assignment_status?: 'active' | 'inactive';
  tier?: string;       // 'pro' | 'basic' — kolom utama subscription state
  tier_expires_at?: string;
  is_pro?: boolean;    // kolom legacy (fallback)
  pro_plan?: string; pro_order_id?: string;
  pro_activated_at?: string; pro_expires_at?: string; created_at?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}
