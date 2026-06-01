'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search, Heart, Grid3X3, Loader2, AlertCircle, RefreshCw, Droplets, ArrowUpDown, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AddItemDialog } from '@/components/add-item-dialog';
import { ItemDetailDialog } from '@/components/item-detail-dialog';
import { BulkActionToolbar, BulkSelection } from '@/components/bulk-action-toolbar';
import { useItems, useItem, useItemTypes, useReanalyzeItem, useBulkDeleteItems, useBulkReanalyzeItems, BulkOperationParams } from '@/lib/hooks/use-items';
import { useImmichConnection, useScanImmich } from '@/lib/hooks/use-immich';
import { useUserProfile } from '@/lib/hooks/use-user';
import { CLOTHING_TYPES, CLOTHING_COLORS, Item } from '@/lib/types';
import { TYPE_ZH, itemColorZh, itemTitleZh, itemTypeZh } from '@/lib/zh-labels';
import { toast } from 'sonner';
import { formatWornAgo, getWornAgoColorClass } from '@/lib/utils';

const SORT_OPTIONS = [
  { label: '最新添加', value: 'created_at', order: 'desc' as const },
  { label: '最早添加', value: 'created_at', order: 'asc' as const },
  { label: '最近穿过', value: 'last_worn', order: 'desc' as const },
  { label: '最久未穿', value: 'last_worn', order: 'asc' as const },
  { label: '穿着最多', value: 'wear_count', order: 'desc' as const },
  { label: '穿着最少', value: 'wear_count', order: 'asc' as const },
  { label: '名称 A-Z', value: 'name', order: 'asc' as const },
  { label: '名称 Z-A', value: 'name', order: 'desc' as const },
] as const;

