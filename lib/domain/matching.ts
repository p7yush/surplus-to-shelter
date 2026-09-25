import {
  DISPATCH_DELAY_MINUTES,
  FOOD_TYPES,
  LOAD_MINUTES,
  MATCH_WEIGHTS,
  MAX_MATCH_DISTANCE_KM,
  SAFETY_BUFFER_MINUTES,
  UNLOAD_MINUTES,
} from "./constants";
import { roadDistanceKm, travelMinutes } from "./geo";
import { HOUR, MINUTE, formatDuration, formatMinuteOfDay, isWithinHours } from "./time";
import type { Donation, Donor, Driver, Shelter } from "./types";

export type RejectionCode =
  | "food-type"
  | "refrigeration"
  | "capacity"
  | "distance"
  | "expiry"
  | "closed"
  | "no-driver";

export interface Rejection {
  code: RejectionCode;
  message: string;
}

export interface ScoreBreakdown {
  proximity: number;
  timeMargin: number;
  capacityFit: number;
  need: number;
  preference: number;
}

export interface Candidate {
  shelterId: string;
  shelterName: string;
  feasible: boolean;
  score: number;
  breakdown: ScoreBreakdown;
  rejections: Rejection[];
  distanceKm: number;
  etaMinutes: number;
  slackMinutes: number;
  remainingCapacityKg: number;
  utilisation: number;
  driverId: string | null;
  driverName: string | null;
  pickupAt: number | null;
  deliveredAt: number | null;
}

export interface MatchResult {
  donationId: string;
  best: Candidate | null;
  candidates: Candidate[];
  driverId: string | null;
  blockedReason: string | null;
}

