import { describe, expect, it } from "vitest";
import {
  buildRouteStops,
  evaluateOrder,
  planRoute,
} from "@/lib/domain/routing";
import { HOUR } from "@/lib/domain/time";
import {
  BASE_NOW,
  makeDonation,
  makeDonor,
  makeDriver,
  makeShelter,
} from "./fixtures";

const donors = [
  makeDonor({ id: "d1", name: "Donor One", location: { lat: 28.57, lng: 77.33 } }),
  makeDonor({ id: "d2", name: "Donor Two", location: { lat: 28.62, lng: 77.37 } }),
  makeDonor({ id: "d3", name: "Donor Three", location: { lat: 28.55, lng: 77.31 } }),
];

const shelters = [
  makeShelter({ id: "s1", name: "Shelter One", location: { lat: 28.575, lng: 77.335 } }),
  makeShelter({ id: "s2", name: "Shelter Two", location: { lat: 28.625, lng: 77.375 } }),
  makeShelter({ id: "s3", name: "Shelter Three", location: { lat: 28.545, lng: 77.305 } }),
];

const donations = [
  makeDonation({
    id: "n1",
    donorId: "d1",
    shelterId: "s1",
    driverId: "driver-1",
    status: "assigned",
    quantityKg: 10,
    expiresAt: BASE_NOW + 8 * HOUR,
  }),
  makeDonation({
    id: "n2",
    donorId: "d2",
    shelterId: "s2",
    driverId: "driver-1",
    status: "assigned",
    quantityKg: 12,
    expiresAt: BASE_NOW + 8 * HOUR,
  }),
  makeDonation({
    id: "n3",
    donorId: "d3",
    shelterId: "s3",
    driverId: "driver-1",
    status: "assigned",
    quantityKg: 8,
    expiresAt: BASE_NOW + 8 * HOUR,
  }),
];

describe("multi-stop route planning", () => {
  it("creates a pickup and a dropoff stop per donation", () => {
    const stops = buildRouteStops(donations, donors, shelters);
    expect(stops).toHaveLength(6);
    expect(stops.filter((s) => s.kind === "pickup")).toHaveLength(3);
    expect(stops.filter((s) => s.kind === "dropoff")).toHaveLength(3);
  });

  it("skips the pickup stop for food already collected", () => {
    const stops = buildRouteStops(
      [{ ...donations[0], status: "picked_up" }],
      donors,
      shelters,
    );
    expect(stops).toHaveLength(1);
    expect(stops[0].kind).toBe("dropoff");
  });

  it("always visits a pickup before its matching dropoff", () => {
    const stops = buildRouteStops(donations, donors, shelters);
    const plan = planRoute(makeDriver(), stops, BASE_NOW);

    for (const donationId of ["n1", "n2", "n3"]) {
      const pickupIndex = plan.stops.findIndex(
        (s) => s.donationId === donationId && s.kind === "pickup",
      );
      const dropIndex = plan.stops.findIndex(
        (s) => s.donationId === donationId && s.kind === "dropoff",
      );
      expect(pickupIndex).toBeGreaterThanOrEqual(0);
      expect(dropIndex).toBeGreaterThan(pickupIndex);
    }
  });

  it("produces a route no longer than a naive sequential ordering", () => {
    const stops = buildRouteStops(donations, donors, shelters);
    const driver = makeDriver();

    const naiveOrder = ["n1", "n2", "n3"].flatMap((id) => [
      stops.find((s) => s.donationId === id && s.kind === "pickup")!,
      stops.find((s) => s.donationId === id && s.kind === "dropoff")!,
    ]);

    const naive = evaluateOrder(driver, naiveOrder, BASE_NOW);
    const optimised = planRoute(driver, stops, BASE_NOW);

    expect(optimised.totalKm).toBeLessThanOrEqual(naive.totalKm + 1e-6);
  });

  it("reports arrival times in visiting order", () => {
    const plan = planRoute(
      makeDriver(),
      buildRouteStops(donations, donors, shelters),
      BASE_NOW,
    );

    for (let i = 1; i < plan.stops.length; i += 1) {
      expect(plan.stops[i].arrivalAt).toBeGreaterThanOrEqual(
        plan.stops[i - 1].arrivalAt,
      );
    }
    expect(plan.totalMinutes).toBeGreaterThan(0);
  });

  it("flags stops that would arrive after the deadline", () => {
    const tight = donations.map((donation) => ({
      ...donation,
      expiresAt: BASE_NOW + 5 * 60 * 1000,
    }));
    const plan = planRoute(
      makeDriver(),
      buildRouteStops(tight, donors, shelters),
      BASE_NOW,
    );

    expect(plan.feasible).toBe(false);
    expect(plan.lateStops).toBeGreaterThan(0);
  });

  it("returns an empty plan when there is nothing to do", () => {
    const plan = planRoute(makeDriver(), [], BASE_NOW);
    expect(plan.stops).toHaveLength(0);
    expect(plan.totalKm).toBe(0);
    expect(plan.feasible).toBe(true);
  });
});
