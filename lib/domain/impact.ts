import {
  CO2E_KG_PER_KG_FOOD,
  MEAL_WEIGHT_KG,
  WATER_LITRES_PER_KG_FOOD,
} from "./constants";
import { expiryRisk } from "./expiry";
import { DAY, MINUTE, startOfDay } from "./time";
import type { Donation, FoodType } from "./types";

export interface ImpactTotals {
  deliveredCount: number;
  kgRescued: number;
  meals: number;
  co2eKg: number;
  waterLitres: number;
  activeCount: number;
  atRiskCount: number;
  expiredCount: number;
  postedCount: number;
  matchRate: number;
  medianMinutesToDelivery: number | null;
  kgByFoodType: Record<FoodType, number>;
  daily: { day: number; kg: number; meals: number }[];
}

export const mealsFromKg = (kg: number) => kg / MEAL_WEIGHT_KG;
export const co2eFromKg = (kg: number) => kg * CO2E_KG_PER_KG_FOOD;
export const waterFromKg = (kg: number) => kg * WATER_LITRES_PER_KG_FOOD;

const ACTIVE_STATUSES = new Set([
  "posted",
  "matched",
  "accepted",
  "assigned",
  "picked_up",
]);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeImpact(
  donations: Donation[],
  now: number,
  dayCount = 7,
): ImpactTotals {
  const delivered = donations.filter((d) => d.status === "delivered");
  const kgRescued = delivered.reduce((sum, d) => sum + d.quantityKg, 0);

  const kgByFoodType = donations.reduce(
    (acc, donation) => {
      if (donation.status === "delivered") {
        acc[donation.foodType] = (acc[donation.foodType] ?? 0) + donation.quantityKg;
      }
      return acc;
    },
    {
      prepared: 0,
      produce: 0,
      bakery: 0,
      dairy: 0,
      packaged: 0,
      meat: 0,
    } as Record<FoodType, number>,
  );

  const active = donations.filter((d) => ACTIVE_STATUSES.has(d.status));
  const atRisk = active.filter((d) => {
    const risk = expiryRisk(d, now);
    return risk.level === "urgent" || risk.level === "critical";
  });

  const resolvable = donations.filter(
    (d) => d.status !== "posted" || expiryRisk(d, now).level === "expired",
  );
  const matched = donations.filter(
    (d) => d.shelterId !== null && d.status !== "unmatched",
  );

  const deliveryMinutes = delivered
    .filter((d) => d.deliveredAt !== null)
    .map((d) => (d.deliveredAt! - d.createdAt) / MINUTE);

  const today = startOfDay(now);
  const daily = Array.from({ length: dayCount }, (_, index) => {
    const day = today - (dayCount - 1 - index) * DAY;
    const dayDonations = delivered.filter(
      (d) => d.deliveredAt !== null && startOfDay(d.deliveredAt) === day,
    );
    const kg = dayDonations.reduce((sum, d) => sum + d.quantityKg, 0);
    return { day, kg, meals: mealsFromKg(kg) };
  });

  return {
    deliveredCount: delivered.length,
    kgRescued,
    meals: mealsFromKg(kgRescued),
    co2eKg: co2eFromKg(kgRescued),
    waterLitres: waterFromKg(kgRescued),
    activeCount: active.length,
    atRiskCount: atRisk.length,
    expiredCount: donations.filter(
      (d) => d.status === "expired" || d.status === "unmatched",
    ).length,
    postedCount: donations.length,
    matchRate: resolvable.length === 0 ? 0 : matched.length / donations.length,
    medianMinutesToDelivery: median(deliveryMinutes),
    kgByFoodType,
    daily,
  };
}
