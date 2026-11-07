/**
 * Inventory, unit conversions, and bulk import routes.
 * Extracted from monolith index.ts — exact same behavior.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  withTransaction,
  ApiError,
  requirePermission,
  assertStoreOwned,
  normalizeInventory,
  normalizeStockUnitConversion,
  pickDefined,
  buildUpdateClause,
  toNumber,
  inventoryColumns,
  stockUnitConversionColumns,
  menuColumns,
} from '../core';
import {
  validateStockBulkImportRows,
  type StockBulkImportMode,
  type StockBulkImportRow,
} from '../lib/stockImport';
import { calculateStockAdjustmentDelta, stockAdjustmentInputSchema } from '../lib/stockAdjustment';
import { InventoryService } from '../services/InventoryService';

const router = Router();
const storeIdSchema = z.string().uuid();

const inventoryWriteSchema = z.object({
  id: z.string().uuid().optional(),
  store_id: z.string().uuid(),
  name: z.string().trim().min(1),
  sku: z.string().trim().optional().nullable(),
  stock: z.number().min(0, 'Stok tidak boleh negatif.'),
  unit: z.string().trim().min(1).default('pcs'),
  base_unit: z.string().trim().optional().nullable(),
  purchase_unit: z.string().trim().optional().nullable(),
  conversion_ratio: z.number().positive().optional().nullable(),
  min_stock: z.number().nonnegative().optional(),
  cost_per_unit: z.number().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

const stockUnitConversionWriteSchema = z.object({
  id: z.string().uuid().optional(),
  store_id: z.string().uuid(),
  ingredient_id: z.string().uuid().optional().nullable(),
  from_unit: z.string().trim().min(1),
  to_unit: z.string().trim().min(1),
  ratio: z.number().positive(),
  is_active: z.boolean().optional(),
});

const stockBulkImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  kind: z.enum(['ingredient', 'conversion', 'product', 'recipe']).or(z.literal('unknown')),
  name: z.string().trim().optional(),
  stock: z.number().optional(),
  base_unit: z.string().trim().optional(),
  purchase_unit: z.string().trim().optional(),
  min_stock: z.number().optional(),
  total_cost: z.number().optional(),
  sku: z.string().trim().optional(),
  from_unit: z.string().trim().optional(),
  to_unit: z.string().trim().optional(),
  ratio: z.number().optional(),
  product_name: z.string().trim().optional(),
  ingredient_name: z.string().trim().optional(),
  qty_per_serving: z.number().optional(),
  unit_reference: z.string().trim().optional(),
  price: z.number().optional(),
  category: z.string().trim().optional(),
});

const stockBulkImportCommitSchema = z.object({
  store_id: z.string().uuid(),
  mode: z.enum(['create_only', 'update_existing', 'upsert']).default('create_only'),
  rows: z.array(stockBulkImportRowSchema).min(1).max(1000),
});

router.get('/api/inventory', async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const items = await InventoryService.listInventory(storeId, req.authUser!.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/api/inventory', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const payload = inventoryWriteSchema.parse(req.body);
    const item = await InventoryService.createInventoryItem(payload, req.authUser!.id);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.get('/api/inventory/conversions', async (req, res, next) => {
  try {
    const storeId = storeIdSchema.parse(req.query.storeId);
    const items = await InventoryService.listUnitConversions(storeId, req.authUser!.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/api/inventory/conversions', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const payload = stockUnitConversionWriteSchema.parse(req.body);
    const item = await InventoryService.createUnitConversion(payload, req.authUser!.id);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.patch('/api/inventory/conversions/:id', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const conversionId = storeIdSchema.parse(req.params.id);
    const payload = pickDefined(req.body as Record<string, unknown>, [
      'ingredient_id',
      'from_unit',
      'to_unit',
      'ratio',
      'is_active',
    ]);
    const { clause, values } = buildUpdateClause(payload);

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `
          select c.id
          from public.inventory_unit_conversions c
          join public.stores s on s.id = c.store_id
          where c.id = $1 and s.owner_id = $2
          limit 1
        `,
        [conversionId, req.authUser!.id],
      );
      if (!existing.rows[0]) {
        throw new ApiError(404, 'Konversi satuan tidak ditemukan.');
      }

      return client.query(
        `
          update public.inventory_unit_conversions
          set ${clause}, updated_at = now()
          where id = $${values.length + 1}
          returning ${stockUnitConversionColumns}
        `,
        [...values, conversionId],
      );
    });

    res.json(normalizeStockUnitConversion(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete('/api/inventory/conversions/:id', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const conversionId = storeIdSchema.parse(req.params.id);
    await withTransaction(async (client) => {
      const result = await client.query(
        `
          delete from public.inventory_unit_conversions c
          using public.stores s
          where c.store_id = s.id
            and c.id = $1
            and s.owner_id = $2
          returning c.id
        `,
        [conversionId, req.authUser!.id],
      );
      if (!result.rows[0]) {
        throw new ApiError(404, 'Konversi satuan tidak ditemukan.');
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/api/inventory/adjustments', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const payload = stockAdjustmentInputSchema.parse(req.body);
    const updatedInventory = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, req.authUser!.id);

      const existing = await client.query(
        `
          select ${inventoryColumns}
          from public.inventory
          where id = $1 and store_id = $2
          for update
        `,
        [payload.inventory_id, payload.store_id],
      );

      const row = existing.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        throw new ApiError(404, 'Bahan baku tidak ditemukan. Muat ulang halaman lalu coba lagi.');
      }

      const stockBefore = toNumber(row.stock);
      const countedStock = payload.counted_stock;
      const delta = calculateStockAdjustmentDelta({ currentStock: stockBefore, countedStock });

      const updated = await client.query(
        `
          update public.inventory
          set stock = $1,
              updated_at = now()
          where id = $2 and store_id = $3
          returning ${inventoryColumns}
        `,
        [countedStock, payload.inventory_id, payload.store_id],
      );

      const adjustment = await client.query(
        `
          insert into public.inventory_adjustments (
            store_id,
            inventory_id,
            counted_stock,
            stock_before,
            qty_delta,
            reason,
            note,
            adjusted_by,
            adjusted_by_email
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
          returning id
        `,
        [
          payload.store_id,
          payload.inventory_id,
          countedStock,
          stockBefore,
          delta,
          payload.reason,
          payload.note ?? null,
          req.authUser!.id,
          req.authUser!.email ?? null,
        ],
      );

      await client.query(
        `
          insert into public.transaction_inventory_audit (
            store_id,
            transaction_id,
            inventory_id,
            action,
            qty_delta,
            stock_before,
            stock_after
          ) values ($1, $2, $3, 'opname', $4, $5, $6)
        `,
        [
          payload.store_id,
          `OPNAME:${String(adjustment.rows[0].id)}`,
          payload.inventory_id,
          delta,
          stockBefore,
          countedStock,
        ],
      );

      return updated.rows[0];
    });

    res.status(201).json(normalizeInventory(updatedInventory));
  } catch (error) {
    next(error);
  }
});

router.post(
  '/api/inventory/bulk-import/commit',
  requirePermission('can_manage_inventory'),
  requirePermission('can_manage_products'),
  async (req, res, next) => {
    try {
      const payload = stockBulkImportCommitSchema.parse(req.body);
      const result = await withTransaction(async (client) => {
        await assertStoreOwned(client, payload.store_id, req.authUser!.id);

        const normalizeKey = (value?: string | null) => value?.trim().toLowerCase() || '';
        const inventoryResult = await client.query(
          `select ${inventoryColumns} from public.inventory where store_id = $1 order by created_at asc for update`,
          [payload.store_id],
        );
        const menuResult = await client.query(
          `select ${menuColumns} from public.menu_items where store_id = $1 order by created_at asc for update`,
          [payload.store_id],
        );
        const inventoryByName = new Map<string, Record<string, unknown>>();
        const menuByName = new Map<string, Record<string, unknown>>();

        for (const row of inventoryResult.rows) {
          inventoryByName.set(normalizeKey(row.name), row);
        }
        for (const row of menuResult.rows) {
          menuByName.set(normalizeKey(row.name), row);
        }
        const conversionLookupResult = await client.query(
          `
            select
              c.id,
              c.store_id,
              c.ingredient_id,
              c.from_unit,
              c.to_unit,
              c.ratio,
              c.is_active,
              c.created_at,
              c.updated_at,
              i.name as ingredient_name
            from public.inventory_unit_conversions c
            left join public.inventory i on i.id = c.ingredient_id and i.store_id = c.store_id
            where c.store_id = $1
            for update of c
          `,
          [payload.store_id],
        );

        const validation = validateStockBulkImportRows(payload.rows as StockBulkImportRow[], {
          existingIngredientNames: inventoryResult.rows.map((row: Record<string, unknown>) => String(row.name ?? '')),
          existingProductNames: menuResult.rows.map((row: Record<string, unknown>) => String(row.name ?? '')),
          existingConversions: conversionLookupResult.rows.map((row: Record<string, unknown>) => ({
            ingredientName: row.ingredient_name == null ? null : String(row.ingredient_name),
            fromUnit: String(row.from_unit ?? ''),
            toUnit: String(row.to_unit ?? ''),
          })),
          mode: payload.mode as StockBulkImportMode,
        });

        if (validation.errors.length > 0) {
          return { ok: false as const, validation };
        }

        const committed = { ingredients: 0, conversions: 0, products: 0, recipes: 0 };
        const upsertAllowed = payload.mode === 'upsert';
        const createAllowed = payload.mode === 'create_only' || upsertAllowed;
        const updateAllowed = payload.mode === 'update_existing' || upsertAllowed;

        // Ingredients — validation rejects duplicate names within one import, so each row
        // maps to exactly one update or insert. Two UNNEST batches replace up to 1000
        // sequential round-trips (the old per-row loop was an N+1 on the import hot path).
        type IngredientWrite = { id?: string; name: string; sku: string | null; stock: number; baseUnit: string; purchaseUnit: string; minStock: number; unitCost: number };
        const ingredientUpdates: IngredientWrite[] = [];
        const ingredientInserts: IngredientWrite[] = [];
        for (const row of validation.validRows.filter((entry) => entry.kind === 'ingredient')) {
          const key = normalizeKey(row.name);
          const existing = inventoryByName.get(key);
          const stock = toNumber(row.stock);
          const minStock = Math.max(0, toNumber(row.min_stock ?? 5));
          const totalCost = Math.max(0, toNumber(row.total_cost));
          const unitCost = stock > 0 ? totalCost / stock : 0;
          const baseUnit = row.base_unit || 'pcs';
          const purchaseUnit = row.purchase_unit || baseUnit;
          const write: IngredientWrite = { name: String(row.name ?? ''), sku: row.sku ?? null, stock, baseUnit, purchaseUnit, minStock, unitCost };
          if (existing && updateAllowed) {
            ingredientUpdates.push({ ...write, id: String(existing.id) });
          } else if (!existing && createAllowed) {
            ingredientInserts.push(write);
          }
        }

        if (ingredientUpdates.length > 0) {
          const updated = await client.query(
            `
              update public.inventory inv
              set name = v.w_name,
                  sku = v.w_sku,
                  stock = v.w_stock,
                  unit = v.w_base_unit,
                  base_unit = v.w_base_unit,
                  purchase_unit = v.w_purchase_unit,
                  conversion_ratio = 1,
                  min_stock = v.w_min_stock,
                  cost_per_unit = v.w_unit_cost,
                  is_active = true,
                  updated_at = now()
              from unnest(
                $2::uuid[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::text[], $8::numeric[], $9::numeric[]
              ) as v(w_id, w_name, w_sku, w_stock, w_base_unit, w_purchase_unit, w_min_stock, w_unit_cost)
              where inv.id = v.w_id and inv.store_id = $1
              returning ${inventoryColumns}
            `,
            [
              payload.store_id,
              ingredientUpdates.map((w) => w.id),
              ingredientUpdates.map((w) => w.name),
              ingredientUpdates.map((w) => w.sku),
              ingredientUpdates.map((w) => w.stock),
              ingredientUpdates.map((w) => w.baseUnit),
              ingredientUpdates.map((w) => w.purchaseUnit),
              ingredientUpdates.map((w) => w.minStock),
              ingredientUpdates.map((w) => w.unitCost),
            ],
          );
          for (const rowOut of updated.rows) inventoryByName.set(normalizeKey(rowOut.name), rowOut);
          committed.ingredients += updated.rows.length;
        }

        if (ingredientInserts.length > 0) {
          const inserted = await client.query(
            `
              insert into public.inventory (
                id, store_id, name, sku, stock, unit, base_unit, purchase_unit, conversion_ratio, min_stock, cost_per_unit, is_active
              )
              select gen_random_uuid(), $1, v.w_name, v.w_sku, v.w_stock, v.w_base_unit, v.w_base_unit, v.w_purchase_unit, 1, v.w_min_stock, v.w_unit_cost, true
              from unnest(
                $2::text[], $3::text[], $4::numeric[], $5::text[], $6::text[], $7::numeric[], $8::numeric[]
              ) as v(w_name, w_sku, w_stock, w_base_unit, w_purchase_unit, w_min_stock, w_unit_cost)
              returning ${inventoryColumns}
            `,
            [
              payload.store_id,
              ingredientInserts.map((w) => w.name),
              ingredientInserts.map((w) => w.sku),
              ingredientInserts.map((w) => w.stock),
              ingredientInserts.map((w) => w.baseUnit),
              ingredientInserts.map((w) => w.purchaseUnit),
              ingredientInserts.map((w) => w.minStock),
              ingredientInserts.map((w) => w.unitCost),
            ],
          );
          for (const rowOut of inserted.rows) inventoryByName.set(normalizeKey(rowOut.name), rowOut);
          committed.ingredients += inserted.rows.length;
        }

        // Products — same batching as ingredients (names unique per import).
        type ProductWrite = { id?: string; name: string; price: number; category: string };
        const productUpdates: ProductWrite[] = [];
        const productInserts: ProductWrite[] = [];
        for (const row of validation.validRows.filter((entry) => entry.kind === 'product')) {
          const key = normalizeKey(row.name);
          const existing = menuByName.get(key);
          const price = Math.round(toNumber(row.price));
          const category = row.category || 'Coffee';
          const write: ProductWrite = { name: String(row.name ?? ''), price, category };
          if (existing && updateAllowed) {
            productUpdates.push({ ...write, id: String(existing.id) });
          } else if (!existing && createAllowed) {
            productInserts.push(write);
          }
        }

        if (productUpdates.length > 0) {
          const updated = await client.query(
            `
              update public.menu_items m
              set name = v.w_name, price = v.w_price, category = v.w_category, is_available = true, updated_at = now()
              from unnest($2::uuid[], $3::text[], $4::numeric[], $5::text[]) as v(w_id, w_name, w_price, w_category)
              where m.id = v.w_id and m.store_id = $1
              returning ${menuColumns}
            `,
            [
              payload.store_id,
              productUpdates.map((w) => w.id),
              productUpdates.map((w) => w.name),
              productUpdates.map((w) => w.price),
              productUpdates.map((w) => w.category),
            ],
          );
          for (const rowOut of updated.rows) menuByName.set(normalizeKey(rowOut.name), rowOut);
          committed.products += updated.rows.length;
        }

        if (productInserts.length > 0) {
          const inserted = await client.query(
            `
              insert into public.menu_items (
                id, store_id, name, price, category, is_available, sort_order, recipe, variants
              )
              select gen_random_uuid(), $1, v.w_name, v.w_price, v.w_category, true, 0, '[]'::jsonb, '[]'::jsonb
              from unnest($2::text[], $3::numeric[], $4::text[]) as v(w_name, w_price, w_category)
              returning ${menuColumns}
            `,
            [
              payload.store_id,
              productInserts.map((w) => w.name),
              productInserts.map((w) => w.price),
              productInserts.map((w) => w.category),
            ],
          );
          for (const rowOut of inserted.rows) menuByName.set(normalizeKey(rowOut.name), rowOut);
          committed.products += inserted.rows.length;
        }

        const conversionKey = (ingredientId: unknown, fromUnit?: string | null, toUnit?: string | null) =>
          `${ingredientId ? String(ingredientId) : 'global'}:${normalizeKey(fromUnit)}:${normalizeKey(toUnit)}`;
        const conversionsByKey = new Map<string, Record<string, unknown>>();
        for (const row of conversionLookupResult.rows) {
          conversionsByKey.set(conversionKey(row.ingredient_id, String(row.from_unit ?? ''), String(row.to_unit ?? '')), row);
        }

        for (const row of validation.validRows.filter((entry) => entry.kind === 'conversion')) {
          const ingredient = row.ingredient_name ? inventoryByName.get(normalizeKey(row.ingredient_name)) : null;
          const key = conversionKey(ingredient?.id ?? null, row.from_unit, row.to_unit);
          const existing = conversionsByKey.get(key);

          if (existing && payload.mode === 'create_only') {
            throw new ApiError(422, 'Konversi satuan sudah ada. Pilih mode update/upsert jika ingin memperbarui.');
          }

          if (existing && updateAllowed) {
            const updated = await client.query(
              `
                update public.inventory_unit_conversions
                set ratio = $1,
                    is_active = true,
                    updated_at = now()
                where id = $2 and store_id = $3
                returning ${stockUnitConversionColumns}
              `,
              [toNumber(row.ratio), existing.id, payload.store_id],
            );
            conversionsByKey.set(key, updated.rows[0]);
            committed.conversions += 1;
            continue;
          }

          if (!existing && payload.mode === 'update_existing') {
            throw new ApiError(422, 'Konversi satuan belum ada. Pilih mode upsert jika ingin membuat data baru.');
          }

          const inserted = await client.query(
            `
              insert into public.inventory_unit_conversions (
                id, store_id, ingredient_id, from_unit, to_unit, ratio, is_active
              ) values (
                gen_random_uuid(), $1, $2, $3, $4, $5, true
              )
              returning ${stockUnitConversionColumns}
            `,
            [
              payload.store_id,
              ingredient?.id ?? null,
              row.from_unit,
              row.to_unit,
              toNumber(row.ratio),
            ],
          );
          conversionsByKey.set(key, inserted.rows[0]);
          committed.conversions += 1;
        }

        // Recipes — rows for the same product build on each other in row order, so fold
        // them in-memory first (same filter-then-append semantics as the old loop), then
        // flush one batched update covering every touched product.
        const pendingRecipes = new Map<string, Record<string, unknown>[]>();
        for (const row of validation.validRows.filter((entry) => entry.kind === 'recipe')) {
          const product = menuByName.get(normalizeKey(row.product_name));
          const ingredient = inventoryByName.get(normalizeKey(row.ingredient_name));
          if (!product || !ingredient) {
            throw new ApiError(400, 'Produk atau bahan resep tidak ditemukan saat import diproses.');
          }

          const productId = String(product.id);
          const currentRecipe = pendingRecipes.get(productId)
            ?? (Array.isArray(product.recipe) ? (product.recipe as Record<string, unknown>[]) : []);
          const ingredientId = String(ingredient.id);
          const nextRecipe = [
            ...currentRecipe.filter((line: Record<string, unknown>) => String(line?.matId ?? '') !== ingredientId),
            {
              matId: ingredientId,
              qty: toNumber(row.qty_per_serving),
              unit_reference: row.unit_reference || String(ingredient.base_unit ?? ingredient.unit ?? 'unit'),
            },
          ];
          pendingRecipes.set(productId, nextRecipe);
          committed.recipes += 1;
        }

        if (pendingRecipes.size > 0) {
          const recipeProductIds = [...pendingRecipes.keys()];
          const updated = await client.query(
            `
              update public.menu_items m
              set recipe = v.w_recipe::jsonb, updated_at = now()
              from unnest($2::uuid[], $3::text[]) as v(w_id, w_recipe)
              where m.id = v.w_id and m.store_id = $1
              returning ${menuColumns}
            `,
            [
              payload.store_id,
              recipeProductIds,
              recipeProductIds.map((id) => JSON.stringify(pendingRecipes.get(id))),
            ],
          );
          for (const rowOut of updated.rows) menuByName.set(normalizeKey(rowOut.name), rowOut);
        }

        return {
          ok: true as const,
          summary: validation.summary,
          committed,
        };
      });

      if (!result.ok) {
        res.status(422).json({
          message: 'Import stok belum valid. Periksa baris yang ditandai.',
          errors: result.validation.errors,
          summary: result.validation.summary,
        });
        return;
      }

      res.status(201).json({
        success: true,
        summary: result.summary,
        committed: result.committed,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.patch('/api/inventory/:id', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const itemId = storeIdSchema.parse(req.params.id);
    const payload = pickDefined(req.body as Record<string, unknown>, [
      'name',
      'sku',
      'stock',
      'unit',
      'base_unit',
      'purchase_unit',
      'conversion_ratio',
      'min_stock',
      'cost_per_unit',
      'is_active',
    ]);
    const { clause, values } = buildUpdateClause(payload);

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `
          select i.id
          from public.inventory i
          join public.stores s on s.id = i.store_id
          where i.id = $1 and s.owner_id = $2
          limit 1
        `,
        [itemId, req.authUser!.id],
      );
      if (!existing.rows[0]) {
        throw new ApiError(404, 'Inventaris tidak ditemukan.');
      }

      return client.query(
        `
          update public.inventory
          set ${clause}, updated_at = now()
          where id = $${values.length + 1}
          returning ${inventoryColumns}
        `,
        [...values, itemId],
      );
    });

    res.json(normalizeInventory(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete('/api/inventory/:id', requirePermission('can_manage_inventory'), async (req, res, next) => {
  try {
    const itemId = storeIdSchema.parse(req.params.id);
    await withTransaction(async (client) => {
      const result = await client.query(
        `
          delete from public.inventory i
          using public.stores s
          where i.store_id = s.id
            and i.id = $1
            and s.owner_id = $2
          returning i.id
        `,
        [itemId, req.authUser!.id],
      );
      if (!result.rows[0]) {
        throw new ApiError(404, 'Inventaris tidak ditemukan.');
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
