import { LOAD_MINUTES, UNLOAD_MINUTES } from "./constants";
import { roadDistanceKm, travelMinutes } from "./geo";
import { MINUTE } from "./time";
import type { Donation, Donor, Driver, LatLng, Shelter } from "./types";

export type StopKind = "pickup" | "dropoff";

export interface RouteStop {
  id: string;
  donationId: string;
  kind: StopKind;
  location: LatLng;
  label: string;
  sublabel: string;
  quantityKg: number;
  readyAt: number | null;
  deadline: number | null;
}

export interface PlannedStop extends RouteStop {
  arrivalAt: number;
  departAt: number;
  legKm: number;
  lateByMinutes: number;
}

export interface RoutePlan {
  stops: PlannedStop[];
  totalKm: number;
  totalMinutes: number;
  lateStops: number;
  feasible: boolean;
}

const LATE_PENALTY_KM = 500;

export function buildRouteStops(
  donations: Donation[],
  donors: Donor[],
  shelters: Shelter[],
): RouteStop[] {
  const donorById = new Map(donors.map((d) => [d.id, d]));
  const shelterById = new Map(shelters.map((s) => [s.id, s]));
  const stops: RouteStop[] = [];

  for (const donation of donations) {
    const donor = donorById.get(donation.donorId);
    const shelter = donation.shelterId ? shelterById.get(donation.shelterId) : null;
    if (!donor || !shelter) continue;

    if (donation.status !== "picked_up") {
      stops.push({
        id: `${donation.id}:pickup`,
        donationId: donation.id,
        kind: "pickup",
        location: donor.location,
        label: donor.name,
        sublabel: donor.address,
        quantityKg: donation.quantityKg,
        readyAt: donation.readyAt,
        deadline: donation.expiresAt,
      });
    }

    stops.push({
      id: `${donation.id}:dropoff`,
      donationId: donation.id,
      kind: "dropoff",
      location: shelter.location,
      label: shelter.name,
      sublabel: shelter.address,
      quantityKg: donation.quantityKg,
      readyAt: null,
      deadline: donation.expiresAt,
    });
  }

  return stops;
}

function isValidOrder(order: RouteStop[]): boolean {
  const pickedUp = new Set<string>();
  for (const stop of order) {
    if (stop.kind === "pickup") {
      pickedUp.add(stop.donationId);
    } else if (
      order.some(
        (other) =>
          other.kind === "pickup" && other.donationId === stop.donationId,
      ) &&
      !pickedUp.has(stop.donationId)
    ) {
      return false;
    }
  }
  return true;
}

export function evaluateOrder(
  driver: Driver,
  order: RouteStop[],
  now: number,
): RoutePlan {
  let cursor: LatLng = driver.location;
  let clock = now;
  let totalKm = 0;
  let lateStops = 0;
  const stops: PlannedStop[] = [];

  for (const stop of order) {
    const legKm = roadDistanceKm(cursor, stop.location);
    const legMinutes = travelMinutes(legKm, driver.vehicle);
    let arrivalAt = clock + legMinutes * MINUTE;

    if (stop.kind === "pickup" && stop.readyAt !== null) {
      arrivalAt = Math.max(arrivalAt, stop.readyAt);
    }

    const serviceMinutes = stop.kind === "pickup" ? LOAD_MINUTES : UNLOAD_MINUTES;
    const departAt = arrivalAt + serviceMinutes * MINUTE;

    const lateByMinutes =
      stop.kind === "dropoff" && stop.deadline !== null
        ? Math.max(0, (arrivalAt - stop.deadline) / MINUTE)
        : 0;
    if (lateByMinutes > 0) lateStops += 1;

    stops.push({ ...stop, arrivalAt, departAt, legKm, lateByMinutes });

    totalKm += legKm;
    cursor = stop.location;
    clock = departAt;
  }

  return {
    stops,
    totalKm,
    totalMinutes: (clock - now) / MINUTE,
    lateStops,
    feasible: lateStops === 0,
  };
}

function planCost(plan: RoutePlan): number {
  return plan.totalKm + plan.lateStops * LATE_PENALTY_KM;
}

function nearestNeighbourOrder(driver: Driver, stops: RouteStop[]): RouteStop[] {
  const remaining = [...stops];
  const order: RouteStop[] = [];
  const pickedUp = new Set<string>();
  const hasPickup = new Set(
    stops.filter((s) => s.kind === "pickup").map((s) => s.donationId),
  );
  let cursor: LatLng = driver.location;

  while (remaining.length > 0) {
    const eligible = remaining.filter(
      (stop) =>
        stop.kind === "pickup" ||
        !hasPickup.has(stop.donationId) ||
        pickedUp.has(stop.donationId),
    );
    const pool = eligible.length > 0 ? eligible : remaining;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    pool.forEach((stop, index) => {
      const distance = roadDistanceKm(cursor, stop.location);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    const chosen = pool[bestIndex];
    remaining.splice(remaining.indexOf(chosen), 1);
    order.push(chosen);
    if (chosen.kind === "pickup") pickedUp.add(chosen.donationId);
    cursor = chosen.location;
  }

  return order;
}

export function planRoute(
  driver: Driver,
  stops: RouteStop[],
  now: number,
  maxPasses = 40,
): RoutePlan {
  if (stops.length === 0) {
    return { stops: [], totalKm: 0, totalMinutes: 0, lateStops: 0, feasible: true };
  }

  let order = nearestNeighbourOrder(driver, stops);
  let bestPlan = evaluateOrder(driver, order, now);
  let bestCost = planCost(bestPlan);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let improved = false;

    for (let i = 0; i < order.length - 1; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const candidate = [...order];
        const segment = candidate.slice(i, j + 1).reverse();
        candidate.splice(i, segment.length, ...segment);

        if (!isValidOrder(candidate)) continue;

        const plan = evaluateOrder(driver, candidate, now);
        const cost = planCost(plan);
        if (cost < bestCost - 1e-9) {
          order = candidate;
          bestPlan = plan;
          bestCost = cost;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return bestPlan;
}

export function planForDriver(
  driver: Driver,
  donations: Donation[],
  donors: Donor[],
  shelters: Shelter[],
  now: number,
): RoutePlan {
  const assigned = donations.filter(
    (donation) =>
      donation.driverId === driver.id &&
      (donation.status === "assigned" || donation.status === "picked_up"),
  );
  return planRoute(driver, buildRouteStops(assigned, donors, shelters), now);
}
