import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/hooks/useStore';
import type { MenuItem } from '@/types';

const plain: MenuItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', store_id: 's1', name: 'Air Mineral',
  price: 5000, category: 'Lain', is_available: true,
} as MenuItem;

const latte: MenuItem = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', store_id: 's1', name: 'Latte',
  price: 20000, category: 'Kopi', is_available: true,
  variants: [{ name: 'Regular', price: 20000 }, { name: 'Large', price: 25000 }],
  modifiers: [{ name: 'Extra Shot', price: 5000 }, { name: 'Oat Milk', price: 7000 }],
} as MenuItem;

describe('addToCart with variants and modifiers', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ cart: [], storeId: 's1', discount: '' });
  });

  it('adds a plain item at base price under its own id', () => {
    useStore.getState().addToCart(plain);
    const cart = useStore.getState().cart;
    expect(cart).toHaveLength(1);
    expect(cart[0].id).toBe(plain.id);
    expect(cart[0].price).toBe(5000);
  });

  it('applies the variant price and keeps the base id for stock routing', () => {
    useStore.getState().addToCart(latte, { name: 'Large', price: 25000 });
    const line = useStore.getState().cart[0];
    expect(line.price).toBe(25000);
    expect(line.name).toBe('Latte (Large)');
    expect(line.variantId).toBe('Large');
    expect(line._baseId).toBe(latte.id);
  });

  it('sums modifier prices on top of the variant and lists them in the name', () => {
    useStore.getState().addToCart(latte, { name: 'Large', price: 25000 }, [
      { name: 'Extra Shot', price: 5000 },
      { name: 'Oat Milk', price: 7000 },
    ]);
    const line = useStore.getState().cart[0];
    expect(line.price).toBe(25000 + 5000 + 7000);
    expect(line.name).toBe('Latte (Large, Extra Shot, Oat Milk)');
    expect(line.modifiers).toEqual([
      { name: 'Extra Shot', price: 5000 },
      { name: 'Oat Milk', price: 7000 },
    ]);
  });

  it('stacks an identical configuration onto one line', () => {
    const variant = { name: 'Regular', price: 20000 };
    const mods = [{ name: 'Extra Shot', price: 5000 }];
    useStore.getState().addToCart(latte, variant, mods);
    useStore.getState().addToCart(latte, variant, mods);
    const cart = useStore.getState().cart;
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it('keeps different modifier selections as separate lines', () => {
    const variant = { name: 'Regular', price: 20000 };
    useStore.getState().addToCart(latte, variant, [{ name: 'Extra Shot', price: 5000 }]);
    useStore.getState().addToCart(latte, variant, [{ name: 'Oat Milk', price: 7000 }]);
    expect(useStore.getState().cart).toHaveLength(2);
  });

  it('treats the same modifier set in any order as one line', () => {
    const variant = { name: 'Regular', price: 20000 };
    useStore.getState().addToCart(latte, variant, [
      { name: 'Extra Shot', price: 5000 }, { name: 'Oat Milk', price: 7000 },
    ]);
    useStore.getState().addToCart(latte, variant, [
      { name: 'Oat Milk', price: 7000 }, { name: 'Extra Shot', price: 5000 },
    ]);
    expect(useStore.getState().cart).toHaveLength(1);
    expect(useStore.getState().cart[0].qty).toBe(2);
  });
});
