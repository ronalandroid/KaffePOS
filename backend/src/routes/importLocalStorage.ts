/**
 * Local-storage migration import — moves a device's offline localStorage data
 * into the backend. Extracted from routes/misc.ts (same behaviour, own router).
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  withTransaction,
  ApiError,
  requirePermission,
  localStorageImportSchema,
  pickDefined,
  buildUpdateClause,
  assertStoreOwned,
} from '../core';
import type { PoolClient } from '../core/db';

const router = Router();

const ALLOWED_IMPORT_TABLES = new Set([
  'menu_items', 'inventory', 'transactions', 'expenses', 'cash_flow', 'store_accounts',
]);

async function countRowsForStore(client: PoolClient, table: string, storeId: string) {
  if (!ALLOWED_IMPORT_TABLES.has(table)) {
    throw new ApiError(400, `Tabel tidak diizinkan: ${table}`);
  }
  const result = await client.query(`select count(*)::int as count from public.${table} where store_id = $1`, [storeId]);
  return result.rows[0]?.count ?? 0;
}


router.post('/api/import/local-storage', requirePermission('can_manage_settings'), async (req, res, next) => {
  try {
    const payload = localStorageImportSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      await assertStoreOwned(client, payload.store_id, req.authUser!.id);

      const summary = {
        success: true,
        migrated: [] as string[],
        errors: [] as string[],
        skipped: [] as string[],
      };

      if (payload.store_settings) {
        const storeFields = pickDefined(payload.store_settings, [
          'store_name',
          'address',
          'whatsapp',
          'tax_percent',
          'receipt_header',
          'receipt_footer',
          'logo_url',
          'logo_base64',
          'logo_position',
          'logo_size',
          'show_logo_on_receipt',
          'currency',
          'tagline',
          'email',
          'website',
          'paper_width',
          'receipt_font_size',
          'receipt_show_address',
          'receipt_show_whatsapp',
          'receipt_show_tax',
          'receipt_show_cashier',
          'receipt_show_trx_id',
          'receipt_divider',
          'receipt_custom_line1',
          'receipt_custom_line2',
          'timezone',
        ]);
        if (Object.keys(storeFields).length > 0) {
          const { clause, values } = buildUpdateClause(storeFields);
          await client.query(
            `
              update public.stores
              set ${clause}, updated_at = now()
              where id = $${values.length + 1}
            `,
            [...values, payload.store_id],
          );
          summary.migrated.push('store_settings');
        }
      }

      if (payload.menu_items.length > 0) {
        const existing = await countRowsForStore(client, 'menu_items', payload.store_id);
        if (existing > 0) {
          summary.skipped.push('menu_items (destination not empty)');
        } else {
          for (const item of payload.menu_items) {
            await client.query(
              `
                insert into public.menu_items (
                  store_id, name, price, category, image_url, description, is_available, sort_order, recipe, variants
                ) values (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb
                )
              `,
              [
                payload.store_id,
                String(item.name || 'Unknown'),
                Math.max(0, Number(item.price || 0)),
                String(item.category || 'Coffee'),
                String(item.image_url || ''),
                String(item.description || ''),
                item.is_available ?? true,
                Number(item.sort_order || 0),
                JSON.stringify(Array.isArray(item.recipe) ? item.recipe : []),
                JSON.stringify(Array.isArray(item.variants) ? item.variants : []),
              ],
            );
          }
          summary.migrated.push(`menu_items (${payload.menu_items.length})`);
        }
      } else {
        summary.skipped.push('menu_items (empty)');
      }

      if (payload.inventory_items.length > 0) {
        const existing = await countRowsForStore(client, 'inventory', payload.store_id);
        if (existing > 0) {
          summary.skipped.push('inventory (destination not empty)');
        } else {
          for (const item of payload.inventory_items) {
            await client.query(
              `
                insert into public.inventory (
                  store_id, name, stock, unit, min_stock, cost_per_unit
                ) values (
                  $1, $2, $3, $4, $5, $6
                )
              `,
              [
                payload.store_id,
                String(item.name || 'Unknown'),
                Number(item.stock || 0),
                String(item.unit || 'pcs'),
                Number(item.min_stock || 5),
                Number(item.cost_per_unit || 0),
              ],
            );
          }
          summary.migrated.push(`inventory (${payload.inventory_items.length})`);
        }
      } else {
        summary.skipped.push('inventory (empty)');
      }

      if (payload.transactions.length > 0) {
        const existing = await countRowsForStore(client, 'transactions', payload.store_id);
        if (existing > 0) {
          summary.skipped.push('transactions (destination not empty)');
        } else {
          let invalidIdCount = 0;
          for (const trx of payload.transactions) {
            // The id is a client-supplied text primary key that other tables FK-reference and
            // reports read. Only accept well-formed UUIDs (all real transactions use randomUUID)
            // so a crafted import can't seed arbitrary identifiers into the transactions table.
            if (!z.string().uuid().safeParse(String(trx.id)).success) {
              invalidIdCount += 1;
              continue;
            }
            await client.query(
              `
                insert into public.transactions (
                  id, store_id, date, items, subtotal, discount, discount_label, tax, total, cogs, paid, change,
                  method, cashier, note, is_void, void_reason, void_at, void_by
                ) values (
                  $1, $2, $3::timestamptz, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamptz, $19
                )
                on conflict (id) do nothing
              `,
              [
                String(trx.id),
                payload.store_id,
                String(trx.date || new Date().toISOString()),
                JSON.stringify(Array.isArray(trx.items) ? trx.items : []),
                Number(trx.subtotal || 0),
                Number(trx.discount || 0),
                trx.discount_label ?? null,
                Number(trx.tax || 0),
                Number(trx.total || 0),
                Number(trx.cogs || 0),
                Number(trx.paid || 0),
                Number(trx.change || 0),
                String(trx.method || 'Tunai'),
                String(trx.cashier || ''),
                trx.note ?? null,
                Boolean(trx.is_void),
                trx.void_reason ?? null,
                trx.void_at ?? null,
                trx.void_by ?? null,
              ],
            );
          }
          const importedCount = payload.transactions.length - invalidIdCount;
          summary.migrated.push(`transactions (${importedCount})`);
          if (invalidIdCount > 0) {
            summary.skipped.push(`transactions: ${invalidIdCount} with invalid id`);
          }
        }
      } else {
        summary.skipped.push('transactions (empty)');
      }

      if (payload.expenses.length > 0) {
        const existing = await countRowsForStore(client, 'expenses', payload.store_id);
        if (existing > 0) {
          summary.skipped.push('expenses (destination not empty)');
        } else {
          for (const expense of payload.expenses) {
            await client.query(
              `
                insert into public.expenses (
                  store_id, date, description, amount, category, cashier, source
                ) values (
                  $1, $2::timestamptz, $3, $4, $5, $6, $7
                )
              `,
              [
                payload.store_id,
                String(expense.date || new Date().toISOString()),
                String(expense.description || ''),
                Number(expense.amount || 0),
                String(expense.category || 'Operasional'),
                expense.cashier ?? null,
                String(expense.source || 'cashier'),
              ],
            );
          }
          summary.migrated.push(`expenses (${payload.expenses.length})`);
        }
      } else {
        summary.skipped.push('expenses (empty)');
      }

      if (payload.cash_flow.length > 0) {
        const existing = await countRowsForStore(client, 'cash_flow', payload.store_id);
        if (existing > 0) {
          summary.skipped.push('cash_flow (destination not empty)');
        } else {
          for (const entry of payload.cash_flow) {
            await client.query(
              `
                insert into public.cash_flow (
                  store_id, date, type, amount, description, cashier
                ) values (
                  $1, $2::timestamptz, $3, $4, $5, $6
                )
              `,
              [
                payload.store_id,
                String(entry.date || new Date().toISOString()),
                String(entry.type === 'in' ? 'in' : 'out'),
                Number(entry.amount || 0),
                entry.description ?? null,
                entry.cashier ?? null,
              ],
            );
          }
          summary.migrated.push(`cash_flow (${payload.cash_flow.length})`);
        }
      } else {
        summary.skipped.push('cash_flow (empty)');
      }

      if (payload.store_accounts.length > 0) {
        const existing = await countRowsForStore(client, 'store_accounts', payload.store_id);
        if (existing > 0) {
          summary.skipped.push('store_accounts (destination not empty)');
        } else {
          for (const account of payload.store_accounts) {
            await client.query(
              `
                insert into public.store_accounts (
                  store_id, username, password_hash, role, is_active
                ) values (
                  $1, $2, $3, $4, $5
                )
                on conflict (store_id, username) do update
                set
                  password_hash = excluded.password_hash,
                  role = excluded.role,
                  is_active = excluded.is_active
              `,
              [
                payload.store_id,
                String(account.username || 'kasir'),
                String(account.password_hash || ''),
                String(account.role === 'owner' ? 'owner' : 'kasir'),
                account.is_active ?? true,
              ],
            );
          }
          summary.migrated.push(`store_accounts (${payload.store_accounts.length})`);
        }
      }

      return summary;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});


export default router;
