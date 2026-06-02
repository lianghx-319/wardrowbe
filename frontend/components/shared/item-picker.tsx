'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Loader2, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { useItems } from '@/lib/hooks/use-items';
import { cn } from '@/lib/utils';
import type { Item } from '@/lib/types';
import { itemTitleZh } from '@/lib/zh-labels';
import { getDisplayImageUrl } from '@/lib/image-url';

const PAGE_SIZE = 24;

interface ItemPickerProps {
  selectedIds: Set<string>;
  onToggle: (item: Item) => void;
  hideNeedsWash?: boolean;
  filterType?: string;
  emptyMessage?: string;
  heightClass?: string;
}

export function ItemPicker({
  selectedIds,
  onToggle,
  hideNeedsWash = true,
  filterType,
  emptyMessage = '没有找到衣物',
  heightClass = 'h-[360px]',
}: ItemPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [accumulatedItems, setAccumulatedItems] = useState<Item[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: itemsData, isLoading, isFetching } = useItems(
    {
      search: debouncedSearch || undefined,
      is_archived: false,
      type: filterType,
      needs_wash: hideNeedsWash ? false : undefined,
    },
    page,
    PAGE_SIZE
  );

  const hasMore = itemsData?.has_more ?? false;
  const totalItems = itemsData?.total ?? 0;

  useEffect(() => {
    if (itemsData?.items) {
      if (page === 1) {
        setAccumulatedItems(itemsData.items);
      } else {
        setAccumulatedItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = itemsData.items.filter(
            (i) => !existingIds.has(i.id)
          );
          return [...prev, ...newItems];
        });
      }
    }
  }, [itemsData?.items, page]);

  const items = accumulatedItems;

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    setAccumulatedItems([]);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isFetching]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const nearBottom =
        target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
      if (nearBottom) loadMore();
    },
    [loadMore]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索衣橱..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={cn('overflow-y-auto py-2 -mx-1 px-1', heightClass)}
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const imageSrc = getDisplayImageUrl(item);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item)}
                className={cn(
                  'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={item.name || item.type}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 20vw"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">
                    {itemTitleZh(item)}
                    </span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                    <div className="rounded-full bg-primary p-1.5 shadow-lg">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <span className="text-[10px] sm:text-xs text-white font-medium truncate block">
                    {itemTitleZh(item)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {isFetching && !isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
            <span className="text-xs text-muted-foreground">
              正在加载更多...
            </span>
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {debouncedSearch
              ? '没有匹配搜索的衣物'
              : emptyMessage}
          </div>
        )}

        {!isLoading && !hasMore && items.length > 0 && (
          <div className="text-center text-xs text-muted-foreground py-3">
            已显示全部 {totalItems} 件衣物
          </div>
        )}
      </div>
    </div>
  );
}
