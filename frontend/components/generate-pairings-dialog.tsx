'use client';

import { useState } from 'react';
import { CalendarDays, Check, Layers, Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useGeneratePairings } from '@/lib/hooks/use-pairings';
import { Item, Pairing } from '@/lib/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { itemColorZh, itemTitleZh, itemTypeZh } from '@/lib/zh-labels';
import { getDisplayImageUrl } from '@/lib/image-url';

interface GeneratePairingsDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Images now use signed URLs from backend (item.image_url, item.thumbnail_url)

export function GeneratePairingsDialog({
  item,
  open,
  onOpenChange,
}: GeneratePairingsDialogProps) {
  const [numPairings, setNumPairings] = useState(3);
  const [mode, setMode] = useState<'contextual' | 'inspiration'>('contextual');
  const [generatedPairings, setGeneratedPairings] = useState<Pairing[] | null>(null);
  const generatePairings = useGeneratePairings();
  const router = useRouter();

  const handleGenerate = async () => {
    if (!item) return;

    try {
      const result = await generatePairings.mutateAsync({
        itemId: item.id,
        numPairings,
      });
      setGeneratedPairings(result.pairings);
      toast.success(`已生成 ${result.generated} 套搭配`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成搭配失败';
      toast.error(message);
    }
  };

  const handleContextualRecommend = () => {
    if (!item) return;
    onOpenChange(false);
    setGeneratedPairings(null);
    router.push(`/dashboard/suggest?required_item=${item.id}`);
  };

  const handleViewPairings = () => {
    onOpenChange(false);
    setGeneratedPairings(null);
    router.push('/dashboard/pairings');
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedPairings(null);
    setMode('contextual');
  };

  if (!item) return null;

  const imageUrl = getDisplayImageUrl(item);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            搭配这件衣物
          </DialogTitle>
          <DialogDescription>
            选择是否结合当前天气和场景
          </DialogDescription>
        </DialogHeader>

        {!generatedPairings ? (
          // Generation form
          <div className="space-y-6 py-4 min-w-0">
            {/* Source item preview */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
              <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden relative border-2 border-primary/30">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={itemTitleZh(item)}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {itemTypeZh(item)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{itemTitleZh(item)}</p>
                {item.primary_color && (
                  <p className="text-sm text-muted-foreground">
                    {itemColorZh(item)} {itemTypeZh(item)}
                  </p>
                )}
              </div>
            </div>

            <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="contextual" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  天气场景
                </TabsTrigger>
                <TabsTrigger value="inspiration" className="gap-2">
                  <Layers className="h-4 w-4" />
                  单品灵感
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contextual" className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  进入推荐页后选择场景，系统会把这件衣物作为必搭项，并结合当前天气生成穿搭。
                </p>
              </TabsContent>

              <TabsContent value="inspiration" className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  生成不限定当天天气和场景的搭配灵感，适合先收藏多种组合。
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>搭配数量</Label>
                    <span className="text-sm font-medium text-primary">{numPairings}</span>
                  </div>
                  <Slider
                    value={[numPairings]}
                    onValueChange={([value]) => setNumPairings(value)}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // Success state
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-lg">
                已创建 {generatedPairings.length} 套搭配
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                可以在“搭配”页面查看它们
              </p>
            </div>

            {/* Preview of generated pairings */}
            <div className="flex justify-center gap-2 flex-wrap">
              {generatedPairings.slice(0, 3).map((pairing) => (
                <div
                  key={pairing.id}
                  className="flex gap-1 p-1 rounded-lg bg-muted border"
                >
                  {pairing.items.slice(0, 3).map((pairingItem) => {
                    const imageSrc = getDisplayImageUrl(pairingItem);

                    return (
                      <div
                        key={pairingItem.id}
                        className="w-8 h-8 rounded overflow-hidden relative"
                      >
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={itemTypeZh(pairingItem)}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted-foreground/20" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!generatedPairings ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              {mode === 'contextual' ? (
                <Button onClick={handleContextualRecommend}>
                  <CalendarDays className="h-4 w-4 mr-2" />
                  去推荐
                </Button>
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={generatePairings.isPending}
                >
                  {generatePairings.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      生成灵感
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                关闭
              </Button>
              <Button onClick={handleViewPairings}>
                查看搭配
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
