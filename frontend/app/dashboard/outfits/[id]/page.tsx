'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  BookmarkPlus,
  CalendarPlus,
  ChevronLeft,
  Loader2,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineageCard } from '@/components/shared/lineage-card';
import { CloneToLookbookDialog } from '@/components/shared/clone-to-lookbook-dialog';
import { useDeleteOutfit, useOutfit, useOutfits } from '@/lib/hooks/use-outfits';
import { useWearToday } from '@/lib/hooks/use-studio';
import { getErrorMessage } from '@/lib/api';
import { OCCASION_ZH, itemTitleZh } from '@/lib/zh-labels';
import { getDisplayImageUrl } from '@/lib/image-url';

const SOURCE_ZH: Record<string, string> = {
  manual: '手动创建',
  suggested: 'AI 建议',
  ai_suggested: 'AI 建议',
  lookbook: '灵感册',
};

export default function OutfitDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const outfitId = params?.id;

  const { data: outfit, isLoading } = useOutfit(outfitId);
  const deleteMutation = useDeleteOutfit();
  const wearTodayMutation = useWearToday(outfitId ?? '');

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

  const isTemplate =
    outfit !== undefined && outfit !== null && outfit.scheduled_for === null;
  const isWorn = !!outfit?.feedback?.worn_at;

  const { data: wearInstancesData } = useOutfits(
    isTemplate && outfitId ? { cloned_from_outfit_id: outfitId } : {},
    1,
    10
  );

  if (isLoading || !outfit) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const handleWearToday = async () => {
    try {
      const result = await wearTodayMutation.mutateAsync({});
      toast.success('已加入今天穿着');
      router.push(`/dashboard/outfits/${result.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, '记录今天穿着失败'));
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定删除这套穿搭吗？此操作无法撤销。')) return;
    try {
      await deleteMutation.mutateAsync(outfit.id);
      toast.success('穿搭已删除');
      router.push('/dashboard/outfits');
    } catch (error) {
      toast.error(getErrorMessage(error, '删除失败'));
    }
  };

  const title = outfit.name || `${OCCASION_ZH[outfit.occasion] || outfit.occasion}穿搭`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/outfits">
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回穿搭
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline">
            {OCCASION_ZH[outfit.occasion] || outfit.occasion}
          </Badge>
          <Badge variant="outline">
            {SOURCE_ZH[outfit.source] || outfit.source.replace('_', ' ')}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {outfit.scheduled_for
              ? formatDistanceToNow(parseISO(outfit.scheduled_for), {
                  addSuffix: true,
                  locale: zhCN,
                })
              : '灵感册模板'}
          </span>
        </div>
      </div>

      <LineageCard outfit={outfit} />

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            衣物（{outfit.items.length}）
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {outfit.items.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/wardrobe?itemId=${item.id}`}
                className="group"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                  {getDisplayImageUrl(item) ? (
                    <Image
                      src={getDisplayImageUrl(item)!}
                      alt={item.name || item.type}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width: 640px) 33vw, 20vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">
                        {itemTitleZh(item)}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {itemTitleZh(item)}
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {isTemplate && (
          <Button onClick={handleWearToday} disabled={wearTodayMutation.isPending}>
            {wearTodayMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4 mr-2" />
            )}
            今天穿
          </Button>
        )}
        {!isTemplate && (
          <Button variant="outline" onClick={() => setCloneDialogOpen(true)}>
            <BookmarkPlus className="h-4 w-4 mr-2" />
            保存到灵感册
          </Button>
        )}
        {!isWorn && (
          <Button variant="outline" asChild>
            <Link href={`/dashboard/outfits/new?edit=${outfit.id}`}>
              <Pencil className="h-4 w-4 mr-2" />
              编辑
            </Link>
          </Button>
        )}
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除
        </Button>
      </div>

      {isTemplate && wearInstancesData && wearInstancesData.total > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              已穿 {wearInstancesData.total} 次
            </h2>
            <div className="space-y-2">
              {wearInstancesData.outfits.map((wear) => (
                <Link
                  key={wear.id}
                  href={`/dashboard/outfits/${wear.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50"
                >
                  <span className="text-sm">
                    {wear.scheduled_for
                      ? format(parseISO(wear.scheduled_for), 'yyyy年M月d日', { locale: zhCN })
                      : '未标日期'}
                  </span>
                  {wear.feedback?.rating && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {wear.feedback.rating}
                    </div>
                  )}
                </Link>
              ))}
            </div>
            {wearInstancesData.has_more && (
              <Button variant="link" size="sm" asChild className="mt-2 px-0">
                <Link href={`/dashboard/outfits?filter=worn&cloned_from=${outfit.id}`}>
                  查看全部
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isTemplate && wearInstancesData && wearInstancesData.total === 0 && (
        <Alert className="border-muted">
          <AlertDescription className="text-sm text-muted-foreground">
            这套穿搭还没有穿过。点击“今天穿”即可记录。
          </AlertDescription>
        </Alert>
      )}

      {!isTemplate && (
        <CloneToLookbookDialog
          open={cloneDialogOpen}
          sourceOutfitId={outfit.id}
          sourceOccasion={outfit.occasion}
          onClose={() => setCloneDialogOpen(false)}
          onSuccess={(newId) => router.push(`/dashboard/outfits/${newId}`)}
        />
      )}
    </div>
  );
}
