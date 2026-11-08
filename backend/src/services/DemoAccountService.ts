/**
 * DemoAccountService — Self-Healing Demo Account Provisioner.
 *
 * Ensures that KaffePOS demo accounts (Owner Signature Pro & Cashier POS)
 * are always active, verified, unlocked, and populated with realistic F&B data
 * (Menu, Paket Kombo, Inventory, Open Bill on Meja 03, and Supplier PO).
 */
import bcrypt from 'bcryptjs';
import type { PoolClient } from '../core';

export const DEMO_OWNER_ID = '00000000-0000-4000-8000-00000000de01';
export const DEMO_CASHIER_ID = '00000000-0000-4000-8000-00000000de02';
export const DEMO_STORE_ID = '00000000-0000-4000-8000-00000000de03';

export const DEMO_OWNER_EMAIL = 'demo@kaffepos.my.id';
export const DEMO_CASHIER_EMAIL = 'kasir@kaffepos.my.id';
export const DEMO_DEFAULT_PASSWORD = 'DemoPassword123';

let cachedDemoPasswordHash: string | null = null;

async function getDemoPasswordHash(): Promise<string> {
  if (!cachedDemoPasswordHash) {
    cachedDemoPasswordHash = await bcrypt.hash(DEMO_DEFAULT_PASSWORD, 10);
  }
  return cachedDemoPasswordHash;
}

export function isDemoAccountEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === DEMO_OWNER_EMAIL || normalized === DEMO_CASHIER_EMAIL;
}

