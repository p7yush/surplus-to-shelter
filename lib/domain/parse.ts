import { FOOD_TYPES } from "./constants";
import { HOUR, MINUTE, atMinuteOfDay, startOfDay } from "./time";
import type { FoodType } from "./types";

export interface ParseHighlight {
  field: "quantity" | "foodType" | "expiry" | "coldChain";
  label: string;
  source: string;
}

export interface ParsedDonation {
  quantityKg: number | null;
  foodType: FoodType | null;
  expiresAt: number | null;
  needsRefrigeration: boolean;
  confidence: number;
  highlights: ParseHighlight[];
}

const UNIT_TO_KG: Record<string, number> = {
  kg: 1,
  kgs: 1,
  kilo: 1,
  kilos: 1,
  kilogram: 1,
  kilograms: 1,
  g: 0.001,
  gm: 0.001,
  gms: 0.001,
  gram: 0.001,
  grams: 0.001,
  lb: 0.4536,
  lbs: 0.4536,
  pound: 0.4536,
  pounds: 0.4536,
  quintal: 100,
  tray: 3,
  trays: 3,
  box: 5,
  boxes: 5,
  carton: 5,
  cartons: 5,
  crate: 8,
  crates: 8,
  sack: 25,
  sacks: 25,
  bag: 5,
  bags: 5,
  packet: 0.5,
  packets: 0.5,
  pack: 0.5,
  packs: 0.5,
  plate: 0.5,
  plates: 0.5,
  serving: 0.5,
  servings: 0.5,
  meal: 0.5,
  meals: 0.5,
  portion: 0.5,
  portions: 0.5,
  loaf: 0.45,
  loaves: 0.45,
  litre: 1.03,
  litres: 1.03,
  liter: 1.03,
  liters: 1.03,
  l: 1.03,
  dozen: 0.6,
};

const FOOD_KEYWORDS: Record<FoodType, string[]> = {
  prepared: [
    "cooked",
    "prepared",
    "hot food",
    "buffet",
    "leftover",
    "curry",
    "rice",
    "biryani",
    "pulao",
    "dal",
    "sabzi",
    "khichdi",
    "pasta",
    "noodles",
    "soup",
    "sandwich",
    "pizza",
    "thali",
    "canteen",
    "catered",
    "gravy",
    "chole",
    "rajma",
    "idli",
    "dosa",
    "upma",
    "poha",
  ],
  produce: [
    "vegetable",
    "veggie",
    "veg",
    "fruit",
    "produce",
    "salad",
    "tomato",
    "potato",
    "onion",
    "carrot",
    "spinach",
    "banana",
    "apple",
    "orange",
    "mango",
    "cabbage",
    "cauliflower",
    "greens",
    "cucumber",
    "lettuce",
  ],
  bakery: [
    "bread",
    "bakery",
    "bun",
    "pastry",
    "cake",
    "croissant",
    "muffin",
    "roti",
    "chapati",
    "naan",
    "paratha",
    "biscuit",
    "cookie",
    "doughnut",
    "donut",
    "puff",
    "rusk",
  ],
  dairy: [
    "milk",
    "dairy",
    "paneer",
    "curd",
    "yogurt",
    "yoghurt",
    "dahi",
    "cheese",
    "butter",
    "cream",
    "lassi",
    "buttermilk",
    "ghee",
    "kheer",
  ],
  packaged: [
    "packaged",
    "canned",
    "sealed",
    "dry goods",
    "dry ration",
    "ration",
    "flour",
    "atta",
    "maida",
    "lentil",
    "pulses",
    "sugar",
    "salt",
    "oil",
    "snack",
    "chips",
    "cereal",
    "instant",
    "tetra",
    "shelf stable",
  ],
  meat: [
    "chicken",
    "mutton",
    "lamb",
    "beef",
    "pork",
    "fish",
    "prawn",
    "shrimp",
    "egg",
    "meat",
    "kebab",
    "tikka",
    "seafood",
  ],
};

const COLD_KEYWORDS = [
  "frozen",
  "chilled",
  "refrigerated",
  "refrigeration",
  "cold chain",
  "cold storage",
  "keep cold",
  "keep chilled",
  "on ice",
  "iced",
];

function keywordPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, "i");
}

const FOOD_PATTERNS = Object.fromEntries(
  (Object.entries(FOOD_KEYWORDS) as [FoodType, string[]][]).map(
    ([type, keywords]) => [
      type,
      keywords.map((keyword) => ({ keyword, pattern: keywordPattern(keyword) })),
    ],
  ),
) as Record<FoodType, { keyword: string; pattern: RegExp }[]>;

const COLD_PATTERNS = COLD_KEYWORDS.map((keyword) => ({
  keyword,
  pattern: keywordPattern(keyword),
}));

