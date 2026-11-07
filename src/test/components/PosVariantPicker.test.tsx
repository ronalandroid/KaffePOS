import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PosVariantPicker from '@/components/pos/PosVariantPicker';
import type { MenuItem } from '@/types';

const variantOnly: MenuItem = {
  id: 'm1', store_id: 's1', name: 'Kopi Susu', price: 18000, category: 'Kopi', is_available: true,
  variants: [
    { name: 'Small', price: 16000 },
    { name: 'Medium', price: 18000 },
    { name: 'Large', price: 22000 },
  ],
} as MenuItem;

const withModifiers: MenuItem = {
  id: 'm2', store_id: 's1', name: 'Latte', price: 20000, category: 'Kopi', is_available: true,
  variants: [
    { name: 'Regular', price: 20000 },
    { name: 'Large', price: 25000 },
  ],
  modifiers: [
    { name: 'Extra Shot', price: 5000 },
    { name: 'Oat Milk', price: 7000 },
  ],
} as MenuItem;

describe('PosVariantPicker', () => {
  describe('variant-only (quick-select)', () => {
    it('renders every variant with its price and no confirm button', () => {
      render(<PosVariantPicker item={variantOnly} onConfirm={vi.fn()} onClose={vi.fn()} />);
      expect(screen.getByText('Small')).toBeInTheDocument();
      expect(screen.getByText('Large')).toBeInTheDocument();
      expect(screen.queryByText(/Tambah •/)).not.toBeInTheDocument();
    });

    it('confirms immediately with the tapped variant (one tap)', () => {
      const onConfirm = vi.fn();
      render(<PosVariantPicker item={variantOnly} onConfirm={onConfirm} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Large'));
      expect(onConfirm).toHaveBeenCalledWith({ name: 'Large', price: 22000 }, undefined);
    });
  });

  describe('with modifiers (form mode)', () => {
    it('shows a confirm button with the base total', () => {
      render(<PosVariantPicker item={withModifiers} onConfirm={vi.fn()} onClose={vi.fn()} />);
      // default variant is the first (Regular 20.000), no modifiers selected yet
      expect(screen.getByText(/Tambah •/)).toHaveTextContent('20.000');
    });

    it('adds selected modifier prices to the live total', () => {
      render(<PosVariantPicker item={withModifiers} onConfirm={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Extra Shot')); // +5.000
      fireEvent.click(screen.getByText('Oat Milk'));   // +7.000
      expect(screen.getByText(/Tambah •/)).toHaveTextContent('32.000'); // 20 + 5 + 7
    });

    it('reflects the chosen variant in the total', () => {
      render(<PosVariantPicker item={withModifiers} onConfirm={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Large')); // 25.000
      expect(screen.getByText(/Tambah •/)).toHaveTextContent('25.000');
    });

    it('confirms with the chosen variant and modifiers only on the confirm tap', () => {
      const onConfirm = vi.fn();
      render(<PosVariantPicker item={withModifiers} onConfirm={onConfirm} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('Large'));
      fireEvent.click(screen.getByText('Extra Shot'));
      expect(onConfirm).not.toHaveBeenCalled(); // selecting does not add
      fireEvent.click(screen.getByText(/Tambah •/));
      expect(onConfirm).toHaveBeenCalledWith(
        { name: 'Large', price: 25000 },
        [{ name: 'Extra Shot', price: 5000 }],
      );
    });
  });

  it('calls onClose on the close button and on Escape', () => {
    const onClose = vi.fn();
    render(<PosVariantPicker item={variantOnly} onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Tutup pilih opsi'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