function ItemCard({
  item,
  selected,
  onSelect,
  onRetry,
  onClick,
  userTimezone,
}: {
  item: Item;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onRetry?: (id: string) => void;
  onClick?: () => void;
  userTimezone: string;
}) {
  const colorInfo = CLOTHING_COLORS.find((c) => c.value === item.primary_color);
  const displayTitle = itemTitleZh(item);
  const displayType = itemTypeZh(item);
  const displayColor = itemColorZh(item);
  const isProcessing = item.status === 'processing';
  const isError = item.status === 'error';
  const errorMessage = typeof item.ai_raw_response?.error === 'string'
    ? item.ai_raw_response.error
    : 'AI 分析失败';
  const modelConfidence = item.tags?.logprobs_confidence;
  const estimatedConfidence = Number(item.ai_confidence ?? 0);
  const confidenceLabel = modelConfidence != null
    ? `模型置信度 ${Math.round(modelConfidence * 100)}%`
    : estimatedConfidence > 0 && item.status === 'ready'
      ? `估算置信度 ${Math.round(estimatedConfidence * 100)}%`
      : null;

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className={`group overflow-hidden cursor-pointer transition-all ${
        selected ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div className="relative aspect-square bg-muted">
        {item.thumbnail_url ? (
          <Image
            src={item.thumbnail_url}
            alt={displayTitle}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            {displayType}
          </div>
        )}
        {/* Checkbox in top-left */}
        <div
          className={`absolute top-2 left-2 z-10 transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={handleCheckboxClick}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(item.id, checked === true)}
            className="bg-background/80 backdrop-blur-sm"
          />
        </div>
        {item.favorite && (
          <div className="absolute top-2 right-2 z-10">
            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
          </div>
        )}
        {item.needs_wash && (
          <div className="absolute bottom-2 right-2 z-10">
            <div className="bg-amber-500/90 text-white rounded-full p-1" title="需要清洗">
              <Droplets className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
            <span className="text-white text-xs font-medium">AI 分析中...</span>
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 p-2">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <span className="text-white text-xs font-medium text-center line-clamp-3">
              {errorMessage}
            </span>
            {onRetry && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(item.id);
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                重试
              </Button>
            )}
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {displayTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {displayType}
              {item.subtype && ` • ${item.subtype}`}
              {displayColor && ` · ${displayColor}`}
              {confidenceLabel && ` · ${confidenceLabel}`}
            </p>
          </div>
          {colorInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="w-4 h-4 rounded-full border shrink-0"
                    style={{ backgroundColor: colorInfo.hex }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{displayColor || colorInfo.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {item.last_worn_at ? (
          <p className={`text-xs mt-1 ${getWornAgoColorClass(item.last_worn_at, userTimezone)}`}>
            {formatWornAgo(item.last_worn_at, userTimezone)}
          </p>
        ) : item.wear_count > 0 ? (
          <p className="text-xs text-muted-foreground mt-1">
            Worn {item.wear_count} time{item.wear_count !== 1 ? 's' : ''}
          </p>
        ) : null}
        {estimatedConfidence > 0 && item.status === 'ready' && (
          <p className="text-xs text-muted-foreground mt-1">
            AI 标签完整度：{Math.round(estimatedConfidence * 100)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ItemCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-square" />
      <CardContent className="p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2 mt-1" />
      </CardContent>
    </Card>
  );
}

function EmptyWardrobe({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Grid3X3 className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">衣橱还是空的</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        添加第一件衣服后，就可以开始获得个性化穿搭建议。
      </p>
      <Button onClick={onAddClick}>
        <Plus className="mr-2 h-4 w-4" />
        添加第一件
      </Button>
    </div>
  );
}

export default function WardrobePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: userProfile } = useUserProfile();
  const userTimezone = userProfile?.timezone || 'UTC';
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selection, setSelection] = useState<BulkSelection>({
    mode: 'none',
    selectedIds: new Set(),
    excludedIds: new Set(),
  });
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortIndex, setSortIndex] = useState(0);
  const [needsWash, setNeedsWash] = useState<boolean | undefined>(undefined);
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Open item detail dialog from URL param (e.g. ?item=uuid from outfit pages)
  useEffect(() => {
    const itemParam = searchParams.get('item');
    if (itemParam && !detailItemId) {
      setDetailItemId(itemParam);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortOption = SORT_OPTIONS[sortIndex];

  const filters = {
    search: search || undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    needs_wash: needsWash,
    favorite: favoriteFilter,
    is_archived: false,
    sort_by: sortOption.value,
    sort_order: sortOption.order,
  };

  const activeFilterCount = [
    needsWash !== undefined,
    favoriteFilter !== undefined,
    typeFilter !== 'all',
  ].filter(Boolean).length;

  // Fetch items with automatic polling (faster when items are processing)
  const { data, isLoading, error } = useItems(filters, page, 20);
  const { data: itemTypes } = useItemTypes();
  const reanalyze = useReanalyzeItem();
  const bulkDelete = useBulkDeleteItems();
  const bulkReanalyze = useBulkReanalyzeItems();
  const { data: immichConnection } = useImmichConnection();
  const scanImmich = useScanImmich();

  const items = data?.items || [];
  const total = data?.total || 0;

  // Get selected item: try from list first, then fetch individually (for deep-link from outfit pages)
  const listItem = detailItemId ? items.find((i) => i.id === detailItemId) || null : null;
  const { data: fetchedItem } = useItem(detailItemId && !listItem ? detailItemId : '');
  const detailItem = listItem || fetchedItem || null;

  // Count items being processed or with errors
  const processingCount = items.filter((i) => i.status === 'processing').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  // Clear selection when filters change (but not page - allow cross-page selection)
  useEffect(() => {
    setSelection({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });
  }, [search, typeFilter, needsWash, favoriteFilter, sortIndex]);

  const handleRetry = (itemId: string) => {
    reanalyze.mutate(itemId);
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelection((prev) => {
      if (prev.mode === 'all') {
        // In "select all" mode, toggle exclusion
        const next = new Set(prev.excludedIds);
        if (checked) {
          next.delete(id); // Remove from excluded = selected
        } else {
          next.add(id); // Add to excluded = deselected
        }
        return { ...prev, excludedIds: next };
      } else {
        // In "some" or "none" mode, toggle selection
        const next = new Set(prev.selectedIds);
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return { mode: next.size > 0 ? 'some' : 'none', selectedIds: next, excludedIds: new Set() };
      }
    });
  };

  const handleSelectAll = () => {
    setSelection((prev) => {
      if (prev.mode === 'all' && prev.excludedIds.size === 0) {
        // Already all selected, clear
        return { mode: 'none', selectedIds: new Set(), excludedIds: new Set() };
      } else {
        // Select all
        return { mode: 'all', selectedIds: new Set(), excludedIds: new Set() };
      }
    });
  };

  const handleClearSelection = () => {
    setSelection({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });
  };

  // Build bulk operation params from selection state
  const getBulkParams = (): BulkOperationParams => {
    if (selection.mode === 'all') {
      return {
        select_all: true,
        excluded_ids: Array.from(selection.excludedIds),
        filters: {
          type: typeFilter !== 'all' ? typeFilter : undefined,
          search: search || undefined,
          needs_wash: needsWash,
          favorite: favoriteFilter,
          is_archived: false,
        },
      };
    } else {
      return {
        item_ids: Array.from(selection.selectedIds),
      };
    }
  };

  const handleBulkDelete = async () => {
    const params = getBulkParams();
    try {
      const result = await bulkDelete.mutateAsync(params);
      toast.success(`已删除 ${result.deleted} 件衣物`);
      if (result.failed > 0) {
        toast.error(`${result.failed} 件衣物删除失败`);
      }
      handleClearSelection();
    } catch {
      toast.error('删除衣物失败');
    }
  };

  const handleBulkReanalyze = async () => {
    const params = getBulkParams();
    try {
      const result = await bulkReanalyze.mutateAsync(params);
      if (result.queued > 20) {
        toast.success(`已将 ${result.queued} 件衣物加入重新分析队列，可能需要一些时间。`);
      } else {
        toast.success(`已将 ${result.queued} 件衣物加入重新分析队列`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} 件衣物加入队列失败`);
      }
      handleClearSelection();
    } catch {
      toast.error('重新分析入队失败');
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleScanImmich = async () => {
    try {
      const result = await scanImmich.mutateAsync();
      toast.success(
        `Immich 扫描完成：导入 ${result.imported} 张，跳过 ${result.skipped_existing_asset + result.skipped_duplicate_hash} 张`
      );
      if (result.failed > 0) {
        toast.error(`${result.failed} 张 Immich 照片导入失败`);
      }
    } catch {
      toast.error('Immich 扫描失败，请在设置中重新绑定。');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <h1 className="text-2xl font-bold tracking-tight">我的衣橱</h1>
            <div className="flex items-center gap-2 sm:hidden">
              <Button
                variant={immichConnection?.status === 'error' ? 'destructive' : 'outline'}
                size="icon"
                onClick={handleScanImmich}
                disabled={!immichConnection?.configured || scanImmich.isPending}
                title={immichConnection?.configured ? '扫描 Immich' : '请先在设置中绑定 Immich'}
                aria-label={immichConnection?.configured ? '扫描 Immich' : '请先在设置中绑定 Immich'}
              >
                {scanImmich.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={() => setAddDialogOpen(true)}
                size="icon"
                title="添加衣物"
                aria-label="添加衣物"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            衣橱中共有 {total} 件物品
          </p>
          {(processingCount > 0 || errorCount > 0) && (
            <div className="flex items-center gap-2 mt-2">
              {processingCount > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {processingCount} 件分析中
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  {errorCount} 件失败
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="hidden sm:flex gap-2">
          {immichConnection?.configured && (
            <Button
              variant={immichConnection.status === 'error' ? 'destructive' : 'outline'}
              onClick={handleScanImmich}
              disabled={scanImmich.isPending}
            >
              {scanImmich.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              扫描 Immich
            </Button>
          )}
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加衣物
          </Button>
        </div>
      </div>

      {immichConnection?.configured && immichConnection.status === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Immich 连接不可用</p>
            <p>{immichConnection.last_error || '请先在设置中重新绑定 Immich。'}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Main row: search + sort + filter toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索衣物、颜色、标签..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
            <Select
              value={String(sortIndex)}
              onValueChange={(v) => {
                setSortIndex(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showFilters || activeFilterCount > 0 ? 'default' : 'outline'}
              size="icon"
              className="shrink-0 relative"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Expandable filter row */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 items-center p-2 sm:p-3 rounded-lg border bg-muted/30">
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full min-w-[140px] sm:w-[150px] h-8 text-xs">
                <SelectValue placeholder="所有品类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有品类</SelectItem>
                {CLOTHING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {TYPE_ZH[t.value] || t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={needsWash === true ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                setNeedsWash(needsWash === true ? undefined : true);
                setPage(1);
              }}
            >
              <Droplets className="h-3.5 w-3.5" />
              待清洗
            </Button>

            <Button
              variant={favoriteFilter === true ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                setFavoriteFilter(favoriteFilter === true ? undefined : true);
                setPage(1);
              }}
            >
              <Heart className="h-3.5 w-3.5" />
              收藏
            </Button>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1 sm:ml-auto"
                onClick={() => {
                  setTypeFilter('all');
                  setNeedsWash(undefined);
                  setFavoriteFilter(undefined);
                  setPage(1);
                }}
              >
                <X className="h-3 w-3" />
                清除筛选
              </Button>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="text-center py-8">
          <p className="text-destructive">
            加载衣物失败，请重试。
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            重试
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        search || typeFilter !== 'all' || needsWash !== undefined || favoriteFilter !== undefined ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              没有找到符合筛选条件的衣物。
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setNeedsWash(undefined);
                setFavoriteFilter(undefined);
              }}
            >
              清除筛选
            </Button>
          </div>
        ) : (
          <EmptyWardrobe onAddClick={() => setAddDialogOpen(true)} />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-20 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            // Determine if item is selected based on selection mode
            const isSelected = selection.mode === 'all'
              ? !selection.excludedIds.has(item.id)
              : selection.selectedIds.has(item.id);
            return (
              <ItemCard
                key={item.id}
                item={item}
                selected={isSelected}
                onSelect={handleSelect}
                onRetry={handleRetry}
                onClick={() => setDetailItemId(item.id)}
                userTimezone={userTimezone}
              />
            );
          })}
        </div>
      )}

      <BulkActionToolbar
        selection={selection}
        totalItems={total}
        pageItems={items.length}
        onSelectAll={handleSelectAll}
        onClear={handleClearSelection}
        onDelete={handleBulkDelete}
        onReanalyze={handleBulkReanalyze}
        isDeleting={bulkDelete.isPending}
        isReanalyzing={bulkReanalyze.isPending}
        page={page}
        pageSize={20}
        onPageChange={handlePageChange}
      />

      <AddItemDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <ItemDetailDialog
        item={detailItem}
        open={!!detailItemId}
        onOpenChange={(open) => {
          if (!open) {
            setDetailItemId(null);
            // Clear the ?item= param from URL without navigation
            if (searchParams.has('item')) {
              router.replace('/dashboard/wardrobe', { scroll: false });
            }
          }
        }}
      />
    </div>
  );
}
