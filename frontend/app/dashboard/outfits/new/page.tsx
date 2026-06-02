'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, AlertTriangle, ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { CanvasPanel } from '@/components/studio/canvas-panel';
import { DetailsPanel } from '@/components/studio/details-panel';
import { ItemPicker } from '@/components/shared/item-picker';
import { CloneToLookbookDialog } from '@/components/shared/clone-to-lookbook-dialog';
import { ApiError, getErrorMessage } from '@/lib/api';
import { useItems } from '@/lib/hooks/use-items';
import { useOutfit } from '@/lib/hooks/use-outfits';
import { useCreateStudioOutfit, usePatchOutfit } from '@/lib/hooks/use-studio';
import {
  INITIAL_STUDIO_STATE,
  studioReducer,
  type StudioItem,
} from '@/lib/studio/editor-state';
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type StudioDraft,
} from '@/lib/studio/draft-storage';
import type { Item } from '@/lib/types';
import { isWornImmutableError } from '@/lib/studio/errors';
import { computeEditLoadPhase } from '@/lib/studio/edit-load';

export default function StudioEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit') || undefined;
  const isEditMode = !!editId;

  const [state, dispatch] = useReducer(studioReducer, INITIAL_STUDIO_STATE);
  const [draftPrompted, setDraftPrompted] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<StudioDraft | null>(null);
  const [editLoaded, setEditLoaded] = useState(false);
  const [wornConflictOpen, setWornConflictOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

  const createMutation = useCreateStudioOutfit();
  const patchMutation = usePatchOutfit();

  const {
    data: editOutfit,
    isLoading: editLoading,
    isError: editIsError,
    error: editError,
    refetch: refetchEdit,
  } = useOutfit(editId);

  const editErrorStatus =
    editError instanceof ApiError ? editError.status : null;
  const editOutfitIsWorn = !!editOutfit?.feedback?.worn_at;

  useEffect(() => {
    if (!isEditMode || editLoaded || !editOutfit) return;
    if (editOutfit.feedback?.worn_at) return;
    const items: StudioItem[] = editOutfit.items.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name ?? null,
      thumbnail_url: item.thumbnail_url ?? null,
      medium_url: item.medium_url ?? null,
      image_url: item.image_url ?? null,
      primary_color: item.primary_color ?? null,
    }));
    dispatch({
      type: 'LOAD',
      state: {
        items,
        name: editOutfit.name ?? '',
        occasion: editOutfit.occasion ?? null,
      },
    });
    setEditLoaded(true);
    setDraftPrompted(true);
  }, [editOutfit, editLoaded, isEditMode]);

  useEffect(() => {
    if (isEditMode || draftPrompted) return;
    const draft = loadDraft();
    if (draft && draft.items.length > 0) {
      setPendingDraft(draft);
    }
    setDraftPrompted(true);
  }, [draftPrompted, isEditMode]);

  const draftItemCount = pendingDraft?.items.length ?? 0;
  const { data: draftItemsData } = useItems(
    pendingDraft
      ? { ids: pendingDraft.items.join(','), is_archived: false }
      : { is_archived: false },
    1,
    draftItemCount > 0 ? draftItemCount : 50
  );

  const handleResumeDraft = useCallback(() => {
    if (!pendingDraft || !draftItemsData?.items) return;
    const byId = new Map(draftItemsData.items.map((i) => [i.id, i]));
    const resumedItems: StudioItem[] = pendingDraft.items
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name ?? null,
        thumbnail_url: item.thumbnail_url ?? null,
        medium_url: item.medium_url ?? null,
        image_url: item.image_url ?? null,
        primary_color: item.primary_color ?? null,
      }));
    dispatch({
      type: 'LOAD',
      state: {
        items: resumedItems,
        name: pendingDraft.name,
        occasion: pendingDraft.occasion,
      },
    });
    setPendingDraft(null);
  }, [pendingDraft, draftItemsData]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setPendingDraft(null);
  }, []);

  useEffect(() => {
    if (isEditMode) return;
    if (!state.isDirty) return;
    const timer = setTimeout(() => {
      saveDraft({
        items: state.items.map((i) => i.id),
        name: state.name,
        occasion: state.occasion,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.items, state.name, state.occasion, isEditMode]);

  const selectedIds = useMemo(
    () => new Set(state.items.map((i) => i.id)),
    [state.items]
  );

  const handleToggle = useCallback((item: Item) => {
    const existing = state.items.find((i) => i.id === item.id);
    if (existing) {
      dispatch({ type: 'REMOVE_ITEM', itemId: item.id });
      return;
    }
    dispatch({
      type: 'ADD_ITEM',
      item: {
        id: item.id,
        type: item.type,
        name: item.name ?? null,
        thumbnail_url: item.thumbnail_url ?? null,
        medium_url: item.medium_url ?? null,
        image_url: item.image_url ?? null,
        primary_color: item.primary_color ?? null,
      },
    });
  }, [state.items]);

  const handleSave = async (markWorn: boolean) => {
    if (state.items.length === 0) {
      toast.error('请至少选择一件衣物');
      return;
    }
    if (!state.occasion) {
      toast.error('请选择场景');
      return;
    }

    if (isEditMode && editId) {
      try {
        await patchMutation.mutateAsync({
          id: editId,
          payload: {
            name: state.name.trim() || undefined,
            items: state.items.map((i) => i.id),
          },
        });
        toast.success('穿搭已更新');
        router.push(`/dashboard/outfits/${editId}`);
      } catch (error) {
        if (isWornImmutableError(error)) {
          setWornConflictOpen(true);
          return;
        }
        toast.error(getErrorMessage(error, '保存穿搭失败'));
      }
      return;
    }

    if (!markWorn && !state.name.trim()) {
      toast.error('保存到灵感册前，请先起一个名称');
      return;
    }

    try {
      await createMutation.mutateAsync({
        items: state.items.map((i) => i.id),
        occasion: state.occasion,
        name: state.name.trim() || undefined,
        scheduled_for: markWorn
          ? new Date().toISOString().slice(0, 10)
          : null,
        mark_worn: markWorn,
      });
      clearDraft();
      toast.success(markWorn ? '已保存并标记为已穿' : '已保存到灵感册');
      router.push(
        markWorn
          ? '/dashboard/outfits?filter=worn'
          : '/dashboard/outfits?filter=my-looks'
      );
    } catch (error) {
      toast.error(getErrorMessage(error, '保存穿搭失败'));
    }
  };

  const mutationPending = isEditMode ? patchMutation.isPending : createMutation.isPending;
  const canSave =
    state.items.length > 0 && state.occasion !== null && !mutationPending;

  const editPhase = isEditMode
    ? computeEditLoadPhase({
        isLoading: editLoading,
        isError: editIsError,
        errorStatus: editErrorStatus,
        hasData: !!editOutfit,
        isWorn: editOutfitIsWorn,
        editLoaded,
      })
    : 'ready';

  if (isEditMode && editPhase === 'loading') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEditMode && editPhase === 'missing') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-4 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold mb-1">找不到这套穿搭</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          这套穿搭已不存在，可能已在其他标签页或设备上删除。
        </p>
        <Button asChild>
          <Link href="/dashboard/outfits">返回穿搭</Link>
        </Button>
      </div>
    );
  }

  if (isEditMode && editPhase === 'error') {
    const isAuthError = editErrorStatus === 401 || editErrorStatus === 403;
    const headline = isAuthError
      ? '你不能编辑这套穿搭'
      : '无法加载这套穿搭';
    const body = isAuthError
      ? '你的登录可能已过期，或这套穿搭属于其他账号。'
      : '加载穿搭时出错，请检查连接后重试。';
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] px-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
        <h2 className="text-lg font-semibold mb-1">{headline}</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">{body}</p>
        <div className="flex gap-2">
          {!isAuthError && (
            <Button variant="outline" onClick={() => refetchEdit()}>
              重试
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard/outfits">返回穿搭</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isEditMode && editPhase === 'wornImmutable' && editOutfit && editId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-[60vh] px-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold mb-1">这套穿搭已经穿过</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            已穿过的穿搭会保留在穿着记录中，不能直接编辑。你可以另存为新的灵感册条目。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/outfits/${editId}`}>返回穿搭</Link>
            </Button>
            <Button onClick={() => setCloneDialogOpen(true)}>另存为新穿搭</Button>
          </div>
        </div>
        <CloneToLookbookDialog
          open={cloneDialogOpen}
          sourceOutfitId={editId}
          sourceOccasion={editOutfit.occasion}
          onClose={() => setCloneDialogOpen(false)}
          onSuccess={(newId) => router.push(`/dashboard/outfits/${newId}`)}
        />
      </>
    );
  }

  const cancelHref = isEditMode && editId ? `/dashboard/outfits/${editId}` : '/dashboard/outfits';

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background border-b px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href={cancelHref}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            取消
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 text-center text-base font-semibold sm:text-lg">
          {isEditMode ? '编辑穿搭' : '穿搭工作台'}
        </h1>
        <div className="flex min-w-0 flex-col items-end">
          <div className="flex max-w-full gap-1.5 sm:gap-2">
            {!isEditMode && (
              <Button
                variant="outline"
                size="sm"
                className="px-2 sm:px-3"
                disabled={!canSave}
                onClick={() => handleSave(true)}
              >
                {mutationPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '今天穿'
                )}
              </Button>
            )}
            <Button size="sm" className="px-2 sm:px-3" disabled={!canSave} onClick={() => handleSave(false)}>
              {mutationPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditMode ? (
                '保存修改'
              ) : (
                '保存到灵感册'
              )}
            </Button>
          </div>
          {!canSave && !mutationPending && (
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {state.items.length === 0 && state.occasion === null
                ? '请至少选择一件衣物和一个场景'
                : state.items.length === 0
                  ? '请至少选择一件衣物'
                  : state.occasion === null
                    ? '请选择场景'
                    : ''}
            </p>
          )}
        </div>
        </div>
      </div>

      {pendingDraft && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-blue-900">
            你有一个上次未保存的草稿，要继续编辑吗？
          </p>
          <div className="flex gap-2 sm:shrink-0">
            <Button size="sm" variant="outline" onClick={handleDiscardDraft}>
              重新开始
            </Button>
            <Button size="sm" onClick={handleResumeDraft}>
              继续草稿
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                画布
              </h2>
              <CanvasPanel
                items={state.items}
                onRemove={(id) => dispatch({ type: 'REMOVE_ITEM', itemId: id })}
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                详情
              </h2>
              <DetailsPanel
                items={state.items}
                name={state.name}
                occasion={state.occasion}
                onNameChange={(n) => dispatch({ type: 'SET_NAME', name: n })}
                onOccasionChange={(o) =>
                  dispatch({ type: 'SET_OCCASION', occasion: o })
                }
                onAiMerge={(merged) =>
                  dispatch({ type: 'REPLACE_CANVAS', items: merged })
                }
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              你的衣橱
            </h2>
            <ItemPicker
              selectedIds={selectedIds}
              onToggle={handleToggle}
              hideNeedsWash={true}
              emptyMessage="衣橱里还没有衣物，请先添加衣物。"
              heightClass="h-[280px]"
            />
          </div>
        </div>
      </div>

      <AlertDialog open={wornConflictOpen} onOpenChange={setWornConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>这套穿搭已经穿过</AlertDialogTitle>
            <AlertDialogDescription>
              已穿过的穿搭会保留在穿着记录中，不能直接编辑。要把修改另存为新的灵感册条目吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>放弃修改</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setWornConflictOpen(false);
                setCloneDialogOpen(true);
              }}
            >
              另存为新穿搭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isEditMode && editId && editOutfit && (
        <CloneToLookbookDialog
          open={cloneDialogOpen}
          sourceOutfitId={editId}
          sourceOccasion={editOutfit.occasion}
          onClose={() => setCloneDialogOpen(false)}
          onSuccess={(newId) => router.push(`/dashboard/outfits/${newId}`)}
        />
      )}
    </div>
  );
}
