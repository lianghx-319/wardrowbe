import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import WardrobePage from '@/app/dashboard/wardrobe/page';
import {
  useBulkDeleteItems,
  useBulkReanalyzeItems,
  useItem,
  useItems,
  useItemTypes,
  useReanalyzeItem,
} from '@/lib/hooks/use-items';
import type { Item, ItemListResponse } from '@/lib/types';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/add-item-dialog', () => ({
  AddItemDialog: () => null,
}));

vi.mock('@/components/item-detail-dialog', () => ({
  ItemDetailDialog: () => null,
}));

vi.mock('@/components/bulk-action-toolbar', () => ({
  BulkActionToolbar: ({ totalItems, pageItems }: { totalItems: number; pageItems: number }) => (
    <div data-testid="bulk-toolbar" data-total={totalItems} data-page-items={pageItems} />
  ),
}));

vi.mock('@/lib/hooks/use-user', () => ({
  useUserProfile: () => ({ data: { timezone: 'UTC' } }),
}));

vi.mock('@/lib/hooks/use-immich', () => ({
  useImmichConnection: () => ({ data: null }),
  useScanImmich: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/hooks/use-items', () => ({
  useItems: vi.fn(),
  useItem: vi.fn(),
  useItemTypes: vi.fn(),
  useReanalyzeItem: vi.fn(),
  useBulkDeleteItems: vi.fn(),
  useBulkReanalyzeItems: vi.fn(),
}));

function makeItem(id: string, name: string, type = 'shirt', primaryColor?: string): Item {
  return {
    id,
    user_id: 'user-1',
    type,
    name,
    primary_color: primaryColor,
    favorite: false,
    tags: {
      colors: primaryColor ? [primaryColor] : [],
      style: [],
      season: [],
    },
    colors: primaryColor ? [primaryColor] : [],
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
    page_size: 20,
    has_more: false,
  };
}

describe('WardrobePage search', () => {
  const allItems = makeResponse([
    makeItem('1', 'Blue Oxford Shirt', 'shirt', 'blue'),
    makeItem('2', 'Black Chinos', 'pants', 'black'),
    {
      ...makeItem('3', 'IMG_4794', 'dress', 'blue'),
      subtype: 'maxi',
      ai_description_zh: '浅蓝色连衣裙，描述里提到了短裤作为搭配参考。',
    },
    makeItem('4', 'Linen Shorts', 'shorts', 'beige'),
    makeItem('5', 'Blue Running Shorts', 'shorts', 'blue'),
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useItems).mockReturnValue({
      data: allItems,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useItems>);
    vi.mocked(useItem).mockReturnValue({ data: null } as unknown as ReturnType<typeof useItem>);
    vi.mocked(useItemTypes).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useItemTypes>);
    vi.mocked(useReanalyzeItem).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useReanalyzeItem>);
    vi.mocked(useBulkDeleteItems).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkDeleteItems>);
    vi.mocked(useBulkReanalyzeItems).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBulkReanalyzeItems>);
  });

  it('does not render all wardrobe items when a search is active and the query returns stale full data', async () => {
    render(<WardrobePage />);

    expect(screen.getByText('Blue Oxford Shirt')).toBeInTheDocument();
    expect(screen.getByText('Black Chinos')).toBeInTheDocument();
    expect(screen.getByText('IMG_4794')).toBeInTheDocument();
    expect(screen.getByText('Linen Shorts')).toBeInTheDocument();
    expect(screen.getByText('Blue Running Shorts')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索衣物、颜色、标签...'), {
      target: { value: 'oxford' },
    });

    await waitFor(() => {
      expect(useItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'oxford' }),
        1,
        20
      );
    });
    expect(screen.getByText('Blue Oxford Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Black Chinos')).not.toBeInTheDocument();
    expect(screen.queryByText('IMG_4794')).not.toBeInTheDocument();
    expect(screen.queryByText('Linen Shorts')).not.toBeInTheDocument();
    expect(screen.queryByText('Blue Running Shorts')).not.toBeInTheDocument();
    expect(screen.getByText('衣橱中共有 1 件物品')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-toolbar')).toHaveAttribute('data-total', '1');
  });

  it('treats an exact clothing type search as a strict type filter', async () => {
    render(<WardrobePage />);

    fireEvent.change(screen.getByPlaceholderText('搜索衣物、颜色、标签...'), {
      target: { value: '短裤' },
    });

    await waitFor(() => {
      expect(useItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '短裤' }),
        1,
        20
      );
    });
    expect(screen.getByText('Linen Shorts')).toBeInTheDocument();
    expect(screen.getByText('Blue Running Shorts')).toBeInTheDocument();
    expect(screen.queryByText('IMG_4794')).not.toBeInTheDocument();
    expect(screen.queryByText('Blue Oxford Shirt')).not.toBeInTheDocument();
    expect(screen.queryByText('Black Chinos')).not.toBeInTheDocument();
    expect(screen.getByText('衣橱中共有 2 件物品')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-toolbar')).toHaveAttribute('data-total', '2');
  });

  it('combines structured keyword terms with AND semantics', async () => {
    render(<WardrobePage />);

    fireEvent.change(screen.getByPlaceholderText('搜索衣物、颜色、标签...'), {
      target: { value: '蓝色 短裤' },
    });

    await waitFor(() => {
      expect(useItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '蓝色 短裤' }),
        1,
        20
      );
    });
    expect(screen.getByText('Blue Running Shorts')).toBeInTheDocument();
    expect(screen.queryByText('Linen Shorts')).not.toBeInTheDocument();
    expect(screen.queryByText('IMG_4794')).not.toBeInTheDocument();
    expect(screen.queryByText('Blue Oxford Shirt')).not.toBeInTheDocument();
    expect(screen.getByText('衣橱中共有 1 件物品')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-toolbar')).toHaveAttribute('data-total', '1');
  });
});