interface TimeMatch {
  expiresAt: number;
  source: string;
}

function parseAbsoluteTime(text: string, now: number): TimeMatch | null {
  const wordMatch = text.match(/\b(tonight|midnight|noon|tomorrow morning|end of day|closing time)\b/i);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    const minutes =
      word === "noon"
        ? 12 * 60
        : word === "tonight" || word === "closing time" || word === "end of day"
          ? 22 * 60
          : word === "tomorrow morning"
            ? 9 * 60
            : 24 * 60;
    let expiresAt = atMinuteOfDay(now, minutes);
    if (word === "tomorrow morning") expiresAt += 24 * HOUR;
    if (expiresAt <= now) expiresAt += 24 * HOUR;
    return { expiresAt, source: wordMatch[0] };
  }

  const match = text.match(
    /\b(?:until|till|til|by|before|upto|up to|good\s+(?:until|till|for use till))\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i,
  );
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase().replace(/\./g, "");

  if (hours > 24 || minutes > 59) return null;

  if (meridiem === "pm") {
    if (hours < 12) hours += 12;
  } else if (meridiem === "am") {
    if (hours === 12) hours = 0;
  } else if (hours <= 11) {
    const candidate = startOfDay(now) + hours * HOUR + minutes * MINUTE;
    if (candidate <= now) hours += 12;
  }

  let expiresAt = startOfDay(now) + hours * HOUR + minutes * MINUTE;
  if (expiresAt <= now) expiresAt += 24 * HOUR;

  return { expiresAt, source: match[0] };
}

function parseRelativeTime(text: string, now: number): TimeMatch | null {
  const match = text.match(
    /\b(?:good\s+for|lasts|expires?\s+in|within|usable\s+for|safe\s+for|next|in)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const isHour = unit.startsWith("h");
  const ms = isHour ? amount * HOUR : amount * MINUTE;
  if (ms <= 0) return null;

  return { expiresAt: now + ms, source: match[0] };
}

export function parseDonationText(text: string, now: number): ParsedDonation {
  const highlights: ParseHighlight[] = [];
  const normalised = ` ${text.toLowerCase()} `;

  const timeMatch = parseRelativeTime(text, now) ?? parseAbsoluteTime(text, now);
  const withoutTime = timeMatch
    ? normalised.replace(timeMatch.source.toLowerCase(), " ")
    : normalised;

  let quantityKg: number | null = null;
  const unitPattern = Object.keys(UNIT_TO_KG)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const quantityMatch = withoutTime.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"),
  );
  if (quantityMatch) {
    const amount = Number(quantityMatch[1]);
    const factor = UNIT_TO_KG[quantityMatch[2].toLowerCase()];
    if (Number.isFinite(amount) && factor) {
      quantityKg = Math.round(amount * factor * 10) / 10;
      highlights.push({
        field: "quantity",
        label: `${quantityKg} kg`,
        source: quantityMatch[0].trim(),
      });
    }
  }

  let foodType: FoodType | null = null;
  let bestHits = 0;
  let matchedKeyword = "";
  for (const [type, entries] of Object.entries(FOOD_PATTERNS) as [
    FoodType,
    { keyword: string; pattern: RegExp }[],
  ][]) {
    let hits = 0;
    let firstKeyword = "";
    for (const entry of entries) {
      if (entry.pattern.test(withoutTime)) {
        hits += 1;
        if (!firstKeyword) firstKeyword = entry.keyword;
      }
    }
    if (hits > bestHits) {
      bestHits = hits;
      foodType = type;
      matchedKeyword = firstKeyword;
    }
  }
  if (foodType) {
    highlights.push({
      field: "foodType",
      label: FOOD_TYPES[foodType].shortLabel,
      source: matchedKeyword,
    });
  }

  if (timeMatch) {
    highlights.push({
      field: "expiry",
      label: new Date(timeMatch.expiresAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      source: timeMatch.source.trim(),
    });
  }

  const coldKeyword = COLD_PATTERNS.find((entry) =>
    entry.pattern.test(withoutTime),
  )?.keyword;
  const needsRefrigeration = Boolean(
    coldKeyword || (foodType && FOOD_TYPES[foodType].coldChain),
  );
  if (needsRefrigeration) {
    highlights.push({
      field: "coldChain",
      label: "Cold chain",
      source: coldKeyword ?? (foodType ? FOOD_TYPES[foodType].shortLabel : ""),
    });
  }

  const detected = [quantityKg !== null, foodType !== null, timeMatch !== null];
  const confidence = detected.filter(Boolean).length / detected.length;

  return {
    quantityKg,
    foodType,
    expiresAt: timeMatch?.expiresAt ?? null,
    needsRefrigeration,
    confidence,
    highlights,
  };
}
