import type { Item } from '@/lib/types';
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

type SearchToken = {
  kind: 'type' | 'color' | 'metadata' | 'text';
  value: string;
  aliases: string[];
};

type AliasTarget = {
  kind: SearchToken['kind'];
  value: string;
};

function addMappingAliases(
  aliases: Record<string, AliasTarget>,
  mapping: Record<string, string>,
  kind: SearchToken['kind']
) {
  Object.entries(mapping).forEach(([value, label]) => {
    aliases[value.toLowerCase()] = { kind, value };
    aliases[label.toLowerCase()] = { kind, value };
  });
}

const SEARCH_ALIASES: Record<string, AliasTarget> = {};

addMappingAliases(SEARCH_ALIASES, TYPE_ZH, 'type');
addMappingAliases(SEARCH_ALIASES, COLOR_ZH, 'color');
addMappingAliases(SEARCH_ALIASES, FEATURE_ZH, 'metadata');
addMappingAliases(SEARCH_ALIASES, WEATHER_ZH, 'metadata');
addMappingAliases(SEARCH_ALIASES, WARMTH_ZH, 'metadata');

Object.assign(SEARCH_ALIASES, {
  防雨: { kind: 'metadata', value: 'water-resistant' },
  泼水: { kind: 'metadata', value: 'water-resistant' },
  挡风: { kind: 'metadata', value: 'wind-resistant' },
  适合叠穿: { kind: 'metadata', value: 'layer-friendly' },
  裙子: { kind: 'type', value: 'dress' },
  裙: { kind: 'type', value: 'dress' },
  白: { kind: 'color', value: 'white' },
  黑: { kind: 'color', value: 'black' },
  蓝: { kind: 'color', value: 'blue' },
  红: { kind: 'color', value: 'red' },
  绿: { kind: 'color', value: 'green' },
});

const CONTAINED_SEARCH_ALIASES = Object.entries(SEARCH_ALIASES)
  .filter(([alias]) => alias.length >= 2)
  .sort(([a], [b]) => b.length - a.length);

function collectSearchText(value: unknown, output: string[] = []): string[] {
  if (value == null) return output;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSearchText(entry, output));
    return output;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => collectSearchText(entry, output));
  }
  return output;
}

function makeSearchToken(kind: SearchToken['kind'], value: string): SearchToken {
  const aliases = Object.entries(SEARCH_ALIASES)
    .filter(([, target]) => target.kind === kind && target.value === value)
    .map(([alias]) => alias);
  return { kind, value, aliases: aliases.length ? aliases : [value] };
}

function dedupeSearchTokens(tokens: SearchToken[]): SearchToken[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    const key = `${token.kind}:${token.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSearchSegment(segment: string): SearchToken[] {
  const normalized = segment.trim().toLowerCase();
  if (!normalized) return [];

  const exactAlias = SEARCH_ALIASES[normalized];
  if (exactAlias) {
    return [makeSearchToken(exactAlias.kind, exactAlias.value)];
  }

  const containedTokens = CONTAINED_SEARCH_ALIASES
    .filter(([alias]) => normalized.includes(alias))
    .map(([, target]) => makeSearchToken(target.kind, target.value));

  if (containedTokens.length) {
    return dedupeSearchTokens(containedTokens);
  }

  return [{ kind: 'text', value: normalized, aliases: [normalized] }];
}

export function parseKeywordSearch(search: string): SearchToken[] {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return [];

  return dedupeSearchTokens(
    normalized
      .split(/[\s,，、]+/)
      .filter(Boolean)
      .flatMap(parseSearchSegment)
  );
}

function metadataValues(item: Item): string[] {
  return [
    item.tags?.pattern,
    item.tags?.material,
    item.tags?.formality,
    item.tags?.fit,
    item.tags?.warmth_level,
    ...(item.tags?.style ?? []),
    ...(item.tags?.season ?? []),
    ...(item.tags?.features ?? []),
    ...(item.tags?.weather_suitability ?? []),
    ...(item.tags?.weather_avoid ?? []),
    item.tags_zh?.pattern,
    item.tags_zh?.material,
    item.tags_zh?.formality,
    item.tags_zh?.fit,
    item.tags_zh?.warmth_level,
    ...(item.tags_zh?.style ?? []),
    ...(item.tags_zh?.season ?? []),
    ...(item.tags_zh?.features ?? []),
    ...(item.tags_zh?.weather_suitability ?? []),
    ...(item.tags_zh?.weather_avoid ?? []),
  ].filter((value): value is string => Boolean(value));
}

function itemMatchesToken(item: Item, token: SearchToken): boolean {
  if (token.kind === 'type') {
    return item.type === token.value;
  }

  if (token.kind === 'color') {
    return item.primary_color === token.value || item.colors.includes(token.value);
  }

  if (token.kind === 'metadata') {
    const values = metadataValues(item).map((value) => value.toLowerCase());
    return token.aliases.some((alias) => values.includes(alias.toLowerCase()));
  }

  const values = [
    item.name,
    item.brand,
    item.type,
    item.subtype,
    item.primary_color,
    item.notes,
    item.immich_original_filename,
    itemTitleZh(item),
    itemTypeZh(item),
    itemColorZh(item),
    ...item.colors,
    ...metadataValues(item),
    ...collectSearchText(item.tags),
    ...collectSearchText(item.tags_zh),
  ];

  return values.some((value) => value?.toLowerCase().includes(token.value));
}

export function itemMatchesKeywordSearch(item: Item, search: string): boolean {
  const tokens = parseKeywordSearch(search);
  if (!tokens.length) return true;
  return tokens.every((token) => itemMatchesToken(item, token));
}
