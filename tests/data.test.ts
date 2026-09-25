import { describe, expect, it } from "vitest";
import { diffById, upsertById } from "@/lib/data/adapter";
import { createSeedData } from "@/lib/data/seed";
import {
  fromDonation,
  fromDonor,
  fromDriver,
  fromNotification,
  fromShelter,
  toDonation,
  toDonor,
  toDriver,
  toNotification,
  toShelter,
} from "@/lib/data/mappers";
import { BASE_NOW } from "./fixtures";

describe("diffById", () => {
  it("reports nothing when the snapshot is untouched", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const diff = diffById(rows, rows);
    expect(diff.changed).toEqual([]);
    expect(diff.removedIds).toEqual([]);
  });

  it("only reports the rows whose reference actually changed", () => {
    const a = { id: "a", n: 1 };
    const b = { id: "b", n: 1 };
    const updatedB = { id: "b", n: 2 };

    const diff = diffById([a, b], [a, updatedB]);

    expect(diff.changed).toEqual([updatedB]);
    expect(diff.removedIds).toEqual([]);
  });

  it("treats a brand new row as changed", () => {
    const a = { id: "a" };
    const diff = diffById([a], [a, { id: "b" }]);
    expect(diff.changed.map((row) => row.id)).toEqual(["b"]);
  });

  it("errs towards writing: a rebuilt but equal row still counts as changed", () => {
    // The diff is deliberately reference-based, which depends on the store updating state
    // immutably and reusing untouched rows. If that ever stops holding, the failure mode is a
    // redundant write rather than a lost one.
    const diff = diffById([{ id: "a", n: 1 }], [{ id: "a", n: 1 }]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.removedIds).toEqual([]);
  });

  it("reports removals so deletes propagate to the database", () => {
    const a = { id: "a" };
    const diff = diffById([a, { id: "b" }], [a]);
    expect(diff.changed).toEqual([]);
    expect(diff.removedIds).toEqual(["b"]);
  });

  it("does not write rows that were merely reordered", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const diff = diffById([a, b], [b, a]);
    expect(diff.changed).toEqual([]);
    expect(diff.removedIds).toEqual([]);
  });
});

