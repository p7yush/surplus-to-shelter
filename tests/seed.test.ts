import { describe, expect, it } from "vitest";
import { createSeedData } from "@/lib/data/seed";
import { BASE_NOW } from "./fixtures";

const data = createSeedData(BASE_NOW);

const shelterById = new Map(data.shelters.map((shelter) => [shelter.id, shelter]));
const driverById = new Map(data.drivers.map((driver) => [driver.id, driver]));

const NEEDS_SHELTER = new Set([
  "matched",
  "accepted",
  "assigned",
  "picked_up",
  "delivered",
]);

describe("seed data consistency", () => {
  it("builds a network with donors, recipients, drivers and history", () => {
    expect(data.donors.length).toBeGreaterThan(5);
    expect(data.shelters.length).toBeGreaterThan(5);
    expect(data.drivers.length).toBeGreaterThan(3);
    expect(data.donations.length).toBeGreaterThan(20);
  });

  it("never routes food to a recipient that does not accept the type", () => {
    for (const donation of data.donations) {
      if (!donation.shelterId) continue;
      const shelter = shelterById.get(donation.shelterId);
      expect(shelter).toBeDefined();
      expect(shelter!.acceptedFoodTypes).toContain(donation.foodType);
    }
  });

  it("never routes cold-chain food to a recipient without cold storage", () => {
    for (const donation of data.donations) {
      if (!donation.shelterId || !donation.needsRefrigeration) continue;
      expect(shelterById.get(donation.shelterId)!.hasRefrigeration).toBe(true);
    }
  });

  it("never assigns a load larger than the driver's vehicle", () => {
    for (const donation of data.donations) {
      if (!donation.driverId) continue;
      const driver = driverById.get(donation.driverId);
      expect(driver).toBeDefined();
      expect(driver!.capacityKg).toBeGreaterThanOrEqual(donation.quantityKg);
    }
  });

  it("keeps every safe window ahead of its creation time", () => {
    for (const donation of data.donations) {
      expect(donation.expiresAt).toBeGreaterThan(donation.createdAt);
    }
  });

  it("attaches a recipient to every donation past the posted stage", () => {
    for (const donation of data.donations) {
      if (NEEDS_SHELTER.has(donation.status)) {
        expect(donation.shelterId).not.toBeNull();
      }
    }
  });

  it("orders every timeline chronologically", () => {
    for (const donation of data.donations) {
      for (let i = 1; i < donation.timeline.length; i += 1) {
        expect(donation.timeline[i].at).toBeGreaterThanOrEqual(
          donation.timeline[i - 1].at,
        );
      }
    }
  });

  it("records a delivery timestamp for every delivered donation", () => {
    const delivered = data.donations.filter((d) => d.status === "delivered");
    expect(delivered.length).toBeGreaterThan(10);
    for (const donation of delivered) {
      expect(donation.deliveredAt).not.toBeNull();
      expect(donation.deliveredAt!).toBeLessThanOrEqual(BASE_NOW);
    }
  });

  it("is deterministic for a given reference time", () => {
    const again = createSeedData(BASE_NOW);
    expect(again.donations.map((d) => d.id)).toEqual(
      data.donations.map((d) => d.id),
    );
    expect(again.donations.map((d) => d.quantityKg)).toEqual(
      data.donations.map((d) => d.quantityKg),
    );
  });
});
