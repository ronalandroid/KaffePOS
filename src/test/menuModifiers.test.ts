import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/backendApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/backendApi')>();
  return { ...actual, createMenuItem: vi.fn(), updateMenuItem: vi.fn() };
});

import { useStore } from '@/hooks/useStore';
import { createMenuItem, updateMenuItem } from '@/lib/backendApi';
import type { MenuItem } from '@/types';

describe('saveMenuItem carries modifiers to the API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useStore.setState({ storeId: 'store-1', menu: [], inventory: [] });
  });

  it('includes variants and modifiers when creating a new item', async () => {
    vi.mocked(createMenuItem).mockResolvedValue({ id: 'created-1' } as MenuItem);
    await useStore.getState().saveMenuItem({
      name: 'Latte', price: 20000, category: 'Kopi',
      variants: [{ name: 'Large', price: 25000 }],
      modifiers: [{ name: 'Extra Shot', price: 5000 }],
    } as Partial<MenuItem>);

    expect(createMenuItem).toHaveBeenCalledTimes(1);
    expect(createMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        variants: [{ name: 'Large', price: 25000 }],
        modifiers: [{ name: 'Extra Shot', price: 5000 }],
      }),
    );
  });

  it('includes modifiers when updating an existing item', async () => {
    useStore.setState({
      menu: [{ id: 'm1', store_id: 'store-1', name: 'Latte', price: 20000, category: 'Kopi', is_available: true } as MenuItem],
    });
    vi.mocked(updateMenuItem).mockResolvedValue({ id: 'm1' } as MenuItem);

    await useStore.getState().saveMenuItem({
      id: 'm1', name: 'Latte', price: 20000, category: 'Kopi',
      modifiers: [{ name: 'Oat Milk', price: 7000 }],
    } as Partial<MenuItem>);

    expect(updateMenuItem).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ modifiers: [{ name: 'Oat Milk', price: 7000 }] }),
    );
  });
});
