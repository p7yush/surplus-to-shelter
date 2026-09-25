import { describe, expect, it } from "vitest";
import { CO2E_KG_PER_KG_FOOD, MEAL_WEIGHT_KG } from "@/lib/domain/constants";
import { co2eFromKg, computeImpact, mealsFromKg } from "@/lib/domain/impact";
import { expiryRisk } from "@/lib/domain/expiry";
import { HOUR, MINUTE } from "@/lib/domain/time";
import { BASE_NOW, makeDonation } from "./fixtures";

describe("impact maths", () => {
  it("converts weight into meals and avoided emissions", () => {
    expect(mealsFromKg(10)).toBe(10 / MEAL_WEIGHT_KG);
    expect(co2eFromKg(10)).toBe(10 * CO2E_KG_PER_KG_FOOD);
  });

  it("totals only delivered donations", () => {
    const donations = [
      makeDonation({
        id: "a",
        status: "delivered",
        quantityKg: 20,
        deliveredAt: BASE_NOW - 30 * MINUTE,
      }),
      makeDonation({
        id: "b",
        status: "delivered",
        quantityKg: 10,
        deliveredAt: BASE_NOW - 90 * MINUTE,
      }),
      makeDonation({ id: "c", status: "posted", quantityKg: 50 }),
    ];

    const impact = computeImpact(donations, BASE_NOW);

    expect(impact.deliveredCount).toBe(2);
    expect(impact.kgRescued).toBe(30);
    expect(impact.meals).toBe(60);
    expect(impact.activeCount).toBe(1);
  });

  it("buckets delivered weight by food type", () => {
    const donations = [
      makeDonation({
        id: "a",
        status: "delivered",
        foodType: "produce",
        quantityKg: 12,
        deliveredAt: BASE_NOW,
      }),
      makeDonation({
        id: "b",
        status: "delivered",
        foodType: "prepared",
        quantityKg: 8,
        deliveredAt: BASE_NOW,
      }),
    ];

    const impact = computeImpact(donations, BASE_NOW);
    expect(impact.kgByFoodType.produce).toBe(12);
    expect(impact.kgByFoodType.prepared).toBe(8);
    expect(impact.kgByFoodType.dairy).toBe(0);
  });

  it("counts urgent donations as at risk", () => {
    const donations = [
      makeDonation({ id: "a", status: "posted", expiresAt: BASE_NOW + 45 * MINUTE }),
      makeDonation({ id: "b", status: "posted", expiresAt: BASE_NOW + 10 * HOUR }),
    ];

    const impact = computeImpact(donations, BASE_NOW);
    expect(impact.atRiskCount).toBe(1);
  });

  it("produces one daily bucket per requested day", () => {
    const impact = computeImpact([], BASE_NOW, 7);
    expect(impact.daily).toHaveLength(7);
    expect(impact.daily.every((bucket) => bucket.kg === 0)).toBe(true);
  });
});

describe("expiry risk", () => {
  it("grades the window from fresh to expired", () => {
    const grade = (minutes: number) =>
      expiryRisk(
        makeDonation({ createdAt: BASE_NOW, expiresAt: BASE_NOW + minutes * MINUTE }),
        BASE_NOW,
      ).level;

    expect(grade(600)).toBe("fresh");
    expect(grade(200)).toBe("watch");
    expect(grade(60)).toBe("urgent");
    expect(grade(15)).toBe("critical");
    expect(grade(-5)).toBe("expired");
  });

  it("marks items inside the safety buffer as not routable", () => {
    const risk = expiryRisk(
      makeDonation({ expiresAt: BASE_NOW + 20 * MINUTE }),
      BASE_NOW,
    );
    expect(risk.routable).toBe(false);
  });
});
