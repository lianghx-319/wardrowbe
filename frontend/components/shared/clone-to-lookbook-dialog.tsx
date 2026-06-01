'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCloneToLookbook } from '@/lib/hooks/use-studio';
import { getErrorMessage } from '@/lib/api';
import { OCCASION_ZH } from '@/lib/zh-labels';

interface CloneToLookbookDialogProps {
  open: boolean;
  sourceOutfitId: string;
  sourceOccasion: string;
  onClose: () => void;
  onSuccess?: (newOutfitId: string) => void;
}

function defaultCloneName(occasion: string): string {
  const occasionTitle = OCCASION_ZH[occasion] || occasion;
  return `${occasionTitle} - ${format(new Date(), 'M月d日')}`;
}

export function CloneToLookbookDialog({
  open,
  sourceOutfitId,
  sourceOccasion,
  onClose,
  onSuccess,
}: CloneToLookbookDialogProps) {
  const [name, setName] = useState(() => defaultCloneName(sourceOccasion));
  const clone = useCloneToLookbook(sourceOutfitId);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('请输入名称');
      return;
    }
    try {
      const result = await clone.mutateAsync({ name: trimmed });
      toast.success('已保存到造型册');
      onSuccess?.(result.id);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, '保存到造型册失败'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>保存到造型册</DialogTitle>
          <DialogDescription>
            给这套造型起个名字，方便之后查找和再次穿着。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="lookbook-name">名称</Label>
          <Input
            id="lookbook-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="周五早午餐"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={clone.isPending}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={clone.isPending || !name.trim()}
          >
            {clone.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
