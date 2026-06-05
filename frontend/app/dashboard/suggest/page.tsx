'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Briefcase,
  Shirt,
  Heart,
  Dumbbell,
  TreePine,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Cloud,
  Sun,
  CloudRain,
  Loader2,
  AlertCircle,
  Thermometer,
  Droplets,
  ChevronDown,
  MapPin,
  Wind,
  GlassWater,
  Cloudy,
  CloudSun,
  Snowflake,
  CalendarDays,
  CloudLightning,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { api, ApiError, setAccessToken } from '@/lib/api';
import { OCCASIONS, Outfit, SuggestRequest, type Item } from '@/lib/types';
import { useWeather, Weather } from '@/lib/hooks/use-weather';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { useItem } from '@/lib/hooks/use-items';
import { ItemPicker } from '@/components/shared/item-picker';
import { cn } from '@/lib/utils';
import { TempUnit, formatTemp, displayValue, toF, toCelsius } from '@/lib/temperature';
import { OCCASION_ZH, TYPE_ZH, itemTitleZh } from '@/lib/zh-labels';
import { getDisplayImageUrl } from '@/lib/image-url';

// Map occasion values to icons and colors
const OCCASION_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  casual: { icon: <Shirt className="h-4 w-4" />, color: 'hover:border-blue-400 hover:bg-blue-50 data-[selected=true]:border-blue-500 data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700' },
  office: { icon: <Briefcase className="h-4 w-4" />, color: 'hover:border-slate-400 hover:bg-slate-50 data-[selected=true]:border-slate-500 data-[selected=true]:bg-slate-50 data-[selected=true]:text-slate-700' },
  formal: { icon: <GlassWater className="h-4 w-4" />, color: 'hover:border-purple-400 hover:bg-purple-50 data-[selected=true]:border-purple-500 data-[selected=true]:bg-purple-50 data-[selected=true]:text-purple-700' },
  date: { icon: <Heart className="h-4 w-4" />, color: 'hover:border-rose-400 hover:bg-rose-50 data-[selected=true]:border-rose-500 data-[selected=true]:bg-rose-50 data-[selected=true]:text-rose-700' },
  sporty: { icon: <Dumbbell className="h-4 w-4" />, color: 'hover:border-orange-400 hover:bg-orange-50 data-[selected=true]:border-orange-500 data-[selected=true]:bg-orange-50 data-[selected=true]:text-orange-700' },
  outdoor: { icon: <TreePine className="h-4 w-4" />, color: 'hover:border-green-400 hover:bg-green-50 data-[selected=true]:border-green-500 data-[selected=true]:bg-green-50 data-[selected=true]:text-green-700' },
};

// Weather condition to icon mapping
function getWeatherIcon(condition: string, isDay: boolean) {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return <CloudRain className="h-8 w-8" />;
  if (c.includes('snow')) return <Snowflake className="h-8 w-8" />;
  if (c.includes('thunder') || c.includes('storm')) return <CloudLightning className="h-8 w-8" />;
  if (c.includes('cloud') && c.includes('part')) return <CloudSun className="h-8 w-8" />;
  if (c.includes('cloud') || c.includes('overcast')) return <Cloudy className="h-8 w-8" />;
  return isDay ? <Sun className="h-8 w-8" /> : <Cloud className="h-8 w-8" />;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 17) return '下午好';
  return '晚上好';
}

function getWeatherHint(weather: Weather): string {
  const temp = weather.temperature;
  const condition = weather.condition.toLowerCase();

  if (weather.precipitation_chance > 50) return '记得带伞或雨衣';
  if (temp < 10) return '天气较冷，适合多穿几层';
  if (temp < 18) return '轻薄外套会很合适';
  if (temp > 28) return '建议选择轻薄透气的衣物';
  if (condition.includes('wind')) return '可以考虑防风外套';
  return '今天很适合自由搭配';
}

function weatherConditionZh(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return '雨';
  if (c.includes('snow')) return '雪';
  if (c.includes('thunder') || c.includes('storm')) return '雷暴';
  if (c.includes('cloud') && c.includes('part')) return '局部多云';
  if (c.includes('cloud') || c.includes('overcast')) return '多云';
  if (c.includes('sun') || c.includes('clear')) return '晴';
  return condition;
}

interface WeatherOverride {
  temperature: number;
  condition: 'sunny' | 'cloudy' | 'rainy';
}

