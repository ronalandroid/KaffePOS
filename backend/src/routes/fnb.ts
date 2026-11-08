import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../core';
import { FnbService } from '../services/FnbService';

const router = Router();
const storeIdSchema = z.string().uuid();

const openBillItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
  menu_item_id: z.string().uuid().optional().nullable(),
  note: z.string().trim().optional().nullable(),
  station: z.enum(['kitchen', 'bar', 'dessert', 'other']).optional().nullable(),
  variant: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
});

const upsertOpenBillSchema = z.object({
  id: z.string().uuid().optional(),
  store_id: z.string().uuid(),
  table_number: z.string().trim().optional().nullable(),
  order_type: z.enum(['dine_in', 'takeaway', 'gofood', 'grabfood', 'shopeefood']).default('dine_in'),
  customer_name: z.string().trim().optional().nullable(),
  pax: z.number().int().positive().default(1),
  items: z.array(openBillItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  discount_label: z.string().trim().optional().nullable(),
  tax: z.number().nonnegative().default(0),
  service_charge: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  note: z.string().trim().optional().nullable(),
  cashier: z.string().trim().optional().nullable(),
});

const updateOpenBillSchema = z.object({
  store_id: z.string().uuid(),
  table_number: z.string().trim().optional().nullable(),
  order_type: z.enum(['dine_in', 'takeaway', 'gofood', 'grabfood', 'shopeefood']).optional(),
  customer_name: z.string().trim().optional().nullable(),
  pax: z.number().int().positive().optional(),
  items: z.array(openBillItemSchema).optional(),
  subtotal: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  discount_label: z.string().trim().optional().nullable(),
  tax: z.number().nonnegative().optional(),
  service_charge: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  note: z.string().trim().optional().nullable(),
  status: z.enum(['open', 'paid', 'cancelled', 'merged']).optional(),
});

const purchaseOrderItemSchema = z.object({
  inventory_id: z.string().uuid(),
  name: z.string().trim().min(1),
  qty: z.number().positive(),
  unit: z.string().trim().min(1),
  cost_per_unit: z.number().nonnegative(),
});

const createPurchaseOrderSchema = z.object({
  id: z.string().uuid().optional(),
  store_id: z.string().uuid(),
  po_number: z.string().trim().min(1),
  supplier_name: z.string().trim().min(1),
  status: z.enum(['draft', 'ordered', 'received', 'cancelled']).default('ordered'),
  items: z.array(purchaseOrderItemSchema).min(1),
  total_amount: z.number().nonnegative(),
  notes: z.string().trim().optional().nullable(),
});

const createShiftClosingSchema = z.object({
  id: z.string().uuid().optional(),
  store_id: z.string().uuid(),
  cashier_name: z.string().trim().min(1),
  opened_at: z.string().datetime().optional(),
  opening_cash: z.number().nonnegative(),
  expected_cash: z.number(),
  actual_cash: z.number().nonnegative(),
  variance: z.number(),
  total_sales: z.number().nonnegative().default(0),
  total_non_cash: z.number().nonnegative().default(0),
  cash_in: z.number().nonnegative().default(0),
  cash_out: z.number().nonnegative().default(0),
  transactions_count: z.number().int().nonnegative().default(0),
  notes: z.string().trim().optional().nullable(),
});

// ── Open Bills & Table Management (pos-order-service) ────────────
router.get('/api/fnb/open-bills', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const items = await FnbService.listOpenBills(storeId, req.authUser!.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/api/fnb/open-bills', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = upsertOpenBillSchema.parse(req.body);
    const item = await FnbService.upsertOpenBill(payload, req.authUser!.id);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.patch('/api/fnb/open-bills/:id', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const billId = storeIdSchema.parse(req.params.id);
    const payload = updateOpenBillSchema.parse(req.body);
    const item = await FnbService.updateOpenBill(billId, payload, req.authUser!.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// ── Purchase Orders & Stock Receiving (inventory-po-service) ─────
router.get('/api/fnb/purchase-orders', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const items = await FnbService.listPurchaseOrders(storeId, req.authUser!.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/api/fnb/purchase-orders', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const payload = createPurchaseOrderSchema.parse(req.body);
    const item = await FnbService.createPurchaseOrder(payload, {
      id: req.authUser!.id,
      email: req.authUser!.email ?? null,
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.post('/api/fnb/purchase-orders/:id/receive', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const poId = storeIdSchema.parse(req.params.id);
    const body = z.object({ store_id: z.string().uuid() }).parse(req.body);
    const item = await FnbService.receivePurchaseOrder(poId, body.store_id, req.authUser!.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// ── Shift Closings & Cash Drawer Audit (pos-order-service) ───────
router.get('/api/fnb/shift-closings', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const items = await FnbService.listShiftClosings(storeId, req.authUser!.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/api/fnb/shift-closings', requirePermission('can_use_pos'), async (req, res, next) => {
  try {
    const payload = createShiftClosingSchema.parse(req.body);
    const item = await FnbService.createShiftClosing(payload, req.authUser!.id);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

export default router;
