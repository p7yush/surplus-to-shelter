import { describe, expect, it } from "vitest";
import { SAFETY_BUFFER_MINUTES } from "@/lib/domain/constants";
import { findMatches, remainingCapacityKg, scoreShelter, bestDriverFor } from "@/lib/domain/matching";
import { HOUR, MINUTE } from "@/lib/domain/time";
import {
  BASE_NOW,
  makeDonation,
  makeDonor,
  makeDriver,
  makeShelter,
} from "./fixtures";

const donor = makeDonor();

describe("matching engine", () => {
  it("picks the nearest suitable shelter when everything else is equal", () => {
    const near = makeShelter({ id: "near", name: "Near", location: { lat: 28.58, lng: 77.33 } });
    const far = makeShelter({ id: "far", name: "Far", location: { lat: 28.65, lng: 77.33 } });

    const result = findMatches(
      makeDonation(),
      donor,
      [far, near],
      [makeDriver()],
      BASE_NOW,
    );

    expect(result.best?.shelterId).toBe("near");
    expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score);
  });

  it("rejects a shelter that cannot be reached inside the safe window", () => {
    const donation = makeDonation({ expiresAt: BASE_NOW + 20 * MINUTE });

    const result = findMatches(
      donation,
      donor,
      [makeShelter()],
      [makeDriver()],
      BASE_NOW,
    );

    expect(result.best).toBeNull();
    expect(result.candidates[0].rejections.map((r) => r.code)).toContain("expiry");
    expect(result.blockedReason).toMatch(/safe window/i);
  });

  it("prefers a farther shelter over a closer one that cannot accept the food type", () => {
    const nearVeg = makeShelter({
      id: "near-veg",
      location: { lat: 28.58, lng: 77.33 },
      acceptedFoodTypes: ["produce", "bakery"],
    });
    const farAny = makeShelter({
      id: "far-any",
      location: { lat: 28.63, lng: 77.33 },
    });

    const result = findMatches(
      makeDonation({ foodType: "meat", needsRefrigeration: true }),
      donor,
      [nearVeg, farAny],
      [makeDriver()],
      BASE_NOW,
    );

    expect(result.best?.shelterId).toBe("far-any");
  });

  it("blocks cold-chain food from a shelter without refrigeration", () => {
    const candidate = scoreShelter(
      makeDonation({ foodType: "dairy", needsRefrigeration: true }),
      donor,
      makeShelter({ hasRefrigeration: false }),
      bestDriverFor(makeDonation(), donor, [makeDriver()], BASE_NOW),
      BASE_NOW,
    );

    expect(candidate.feasible).toBe(false);
    expect(candidate.rejections.map((r) => r.code)).toContain("refrigeration");
  });

  it("blocks a donation larger than the remaining capacity", () => {
    const shelter = makeShelter({ dailyCapacityKg: 50, capacityUsedKg: 40 });
    expect(remainingCapacityKg(shelter)).toBe(10);

    const result = findMatches(
      makeDonation({ quantityKg: 25 }),
      donor,
      [shelter],
      [makeDriver()],
      BASE_NOW,
    );

    expect(result.best).toBeNull();
    expect(result.candidates[0].rejections.map((r) => r.code)).toContain("capacity");
    expect(result.blockedReason).toMatch(/capacity/i);
  });

  it("rejects shelters that are closed when the driver would arrive", () => {
    const result = findMatches(
      makeDonation(),
      donor,
      [makeShelter({ openHours: { open: 6 * 60, close: 11 * 60 } })],
      [makeDriver()],
      BASE_NOW,
    );

    expect(result.best).toBeNull();
    expect(result.candidates[0].rejections.map((r) => r.code)).toContain("closed");
  });

  it("reports no driver when nobody has enough vehicle capacity", () => {
    const result = findMatches(
      makeDonation({ quantityKg: 120 }),
      donor,
      [makeShelter()],
      [makeDriver({ capacityKg: 25, vehicle: "bike" })],
      BASE_NOW,
    );

    expect(result.driverId).toBeNull();
    expect(result.best).toBeNull();
    expect(result.blockedReason).toMatch(/driver/i);
  });

  it("chooses the driver who can reach the donor soonest", () => {
    const close = makeDriver({ id: "close", location: { lat: 28.5705, lng: 77.3305 } });
    const distant = makeDriver({ id: "distant", location: { lat: 28.72, lng: 77.45 } });

    const option = bestDriverFor(makeDonation(), donor, [distant, close], BASE_NOW);
    expect(option?.driver.id).toBe("close");
  });

  it("never proposes a match whose margin is under the safety buffer", () => {
    const shelters = [
      makeShelter({ id: "a", location: { lat: 28.59, lng: 77.34 } }),
      makeShelter({ id: "b", location: { lat: 28.62, lng: 77.36 } }),
      makeShelter({ id: "c", location: { lat: 28.56, lng: 77.31 } }),
    ];

    for (const minutes of [35, 50, 70, 120, 240]) {
      const result = findMatches(
        makeDonation({ expiresAt: BASE_NOW + minutes * MINUTE }),
        donor,
        shelters,
        [makeDriver()],
        BASE_NOW,
      );
      if (result.best) {
        expect(result.best.slackMinutes).toBeGreaterThanOrEqual(SAFETY_BUFFER_MINUTES);
      }
    }
  });

  it("waits for the ready time before computing the pickup", () => {
    const readyAt = BASE_NOW + 2 * HOUR;
    const option = bestDriverFor(
      makeDonation({ readyAt, expiresAt: readyAt + 4 * HOUR }),
      donor,
      [makeDriver()],
      BASE_NOW,
    );

    expect(option).not.toBeNull();
    expect(option!.arriveAt).toBeGreaterThanOrEqual(readyAt);
  });

  it("scores a preferred food type above a merely accepted one", () => {
    const driverOption = bestDriverFor(makeDonation(), donor, [makeDriver()], BASE_NOW);
    const preferred = scoreShelter(
      makeDonation(),
      donor,
      makeShelter({ preferredFoodTypes: ["prepared"] }),
      driverOption,
      BASE_NOW,
    );
    const accepted = scoreShelter(
      makeDonation(),
      donor,
      makeShelter({ preferredFoodTypes: ["bakery"] }),
      driverOption,
      BASE_NOW,
    );

    expect(preferred.score).toBeGreaterThan(accepted.score);
  });
});
