'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Heart,
  Pencil,
  Trash2,
  X,
  Loader2,
  Calendar,
  Tag,
  Palette,
  Shirt,
  Sparkles,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Eraser,
  Layers,
  Droplets,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Star,
  ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useUpdateItem, useDeleteItem, useReanalyzeItem, useMarkItemNotDuplicate, useRotateImage, useRemoveBackground, useLogWash, useWashHistory, useItemWearStats, useItemWearHistory, useAddItemImage, useDeleteItemImage, useSetPrimaryImage } from '@/lib/hooks/use-items';
import { Item, CLOTHING_TYPES, CLOTHING_COLORS } from '@/lib/types';
import {
  COLOR_ZH,
  FEATURE_ZH,
  TYPE_ZH,
  WARMTH_ZH,
  WEATHER_ZH,
  itemColorZh,
  itemTitleZh,
  itemTypeZh,
} from '@/lib/zh-labels';
import { ColorEyedropper } from '@/components/color-eyedropper';
import { GeneratePairingsDialog } from '@/components/generate-pairings-dialog';
import { useFeatures } from '@/lib/hooks/use-features';

interface ItemDetailDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Images now use signed URLs from backend (item.image_url, item.thumbnail_url)

export function ItemDetailDialog({ item, open, onOpenChange }: ItemDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPairingsDialog, setShowPairingsDialog] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [editForm, setEditForm] = useState({
    name: '',
    type: '',
    subtype: '',
    brand: '',
    primary_color: '',
    notes: '',
    favorite: false,
    wash_interval: undefined as number | undefined,
  });
  const [showWashHistory, setShowWashHistory] = useState(false);
  const [showWearHistory, setShowWearHistory] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [primaryImageFallbackIndex, setPrimaryImageFallbackIndex] = useState(0);

  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const reanalyzeItem = useReanalyzeItem();
  const markNotDuplicate = useMarkItemNotDuplicate();
  const rotateImage = useRotateImage();
  const removeBackground = useRemoveBackground();
  const { data: features } = useFeatures();
  const logWash = useLogWash();
  const { data: washHistory } = useWashHistory(item?.id || '');
  const { data: wearStats } = useItemWearStats(item?.id || '');
  const { data: wearHistory } = useItemWearHistory(item?.id || '', 20);
  const addImage = useAddItemImage();
  const deleteImage = useDeleteItemImage();
  const setPrimary = useSetPrimaryImage();

  useEffect(() => {
    if (item) {
      setEditForm({
        name: item.name || '',
        type: item.type,
        subtype: item.subtype || '',
        brand: item.brand || '',
        primary_color: item.primary_color || '',
        notes: item.notes || '',
        favorite: item.favorite,
        wash_interval: item.wash_interval ?? undefined,
      });
      setIsEditing(false);
      setActiveImageIndex(0);
      setPrimaryImageFallbackIndex(0);
    }
  }, [item?.id]);

  if (!item) return null;

  const handleSave = async () => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: {
          name: editForm.name || undefined,
          type: editForm.type,
          subtype: editForm.subtype || undefined,
          brand: editForm.brand || undefined,
          primary_color: editForm.primary_color || undefined,
          notes: editForm.notes || undefined,
          favorite: editForm.favorite,
          wash_interval: editForm.wash_interval,
        },
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleMarkWashed = async () => {
    try {
      await logWash.mutateAsync({ id: item.id });
      toast.success('已标记为清洗');
    } catch (error) {
      console.error('Failed to log wash:', error);
      toast.error('标记清洗失败');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync(item.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
      toast.success('衣物已删除', {
        description: item.name ? `“${item.name}”已移除。` : '衣物已从衣橱移除。',
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('删除失败', {
        description: '出现问题，请重试。',
      });
    }
  };

  const handleToggleFavorite = async () => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: { favorite: !item.favorite },
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleReanalyze = async () => {
    try {
      await reanalyzeItem.mutateAsync(item.id);
      // Status will update to 'processing' and UI will reflect it
    } catch (error) {
      console.error('Failed to trigger re-analysis:', error);
    }
  };

  const handleMarkNotDuplicate = async () => {
    try {
      await markNotDuplicate.mutateAsync(item.id);
      toast.success('已标记为非重复，并加入 AI 分析队列');
    } catch (error) {
      console.error('Failed to mark item as not duplicate:', error);
      toast.error('标记失败');
    }
  };

  const handleRotate = async (direction: 'cw' | 'ccw') => {
    try {
      await rotateImage.mutateAsync({ id: item.id, direction });
      setImageKey((k) => k + 1);
      toast.success('图片已旋转');
    } catch (error) {
      console.error('Failed to rotate image:', error);
      toast.error('旋转图片失败');
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await removeBackground.mutateAsync({ id: item.id });
      setImageKey((k) => k + 1);
      toast.success('背景已移除');
    } catch (error) {
      console.error('Failed to remove background:', error);
      toast.error('移除背景失败');
    }
  };

  const isAnalyzing = reanalyzeItem.isPending || markNotDuplicate.isPending || item.status === 'processing';
  const isImmichItem = item.image_source === 'immich';

  // Use signed URL from backend for better quality in detail view
  const imageUrl = item.medium_url || item.image_url || item.thumbnail_url || item.image_path || '';
  const primaryImageCandidates = [item.medium_url, item.image_url, item.thumbnail_url, item.image_path]
    .filter((url): url is string => !!url);
  const primaryImageUrl = primaryImageCandidates[
    Math.min(primaryImageFallbackIndex, Math.max(primaryImageCandidates.length - 1, 0))
  ] || imageUrl;
  const colorInfo = CLOTHING_COLORS.find((c) => c.value === item.primary_color);
  const typeInfo = CLOTHING_TYPES.find((t) => t.value === item.type);
  const displayTitle = itemTitleZh(item);
  const displayType = itemTypeZh(item);
  const displayColor = itemColorZh(item);

  // AI-generated tags
  const tags = item.tags || {};
  const zhTags = item.tags_zh || {};
  const hasAiTags = !!(tags.colors?.length || tags.pattern || tags.material ||
                   tags.style?.length || tags.season?.length || tags.formality || tags.fit ||
                   tags.occasion?.length || tags.condition || tags.features?.length);
  const aiDescription = item.ai_description_zh || item.ai_description;
  const estimatedConfidence = Number(item.ai_confidence ?? 0);
  const modelConfidence = item.tags?.logprobs_confidence;
  const aiProvider = item.tags?.ai_provider || (
    typeof item.ai_raw_response?.provider === 'string' ? item.ai_raw_response.provider : undefined
  );
  const aiModel = item.tags?.ai_model || (
    typeof item.ai_raw_response?.model === 'string' ? item.ai_raw_response.model : undefined
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden [&>button]:hidden">
          {/* Header - sticky */}
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 border-b flex-shrink-0">
            <DialogTitle className="text-xl min-w-0 truncate">
              {displayTitle || typeInfo?.label || item.type}
            </DialogTitle>
              <div className="flex items-center gap-0.5 sm:gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleFavorite}
                disabled={updateItem.isPending}
                title="切换收藏"
              >
                <Heart
                  className={`h-5 w-5 ${
                    item.favorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                  }`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPairingsDialog(true)}
                disabled={item.status !== 'ready'}
                title="查找可搭配穿搭"
              >
                <Layers className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReanalyze}
                disabled={isAnalyzing}
                title={isAnalyzing ? 'AI 分析中...' : '重新 AI 分析'}
              >
                <RefreshCw
                  className={`h-5 w-5 ${isAnalyzing ? 'animate-spin text-primary' : ''}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRotate('ccw')}
                disabled={rotateImage.isPending || isImmichItem}
                title={isImmichItem ? 'Immich 图片不能在 Wardrowbe 中编辑' : '向左旋转'}
              >
                {rotateImage.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRotate('cw')}
                disabled={rotateImage.isPending || isImmichItem}
                title={isImmichItem ? 'Immich 图片不能在 Wardrowbe 中编辑' : '向右旋转'}
              >
                {rotateImage.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RotateCw className="h-5 w-5" />
                )}
              </Button>
              {features?.background_removal && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveBackground}
                  disabled={removeBackground.isPending || !item.image_url || isImmichItem}
                  title={isImmichItem ? 'Immich 图片不能在 Wardrowbe 中编辑' : '移除背景'}
                >
                  {removeBackground.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Eraser className="h-5 w-5" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(!isEditing)}
                title={isEditing ? '取消编辑' : '编辑衣物'}
              >
                {isEditing ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Pencil className="h-5 w-5" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full" title="关闭">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 pt-3 sm:p-6 sm:pt-4">
            {item.possible_duplicate && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">可能重复</p>
                    <p className="text-xs text-amber-900">
                      这张图片和已有衣物较相似，已导入但暂未触发 AI 分析。
                      {item.duplicate_distance != null && ` 相似距离：${item.duplicate_distance}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 border-amber-300 bg-white/70"
                    onClick={handleMarkNotDuplicate}
                    disabled={markNotDuplicate.isPending}
                  >
                    {markNotDuplicate.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    不是重复
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 [&>*]:min-w-0">
            {/* Image Gallery */}
            <div className="space-y-2">
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                {(() => {
                  const withVersion = (url: string) => {
                    if (!url) return '';
                    return `${url}${url.includes('?') ? '&' : '?'}v=${imageKey}`;
                  };
                  const allImages = [
                    { url: withVersion(primaryImageUrl), id: 'primary' },
                    ...(item.additional_images || []).map((img) => ({ url: img.image_url, id: img.id })),
                  ].filter((img) => !!img.url);
                  const currentImage = allImages[activeImageIndex] || allImages[0];
                  return (
                    <>
                      {currentImage ? (
                        <Image
                          key={`${currentImage.id}-${currentImage.url}`}
                          src={currentImage.url}
                          alt={displayTitle || item.type}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 50vw"
                          onError={() => {
                            if (currentImage.id === 'primary' && primaryImageFallbackIndex < primaryImageCandidates.length - 1) {
                              setPrimaryImageFallbackIndex((idx) => idx + 1);
                              return;
                            }
                            if (isImmichItem) {
                              toast.error('Immich 图片暂时不可用，请重新绑定或检查相册');
                            } else {
                              toast.error('图片加载失败');
                            }
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-sm">暂无可显示图片</span>
                        </div>
                      )}
                      {allImages.length > 1 && (
                        <>
                          <button
                            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                            onClick={() => setActiveImageIndex((i) => (i - 1 + allImages.length) % allImages.length)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                            onClick={() => setActiveImageIndex((i) => (i + 1) % allImages.length)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {allImages.map((_, idx) => (
                              <button
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${idx === activeImageIndex ? 'bg-white' : 'bg-white/50'}`}
                                onClick={() => setActiveImageIndex(idx)}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                    <span className="text-white text-sm font-medium">AI 分析中...</span>
                  </div>
                )}
              </div>
              {/* Thumbnail strip */}
              {(item.additional_images?.length > 0 || isEditing) && (
                <div className="flex gap-1.5 overflow-x-auto">
                  <button
                    className={`relative w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 ${activeImageIndex === 0 ? 'border-primary' : 'border-transparent'}`}
                    onClick={() => setActiveImageIndex(0)}
                  >
                    <Image src={imageUrl} alt="主图" fill className="object-cover" sizes="48px" />
                  </button>
                  {(item.additional_images || []).map((img, idx) => (
                    <div key={img.id} className="relative flex-shrink-0">
                      <button
                        className={`relative w-12 h-12 rounded border-2 overflow-hidden ${activeImageIndex === idx + 1 ? 'border-primary' : 'border-transparent'}`}
                        onClick={() => setActiveImageIndex(idx + 1)}
                      >
                        <Image src={img.thumbnail_url || img.image_url} alt="" fill className="object-cover" sizes="48px" />
                      </button>
                      {isEditing && (
                        <div className="absolute -top-1 -right-1 flex gap-0.5">
                          <button
                            className="bg-primary text-primary-foreground rounded-full p-0.5 hover:bg-primary/90"
                            title="设为主图"
                            onClick={() => {
                              setPrimary.mutate({ itemId: item.id, imageId: img.id });
                              setActiveImageIndex(0);
                            }}
                          >
                            <Star className="h-2.5 w-2.5" />
                          </button>
                          <button
                            className="bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90"
                            title="删除图片"
                            onClick={() => {
                              deleteImage.mutate({ itemId: item.id, imageId: img.id });
                              if (activeImageIndex > idx) setActiveImageIndex((i) => i - 1);
                            }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {isEditing && (item.additional_images?.length || 0) < 4 && (
                    <label
                      className="w-12 h-12 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 flex-shrink-0"
                    >
                      {addImage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            addImage.mutate({ itemId: item.id, file });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4">
              {isEditing ? (
                // Edit form
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>名称</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="衣物名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>品类</Label>
                    <Select
                      value={editForm.type}
                      onValueChange={(v) => setEditForm({ ...editForm, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLOTHING_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {TYPE_ZH[t.value] || t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>品牌</Label>
                    <Input
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      placeholder="品牌名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>主色</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editForm.primary_color}
                        onValueChange={(v) => setEditForm({ ...editForm, primary_color: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="选择颜色" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLOTHING_COLORS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border"
                                  style={{ backgroundColor: c.hex }}
                                />
                                {COLOR_ZH[c.value] || c.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ColorEyedropper
                        imageUrl={imageUrl}
                        onColorSelect={(color) => setEditForm({ ...editForm, primary_color: color })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>备注</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="补充说明..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>清洗间隔（穿着次数）</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={editForm.wash_interval ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, wash_interval: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder={`默认：${item.effective_wash_interval}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      达到该穿着次数后提示清洗，留空则使用默认值。
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsEditing(false)}
                    >
                      取消
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSave}
                      disabled={updateItem.isPending}
                    >
                      {updateItem.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="space-y-4">
                  {/* Basic info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Shirt className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{displayType || typeInfo?.label || item.type}</span>
                      {item.subtype && (
                        <span className="text-muted-foreground">• {item.subtype}</span>
                      )}
                    </div>
                    {item.brand && (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span>{item.brand}</span>
                      </div>
                    )}
                    {colorInfo && (
                      <div className="flex items-center gap-2 text-sm">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: colorInfo.hex }}
                        />
                        <span>{displayColor || colorInfo.name}</span>
                      </div>
                    )}
                    {item.wear_count > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          穿过 {item.wear_count} 次
                          {item.last_worn_at && (
                            <span className="text-muted-foreground">
                              {' '}• 最近：{new Date(item.last_worn_at).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Wash Status */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Droplets className={`h-4 w-4 ${item.needs_wash ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        清洗状态
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleMarkWashed}
                        disabled={logWash.isPending}
                      >
                        {logWash.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Droplets className="h-3 w-3 mr-1" />
                        )}
                        标记已洗
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>清洗后穿着：{item.wears_since_wash}/{item.effective_wash_interval}</span>
                        {item.needs_wash && (
                          <span className="text-amber-500 font-medium">需要清洗</span>
                        )}
                      </div>
                      <Progress
                        value={Math.min((item.wears_since_wash / item.effective_wash_interval) * 100, 100)}
                        className={`h-2 ${item.needs_wash ? '[&>div]:bg-amber-500' : ''}`}
                      />
                      {item.last_washed_at && (
                        <p className="text-xs text-muted-foreground">
                          最近清洗：{new Date(item.last_washed_at).toLocaleDateString('zh-CN')}
                        </p>
                      )}
                    </div>

                    {/* Wash History */}
                    {washHistory && washHistory.length > 0 && (
                      <Collapsible open={showWashHistory} onOpenChange={setShowWashHistory}>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronDown className={`h-3 w-3 transition-transform ${showWashHistory ? 'rotate-180' : ''}`} />
                          清洗记录（{washHistory.length}）
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1.5 space-y-1">
                          {washHistory.map((wash) => (
                            <div key={wash.id} className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{new Date(wash.washed_at).toLocaleDateString()}</span>
                              {wash.method && <Badge variant="outline" className="text-[10px] h-4">{wash.method}</Badge>}
                              {wash.notes && <span className="truncate">{wash.notes}</span>}
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>

                  {/* Wear History */}
                  {item.wear_count > 0 && wearStats && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        穿着记录
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/50 rounded-md p-2">
                          <p className="text-muted-foreground">总穿着</p>
                          <p className="font-medium text-sm">{wearStats.total_wears}</p>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2">
                          <p className="text-muted-foreground">最近穿着</p>
                          <p className="font-medium text-sm">
                            {wearStats.days_since_last_worn === null
                              ? '从未'
                              : wearStats.days_since_last_worn === 0
                              ? '今天'
                              : `${wearStats.days_since_last_worn} 天前`}
                          </p>
                        </div>
                        <div className="bg-muted/50 rounded-md p-2">
                          <p className="text-muted-foreground">月均</p>
                          <p className="font-medium text-sm">{wearStats.average_wears_per_month}</p>
                        </div>
                        {wearStats.most_common_occasion && (
                          <div className="bg-muted/50 rounded-md p-2">
                            <p className="text-muted-foreground">常见场合</p>
                            <p className="font-medium text-sm capitalize">{wearStats.most_common_occasion}</p>
                          </div>
                        )}
                      </div>

                      {/* Mini bar chart - wear by month */}
                      {Object.keys(wearStats.wear_by_month).length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">最近 6 个月</p>
                          <div className="flex items-end gap-1 h-12">
                            {Object.entries(wearStats.wear_by_month).map(([month, count]) => {
                              const maxCount = Math.max(...Object.values(wearStats.wear_by_month), 1);
                              const height = (count / maxCount) * 100;
                              return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-0.5" title={`${month}: ${count} 次`}>
                                  <div
                                    className="w-full bg-primary/70 rounded-t-sm min-h-[2px]"
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                  />
                                  <span className="text-[9px] text-muted-foreground">{month.split('-')[1]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Wear timeline */}
                      {wearHistory && wearHistory.length > 0 && (
                        <Collapsible open={showWearHistory} onOpenChange={setShowWearHistory}>
                          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronDown className={`h-3 w-3 transition-transform ${showWearHistory ? 'rotate-180' : ''}`} />
                            时间线（{wearHistory.length} 条）
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1.5 space-y-1.5">
                            {wearHistory.map((entry) => (
                              <div key={entry.id} className="text-xs flex items-start gap-2">
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {new Date(entry.worn_at).toLocaleDateString()}
                                </span>
                                {entry.occasion && (
                                  <Badge variant="outline" className="text-[10px] h-4">{entry.occasion}</Badge>
                                )}
                                {entry.outfit && (
                                  <div className="flex -space-x-1">
                                    {entry.outfit.items.slice(0, 3).map((oi) => (
                                      <div
                                        key={oi.id}
                                        className="w-5 h-5 rounded-full bg-muted border-2 border-background overflow-hidden"
                                        title={oi.name || oi.type}
                                      >
                                        {oi.thumbnail_url && (
                                          <Image
                                            src={oi.thumbnail_url}
                                            alt={oi.name || oi.type}
                                            width={20}
                                            height={20}
                                            className="object-cover w-full h-full"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )}

                  {/* AI Analysis */}
                  {(hasAiTags || aiDescription) && item.status === 'ready' && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI 分析
                        {estimatedConfidence > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            标签完整度 {Math.round(estimatedConfidence * 100)}%
                          </Badge>
                        )}
                        {modelConfidence != null ? (
                          <Badge variant="outline" className="text-xs">
                            模型置信度 {Math.round(modelConfidence * 100)}%
                          </Badge>
                        ) : estimatedConfidence > 0 && (
                          <Badge variant="outline" className="text-xs">
                            估算置信度 {Math.round(estimatedConfidence * 100)}%
                          </Badge>
                        )}
                        {aiModel && (
                          <Badge variant="outline" className="max-w-full text-xs">
                            {aiProvider ? `${aiProvider} · ` : ''}{aiModel}
                          </Badge>
                        )}
                      </div>
                      {aiDescription && (
                        <p className="text-sm text-muted-foreground italic">
                          &ldquo;{aiDescription}&rdquo;
                        </p>
                      )}
                      {hasAiTags && <div className="flex flex-wrap gap-1.5">
                        {(zhTags.colors?.length ? zhTags.colors : tags.colors)?.map((color) => (
                          <Badge key={color} variant="outline" className="text-xs">
                            {color}
                          </Badge>
                        ))}
                        {(zhTags.pattern || tags.pattern) && (
                          <Badge variant="outline" className="text-xs">
                            {zhTags.pattern || tags.pattern}
                          </Badge>
                        )}
                        {(zhTags.material || tags.material) && (
                          <Badge variant="outline" className="text-xs">
                            {zhTags.material || tags.material}
                          </Badge>
                        )}
                        {(zhTags.style?.length ? zhTags.style : tags.style)?.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                        {(zhTags.season?.length ? zhTags.season : tags.season)?.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                        {(zhTags.formality || tags.formality) && (
                          <Badge variant="outline" className="text-xs">
                            {zhTags.formality || tags.formality}
                          </Badge>
                        )}
                        {(zhTags.fit || tags.fit) && (
                          <Badge variant="outline" className="text-xs">
                            {zhTags.fit || `${tags.fit} fit`}
                          </Badge>
                        )}
                        {tags.occasion?.map((o: string) => (
                          <Badge key={o} variant="outline" className="text-xs">
                            {o}
                          </Badge>
                        ))}
                        {(zhTags.warmth_level || tags.warmth_level) && (
                          <Badge variant="outline" className="text-xs">
                            保暖：{zhTags.warmth_level || WARMTH_ZH[tags.warmth_level] || tags.warmth_level}
                          </Badge>
                        )}
                        {tags.temperature_min_c != null && tags.temperature_max_c != null && (
                          <Badge variant="outline" className="text-xs">
                            适合 {tags.temperature_min_c}-{tags.temperature_max_c}°C
                          </Badge>
                        )}
                        {(zhTags.weather_suitability?.length ? zhTags.weather_suitability : tags.weather_suitability)?.map((w: string) => (
                          <Badge key={`weather-${w}`} variant="outline" className="text-xs">
                            适合{WEATHER_ZH[w] || w}
                          </Badge>
                        ))}
                        {(zhTags.weather_avoid?.length ? zhTags.weather_avoid : tags.weather_avoid)?.map((w: string) => (
                          <Badge key={`avoid-${w}`} variant="outline" className="text-xs">
                            避免{WEATHER_ZH[w] || w}
                          </Badge>
                        ))}
                        {(zhTags.condition || tags.condition) && (
                          <Badge variant="outline" className="text-xs">
                            {zhTags.condition || tags.condition}
                          </Badge>
                        )}
                        {(zhTags.features?.length ? zhTags.features : tags.features)?.map((f: string) => (
                          <Badge key={f} variant="outline" className="text-xs">
                            {FEATURE_ZH[f] || f}
                          </Badge>
                        ))}
                      </div>}
                    </div>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-sm font-medium">备注</p>
                      <p className="text-sm text-muted-foreground">{item.notes}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    添加于 {new Date(item.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Delete button - separated from other actions for safety */}
            {!isEditing && (
              <div className="pt-4 border-t mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除这件衣物
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这件衣物？</AlertDialogTitle>
            <AlertDialogDescription>
              这会从衣橱中永久删除“{item.name || displayType || item.type}”，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteItem.isPending}
            >
              {deleteItem.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Pairings Dialog */}
      <GeneratePairingsDialog
        item={item}
        open={showPairingsDialog}
        onOpenChange={setShowPairingsDialog}
      />
    </>
  );
}
