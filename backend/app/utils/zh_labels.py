TYPE_ZH = {
    "shirt": "衬衫",
    "t-shirt": "T 恤",
    "top": "上衣",
    "pants": "裤子",
    "jeans": "牛仔裤",
    "shorts": "短裤",
    "dress": "连衣裙",
    "jumpsuit": "连体裤",
    "skirt": "半身裙",
    "jacket": "夹克",
    "coat": "外套",
    "sweater": "毛衣",
    "hoodie": "连帽衫",
    "blazer": "西装外套",
    "vest": "马甲",
    "cardigan": "开衫",
    "polo": "Polo 衫",
    "blouse": "女士衬衫",
    "tank-top": "背心",
    "shoes": "鞋",
    "sneakers": "运动鞋",
    "boots": "靴子",
    "sandals": "凉鞋",
    "socks": "袜子",
    "tie": "领带",
    "hat": "帽子",
    "scarf": "围巾",
    "belt": "腰带",
    "bag": "包",
    "accessories": "配饰",
    "unknown": "未知",
}

COLOR_ZH = {
    "black": "黑色",
    "charcoal": "炭灰色",
    "white": "白色",
    "gray": "灰色",
    "navy": "藏蓝色",
    "blue": "蓝色",
    "light-blue": "浅蓝色",
    "red": "红色",
    "burgundy": "酒红色",
    "pink": "粉色",
    "green": "绿色",
    "olive": "橄榄绿",
    "khaki": "卡其色",
    "army-green": "军绿色",
    "teal": "蓝绿色",
    "yellow": "黄色",
    "orange": "橙色",
    "purple": "紫色",
    "brown": "棕色",
    "dark-brown": "深棕色",
    "tan": "棕褐色",
    "beige": "米色",
    "cream": "奶油色",
    "gold": "金色",
    "silver": "银色",
}

PATTERN_ZH = {
    "solid": "纯色",
    "striped": "条纹",
    "plaid": "格纹",
    "checkered": "棋盘格",
    "floral": "花卉",
    "graphic": "图案",
    "geometric": "几何",
    "polka-dot": "波点",
    "camouflage": "迷彩",
    "animal-print": "动物纹",
}

MATERIAL_ZH = {
    "cotton": "棉",
    "denim": "牛仔布",
    "leather": "皮革",
    "wool": "羊毛",
    "polyester": "聚酯纤维",
    "silk": "丝绸",
    "linen": "亚麻",
    "knit": "针织",
    "fleece": "抓绒",
    "suede": "麂皮",
    "velvet": "天鹅绒",
    "nylon": "尼龙",
    "canvas": "帆布",
}

STYLE_ZH = {
    "casual": "休闲",
    "classic": "经典",
    "sporty": "运动",
    "minimalist": "极简",
    "bohemian": "波西米亚",
    "preppy": "学院风",
    "streetwear": "街头",
    "elegant": "优雅",
    "athletic": "运动机能",
    "vintage": "复古",
    "modern": "现代",
    "rugged": "硬朗",
}

SEASON_ZH = {
    "spring": "春季",
    "summer": "夏季",
    "fall": "秋季",
    "winter": "冬季",
    "all-season": "四季",
}

FORMALITY_ZH = {
    "very-casual": "非常休闲",
    "casual": "休闲",
    "smart-casual": "精致休闲",
    "business-casual": "商务休闲",
    "formal": "正式",
}

FIT_ZH = {
    "slim": "修身",
    "regular": "常规",
    "relaxed": "宽松",
    "oversized": "廓形",
    "tailored": "合身剪裁",
    "cropped": "短款",
}

FEATURE_ZH = {
    "wind-resistant": "防风",
    "water-resistant": "防泼水",
    "waterproof": "防水",
    "warm": "保暖",
    "insulated": "隔热保暖",
    "breathable": "透气",
    "lightweight": "轻量",
    "quick-dry": "速干",
    "stretch": "弹力",
    "sun-protective": "防晒",
    "moisture-wicking": "吸湿排汗",
    "thermal": "保温",
    "layer-friendly": "适合叠穿",
    "packable": "便携",
    "hooded": "连帽",
}

WEATHER_ZH = {
    "sunny": "晴天",
    "cloudy": "多云",
    "rainy": "雨天",
    "windy": "有风",
    "snowy": "雪天",
    "cold": "寒冷",
    "cool": "偏凉",
    "mild": "温和",
    "hot": "炎热",
    "humid": "潮湿",
}

WARMTH_ZH = {
    "very-light": "非常轻薄",
    "light": "轻薄",
    "medium": "中等",
    "warm": "保暖",
    "very-warm": "非常保暖",
}


def zh_for(mapping: dict[str, str], value: str | None) -> str | None:
    if not value:
        return None
    return mapping.get(value, value)


def build_zh_tags(tags: dict) -> dict:
    return {
        "type": zh_for(TYPE_ZH, tags.get("type")),
        "subtype": tags.get("subtype"),
        "primary_color": zh_for(COLOR_ZH, tags.get("primary_color")),
        "colors": [zh_for(COLOR_ZH, color) for color in tags.get("colors", [])],
        "pattern": zh_for(PATTERN_ZH, tags.get("pattern")),
        "material": zh_for(MATERIAL_ZH, tags.get("material")),
        "style": [zh_for(STYLE_ZH, style) for style in tags.get("style", [])],
        "season": [zh_for(SEASON_ZH, season) for season in tags.get("season", [])],
        "formality": zh_for(FORMALITY_ZH, tags.get("formality")),
        "fit": zh_for(FIT_ZH, tags.get("fit")),
        "condition": tags.get("condition"),
        "features": [zh_for(FEATURE_ZH, feature) for feature in tags.get("features", [])],
        "weather_suitability": [
            zh_for(WEATHER_ZH, weather) for weather in tags.get("weather_suitability", [])
        ],
        "weather_avoid": [zh_for(WEATHER_ZH, weather) for weather in tags.get("weather_avoid", [])],
        "warmth_level": zh_for(WARMTH_ZH, tags.get("warmth_level")),
    }


SEARCH_ALIASES = {
    **{v: k for k, v in TYPE_ZH.items()},
    **{v: k for k, v in COLOR_ZH.items()},
    **{v: k for k, v in PATTERN_ZH.items()},
    **{v: k for k, v in MATERIAL_ZH.items()},
    **{v: k for k, v in STYLE_ZH.items()},
    **{v: k for k, v in SEASON_ZH.items()},
    **{v: k for k, v in FEATURE_ZH.items()},
    **{v: k for k, v in WEATHER_ZH.items()},
    **{v: k for k, v in WARMTH_ZH.items()},
    "防雨": "water-resistant",
    "泼水": "water-resistant",
    "挡风": "wind-resistant",
    "保暖": "warm",
    "透气": "breathable",
    "适合叠穿": "layer-friendly",
    "雨天": "rainy",
    "有风": "windy",
    "寒冷": "cold",
    "炎热": "hot",
    "裙子": "dress",
    "裙": "dress",
    "连衣裙": "dress",
    "白": "white",
    "黑": "black",
    "蓝": "blue",
    "红": "red",
    "绿": "green",
    "波点": "polka-dot",
    "圆点": "polka-dot",
}


def expand_search_terms(term: str) -> list[str]:
    normalized = term.strip().lower()
    if not normalized:
        return []
    terms = {normalized}
    for zh, en in SEARCH_ALIASES.items():
        if zh in term:
            terms.add(en)
            terms.add(zh)
    return list(terms)
