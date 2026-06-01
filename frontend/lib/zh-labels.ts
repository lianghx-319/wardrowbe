import type { Item } from '@/lib/types';

export const TYPE_ZH: Record<string, string> = {
  shirt: '衬衫',
  't-shirt': 'T 恤',
  top: '上衣',
  pants: '裤子',
  jeans: '牛仔裤',
  shorts: '短裤',
  dress: '连衣裙',
  jumpsuit: '连体裤',
  skirt: '半身裙',
  jacket: '夹克',
  coat: '外套',
  sweater: '毛衣',
  hoodie: '连帽衫',
  blazer: '西装外套',
  vest: '马甲',
  cardigan: '开衫',
  polo: 'Polo 衫',
  blouse: '女士衬衫',
  'tank-top': '背心',
  shoes: '鞋',
  sneakers: '运动鞋',
  boots: '靴子',
  sandals: '凉鞋',
  socks: '袜子',
  tie: '领带',
  hat: '帽子',
  scarf: '围巾',
  belt: '腰带',
  bag: '包',
  accessories: '配饰',
  unknown: '未知',
};

export const COLOR_ZH: Record<string, string> = {
  black: '黑色',
  charcoal: '炭灰色',
  white: '白色',
  gray: '灰色',
  navy: '藏蓝色',
  blue: '蓝色',
  'light-blue': '浅蓝色',
  red: '红色',
  burgundy: '酒红色',
  pink: '粉色',
  green: '绿色',
  olive: '橄榄绿',
  khaki: '卡其色',
  'army-green': '军绿色',
  teal: '蓝绿色',
  yellow: '黄色',
  orange: '橙色',
  purple: '紫色',
  brown: '棕色',
  'dark-brown': '深棕色',
  tan: '棕褐色',
  beige: '米色',
  cream: '奶油色',
  gold: '金色',
  silver: '银色',
};

export const OCCASION_ZH: Record<string, string> = {
  casual: '日常',
  office: '通勤',
  formal: '正式',
  date: '约会',
  sporty: '运动',
  outdoor: '户外',
};

export const STYLE_ZH: Record<string, string> = {
  casual: '休闲',
  formal: '正式',
  sporty: '运动',
  minimalist: '极简',
  bold: '醒目',
};

export const MEASUREMENT_ZH: Record<string, string> = {
  height: '身高',
  weight: '体重',
  chest: '胸围',
  waist: '腰围',
  hips: '臀围',
  inseam: '内长',
  shirt_size: '上衣尺码',
  pants_size: '裤装尺码',
  dress_size: '连衣裙尺码',
  shoe_size: '鞋码',
};

export const FEATURE_ZH: Record<string, string> = {
  'wind-resistant': '防风',
  'water-resistant': '防泼水',
  waterproof: '防水',
  warm: '保暖',
  insulated: '隔热保暖',
  breathable: '透气',
  lightweight: '轻量',
  'quick-dry': '速干',
  stretch: '弹力',
  'sun-protective': '防晒',
  'moisture-wicking': '吸湿排汗',
  thermal: '保温',
  'layer-friendly': '适合叠穿',
  packable: '便携',
  hooded: '连帽',
};

export const WEATHER_ZH: Record<string, string> = {
  sunny: '晴天',
  cloudy: '多云',
  rainy: '雨天',
  windy: '有风',
  snowy: '雪天',
  cold: '寒冷',
  cool: '偏凉',
  mild: '温和',
  hot: '炎热',
  humid: '潮湿',
};

export const WARMTH_ZH: Record<string, string> = {
  'very-light': '非常轻薄',
  light: '轻薄',
  medium: '中等',
  warm: '保暖',
  'very-warm': '非常保暖',
};

export function itemTypeZh(item: Item): string {
  return item.tags_zh?.type || TYPE_ZH[item.type] || item.type;
}

export function itemColorZh(item: Item): string | undefined {
  return item.tags_zh?.primary_color || (item.primary_color ? COLOR_ZH[item.primary_color] : undefined);
}

export function itemTitleZh(item: Item): string {
  return item.name || itemTypeZh(item);
}
