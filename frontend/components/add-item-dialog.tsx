'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateItem, useBulkCreateItems, BulkUploadResponse } from '@/lib/hooks/use-items';
import { CLOTHING_TYPES, CLOTHING_COLORS } from '@/lib/types';
import { COLOR_ZH, TYPE_ZH } from '@/lib/zh-labels';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  // Single upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [notes, setNotes] = useState('');

  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<FileWithPreview[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkUploadResponse | null>(null);
  const [activeTab, setActiveTab] = useState('single');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Track blob URLs for cleanup on unmount
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const createItem = useCreateItem();
  const bulkCreateItems = useBulkCreateItems();

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  // Single file drop handler
  const onDropSingle = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Bulk file drop handler
  const onDropBulk = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileWithPreview[] = acceptedFiles.map((file) => {
      const preview = URL.createObjectURL(file);
      blobUrlsRef.current.add(preview);
      return {
        file,
        preview,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      };
    });
    setBulkFiles((prev) => {
      const combined = [...prev, ...newFiles];
      // Limit to 20 files
      return combined
    });
  }, []);

  const { getRootProps: getSingleRootProps, getInputProps: getSingleInputProps, isDragActive: isSingleDragActive } = useDropzone({
    onDrop: onDropSingle,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic', '.heif'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const { getRootProps: getBulkRootProps, getInputProps: getBulkInputProps, isDragActive: isBulkDragActive } = useDropzone({
    onDrop: onDropBulk,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic', '.heif'],
    },
    // maxFiles: 20,
    multiple: true,
  });

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    // Type is optional - AI will detect if not provided
    if (type) formData.append('type', type);
    if (name) formData.append('name', name);
    if (brand) formData.append('brand', brand);
    if (primaryColor) formData.append('primary_color', primaryColor);
    if (notes) formData.append('notes', notes);

    try {
      await createItem.mutateAsync(formData);
      handleClose();
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleBulkSubmit = async () => {
    if (bulkFiles.length === 0) return;

    try {
      const result = await bulkCreateItems.mutateAsync(bulkFiles.map((f) => f.file));
      setBulkResult(result);

      // Show toast based on results
      if (result.failed === 0) {
        toast.success(`已成功上传 ${result.successful} 件衣物`);
      } else if (result.successful === 0) {
        toast.error(`${result.failed} 件衣物全部上传失败`);
      } else {
        toast.warning(`已上传 ${result.successful} 件，失败 ${result.failed} 件`);
      }
    } catch (error) {
      console.error('Failed to bulk upload:', error);
      toast.error('上传衣物失败，请重试。');
    }
  };

  // Check if there are unsaved files that would be lost on close
  const hasUnsavedFiles = (file !== null) || (bulkFiles.length > 0 && !bulkResult);

  const handleCloseRequest = () => {
    // Show confirmation if there are unsaved files and not currently uploading
    if (hasUnsavedFiles && !createItem.isPending && !bulkCreateItems.isPending) {
      setShowCloseConfirm(true);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    // Single upload cleanup
    setFile(null);
    setPreview(null);
    setType('');
    setName('');
    setBrand('');
    setPrimaryColor('');
    setNotes('');

    // Bulk upload cleanup - also clean up from the ref
    bulkFiles.forEach((f) => {
      URL.revokeObjectURL(f.preview);
      blobUrlsRef.current.delete(f.preview);
    });
    setBulkFiles([]);
    setBulkResult(null);
    setActiveTab('single');
    setShowCloseConfirm(false);

    onOpenChange(false);
  };

  const clearSingleFile = () => {
    setFile(null);
    setPreview(null);
  };

  const removeBulkFile = (id: string) => {
    setBulkFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
        blobUrlsRef.current.delete(fileToRemove.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearBulkFiles = () => {
    bulkFiles.forEach((f) => {
      URL.revokeObjectURL(f.preview);
      blobUrlsRef.current.delete(f.preview);
    });
    setBulkFiles([]);
    setBulkResult(null);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleCloseRequest}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加衣物</DialogTitle>
          <DialogDescription>
            上传衣物照片，AI 会自动识别并打标
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">单件上传</TabsTrigger>
            <TabsTrigger value="bulk">批量上传</TabsTrigger>
          </TabsList>

          {/* Single Item Upload */}
          <TabsContent value="single" className="space-y-4">
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {!preview ? (
                <div
                  {...getSingleRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isSingleDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...getSingleInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isSingleDragActive
                      ? '把图片放到这里...'
                      : '拖入图片，或点击选择'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    支持 JPEG、PNG、WebP、HEIC
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={preview}
                    alt="预览"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={clearSingleFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="type">品类 <span className="text-muted-foreground font-normal">（留空则由 AI 判断）</span></Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder="让 AI 判断..." />
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
                  <Label htmlFor="name">名称（可选）</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：蓝色牛津衬衫"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="brand">品牌</Label>
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="例如：J.Crew"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="color">主色</Label>
                    <Select value={primaryColor} onValueChange={setPrimaryColor}>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择..." />
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">备注</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="补充说明..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseRequest}>
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={!file || createItem.isPending}
                >
                  {createItem.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在上传...
                    </>
                  ) : (
                    '添加衣物'
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Bulk Upload */}
          <TabsContent value="bulk" className="space-y-4">
            {!bulkResult ? (
              <>
                <div
                  {...getBulkRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isBulkDragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...getBulkInputProps()} />
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isBulkDragActive
                      ? '把图片放到这里...'
                      : '拖入多张图片，或点击选择'}
                  </p>
                  {/* <p className="mt-1 text-xs text-muted-foreground">
                    Up to 20 images (JPEG, PNG, WebP, HEIC)
                  </p> */}
                </div>

                {bulkFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        已选择 {bulkFiles.length} 张图片
                      
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearBulkFiles}
                      >
                        清空
                      </Button>
                    </div>

                    <ScrollArea className="h-[200px] rounded-md border p-2">
                      <div className="grid grid-cols-4 gap-2">
                        {bulkFiles.map((f) => (
                          <div key={f.id} className="relative group">
                            <img
                              src={f.preview}
                              alt={f.file.name}
                              className="w-full aspect-square object-cover rounded-md"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeBulkFile(f.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <p className="text-[10px] text-muted-foreground truncate mt-1 px-1">
                              {f.file.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <p className="text-xs text-muted-foreground">
                      所有衣物都会由 AI 自动打标，稍后可以编辑详情。
                    </p>
                  </div>
                )}

                {bulkCreateItems.isPending && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">正在上传 {bulkFiles.length} 件衣物...</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{bulkCreateItems.uploadProgress}%</span>
                    </div>
                    <Progress value={bulkCreateItems.uploadProgress} className="h-2" />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleCloseRequest}>
                    取消
                  </Button>
                  <Button
                    onClick={handleBulkSubmit}
                    disabled={bulkFiles.length === 0 || bulkCreateItems.isPending}
                  >
                    {bulkCreateItems.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在上传...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        上传 {bulkFiles.length} 件衣物
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Bulk Upload Results */
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 py-4">
                  {bulkResult.failed === 0 ? (
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  ) : bulkResult.successful === 0 ? (
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  ) : (
                    <AlertCircle className="h-12 w-12 text-yellow-500" />
                  )}
                </div>

                <div className="text-center">
                  <p className="text-lg font-medium">
                    已成功上传 {bulkResult.successful} / {bulkResult.total} 件
                  </p>
                  {bulkResult.failed > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {bulkResult.failed} 件上传失败
                    </p>
                  )}
                </div>

                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-3 space-y-2">
                    {bulkResult.results.map((result, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-2 rounded-md ${
                          result.success ? 'bg-green-500/10' : 'bg-destructive/10'
                        }`}
                      >
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.filename}</p>
                          {result.error && (
                            <p className="text-xs text-destructive">{result.error}</p>
                          )}
                        </div>
                        {result.item && (
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={clearBulkFiles}>
                    继续上传
                  </Button>
                  <Button onClick={handleClose}>
                    完成
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃已选择的图片？</AlertDialogTitle>
          <AlertDialogDescription>
            当前已选择 {activeTab === 'single' ? '1 张图片' : `${bulkFiles.length} 张图片`}，关闭窗口后这些选择会丢失。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction onClick={handleClose}>放弃</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
