import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffPersonalProfile from '@/components/gamification/StaffPersonalProfile';
import { useStore } from '@/hooks/useStore';
import type { Profile, Transaction } from '@/types';

function tx(partial: Partial<Transaction>): Transaction {
  const base: Transaction = {
    id: partial.id || crypto.randomUUID(),
    store_id: 'store_1',
    date: partial.date || '2026-05-10T09:00:00.000Z',
    items: partial.items || [{ name: 'Latte', qty: 1, price: 22000, subtotal: 22000 }],
    subtotal: partial.subtotal ?? 22000,
    discount: partial.discount ?? 0,
    tax: partial.tax ?? 0,
    total: partial.total ?? 22000,
    paid: partial.paid ?? 22000,
    change: partial.change ?? 0,
    method: partial.method || 'Tunai',
    cashier: partial.cashier || 'Rina',
    is_void: partial.is_void ?? false,
  };
  return { ...base, ...partial };
}

describe('StaffPersonalProfile', () => {
  const ownerRoleProps = { role: 'owner_admin' as const };
  const profile: Profile = {
    id: 'cashier_1',
    display_name: 'Rina Agustina',
    email: 'rina@example.com',
    role: 'cashier',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T10:00:00.000Z'));
    useStore.setState({
      transactions: [
        tx({ cashier: 'Rina Agustina', total: 65000, method: 'QRIS' }),
        tx({ cashier: 'Rina Agustina', date: '2026-05-09T09:00:00.000Z', total: 52000 }),
        tx({ cashier: 'Budi', total: 150000, method: 'QRIS' }),
      ],
      syncing: false,
      isOnline: true,
      loading: false,
      storeSettings: {
        id: 'store_1',
        owner_id: 'owner_1',
        store_name: 'Kopi Test',
      },
    });
  });

  it('renders the staff profile using KaffePOS performance sections', () => {
    render(<StaffPersonalProfile profile={profile} />);

    expect(screen.getByText('Performa saya')).toBeInTheDocument();
    expect(screen.getAllByText('Rina Agustina').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Level/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Hari berturut-turut')).toBeInTheDocument();
    expect(screen.getByText('Badge')).toBeInTheDocument();
    expect(screen.getByText('Misi hari ini')).toBeInTheDocument();
    expect(screen.getAllByText('Peringkat saya').length).toBeGreaterThan(0); expect(screen.getByText('Badge diraih')).toBeInTheDocument();
  });

  it('shows badge grid and active challenge progress', () => {
    render(<StaffPersonalProfile profile={profile} />);

    expect(screen.getByText('15 transaksi seminggu')).toBeInTheDocument();
    expect(screen.getByText('Transaksi besar')).toBeInTheDocument();
    expect(screen.getByText('10 transaksi hari ini')).toBeInTheDocument();
    expect(screen.getByText('3 pembayaran QRIS')).toBeInTheDocument();
    expect(screen.getAllByText(/Ke-\d+/).length).toBeGreaterThan(0);
  });

  it('keeps cashier view personal without exposing other staff names', () => {
    render(<StaffPersonalProfile profile={profile} role="cashier" />);

    expect(screen.getAllByText('Peringkat saya').length).toBeGreaterThan(0); expect(screen.queryByText('Peringkat tim')).not.toBeInTheDocument().toBeInTheDocument();
    expect(screen.queryByText('Budi')).not.toBeInTheDocument();
  });

  it('shows owner team mode and team leaderboard', () => {
    render(<StaffPersonalProfile profile={{ id: 'owner_1', display_name: 'Owner', email: 'owner@example.com', role: 'owner_admin' }} {...ownerRoleProps} />);

    expect(screen.getByText('Performa tim')).toBeInTheDocument();
    expect(screen.getByText('Peringkat tim')).toBeInTheDocument();
    expect(screen.getByText('Budi')).toBeInTheDocument();
    expect(screen.getByText('Rina Agustina')).toBeInTheDocument();
  });

  it('renders a clean loading state while initial performance data is loading', () => {
    useStore.setState({ transactions: [], loading: true });

    render(<StaffPersonalProfile profile={profile} role="cashier" />);

    expect(screen.getByText('Memuat performa staf...')).toBeInTheDocument();
  });

  it('renders an empty state for a new cashier with zero activity', () => {
    useStore.setState({ transactions: [], loading: false });

    render(<StaffPersonalProfile profile={profile} role="cashier" />);

    expect(screen.getByText('Performa personal masih kosong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buka Kasir/i })).toBeInTheDocument();
  });
});