function WeatherCard({
  weather,
  isLoading,
  error,
  temperatureUnit,
}: {
  weather?: Weather;
  isLoading: boolean;
  error?: unknown;
  temperatureUnit: TempUnit;
}) {
  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !weather) {
    const isLocationMissing = error instanceof ApiError && error.status === 400;
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              {isLocationMissing ? (
                <MapPin className="h-6 w-6 text-muted-foreground" />
              ) : (
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {isLocationMissing ? '尚未设置位置' : '天气暂时不可用'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isLocationMissing
                  ? '在设置中填写位置后，可以获得结合天气的建议'
                  : '可以稍后重试，或使用自定义天气继续获取建议'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weather) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">尚未设置位置</p>
              <p className="text-sm text-muted-foreground">
                在设置中填写位置后，可以获得结合天气的建议
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-foreground">
              {getWeatherIcon(weather.condition, weather.is_day)}
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{displayValue(weather.temperature, temperatureUnit)}</span>
                <span className="text-lg text-muted-foreground">{temperatureUnit === 'fahrenheit' ? '°F' : '°C'}</span>
              </div>
              <p className="text-sm text-muted-foreground">{weatherConditionZh(weather.condition)}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground sm:block sm:space-y-1 sm:text-right sm:text-sm">
            <div className="flex items-center gap-1.5 sm:justify-end">
              <Thermometer className="h-3.5 w-3.5" />
              <span>体感 {displayValue(weather.feels_like, temperatureUnit)}°</span>
            </div>
            <div className="flex items-center gap-1.5 sm:justify-end">
              <Droplets className="h-3.5 w-3.5" />
              <span>降雨 {weather.precipitation_chance}%</span>
            </div>
            <div className="flex items-center gap-1.5 sm:justify-end">
              <Wind className="h-3.5 w-3.5" />
              <span>{Math.round(weather.wind_speed)} km/h</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {getWeatherHint(weather)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function OccasionChips({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (occasion: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OCCASIONS.map((occasion) => {
        const config = OCCASION_CONFIG[occasion.value];
        return (
          <button
            key={occasion.value}
            onClick={() => onSelect(occasion.value)}
            data-selected={selected === occasion.value}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all',
              'border-muted bg-background',
              config?.color || 'hover:border-primary hover:bg-primary/5',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50'
            )}
          >
            {config?.icon}
            <span className="text-sm font-medium">
              {OCCASION_ZH[occasion.value] || occasion.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WeatherOverrideSection({
  weather,
  onChange,
  temperatureUnit,
}: {
  weather: WeatherOverride | null;
  onChange: (weather: WeatherOverride | null) => void;
  temperatureUnit: TempUnit;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const conditions = [
    { value: 'sunny', icon: <Sun className="h-4 w-4" />, label: '晴' },
    { value: 'cloudy', icon: <Cloud className="h-4 w-4" />, label: '多云' },
    { value: 'rainy', icon: <CloudRain className="h-4 w-4" />, label: '雨' },
  ] as const;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          <span>{weather ? '已使用自定义天气' : '自定义天气'}</span>
          {weather && (
            <Badge variant="secondary" className="text-xs">
              {conditions.find((c) => c.value === weather.condition)?.label || weather.condition}{' '}
              {formatTemp(weather.temperature, temperatureUnit)}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">天气</span>
            {weather && (
              <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
                重置
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {conditions.map((c) => (
              <button
                key={c.value}
                onClick={() =>
                  onChange({
                    temperature: weather?.temperature ?? 20,
                    condition: c.value,
                  })
                }
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
                  weather?.condition === c.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted bg-background hover:border-primary/50'
                )}
              >
                {c.icon}
                <span className="text-sm">{c.label}</span>
              </button>
            ))}
          </div>
          {weather && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">温度</span>
              <input
                type="range"
                min={temperatureUnit === 'fahrenheit' ? 14 : -10}
                max={temperatureUnit === 'fahrenheit' ? 104 : 40}
                value={temperatureUnit === 'fahrenheit' ? Math.round(toF(weather.temperature)) : weather.temperature}
                onChange={(e) => {
                  const raw = parseInt(e.target.value);
                  onChange({ ...weather, temperature: temperatureUnit === 'fahrenheit' ? Math.round(toCelsius(raw)) : raw });
                }}
                className="flex-1 accent-primary"
              />
              <span className="text-sm font-medium w-14 text-right">{formatTemp(weather.temperature, temperatureUnit)}</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RequiredItemsSection({
  selectedItems,
  limitMessage,
  onToggle,
  onRemove,
  onClearMessage,
}: {
  selectedItems: Item[];
  limitMessage: string | null;
  onToggle: (item: Item) => void;
  onRemove: (itemId: string) => void;
  onClearMessage: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIds = new Set(selectedItems.map((item) => item.id));

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="font-semibold">必须搭配</h2>
            <p className="text-sm text-muted-foreground">
              可选 1-2 件衣物，推荐会结合天气和场景来补完整套穿搭
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1">
              {isOpen ? '收起' : selectedItems.length ? '调整' : '选择'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
        </div>

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => {
              const imageSrc = getDisplayImageUrl(item);
              return (
                <div
                  key={item.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border bg-background px-2 py-1"
                >
                  <div className="relative h-7 w-7 overflow-hidden rounded-full bg-muted">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={item.name || item.type}
                        fill
                        className="object-cover"
                        sizes="28px"
                      />
                    ) : (
                      <Shirt className="m-1.5 h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="max-w-[160px] truncate text-sm font-medium">
                    {itemTitleZh(item)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`移除 ${itemTitleZh(item)}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {limitMessage && (
          <p className="text-xs text-amber-700">{limitMessage}</p>
        )}

        <CollapsibleContent>
          <div className="border-t pt-3">
            <ItemPicker
              selectedIds={selectedIds}
              onToggle={(item) => {
                onClearMessage();
                onToggle(item);
              }}
              emptyMessage="还没有可推荐的衣物"
              heightClass="h-[300px]"
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function OutfitResult({
  outfit,
  occasion,
  temperatureUnit,
  onAccept,
  onReject,
  onTryAnother,
  onNewRequest,
}: {
  outfit: Outfit;
  occasion: string;
  temperatureUnit: TempUnit;
  onAccept: () => void;
  onReject: () => void;
  onTryAnother: () => void;
  onNewRequest: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header with occasion and new request */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize text-sm px-3 py-1">
            {OCCASION_ZH[occasion] || occasion}
          </Badge>
          {outfit.scheduled_for && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {new Date(outfit.scheduled_for + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onNewRequest}>
          重新开始
        </Button>
      </div>

      {/* Weather info */}
      {outfit.weather && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-1.5">
            <Thermometer className="h-4 w-4" />
            <span>{formatTemp(outfit.weather.temperature, temperatureUnit)}</span>
            <span className="text-xs opacity-70">
              （体感 {displayValue(outfit.weather.feels_like, temperatureUnit)}°）
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="h-4 w-4" />
            <span>降雨 {outfit.weather.precipitation_chance}%</span>
          </div>
          <Badge variant="outline">
            {weatherConditionZh(outfit.weather.condition)}
          </Badge>
        </div>
      )}

      {/* Outfit Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">你的穿搭</h3>
          </div>
          {outfit.reasoning && (
            <p className="mt-2 text-base font-medium text-foreground">{outfit.reasoning}</p>
          )}
          {outfit.highlights && outfit.highlights.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {outfit.highlights.map((highlight, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {outfit.items.map((item) => {
              const imageSrc = getDisplayImageUrl(item);

              return (
                <Link
                  key={item.id}
                  href={`/dashboard/wardrobe?item=${item.id}`}
                  className="group relative rounded-xl border overflow-hidden bg-muted/30 hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square relative">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={item.name || item.type}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Shirt className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium truncate">
                      {itemTitleZh(item)}
                    </p>
                    {item.layer_type && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {TYPE_ZH[item.layer_type] || item.layer_type}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {outfit.style_notes && (
            <div className="mt-4 p-3 bg-muted rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">提示：</span> {outfit.style_notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-3 justify-center">
        <Button variant="outline" size="lg" onClick={onTryAnother} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          换一套
        </Button>
        <Button size="lg" onClick={onAccept} className="gap-2">
          <ThumbsUp className="h-4 w-4" />
          喜欢
        </Button>
        <Button variant="ghost" size="lg" onClick={onReject} className="px-3">
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function SuggestPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const requiredItemId = searchParams?.get('required_item') || '';
  const { data: weather, isLoading: weatherLoading, error: weatherError } = useWeather();
  const { data: prefs } = usePreferences();
  const { data: linkedRequiredItem } = useItem(requiredItemId);
  const temperatureUnit: TempUnit = prefs?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [occasionInitialized, setOccasionInitialized] = useState(false);
  const [initializedRequiredItemId, setInitializedRequiredItemId] = useState<string | null>(null);
  const [weatherOverride, setWeatherOverride] = useState<WeatherOverride | null>(null);
  const [requiredItems, setRequiredItems] = useState<Item[]>([]);
  const [requiredLimitMessage, setRequiredLimitMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefs?.default_occasion && !occasionInitialized && !selectedOccasion) {
      setSelectedOccasion(prefs.default_occasion);
      setOccasionInitialized(true);
    }
  }, [prefs, occasionInitialized, selectedOccasion]);

  useEffect(() => {
    if (!requiredItemId || initializedRequiredItemId === requiredItemId || !linkedRequiredItem) {
      return;
    }

    setRequiredItems((current) => {
      if (current.some((item) => item.id === linkedRequiredItem.id)) {
        return current;
      }
      return [linkedRequiredItem, ...current].slice(0, 2);
    });
    setInitializedRequiredItemId(requiredItemId);
  }, [requiredItemId, linkedRequiredItem, initializedRequiredItemId]);

  const handleRequiredItemToggle = (item: Item) => {
    setRequiredItems((current) => {
      if (current.some((selected) => selected.id === item.id)) {
        setRequiredLimitMessage(null);
        return current.filter((selected) => selected.id !== item.id);
      }

      if (current.length >= 2) {
        setRequiredLimitMessage('最多选择 2 件必须搭配的衣物');
        return current;
      }

      setRequiredLimitMessage(null);
      return [...current, item];
    });
  };

  const handleRequiredItemRemove = (itemId: string) => {
    setRequiredLimitMessage(null);
    setRequiredItems((current) => current.filter((item) => item.id !== itemId));
  };

  const handleGenerate = async () => {
    if (!selectedOccasion) return;

    if (session?.accessToken) {
      setAccessToken(session.accessToken as string);
    }

    setIsGenerating(true);
    setError(null);

    try {
      const request: SuggestRequest = {
        occasion: selectedOccasion,
      };

      if (requiredItems.length > 0) {
        request.include_items = requiredItems.map((item) => item.id);
      }

      if (weatherOverride) {
        request.weather_override = {
          temperature: weatherOverride.temperature,
          feels_like: weatherOverride.temperature,
          humidity: 50,
          precipitation_chance: weatherOverride.condition === 'rainy' ? 80 : weatherOverride.condition === 'cloudy' ? 30 : 10,
          condition: weatherOverride.condition,
        };
      }

      const result = await api.post<Outfit>('/outfits/suggest', request);
      setOutfit(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('生成穿搭建议失败，请重试');
      }
      console.error('Suggestion error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = async () => {
    if (!outfit) return;

    if (session?.accessToken) {
      setAccessToken(session.accessToken as string);
    }

    try {
      await api.post(`/outfits/${outfit.id}/accept`);
      setOutfit(null);
      setSelectedOccasion(null);
      setRequiredItems([]);
      setRequiredLimitMessage(null);
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleTryAnother = () => {
    setOutfit(null);
    handleGenerate();
  };

  const handleReject = async () => {
    if (!outfit) return;

    if (session?.accessToken) {
      setAccessToken(session.accessToken as string);
    }

    try {
      await api.post(`/outfits/${outfit.id}/reject`);
    } catch (err) {
      console.error('Reject error:', err);
    }

    setOutfit(null);
    handleGenerate();
  };

  const handleNewRequest = () => {
    setOutfit(null);
    setSelectedOccasion(null);
    setRequiredItems([]);
    setRequiredLimitMessage(null);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header with greeting */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}</h1>
        <p className="text-muted-foreground">
          一起为今天找到合适的穿搭
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!outfit ? (
        <div className="space-y-6">
          {/* Weather context */}
          <WeatherCard
            weather={weather}
            isLoading={weatherLoading}
            error={weatherError}
            temperatureUnit={temperatureUnit}
          />

          {/* Main selection card */}
          <Card>
            <CardContent className="p-4 space-y-5 sm:p-6 sm:space-y-6">
              {/* Occasion selection */}
              <div className="space-y-3">
                <h2 className="font-semibold">今天是什么场景？</h2>
                <OccasionChips
                  selected={selectedOccasion}
                  onSelect={setSelectedOccasion}
                />
              </div>

              {/* Weather override (collapsible) */}
              <WeatherOverrideSection
                weather={weatherOverride}
                onChange={setWeatherOverride}
                temperatureUnit={temperatureUnit}
              />

              <RequiredItemsSection
                selectedItems={requiredItems}
                limitMessage={requiredLimitMessage}
                onToggle={handleRequiredItemToggle}
                onRemove={handleRequiredItemRemove}
                onClearMessage={() => setRequiredLimitMessage(null)}
              />

              {/* Generate button */}
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleGenerate}
                  disabled={!selectedOccasion || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      正在生成穿搭...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      获取建议
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <OutfitResult
          outfit={outfit}
          occasion={selectedOccasion || 'casual'}
          temperatureUnit={temperatureUnit}
          onAccept={handleAccept}
          onReject={handleReject}
          onTryAnother={handleTryAnother}
          onNewRequest={handleNewRequest}
        />
      )}
    </div>
  );
}
