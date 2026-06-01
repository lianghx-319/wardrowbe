'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Shirt,
  Users,
  MapPin,
  Palette,
  Camera,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useCreateFamily, useJoinFamily } from '@/lib/hooks/use-family';
import { useUpdatePreferences } from '@/lib/hooks/use-preferences';
import { useCreateItem } from '@/lib/hooks/use-items';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, setAccessToken } from '@/lib/api';
import { CLOTHING_COLORS, CLOTHING_TYPES, StyleProfile } from '@/lib/types';
import { STYLE_ZH } from '@/lib/zh-labels';

const STEPS = [
  { id: 'welcome', title: '欢迎', icon: Shirt },
  { id: 'family', title: '家庭', icon: Users },
  { id: 'location', title: '位置', icon: MapPin },
  { id: 'preferences', title: '风格', icon: Palette },
  { id: 'upload', title: '第一件衣物', icon: Camera },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                isComplete
                  ? 'bg-primary text-primary-foreground'
                  : isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-8 h-1 mx-1 rounded ${
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  // Use unified auth hook to get user name (works in both auth modes)
  const { user } = useAuth();

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
          <Shirt className="w-12 h-12 text-primary" />
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          欢迎使用 Wardrowbe{user?.display_name ? `，${user.display_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          只需要几步，就能把你的数字衣橱准备好。
        </p>
      </div>
      <div className="grid gap-4 text-left max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">拍照记录衣物</p>
            <p className="text-sm text-muted-foreground">
              AI 会自动识别颜色、风格和更多标签
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Palette className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">获得个性化穿搭</p>
            <p className="text-sm text-muted-foreground">
              根据天气和你的偏好生成每日建议
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">和家人一起使用</p>
            <p className="text-sm text-muted-foreground">
              每个人都可以拥有自己的个性化衣橱
            </p>
          </div>
        </div>
      </div>
      <Button size="lg" onClick={onNext}>
        开始设置
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}

function FamilyStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const createFamily = useCreateFamily();
  const joinFamily = useJoinFamily();

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    try {
      await createFamily.mutateAsync(familyName.trim());
      toast.success('家庭已创建');
      onNext();
    } catch (error) {
      toast.error('创建家庭失败，请重试');
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      await joinFamily.mutateAsync(inviteCode.trim().toUpperCase());
      toast.success('已加入家庭');
      onNext();
    } catch (error) {
      toast.error('邀请码无效，请检查后重试');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">家庭设置</h2>
        <p className="text-muted-foreground mt-1">
          创建或加入家庭，共享衣橱体验
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        <Card
          className={`cursor-pointer transition-all ${
            mode === 'create' ? 'ring-2 ring-primary' : 'hover:border-primary/50'
          }`}
          onClick={() => setMode('create')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">创建家庭</CardTitle>
            <CardDescription>开始一个新的家庭空间</CardDescription>
          </CardHeader>
          {mode === 'create' && (
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="family-name">家庭名称</Label>
                  <Input
                    id="family-name"
                    placeholder="例如：韩家衣橱"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!familyName.trim() || createFamily.isPending}
                >
                  {createFamily.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  创建家庭
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            mode === 'join' ? 'ring-2 ring-primary' : 'hover:border-primary/50'
          }`}
          onClick={() => setMode('join')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">加入家庭</CardTitle>
            <CardDescription>使用邀请码加入</CardDescription>
          </CardHeader>
          {mode === 'join' && (
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">邀请码</Label>
                  <Input
                    id="invite-code"
                    placeholder="例如：ABC123XY"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={!inviteCode.trim() || joinFamily.isPending}
                >
                  {joinFamily.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  加入家庭
                </Button>
                {joinFamily.isError && (
                  <p className="text-sm text-destructive">邀请码无效</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="text-center">
        <Button variant="ghost" onClick={onSkip}>
          暂时跳过
        </Button>
      </div>
    </div>
  );
}

function LocationStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  // Use unified auth hook (token is already set by useAuth)
  const { session } = useAuth();
  const [locationName, setLocationName] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('当前浏览器不支持定位');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lon: longitude });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'User-Agent': 'WardrobeAI/1.0' } }
          );
          if (response.ok) {
            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
            const state = data.address?.state;
            const country = data.address?.country;
            if (city) {
              setLocationName(state ? `${city}, ${state}` : `${city}, ${country}`);
            } else if (data.display_name) {
              setLocationName(data.display_name.split(',').slice(0, 2).join(',').trim());
            }
          }
        } catch {
          setLocationName(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        }

        setDetecting(false);
      },
      (error) => {
        setDetecting(false);
        toast.error('无法获取位置，请手动输入');
      }
    );
  };

  const handleContinue = async () => {
    if (!locationName.trim()) return;

    setSaving(true);
    try {
      if (session?.accessToken) {
        setAccessToken(session.accessToken as string);
      }

      // Save location to user profile
      const updateData: Record<string, unknown> = {
        location_name: locationName.trim(),
      };

      if (coords) {
        updateData.location_lat = coords.lat;
        updateData.location_lon = coords.lon;
      }

      await api.patch('/users/me', updateData);
      toast.success('位置已保存');
      onNext();
    } catch (error) {
      toast.error('保存位置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">你的位置</h2>
        <p className="text-muted-foreground mt-1">
          用于生成适合天气的穿搭建议
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={detectLocation}
            disabled={detecting}
          >
            {detecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-2 h-4 w-4" />
            )}
            自动定位
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或手动输入</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">城市或位置名称</Label>
            <Input
              id="location"
              placeholder="例如：上海"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={!locationName.trim() || saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            继续
          </Button>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="ghost" onClick={onSkip}>
          暂时跳过
        </Button>
      </div>
    </div>
  );
}

function PreferencesStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [avoidColors, setAvoidColors] = useState<string[]>([]);
  const [styleProfile, setStyleProfile] = useState<StyleProfile>({
    casual: 50,
    formal: 50,
    sporty: 50,
    minimalist: 50,
    bold: 50,
  });
  const [saving, setSaving] = useState(false);
  const updatePreferences = useUpdatePreferences();

  const toggleColor = (color: string, list: 'favorite' | 'avoid') => {
    if (list === 'favorite') {
      if (favoriteColors.includes(color)) {
        setFavoriteColors(favoriteColors.filter((c) => c !== color));
      } else {
        setFavoriteColors([...favoriteColors, color]);
        // Remove from avoid if present
        setAvoidColors(avoidColors.filter((c) => c !== color));
      }
    } else {
      if (avoidColors.includes(color)) {
        setAvoidColors(avoidColors.filter((c) => c !== color));
      } else {
        setAvoidColors([...avoidColors, color]);
        // Remove from favorites if present
        setFavoriteColors(favoriteColors.filter((c) => c !== color));
      }
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await updatePreferences.mutateAsync({
        color_favorites: favoriteColors,
        color_avoid: avoidColors,
        style_profile: styleProfile,
      });
      toast.success('风格偏好已保存');
      onNext();
    } catch (error) {
      toast.error('保存偏好失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">你的风格</h2>
        <p className="text-muted-foreground mt-1">
          帮我们了解你的穿衣偏好
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">喜欢的颜色</CardTitle>
          <CardDescription>选择你喜欢穿的颜色</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CLOTHING_COLORS.map((color) => {
              const isSelected = favoriteColors.includes(color.value);
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => toggleColor(color.value, 'favorite')}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 scale-110'
                      : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {isSelected && (
                    <Check
                      className={`h-5 w-5 mx-auto ${
                        ['white', 'yellow', 'beige'].includes(color.value)
                          ? 'text-black'
                          : 'text-white'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">不想穿的颜色</CardTitle>
          <CardDescription>选择你尽量避免的颜色</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CLOTHING_COLORS.map((color) => {
              const isSelected = avoidColors.includes(color.value);
              return (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => toggleColor(color.value, 'avoid')}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    isSelected
                      ? 'border-destructive ring-2 ring-destructive/30 scale-110'
                      : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {isSelected && (
                    <span
                      className={`text-lg font-bold ${
                        ['white', 'yellow', 'beige'].includes(color.value)
                          ? 'text-black'
                          : 'text-white'
                      }`}
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">风格画像</CardTitle>
          <CardDescription>调整你对不同风格的偏好程度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(styleProfile).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>{STYLE_ZH[key] || key}</Label>
                <span className="text-sm text-muted-foreground">{value}%</span>
              </div>
              <Slider
                value={[value]}
                onValueChange={(vals) =>
                  setStyleProfile((prev) => ({ ...prev, [key]: vals[0] }))
                }
                min={0}
                max={100}
                step={10}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip}>
          暂时跳过
        </Button>
        <Button onClick={handleContinue} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          继续
        </Button>
      </div>
    </div>
  );
}

function UploadStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [itemType, setItemType] = useState('');
  const createItem = useCreateItem();

  // Clean up blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      // Revoke previous preview URL if exists
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const clearFile = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
  };

  const handleUpload = async () => {
    if (!file || !itemType) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', itemType);

    try {
      await createItem.mutateAsync(formData);
      toast.success('已添加到衣橱');
      onNext();
    } catch (error) {
      toast.error('上传失败，请重试');
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">添加第一件衣物</h2>
        <p className="text-muted-foreground mt-1">
          拍照或上传一张衣物图片
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {preview ? (
            <div className="space-y-4">
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="预览"
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={clearFile}
              >
                换一张照片
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="mb-2 text-sm font-medium">点击上传或拍照</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or HEIC</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
              />
            </label>
          )}

          {file && (
            <div className="space-y-2">
              <Label htmlFor="item-type">这是什么类型的衣物？</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型..." />
                </SelectTrigger>
                <SelectContent>
                  {CLOTHING_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={!file || !itemType || createItem.isPending}
          >
            {createItem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            添加到衣橱
          </Button>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="ghost" onClick={onSkip}>
          暂时跳过
        </Button>
      </div>
    </div>
  );
}

function CompleteStep({ onFinish, completing }: { onFinish: () => void; completing: boolean }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-24 h-24 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
          <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">设置完成</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          你的衣橱已准备好。继续添加衣物，就能获得个性化穿搭建议。
        </p>
      </div>
      <Button size="lg" onClick={onFinish} disabled={completing}>
        {completing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            正在完成...
          </>
        ) : (
          <>
            进入仪表盘
            <ArrowRight className="ml-2 w-5 h-5" />
          </>
        )}
      </Button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading, session } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const completeOnboarding = async () => {
    setCompleting(true);
    try {
      if (session?.accessToken) {
        setAccessToken(session.accessToken as string);
      }
      await api.post('/users/me/onboarding/complete');
      // Invalidate cached user data so dashboard sees onboarding_completed: true
      await queryClient.invalidateQueries({ queryKey: ['auth-user'] });
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      setCompleting(false);
      toast.error('完成设置失败，请重试');
    }
  };

  const handleFinish = () => {
    completeOnboarding();
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect to login if not authenticated (API call failed)
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  // If user already completed onboarding, redirect to dashboard
  if (user?.onboarding_completed) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {currentStep < STEPS.length && <StepIndicator currentStep={currentStep} />}

        <div className="py-8">
          {currentStep === 0 && <WelcomeStep onNext={nextStep} />}
          {currentStep === 1 && <FamilyStep onNext={nextStep} onSkip={nextStep} />}
          {currentStep === 2 && (
            <LocationStep
              onNext={nextStep}
              onSkip={nextStep}
            />
          )}
          {currentStep === 3 && <PreferencesStep onNext={nextStep} onSkip={nextStep} />}
          {currentStep === 4 && <UploadStep onNext={nextStep} onSkip={nextStep} />}
          {currentStep === STEPS.length && <CompleteStep onFinish={handleFinish} completing={completing} />}
        </div>

        {/* Navigation */}
        {currentStep > 0 && currentStep < STEPS.length && (
          <div className="flex justify-center mt-4">
            <Button variant="ghost" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
