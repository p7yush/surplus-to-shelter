import type { FoodType, VehicleKind } from "./types";

export interface FoodTypeMeta {
  label: string;
  shortLabel: string;
  typicalWindowHours: number;
  coldChain: boolean;
  emoji: string;
  accent: string;
}

export const FOOD_TYPES: Record<FoodType, FoodTypeMeta> = {
  prepared: {
    label: "Prepared / cooked meals",
    shortLabel: "Prepared",
    typicalWindowHours: 4,
    coldChain: false,
    emoji: "🍲",
    accent: "#f97316",
  },
  produce: {
    label: "Fresh produce",
    shortLabel: "Produce",
    typicalWindowHours: 36,
    coldChain: false,
    emoji: "🥬",
    accent: "#22c55e",
  },
  bakery: {
    label: "Bakery & bread",
    shortLabel: "Bakery",
    typicalWindowHours: 20,
    coldChain: false,
    emoji: "🥖",
    accent: "#eab308",
  },
  dairy: {
    label: "Dairy",
    shortLabel: "Dairy",
    typicalWindowHours: 8,
    coldChain: true,
    emoji: "🥛",
    accent: "#38bdf8",
  },
  packaged: {
    label: "Packaged & dry goods",
    shortLabel: "Packaged",
    typicalWindowHours: 240,
    coldChain: false,
    emoji: "📦",
    accent: "#a78bfa",
  },
  meat: {
    label: "Meat, fish & eggs",
    shortLabel: "Meat",
    typicalWindowHours: 6,
    coldChain: true,
    emoji: "🍗",
    accent: "#ef4444",
  },
};

export const FOOD_TYPE_ORDER: FoodType[] = [
  "prepared",
  "produce",
  "bakery",
  "dairy",
  "packaged",
  "meat",
];

export const VEHICLE_SPEED_KMH: Record<VehicleKind, number> = {
  bike: 24,
  car: 27,
  van: 21,
};

export const VEHICLE_META: Record<
  VehicleKind,
  { label: string; emoji: string }
> = {
  bike: { label: "Two-wheeler", emoji: "🛵" },
  car: { label: "Car", emoji: "🚗" },
  van: { label: "Van", emoji: "🚐" },
};

export const ROAD_WINDING_FACTOR = 1.35;

export const DISPATCH_DELAY_MINUTES = 6;
export const LOAD_MINUTES = 8;
export const UNLOAD_MINUTES = 8;
export const SAFETY_BUFFER_MINUTES = 30;
export const MAX_MATCH_DISTANCE_KM = 25;

export const MEAL_WEIGHT_KG = 0.5;
export const CO2E_KG_PER_KG_FOOD = 2.5;
export const WATER_LITRES_PER_KG_FOOD = 1250;

export const MATCH_WEIGHTS = {
  proximity: 0.3,
  timeMargin: 0.25,
  capacityFit: 0.2,
  need: 0.15,
  preference: 0.1,
} as const;

export const STATUS_META: Record<
  string,
  { label: string; tone: string; step: number }
> = {
  posted: { label: "Posted", tone: "slate", step: 1 },
  matched: { label: "Match proposed", tone: "sky", step: 2 },
  accepted: { label: "Accepted", tone: "indigo", step: 3 },
  assigned: { label: "Driver assigned", tone: "violet", step: 4 },
  picked_up: { label: "Picked up", tone: "amber", step: 5 },
  delivered: { label: "Delivered", tone: "emerald", step: 6 },
  expired: { label: "Expired", tone: "rose", step: 0 },
  unmatched: { label: "No safe match", tone: "rose", step: 0 },
};
