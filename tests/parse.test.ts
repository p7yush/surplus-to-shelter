import { describe, expect, it } from "vitest";
import { parseDonationText } from "@/lib/domain/parse";
import { HOUR, MINUTE } from "@/lib/domain/time";
import { BASE_NOW } from "./fixtures";

describe("free-text donation parser", () => {
  it("extracts pounds, food type and an absolute cut-off", () => {
    const parsed = parseDonationText(
      "40 lbs of cooked pasta, good until 9pm",
      BASE_NOW,
    );

    expect(parsed.quantityKg).toBeCloseTo(18.1, 1);
    expect(parsed.foodType).toBe("prepared");
    expect(new Date(parsed.expiresAt!).getHours()).toBe(21);
    expect(parsed.confidence).toBe(1);
  });

  it("handles kilograms and a relative window", () => {
    const parsed = parseDonationText(
      "25 kg mixed vegetables, usable for 6 hours",
      BASE_NOW,
    );

    expect(parsed.quantityKg).toBe(25);
    expect(parsed.foodType).toBe("produce");
    expect(parsed.expiresAt).toBe(BASE_NOW + 6 * HOUR);
  });

  it("converts trays into kilograms", () => {
    const parsed = parseDonationText("6 trays of biryani from the buffet", BASE_NOW);
    expect(parsed.quantityKg).toBe(18);
    expect(parsed.foodType).toBe("prepared");
  });

  it("flags cold chain for dairy even without an explicit keyword", () => {
    const parsed = parseDonationText("10 litres of milk close to date", BASE_NOW);
    expect(parsed.foodType).toBe("dairy");
    expect(parsed.needsRefrigeration).toBe(true);
  });

  it("flags cold chain from an explicit keyword", () => {
    const parsed = parseDonationText("12 kg of frozen paratha packs", BASE_NOW);
    expect(parsed.needsRefrigeration).toBe(true);
  });

  it("recognises bakery surplus and minute-level windows", () => {
    const parsed = parseDonationText(
      "30 loaves of bread left, expires in 90 minutes",
      BASE_NOW,
    );

    expect(parsed.foodType).toBe("bakery");
    expect(parsed.quantityKg).toBeCloseTo(13.5, 1);
    expect(parsed.expiresAt).toBe(BASE_NOW + 90 * MINUTE);
  });

  it("rolls an already-passed cut-off to the next day", () => {
    const parsed = parseDonationText("8 kg rice until 9am", BASE_NOW);
    expect(parsed.expiresAt).toBeGreaterThan(BASE_NOW);
    expect(new Date(parsed.expiresAt!).getHours()).toBe(9);
  });

  it("reads tonight as a late cut-off", () => {
    const parsed = parseDonationText("15 kg sabzi, please collect tonight", BASE_NOW);
    expect(new Date(parsed.expiresAt!).getHours()).toBe(22);
  });

  it("reports low confidence when nothing is recognisable", () => {
    const parsed = parseDonationText("some stuff left over", BASE_NOW);
    expect(parsed.quantityKg).toBeNull();
    expect(parsed.confidence).toBeLessThan(0.4);
  });

  it("does not mistake a clock time for a quantity", () => {
    const parsed = parseDonationText("cooked dal until 8pm", BASE_NOW);
    expect(parsed.quantityKg).toBeNull();
    expect(new Date(parsed.expiresAt!).getHours()).toBe(20);
  });

  it("detects meat surplus", () => {
    const parsed = parseDonationText("9 kg chilled chicken portions", BASE_NOW);
    expect(parsed.foodType).toBe("meat");
    expect(parsed.needsRefrigeration).toBe(true);
  });

  it("does not read cold chain out of the word rice", () => {
    const parsed = parseDonationText(
      "18 kg of cooked dal and jeera rice from the lunch buffet, good for 4 hours",
      BASE_NOW,
    );

    expect(parsed.foodType).toBe("prepared");
    expect(parsed.needsRefrigeration).toBe(false);
  });

  it("does not read cooking oil out of the word boiled", () => {
    const parsed = parseDonationText("4 kg of boiled potatoes", BASE_NOW);
    expect(parsed.foodType).toBe("produce");
  });

  it("treats veggies as produce rather than eggs", () => {
    const parsed = parseDonationText("20 kg of mixed veggies", BASE_NOW);
    expect(parsed.foodType).toBe("produce");
  });

  it("matches plural keywords", () => {
    expect(parseDonationText("5 kg of eggs", BASE_NOW).foodType).toBe("meat");
    expect(parseDonationText("12 kg of buns", BASE_NOW).foodType).toBe("bakery");
  });
});
