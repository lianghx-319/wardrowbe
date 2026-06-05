'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OccasionChips } from '@/components/shared/occasion-chips';
import { api, getErrorMessage } from '@/lib/api';
import { ITEM_ROLE } from '@/lib/studio/canonical-order';
import { mergeAiAssist } from '@/lib/studio/ai-assist-merge';
import { TYPE_ZH } from '@/lib/zh-labels';
import type { StudioItem } from '@/lib/studio/editor-state';
import type { Outfit, OutfitItem } from '@/lib/hooks/use-outfits';

interface DetailsPanelProps {
  items: StudioItem[];
  name: string;
  occasion: string | null;
  onNameChange: (name: string) => void;
  onOccasionChange: (occasion: string) => void;
  onAiMerge: (merged: StudioItem[]) => void;
}

function computeWarnings(items: StudioItem[]): string[] {
  const warnings: string[] = [];
  const roles = items.map((i) => ITEM_ROLE[i.type] ?? '');

  const hasFullBody = roles.includes('full_body');
  const hasTop = roles.includes('base_top');
  const hasBottom = roles.includes('bottom');
  const hasFootwear = roles.includes('footwear');

  if (!hasFullBody) {
    if (hasTop && !hasBottom) {
      warnings.push('还没有选择下装。');
    }
    if (hasBottom && !hasTop) {
      warnings.push('还没有选择上装。');
    }
  }

  const bottomCount = roles.filter((r) => r === 'bottom').length;
  if (bottomCount > 1) {
    warnings.push('选择了多件下装。');
  }

  if (items.length >= 3 && !hasFootwear) {
    warnings.push('还没有选择鞋履。');
  }

  return warnings;
}

function toStudioItem(item: OutfitItem): StudioItem {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    thumbnail_url: item.thumbnail_url ?? null,
    medium_url: item.medium_url ?? null,
    image_url: item.image_url ?? null,
    primary_color: item.primary_color,
  };
}

function studioItemTitle(item: StudioItem): string {
  return item.name || TYPE_ZH[item.type] || item.type;
}

export function DetailsPanel({
  items,
  name,
  occasion,
  onNameChange,
  onOccasionChange,
  onAiMerge,
}: DetailsPanelProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const warnings = computeWarnings(items);

  const handleAiAssist = async () => {
    if (items.length === 0 || !occasion) {
      toast.error('请先选择至少一件衣物和一个场景');
      return;
    }
    setAiLoading(true);
    try {
      const result = await api.post<Outfit>('/outfits/suggest', {
        occasion,
        include_items: items.map((i) => i.id),
      });

      const aiStudioItems = result.items.map(toStudioItem);
      const { merged, skipped } = mergeAiAssist(items, aiStudioItems);

      onAiMerge(merged);

      if (skipped.length > 0) {
        for (const { item, reason } of skipped) {
          toast.info(
            `已跳过 ${studioItemTitle(item)}：${reason}`
          );
        }
      } else if (merged.length > items.length) {
        toast.success(
          `AI 已补充 ${merged.length - items.length} 件衣物`
        );
      } else {
        toast.info('AI 没有新的衣物可补充');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'AI 辅助失败'));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="studio-name" className="flex items-center gap-1">
          名称
          <span className="text-xs text-muted-foreground font-normal ml-1">
            （保存到造型册时必填）
          </span>
        </Label>
        <Input
          id="studio-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="周五早午餐"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          场景
          <span className="text-destructive" aria-label="必填">*</span>
        </Label>
        <OccasionChips selected={occasion} onSelect={onOccasionChange} />
        {!occasion && (
          <p className="text-xs text-muted-foreground mt-1">
            保存前请选择一个场景。
          </p>
        )}
      </div>

      {warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {warnings.map((w) => (
                <li key={w} className="text-xs">
                  {w}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={items.length === 0 || !occasion || aiLoading}
        onClick={handleAiAssist}
      >
        {aiLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            AI 正在思考...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            按天气和场景补全
          </>
        )}
      </Button>
    </div>
  );
}
