import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ItemPicker } from '@/components/shared/item-picker';
import { useItems } from '@/lib/hooks/use-items';
import type { Item, ItemListResponse } from '@/lib/types';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('@/lib/hooks/use-items', () => ({
  useItems: vi.fn(),
}));

function makeItem(id: string, name: string, type = 'shirt'): Item {
  return {
    id,
    user_id: 'user-1',
    type,
    name,
    favorite: false,
    tags: {
      colors: [],
      style: [],
      season: [],
    },
    colors: [],
    status: 'ready',
    ai_processed: true,
    wear_count: 0,
    suggestion_count: 0,
    acceptance_count: 0,
    wears_since_wash: 0,
    needs_wash: false,
    effective_wash_interval: 3,
    additional_images: [],
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function makeResponse(items: Item[]): ItemListResponse {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 24,
    has_more: false,
  };
}

describe('ItemPicker', () => {
  const allItems = makeResponse([
    makeItem('1', 'Blue Shirt'),
    makeItem('2', 'Black Pants', 'pants'),
  ]);
  const redItems = makeResponse([makeItem('3', 'Red Coat', 'coat')]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useItems).mockImplementation((filters) => ({
      data: filters?.search === 'red' ? redItems : allItems,
      isLoading: false,
      isFetching: false,
    } as ReturnType<typeof useItems>));
  });

  it('clears stale accumulated items while applying a new search', async () => {
    render(
      <ItemPicker
        selectedIds={new Set()}
        onToggle={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Blue Shirt').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Black Pants').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('搜索衣橱...'), {
      target: { value: '  red  ' },
    });

    expect(screen.queryByText('Blue Shirt')).not.toBeInTheDocument();
    expect(screen.queryByText('Black Pants')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(useItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'red' }),
        1,
        24
      );
    });
    expect(screen.getAllByText('Red Coat').length).toBeGreaterThan(0);
  });
});