describe("upsertById", () => {
  it("prepends an unseen row so newest-first ordering holds", () => {
    const result = upsertById([{ id: "a" }], { id: "b" });
    expect(result.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("replaces in place without moving an existing row", () => {
    const result = upsertById(
      [{ id: "a", n: 1 }, { id: "b", n: 1 }],
      { id: "a", n: 2 },
    );
    expect(result).toEqual([{ id: "a", n: 2 }, { id: "b", n: 1 }]);
  });

  it("does not mutate the input array", () => {
    const rows = [{ id: "a", n: 1 }];
    upsertById(rows, { id: "a", n: 2 });
    expect(rows).toEqual([{ id: "a", n: 1 }]);
  });
});

describe("row mappers", () => {
  const seed = createSeedData(BASE_NOW);

  it("round-trips every donor unchanged", () => {
    for (const donor of seed.donors) {
      expect(toDonor(fromDonor(donor))).toEqual(donor);
    }
  });

  it("round-trips every shelter unchanged, including nested hours and arrays", () => {
    for (const shelter of seed.shelters) {
      expect(toShelter(fromShelter(shelter))).toEqual(shelter);
    }
  });

  it("round-trips every driver unchanged", () => {
    for (const driver of seed.drivers) {
      expect(toDriver(fromDriver(driver))).toEqual(driver);
    }
  });

  it("round-trips every donation unchanged, including the timeline", () => {
    expect(seed.donations.length).toBeGreaterThan(0);
    for (const donation of seed.donations) {
      expect(toDonation(fromDonation(donation))).toEqual(donation);
    }
  });

  it("round-trips notifications unchanged", () => {
    for (const item of seed.notifications) {
      expect(toNotification(fromNotification(item))).toEqual(item);
    }
  });

  it("flattens coordinates into the columns the schema declares", () => {
    const [donor] = seed.donors;
    const row = fromDonor(donor);
    expect(row.lat).toBe(donor.location.lat);
    expect(row.lng).toBe(donor.location.lng);
    expect(row).not.toHaveProperty("location");
  });

  it("survives bigint columns arriving as strings from Postgres", () => {
    const [donation] = seed.donations;
    const row = fromDonation(donation);
    const asPostgresReturnsIt = {
      ...row,
      ready_at: String(row.ready_at) as unknown as number,
      expires_at: String(row.expires_at) as unknown as number,
      created_at: String(row.created_at) as unknown as number,
    };

    const mapped = toDonation(asPostgresReturnsIt);

    expect(mapped.readyAt).toBe(donation.readyAt);
    expect(mapped.expiresAt).toBe(donation.expiresAt);
    expect(mapped.createdAt).toBe(donation.createdAt);
  });

  // These mirror the CHECK constraints, enums and foreign keys in
  // supabase/migrations/0001_init.sql. Without them a mismatch between the schema and the
  // domain only shows up as a failed insert against a live database — which is exactly how the
  // open_minute/open_hour unit mismatch was found.
  describe("seed rows satisfy the database constraints", () => {
    const FOOD_TYPES = ["prepared", "produce", "bakery", "dairy", "packaged", "meat"];
    const VEHICLES = ["bike", "car", "van"];
    const DONOR_KINDS = ["restaurant", "grocer", "caterer", "campus", "bakery"];
    const STATUSES = [
      "posted", "matched", "accepted", "assigned",
      "picked_up", "delivered", "expired", "unmatched",
    ];

    it("shelters keep intake minutes inside a day and open before they close", () => {
      for (const row of seed.shelters.map(fromShelter)) {
        expect(row.open_minute, row.id).toBeGreaterThanOrEqual(0);
        expect(row.open_minute, row.id).toBeLessThanOrEqual(1440);
        expect(row.close_minute, row.id).toBeLessThanOrEqual(1440);
        expect(row.close_minute, row.id).toBeGreaterThan(row.open_minute);
      }
    });

    it("shelters report positive capacity and non-negative usage", () => {
      for (const row of seed.shelters.map(fromShelter)) {
        expect(row.daily_capacity_kg, row.id).toBeGreaterThan(0);
        expect(row.capacity_used_kg, row.id).toBeGreaterThanOrEqual(0);
      }
    });

    it("drivers report positive vehicle capacity", () => {
      for (const row of seed.drivers.map(fromDriver)) {
        expect(row.capacity_kg, row.id).toBeGreaterThan(0);
      }
    });

    it("donations carry a positive quantity and expire after they are ready", () => {
      for (const row of seed.donations.map(fromDonation)) {
        expect(row.quantity_kg, row.id).toBeGreaterThan(0);
        expect(row.expires_at, row.id).toBeGreaterThan(row.ready_at);
      }
    });

    it("only uses values the database enums allow", () => {
      for (const row of seed.donors.map(fromDonor)) {
        expect(DONOR_KINDS, row.id).toContain(row.kind);
      }
      for (const row of seed.drivers.map(fromDriver)) {
        expect(VEHICLES, row.id).toContain(row.vehicle);
      }
      for (const row of seed.shelters.map(fromShelter)) {
        for (const food of [...row.accepted_food_types, ...row.preferred_food_types]) {
          expect(FOOD_TYPES, row.id).toContain(food);
        }
      }
      for (const row of seed.donations.map(fromDonation)) {
        expect(FOOD_TYPES, row.id).toContain(row.food_type);
        expect(STATUSES, row.id).toContain(row.status);
      }
    });

    it("never references a participant that does not exist", () => {
      const donorIds = new Set(seed.donors.map((d) => d.id));
      const shelterIds = new Set(seed.shelters.map((s) => s.id));
      const driverIds = new Set(seed.drivers.map((d) => d.id));

      for (const donation of seed.donations) {
        expect(donorIds.has(donation.donorId), donation.id).toBe(true);
        if (donation.shelterId !== null) {
          expect(shelterIds.has(donation.shelterId), donation.id).toBe(true);
        }
        if (donation.driverId !== null) {
          expect(driverIds.has(donation.driverId), donation.id).toBe(true);
        }
        for (const declined of donation.declinedShelterIds) {
          expect(shelterIds.has(declined), donation.id).toBe(true);
        }
      }
    });

    it("gives every row a non-empty primary key", () => {
      const ids = [
        ...seed.donors.map((r) => r.id),
        ...seed.shelters.map((r) => r.id),
        ...seed.drivers.map((r) => r.id),
        ...seed.donations.map((r) => r.id),
      ];
      for (const id of ids) expect(id.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it("defaults absent array columns rather than producing undefined", () => {
    const [shelter] = seed.shelters;
    const row = fromShelter(shelter);
    const mapped = toShelter({
      ...row,
      accepted_food_types: undefined as never,
      preferred_food_types: undefined as never,
    });
    expect(mapped.acceptedFoodTypes).toEqual([]);
    expect(mapped.preferredFoodTypes).toEqual([]);
  });
});
