// API response types matching backend schemas

export interface ItemTags {
  colors: string[];
  primary_color?: string;
  pattern?: string;
  material?: string;
  style: string[];
  season: string[];
  formality?: string;
  fit?: string;
  occasion?: string[];
  brand?: string;
  condition?: string;
  features?: string[];
  weather_suitability?: string[];
  weather_avoid?: string[];
  temperature_min_c?: number;
  temperature_max_c?: number;
  warmth_level?: string;
  logprobs_confidence?: number;
  ai_provider?: string;
  ai_model?: string;
  ai_models?: Record<string, {
    task?: string;
    provider?: string;
    model?: string;
    configured_model?: string;
  }>;
}

export interface ItemTagsZh {
  type?: string;
  subtype?: string | null;
  primary_color?: string;
  colors?: string[];
  pattern?: string;
  material?: string;
  style?: string[];
  season?: string[];
  formality?: string;
  fit?: string;
  condition?: string;
  features?: string[];
  weather_suitability?: string[];
  weather_avoid?: string[];
  warmth_level?: string;
}

export interface Item {
  id: string;
  user_id: string;
  type: string;
  subtype?: string;
  name?: string;
  brand?: string;
  notes?: string;
  purchase_date?: string;
  purchase_price?: number;
  favorite: boolean;
  image_path?: string;
  thumbnail_path?: string;
  medium_path?: string;
  image_source?: 'local' | 'immich';
  possible_duplicate?: boolean;
  duplicate_of_item_id?: string | null;
  duplicate_distance?: number | null;
  immich_asset_id?: string;
  immich_original_filename?: string;
  image_url?: string;
  thumbnail_url?: string;
  medium_url?: string;
  tags: ItemTags;
  tags_zh?: ItemTagsZh | null;
  colors: string[];
  primary_color?: string;
  status: 'processing' | 'ready' | 'error' | 'archived';
  ai_processed: boolean;
  ai_confidence?: number;
  ai_raw_response?: { error?: string; [key: string]: unknown } | null;
  ai_description?: string;
  ai_description_zh?: string;
  wear_count: number;
  last_worn_at?: string;
  last_suggested_at?: string;
  suggestion_count: number;
  acceptance_count: number;
  wears_since_wash: number;
  last_washed_at?: string;
  wash_interval?: number;
  needs_wash: boolean;
  effective_wash_interval: number;
  additional_images: ItemImage[];
  is_archived: boolean;
  archived_at?: string;
  archive_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemListResponse {
  items: Item[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ItemFilter {
  type?: string;
  subtype?: string;
  colors?: string[];
  status?: string;
  favorite?: boolean;
  needs_wash?: boolean;
  possible_duplicate?: boolean;
  is_archived?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  ids?: string;
}

export interface StyleProfile {
  casual: number;
  formal: number;
  sporty: number;
  minimalist: number;
  bold: number;
}

export interface AIEndpoint {
  name: string;
  url: string;
  vision_model: string;
  text_model: string;
  enabled: boolean;
}

export interface Preferences {
  color_favorites: string[];
  color_avoid: string[];
  style_profile: StyleProfile;
  default_occasion: string;
  temperature_unit: 'celsius' | 'fahrenheit';
  temperature_sensitivity: 'low' | 'normal' | 'high';
  cold_threshold: number;
  hot_threshold: number;
  layering_preference: 'minimal' | 'moderate' | 'heavy';
  avoid_repeat_days: number;
  prefer_underused_items: boolean;
  variety_level: 'low' | 'moderate' | 'high';
  ai_endpoints: AIEndpoint[];
}

// Color options for the app
// Hex values tuned for typical clothing colors, not pure/saturated colors
export const CLOTHING_COLORS = [
  { name: '黑色', value: 'black', hex: '#1a1a1a' },
  { name: '炭灰色', value: 'charcoal', hex: '#36454F' },
  { name: '灰色', value: 'gray', hex: '#808080' },
  { name: '白色', value: 'white', hex: '#FAFAFA' },
  { name: '奶油色', value: 'cream', hex: '#F5F5DC' },
  { name: '米色', value: 'beige', hex: '#D4C4A8' },
  { name: '棕褐色', value: 'tan', hex: '#C9B896' },
  { name: '卡其色', value: 'khaki', hex: '#A89F6B' },
  { name: '橄榄绿', value: 'olive', hex: '#707B52' },
  { name: '军绿色', value: 'army-green', hex: '#5B6340' },
  { name: '绿色', value: 'green', hex: '#4A7C59' },
  { name: '蓝绿色', value: 'teal', hex: '#367588' },
  { name: '藏蓝色', value: 'navy', hex: '#1B2A4A' },
  { name: '蓝色', value: 'blue', hex: '#4A7DB8' },
  { name: '棕色', value: 'brown', hex: '#8B5A3C' },
  { name: '深棕色', value: 'dark-brown', hex: '#5C4033' },
  { name: '酒红色', value: 'burgundy', hex: '#722F37' },
  { name: '红色', value: 'red', hex: '#C44536' },
  { name: '粉色', value: 'pink', hex: '#E8A0B0' },
  { name: '紫色', value: 'purple', hex: '#6B5B7A' },
  { name: '黄色', value: 'yellow', hex: '#D4A84B' },
  { name: '橙色', value: 'orange', hex: '#D2691E' },
] as const;

// Clothing types — must match the TYPE vocabulary in clothing_analysis.txt
export const CLOTHING_TYPES = [
  { label: '衬衫', value: 'shirt' },
  { label: 'T 恤', value: 't-shirt' },
  { label: '上衣', value: 'top' },
  { label: 'Polo 衫', value: 'polo' },
  { label: '女士衬衫', value: 'blouse' },
  { label: '背心', value: 'tank-top' },
  { label: '毛衣', value: 'sweater' },
  { label: '连帽衫', value: 'hoodie' },
  { label: '开衫', value: 'cardigan' },
  { label: '马甲', value: 'vest' },
  { label: '裤子', value: 'pants' },
  { label: '牛仔裤', value: 'jeans' },
  { label: '短裤', value: 'shorts' },
  { label: '半身裙', value: 'skirt' },
  { label: '连衣裙', value: 'dress' },
  { label: '连体裤', value: 'jumpsuit' },
  { label: '夹克', value: 'jacket' },
  { label: '西装外套', value: 'blazer' },
  { label: '外套', value: 'coat' },
  { label: '套装', value: 'suit' },
  { label: '鞋', value: 'shoes' },
  { label: '运动鞋', value: 'sneakers' },
  { label: '靴子', value: 'boots' },
  { label: '凉鞋', value: 'sandals' },
  { label: '袜子', value: 'socks' },
  { label: '领带', value: 'tie' },
  { label: '帽子', value: 'hat' },
  { label: '围巾', value: 'scarf' },
  { label: '腰带', value: 'belt' },
  { label: '包', value: 'bag' },
  { label: '配饰', value: 'accessories' },
] as const;

export const OCCASIONS = [
  { label: '休闲', value: 'casual' },
  { label: '办公', value: 'office' },
  { label: '正式', value: 'formal' },
  { label: '约会', value: 'date' },
  { label: '运动', value: 'sporty' },
  { label: '户外', value: 'outdoor' },
] as const;

// Family types
export interface FamilyMember {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  role: 'admin' | 'member';
  created_at: string;  // When user joined the family
}

export interface PendingInvite {
  id: string;
  email: string;
  created_at: string;  // When invite was sent
  expires_at: string;
}

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  members: FamilyMember[];
  pending_invites: PendingInvite[];
  created_at: string;
}

export interface FamilyCreateResponse {
  id: string;
  name: string;
  invite_code: string;
  role: string;
}

export interface JoinFamilyResponse {
  family_id: string;
  family_name: string;
  role: string;
}

// Multi-image types
export interface ItemImage {
  id: string;
  item_id: string;
  image_path: string;
  thumbnail_path?: string;
  medium_path?: string;
  position: number;
  created_at: string;
  image_url: string;
  thumbnail_url?: string;
  medium_url?: string;
}

// Wash tracking types
export interface WashHistoryEntry {
  id: string;
  item_id: string;
  washed_at: string;
  method?: string;
  notes?: string;
  created_at: string;
}

// Family rating types
export interface FamilyRating {
  id: string;
  user_id: string;
  user_display_name: string;
  user_avatar_url?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// Outfit types
export interface OutfitItem {
  id: string;
  type: string;
  subtype?: string;
  name?: string;
  primary_color?: string;
  colors: string[];
  image_path?: string | null;
  thumbnail_path?: string | null;
  medium_path?: string | null;
  image_source?: 'local' | 'immich';
  image_url?: string | null;
  thumbnail_url?: string | null;
  medium_url?: string | null;
  layer_type?: string;
  position: number;
}

export interface WeatherData {
  temperature: number;
  feels_like: number;
  humidity: number;
  precipitation_chance: number;
  condition: string;
}

export interface FeedbackSummary {
  rating?: number;
  comment?: string;
  worn_at?: string;
}

export type OutfitSource = 'scheduled' | 'on_demand' | 'manual' | 'pairing';

export interface Outfit {
  id: string;
  occasion: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  source: OutfitSource;
  reasoning?: string;
  style_notes?: string;
  highlights?: string[];
  weather?: WeatherData;
  items: OutfitItem[];
  feedback?: FeedbackSummary;
  family_ratings?: FamilyRating[];
  family_rating_average?: number;
  family_rating_count?: number;
  created_at: string;
}

export interface SuggestRequest {
  occasion: string;
  weather_override?: {
    temperature: number;
    feels_like?: number;
    humidity: number;
    precipitation_chance: number;
    condition: string;
  };
  exclude_items?: string[];
  include_items?: string[];
}

// Pairing types
export interface SourceItem {
  id: string;
  type: string;
  subtype?: string;
  name?: string;
  primary_color?: string;
  image_path?: string | null;
  thumbnail_path?: string | null;
  medium_path?: string | null;
  image_source?: 'local' | 'immich';
  image_url?: string | null;
  thumbnail_url?: string | null;
  medium_url?: string | null;
}

export interface Pairing extends Outfit {
  source_item?: SourceItem;
}

export interface PairingListResponse {
  pairings: Pairing[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface GeneratePairingsRequest {
  num_pairings: number;
}

export interface GeneratePairingsResponse {
  generated: number;
  pairings: Pairing[];
}