export interface DriverOption {
  driver: Driver;
  distanceToDonorKm: number;
  arriveAt: number;
  pickupAt: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function remainingCapacityKg(shelter: Shelter): number {
  return Math.max(0, shelter.dailyCapacityKg - shelter.capacityUsedKg);
}

export function bestDriverFor(
  donation: Donation,
  donor: Donor,
  drivers: Driver[],
  now: number,
): DriverOption | null {
  const options = drivers
    .filter((driver) => driver.available && driver.capacityKg >= donation.quantityKg)
    .map((driver) => {
      const distanceToDonorKm = roadDistanceKm(driver.location, donor.location);
      const minutesToDonor = travelMinutes(distanceToDonorKm, driver.vehicle);
      const arriveAt = Math.max(
        now + (DISPATCH_DELAY_MINUTES + minutesToDonor) * MINUTE,
        donation.readyAt,
      );
      return {
        driver,
        distanceToDonorKm,
        arriveAt,
        pickupAt: arriveAt + LOAD_MINUTES * MINUTE,
      };
    });

  if (options.length === 0) return null;

  return options.reduce((best, option) =>
    option.pickupAt < best.pickupAt ? option : best,
  );
}

function capacityFitScore(quantityKg: number, remainingKg: number): number {
  if (remainingKg <= 0) return 0;
  const ratio = quantityKg / remainingKg;
  if (ratio <= 0.75) return 0.4 + 0.6 * (ratio / 0.75);
  if (ratio <= 1) return 1 - 0.3 * ((ratio - 0.75) / 0.25);
  return 0;
}

function needScore(shelter: Shelter, now: number): number {
  const remaining = remainingCapacityKg(shelter);
  const unmetFraction =
    shelter.dailyCapacityKg > 0 ? remaining / shelter.dailyCapacityKg : 0;
  const hoursSinceDelivery =
    shelter.lastDeliveryAt === null
      ? 24
      : (now - shelter.lastDeliveryAt) / HOUR;
  const staleness = clamp01(hoursSinceDelivery / 24);
  return clamp01(0.6 * staleness + 0.4 * unmetFraction);
}

function preferenceScore(shelter: Shelter, donation: Donation): number {
  if (shelter.preferredFoodTypes.includes(donation.foodType)) return 1;
  if (shelter.acceptedFoodTypes.includes(donation.foodType)) return 0.5;
  return 0;
}

export function scoreShelter(
  donation: Donation,
  donor: Donor,
  shelter: Shelter,
  driverOption: DriverOption | null,
  now: number,
): Candidate {
  const distanceKm = roadDistanceKm(donor.location, shelter.location);
  const remainingKg = remainingCapacityKg(shelter);
  const rejections: Rejection[] = [];

  let pickupAt: number | null = null;
  let deliveredAt: number | null = null;
  let etaMinutes = Number.POSITIVE_INFINITY;
  let slackMinutes = Number.NEGATIVE_INFINITY;

  if (driverOption) {
    const minutesToShelter = travelMinutes(distanceKm, driverOption.driver.vehicle);
    pickupAt = driverOption.pickupAt;
    deliveredAt = pickupAt + (minutesToShelter + UNLOAD_MINUTES) * MINUTE;
    etaMinutes = (deliveredAt - now) / MINUTE;
    slackMinutes = (donation.expiresAt - deliveredAt) / MINUTE;
  } else {
    rejections.push({
      code: "no-driver",
      message: `No available driver can carry ${donation.quantityKg.toFixed(1)} kg right now`,
    });
  }

  if (!shelter.acceptedFoodTypes.includes(donation.foodType)) {
    rejections.push({
      code: "food-type",
      message: `Does not accept ${FOOD_TYPES[donation.foodType].shortLabel.toLowerCase()} food`,
    });
  }

  if (donation.needsRefrigeration && !shelter.hasRefrigeration) {
    rejections.push({
      code: "refrigeration",
      message: "No cold storage for a cold-chain item",
    });
  }

  if (remainingKg < donation.quantityKg) {
    rejections.push({
      code: "capacity",
      message: `Only ${remainingKg.toFixed(1)} kg of capacity left, needs ${donation.quantityKg.toFixed(1)} kg`,
    });
  }

  if (distanceKm > MAX_MATCH_DISTANCE_KM) {
    rejections.push({
      code: "distance",
      message: `${distanceKm.toFixed(1)} km is beyond the ${MAX_MATCH_DISTANCE_KM} km rescue radius`,
    });
  }

  if (deliveredAt !== null && slackMinutes < SAFETY_BUFFER_MINUTES) {
    rejections.push({
      code: "expiry",
      message:
        slackMinutes < 0
          ? `Would arrive ${formatDuration(-slackMinutes)} after the safe window closes`
          : `Only ${formatDuration(slackMinutes)} of margin, under the ${SAFETY_BUFFER_MINUTES}m safety buffer`,
    });
  }

  if (
    deliveredAt !== null &&
    !isWithinHours(deliveredAt, shelter.openHours.open, shelter.openHours.close)
  ) {
    rejections.push({
      code: "closed",
      message: `Closed on arrival, intake runs ${formatMinuteOfDay(shelter.openHours.open)}–${formatMinuteOfDay(shelter.openHours.close)}`,
    });
  }

  const breakdown: ScoreBreakdown = {
    proximity: clamp01(1 - distanceKm / MAX_MATCH_DISTANCE_KM),
    timeMargin: Number.isFinite(slackMinutes) ? clamp01(slackMinutes / 120) : 0,
    capacityFit: capacityFitScore(donation.quantityKg, remainingKg),
    need: needScore(shelter, now),
    preference: preferenceScore(shelter, donation),
  };

  const score =
    100 *
    (breakdown.proximity * MATCH_WEIGHTS.proximity +
      breakdown.timeMargin * MATCH_WEIGHTS.timeMargin +
      breakdown.capacityFit * MATCH_WEIGHTS.capacityFit +
      breakdown.need * MATCH_WEIGHTS.need +
      breakdown.preference * MATCH_WEIGHTS.preference);

  return {
    shelterId: shelter.id,
    shelterName: shelter.name,
    feasible: rejections.length === 0,
    score: Math.round(score * 10) / 10,
    breakdown,
    rejections,
    distanceKm,
    etaMinutes,
    slackMinutes,
    remainingCapacityKg: remainingKg,
    utilisation: remainingKg > 0 ? donation.quantityKg / remainingKg : 1,
    driverId: driverOption?.driver.id ?? null,
    driverName: driverOption?.driver.name ?? null,
    pickupAt,
    deliveredAt,
  };
}

export function buildMatchReason(candidate: Candidate): string {
  const parts = [
    `${candidate.distanceKm.toFixed(1)} km away`,
    `arrives ${formatDuration(candidate.slackMinutes)} before the safe window closes`,
    `uses ${Math.round(candidate.utilisation * 100)}% of remaining capacity`,
  ];
  if (candidate.breakdown.preference === 1) parts.push("this is a preferred food type");
  if (candidate.driverName) parts.push(`${candidate.driverName} is the closest available driver`);
  return parts.join(", ");
}

export function findMatches(
  donation: Donation,
  donor: Donor,
  shelters: Shelter[],
  drivers: Driver[],
  now: number,
): MatchResult {
  const driverOption = bestDriverFor(donation, donor, drivers, now);

  const candidates = shelters
    .map((shelter) => scoreShelter(donation, donor, shelter, driverOption, now))
    .sort((a, b) => {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      if (a.feasible) return b.score - a.score;
      return a.distanceKm - b.distanceKm;
    });

  const best = candidates.find((candidate) => candidate.feasible) ?? null;

  let blockedReason: string | null = null;
  if (!best) {
    if (!driverOption) {
      blockedReason = `No driver is available with at least ${donation.quantityKg.toFixed(1)} kg of space`;
    } else if (candidates.every((c) => c.rejections.some((r) => r.code === "expiry"))) {
      blockedReason =
        "Every shelter in range would be reached after the safe window closes";
    } else if (candidates.every((c) => c.rejections.some((r) => r.code === "capacity"))) {
      blockedReason = "No shelter in range has enough remaining capacity today";
    } else {
      blockedReason = "No shelter in range satisfies the safety and capacity rules";
    }
  }

  return {
    donationId: donation.id,
    best,
    candidates,
    driverId: driverOption?.driver.id ?? null,
    blockedReason,
  };
}
