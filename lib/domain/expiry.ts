import { FOOD_TYPES, SAFETY_BUFFER_MINUTES } from "./constants";
import { MINUTE } from "./time";
import type { Donation, FoodType } from "./types";

export type RiskLevel = "fresh" | "watch" | "urgent" | "critical" | "expired";

export interface ExpiryRisk {
  level: RiskLevel;
  label: string;
  minutesLeft: number;
  windowFractionLeft: number;
  routable: boolean;
  tone: string;
}

const RISK_LABEL: Record<RiskLevel, string> = {
  fresh: "Fresh",
  watch: "Watch",
  urgent: "Urgent",
  critical: "Critical",
  expired: "Expired",
};

const RISK_TONE: Record<RiskLevel, string> = {
  fresh: "emerald",
  watch: "sky",
  urgent: "amber",
  critical: "rose",
  expired: "slate",
};

export function expiryRisk(donation: Donation, now: number): ExpiryRisk {
  const minutesLeft = (donation.expiresAt - now) / MINUTE;
  const totalWindow = Math.max(
    1,
    (donation.expiresAt - donation.createdAt) / MINUTE,
  );
  const windowFractionLeft = Math.max(0, Math.min(1, minutesLeft / totalWindow));

  let level: RiskLevel;
  if (minutesLeft <= 0) level = "expired";
  else if (minutesLeft <= SAFETY_BUFFER_MINUTES) level = "critical";
  else if (minutesLeft <= 90) level = "urgent";
  else if (minutesLeft <= 240) level = "watch";
  else level = "fresh";

  return {
    level,
    label: RISK_LABEL[level],
    minutesLeft,
    windowFractionLeft,
    routable: minutesLeft > SAFETY_BUFFER_MINUTES,
    tone: RISK_TONE[level],
  };
}

export function suggestedExpiry(
  foodType: FoodType,
  readyAt: number,
): number {
  return readyAt + FOOD_TYPES[foodType].typicalWindowHours * 60 * MINUTE;
}

export function isPastSafeWindow(donation: Donation, now: number): boolean {
  return donation.expiresAt <= now;
}