export async function ensureDemoAccountsSeeded(client: PoolClient): Promise<void> {
  const passwordHash = await getDemoPasswordHash();

  // Prevent email constraint collisions from older/manual records
  await client.query(
    `delete from public.app_auth_credentials where email in ($1, $2) and user_id not in ($3, $4)`,
    [DEMO_OWNER_EMAIL, DEMO_CASHIER_EMAIL, DEMO_OWNER_ID, DEMO_CASHIER_ID],
  );
  await client.query(
    `delete from public.profiles where email in ($1, $2) and id not in ($3, $4)`,
    [DEMO_OWNER_EMAIL, DEMO_CASHIER_EMAIL, DEMO_OWNER_ID, DEMO_CASHIER_ID],
  );

  // 1. Upsert Demo Owner Profile (Signature Pro)
  await client.query(
    `
      insert into public.profiles (
        id, username, display_name, email, role, account_status,
        tier, is_pro, pro_plan, pro_activated_at, pro_expires_at, updated_at
      ) values (
        $1, 'kaffepos_demo_owner', 'KaffePOS Flagship Roastery', $2, 'owner_admin', 'active',
        'pro', true, 'signature', now(), now() + interval '365 days', now()
      )
      on conflict (id) do update set
        display_name = excluded.display_name,
        email = excluded.email,
        role = 'owner_admin',
        account_status = 'active',
        tier = 'pro',
        is_pro = true,
        pro_plan = 'signature',
        pro_expires_at = now() + interval '365 days',
        updated_at = now()
    `,
    [DEMO_OWNER_ID, DEMO_OWNER_EMAIL],
  );

  // 2. Upsert Demo Cashier Profile
  await client.query(
    `
      insert into public.profiles (
        id, username, display_name, email, role, account_status,
        tier, is_pro, updated_at
      ) values (
        $1, 'kaffepos_demo_kasir', 'Rina (Barista & Kasir Demo)', $2, 'cashier', 'active',
        'pro', true, now()
      )
      on conflict (id) do update set
        display_name = excluded.display_name,
        email = excluded.email,
        role = 'cashier',
        account_status = 'active',
        updated_at = now()
    `,
    [DEMO_CASHIER_ID, DEMO_CASHIER_EMAIL],
  );

  // 3. Upsert Verified Auth Credentials for Owner & Cashier
  await client.query(
    `
      insert into public.app_auth_credentials (
        user_id, email, password_hash, email_verified_at, updated_at
      ) values
        ($1, $2, $3, now(), now()),
        ($4, $5, $3, now(), now())
      on conflict (user_id) do update set
        email = excluded.email,
        password_hash = excluded.password_hash,
        email_verified_at = coalesce(public.app_auth_credentials.email_verified_at, now()),
        updated_at = now()
    `,
    [DEMO_OWNER_ID, DEMO_OWNER_EMAIL, passwordHash, DEMO_CASHIER_ID, DEMO_CASHIER_EMAIL],
  );

  // 4. Upsert Flagship Demo Store
  await client.query(
    `
      insert into public.stores (
        id, owner_id, store_name, address, whatsapp, tax_percent,
        receipt_header, receipt_footer
      ) values (
        $1, $2, 'KaffePOS Flagship Roastery',
        'Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan',
        '081288889999', 10,
        'KaffePOS Flagship Roastery • Specialty Coffee & Kitchen',
        'Terima kasih telah berkunjung! IG: @kaffepos.id'
      )
      on conflict (id) do update set
        owner_id = excluded.owner_id,
        store_name = excluded.store_name
    `,
    [DEMO_STORE_ID, DEMO_OWNER_ID],
  );

  // 5. Link Demo Cashier to Demo Store
  await client.query(
    `
      insert into public.cashier_outlet_assignments (
        owner_id, cashier_id, store_id, status, created_by, updated_at
      ) values (
        $1, $2, $3, 'active', $1, now()
      )
      on conflict (owner_id, cashier_id) do update set
        store_id = excluded.store_id,
        status = 'active',
        updated_at = now()
    `,
    [DEMO_OWNER_ID, DEMO_CASHIER_ID, DEMO_STORE_ID],
  );

  // 6. Ensure Active Signature Subscription for Demo Store
  const existingSub = await client.query(
    'select id from public.subscriptions where user_id = $1 and status = $2 limit 1',
    [DEMO_OWNER_ID, 'active'],
  );
  if (!existingSub.rows[0]) {
    await client.query(
      `
        insert into public.subscriptions (
          user_id, store_id, tier, period, plan, billing_cycle, status,
          activated_at, expires_at, amount_paid, payment_amount, payment_method,
          payment_note, payment_ref, updated_at
        ) values (
          $1, $2, 'pro', 'yearly', 'signature', 'yearly', 'active',
          now(), now() + interval '365 days', 0, 0, 'demo',
          'Akun Demo Resmi KaffePOS Signature Pro', 'DEMO-SIGNATURE-PRO', now()
        )
      `,
      [DEMO_OWNER_ID, DEMO_STORE_ID],
    );
  }

  // 7. Seed Demo Catalog, Inventory, Open Bill & Supplier PO if store catalog is empty
  const menuCount = await client.query(
    'select count(*)::int as cnt from public.menu_items where store_id = $1',
    [DEMO_STORE_ID],
  );
  if (Number(menuCount.rows[0]?.cnt ?? 0) === 0) {
    const invArabicaId = '00000000-0000-4000-8000-00000000de11';
    const invMilkId = '00000000-0000-4000-8000-00000000de12';
    const invArenId = '00000000-0000-4000-8000-00000000de13';
    const invMatchaId = '00000000-0000-4000-8000-00000000de14';

    await client.query(
      `
        insert into public.inventory (id, store_id, name, stock, unit, min_stock, cost_per_unit)
        values
          ($1, $5, 'Biji Kopi Arabica House Blend', 4800, 'gram', 1000, 280),
          ($2, $5, 'Fresh Milk Barista Series', 12000, 'ml', 2500, 22),
          ($3, $5, 'Gula Aren Organik Cair', 3500, 'ml', 600, 35),
          ($4, $5, 'Uji Ceremonial Matcha Powder', 1200, 'gram', 250, 650)
        on conflict (id) do nothing
      `,
      [invArabicaId, invMilkId, invArenId, invMatchaId, DEMO_STORE_ID],
    );

    await client.query(
      `
        insert into public.menu_items (
          store_id, name, price, category, description, is_available, sort_order, recipe
        ) values
          ($1, 'Es Kopi Susu Gula Aren', 24000, 'Kopi', 'Signature espresso house blend dengan susu segar & gula aren organik.', true, 1, $2::jsonb),
          ($1, 'Iced Americano Arabica', 22000, 'Kopi', 'Double shot Arabica Gayo & Toraja segar dingin.', true, 2, $3::jsonb),
          ($1, 'Uji Matcha Latte', 28000, 'Non-Kopi', 'Ceremonial grade Uji matcha dengan textured fresh milk.', true, 3, $4::jsonb),
          ($1, 'Butter Croissant Artisan', 25000, 'Makanan', 'Croissant Prancis renyah dipanggang hangat setiap pagi.', true, 4, '[]'::jsonb),
          ($1, '[KOMBO] Paket Ngopi Pagi (Kopi Susu + Croissant)', 42000, 'Paket Kombo', 'Hemat Rp 7.000: 1 Es Kopi Susu Gula Aren + 1 Butter Croissant Artisan.', true, 5, $2::jsonb)
      `,
      [
        DEMO_STORE_ID,
        JSON.stringify([
          { matId: invArabicaId, qty: 18, unit_reference: 'gram' },
          { matId: invMilkId, qty: 120, unit_reference: 'ml' },
          { matId: invArenId, qty: 25, unit_reference: 'ml' },
        ]),
        JSON.stringify([{ matId: invArabicaId, qty: 18, unit_reference: 'gram' }]),
        JSON.stringify([
          { matId: invMatchaId, qty: 8, unit_reference: 'gram' },
          { matId: invMilkId, qty: 140, unit_reference: 'ml' },
        ]),
      ],
    );

    // Sample Open Bill on Meja 03 so visitors can test Recall, Move/Merge Table & Split Bill
    await client.query(
      `
        insert into public.open_bills (
          id, store_id, table_number, order_type, customer_name, pax,
          items, subtotal, discount, tax, service_charge, total, note, cashier, status
        ) values (
          '00000000-0000-4000-8000-00000000de21',
          $1, '03', 'dine_in', 'Budi Santoso (VIP)', 2,
          $2::jsonb, 76000, 0, 7600, 0, 83600,
          'Less ice untuk Kopi Susu', 'Rina (Barista & Kasir Demo)', 'open'
        )
        on conflict (id) do nothing
      `,
      [
        DEMO_STORE_ID,
        JSON.stringify([
          { id: 'demo-item-1', name: 'Es Kopi Susu Gula Aren', qty: 2, price: 24000, station: 'bar' },
          { id: 'demo-item-2', name: 'Uji Matcha Latte', qty: 1, price: 28000, station: 'bar' },
        ]),
      ],
    );

    // Sample Supplier PO so visitors can test Receive Stock in Gudang
    await client.query(
      `
        insert into public.purchase_orders (
          id, store_id, po_number, supplier_name, status, items, total_amount, notes, created_by
        ) values (
          '00000000-0000-4000-8000-00000000de31',
          $1, 'PO-DEMO-001', 'PT Kopi Nusantara Roasters', 'ordered',
          $2::jsonb, 1660000, 'Pengiriman reguler mingguan biji kopi & susu', 'demo@kaffepos.my.id'
        )
        on conflict (id) do nothing
      `,
      [
        DEMO_STORE_ID,
        JSON.stringify([
          { inventory_id: invArabicaId, name: 'Biji Kopi Arabica House Blend', qty: 4000, unit: 'gram', cost_per_unit: 280 },
          { inventory_id: invMilkId, name: 'Fresh Milk Barista Series', qty: 24000, unit: 'ml', cost_per_unit: 22.5 },
        ]),
      ],
    );
  }
}
