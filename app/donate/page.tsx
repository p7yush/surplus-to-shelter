"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Sparkles,
  Snowflake,
  Send,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { DonationCard } from "@/components/donation/DonationCard";
import { MatchExplainer } from "@/components/match/MatchExplainer";
import { RescueMap, type MapMarker } from "@/components/map/RescueMap";
import { Badge, EmptyState, SectionTitle, Stat } from "@/components/ui/primitives";
import { FOOD_TYPES, FOOD_TYPE_ORDER } from "@/lib/domain/constants";
import { suggestedExpiry } from "@/lib/domain/expiry";
import { mealsFromKg } from "@/lib/domain/impact";
import { parseDonationText } from "@/lib/domain/parse";
import {
  MINUTE,
  formatClock,
  formatDuration,
  fromDateTimeLocal,
  toDateTimeLocal,
} from "@/lib/domain/time";
import { useNow } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/useAppStore";
import type { FoodType } from "@/lib/domain/types";

const PRESETS = [
  "18 kg of cooked dal and jeera rice from the lunch buffet, good for 4 hours",
  "6 trays of vegetable biryani left after the banquet, collect tonight",
  "40 lbs of bread loaves and buns from the evening bake, until 10pm",
  "10 litres of chilled milk pouches close to date, expires in 3 hours",
];

export default function DonorPage() {
  const now = useNow();
  const donors = useAppStore((state) => state.donors);
  const shelters = useAppStore((state) => state.shelters);
  const donations = useAppStore((state) => state.donations);
  const activeDonorId = useAppStore((state) => state.activeDonorId);
  const setActiveDonor = useAppStore((state) => state.setActiveDonor);
  const postDonation = useAppStore((state) => state.postDonation);
  const candidatesFor = useAppStore((state) => state.candidatesFor);

  const [text, setText] = useState(PRESETS[0]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [foodType, setFoodType] = useState<FoodType>("prepared");
  const [quantityKg, setQuantityKg] = useState("18");
  const [needsRefrigeration, setNeedsRefrigeration] = useState(false);
  const [expiryInput, setExpiryInput] = useState("");
  const [lastPostedId, setLastPostedId] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  const donor = donors.find((item) => item.id === activeDonorId) ?? donors[0];
  const parsed = useMemo(() => parseDonationText(text, now), [text, now]);

  const effectiveFoodType = touched.foodType ? foodType : (parsed.foodType ?? foodType);
  const effectiveQuantity = touched.quantityKg
    ? Number(quantityKg)
    : (parsed.quantityKg ?? Number(quantityKg));
  const effectiveRefrigeration = touched.needsRefrigeration
    ? needsRefrigeration
    : parsed.needsRefrigeration;
  const effectiveExpiry = touched.expiry
    ? (fromDateTimeLocal(expiryInput) ?? suggestedExpiry(effectiveFoodType, now))
    : (parsed.expiresAt ?? suggestedExpiry(effectiveFoodType, now));

  const quantityValid = Number.isFinite(effectiveQuantity) && effectiveQuantity > 0;
  const windowMinutes = (effectiveExpiry - now) / MINUTE;
  const canSubmit = quantityValid && windowMinutes > 30 && text.trim().length > 3;

  const myDonations = useMemo(
    () =>
      donations
        .filter((donation) => donation.donorId === donor?.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [donations, donor?.id],
  );

  const delivered = myDonations.filter((donation) => donation.status === "delivered");
  const myKg = delivered.reduce((sum, donation) => sum + donation.quantityKg, 0);

  const lastPosted = myDonations.find((donation) => donation.id === lastPostedId) ?? null;
  const lastMatch = lastPostedId ? candidatesFor(lastPostedId) : null;

  const markers = useMemo<MapMarker[]>(() => {
    if (!donor) return [];
    const involved = new Set(
      myDonations
        .filter((donation) =>
          ["matched", "accepted", "assigned", "picked_up"].includes(donation.status),
        )
        .map((donation) => donation.shelterId),
    );

    return [
      {
        id: "me",
        position: donor.location,
        label: donor.name,
        sublabel: donor.address,
        color: "#fbbf24",
        glyph: "🍽️",
        size: 28,
      },
      ...shelters.map((shelter) => ({
        id: shelter.id,
        position: shelter.location,
        label: shelter.name,
        sublabel: `${Math.max(0, shelter.dailyCapacityKg - shelter.capacityUsedKg).toFixed(0)} kg free`,
        color: involved.has(shelter.id) ? "#34d399" : "#38bdf8",
        glyph: "🏠",
        size: involved.has(shelter.id) ? 26 : 20,
      })),
    ];
  }, [donor, myDonations, shelters]);

  function handleSubmit() {
    if (!donor || !canSubmit) return;
    const id = postDonation({
      donorId: donor.id,
      description: text.trim(),
      foodType: effectiveFoodType,
      quantityKg: Math.round(effectiveQuantity * 10) / 10,
      needsRefrigeration: effectiveRefrigeration,
      readyAt: now,
      expiresAt: effectiveExpiry,
    });
    setLastPostedId(id);
    setShowExplainer(true);
    setText("");
    setTouched({});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Donor portal</h1>
          <p className="mt-1 text-sm text-muted">
            Describe the surplus in one line. Everything else is inferred, and you
            can correct any field before posting.
          </p>
        </div>
        <label className="min-w-56">
          <span className="field-label">Posting as</span>
          <select
            className="field"
            value={donor?.id ?? ""}
            onChange={(event) => setActiveDonor(event.target.value)}
          >
            {donors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.address}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Your rescued weight"
          value={myKg.toFixed(0)}
          unit="kg"
          hint={`${Math.round(mealsFromKg(myKg))} meals from your kitchen`}
        />
        <Stat
          label="Completed handovers"
          value={String(delivered.length)}
          hint="Each one is timestamped for reporting"
          tone="sky"
        />
        <Stat
          label="In flight now"
          value={String(
            myDonations.filter((donation) =>
              ["posted", "matched", "accepted", "assigned", "picked_up"].includes(
                donation.status,
              ),
            ).length,
          )}
          hint="Awaiting pickup or delivery"
          tone="violet"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="card p-4 lg:col-span-3">
          <SectionTitle
            title="Post surplus food"
            hint="Plain text in, structured donation out"
            action={
              <Badge tone={parsed.confidence === 1 ? "emerald" : "amber"}>
                <Wand2 size={11} />
                {Math.round(parsed.confidence * 100)}% parsed
              </Badge>
            }
          />

          <label>
            <span className="field-label">What is available?</span>
            <textarea
              className="field min-h-20 resize-y"
              placeholder="e.g. 40 lbs of cooked pasta, good until 9pm"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="btn px-2 py-1 text-[0.68rem]"
                onClick={() => {
                  setText(preset);
                  setTouched({});
                }}
              >
                <Sparkles size={11} />
                {preset.slice(0, 26)}…
              </button>
            ))}
          </div>

          {parsed.highlights.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parsed.highlights.map((highlight) => (
                <Badge key={`${highlight.field}-${highlight.label}`} tone="violet">
                  {highlight.field}: {highlight.label}
                  <span className="text-faint">
                    {highlight.source ? ` ← "${highlight.source}"` : ""}
                  </span>
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">Food type</span>
              <select
                className="field"
                value={effectiveFoodType}
                onChange={(event) => {
                  setFoodType(event.target.value as FoodType);
                  setTouched((prev) => ({ ...prev, foodType: true }));
                }}
              >
                {FOOD_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {FOOD_TYPES[type].emoji} {FOOD_TYPES[type].label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Quantity (kg)</span>
              <input
                className="field"
                type="number"
                min="0.5"
                step="0.5"
                value={touched.quantityKg ? quantityKg : (parsed.quantityKg ?? quantityKg)}
                onChange={(event) => {
                  setQuantityKg(event.target.value);
                  setTouched((prev) => ({ ...prev, quantityKg: true }));
                }}
              />
            </label>

            <label>
              <span className="field-label">Safe until</span>
              <input
                className="field"
                type="datetime-local"
                value={
                  touched.expiry ? expiryInput : toDateTimeLocal(effectiveExpiry)
                }
                onChange={(event) => {
                  setExpiryInput(event.target.value);
                  setTouched((prev) => ({ ...prev, expiry: true }));
                }}
              />
            </label>

            <label className="card-tight flex cursor-pointer items-center gap-2.5 p-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-brand)]"
                checked={effectiveRefrigeration}
                onChange={(event) => {
                  setNeedsRefrigeration(event.target.checked);
                  setTouched((prev) => ({ ...prev, needsRefrigeration: true }));
                }}
              />
              <span className="text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <Snowflake size={13} className="text-sky-accent" />
                  Needs cold chain
                </span>
                <span className="mt-0.5 block text-faint">
                  Only recipients with cold storage will be considered
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="text-xs text-muted">
              {quantityValid ? (
                <>
                  <span className="font-semibold text-ink">
                    {effectiveQuantity.toFixed(1)} kg
                  </span>{" "}
                  ≈ {Math.round(mealsFromKg(effectiveQuantity))} meals · window closes{" "}
                  <span className="font-semibold text-ink">
                    {formatClock(effectiveExpiry)}
                  </span>{" "}
                  ({formatDuration(windowMinutes)} from now)
                </>
              ) : (
                "Enter a quantity to continue"
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              <Send size={14} />
              Post and match now
            </button>
          </div>

          {!canSubmit && windowMinutes <= 30 && quantityValid ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-accent">
              <TriangleAlert size={13} />
              The safe window must be more than 30 minutes away, otherwise no
              handover can complete in time.
            </p>
          ) : null}
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold tracking-wide text-ink uppercase">
              Recipients near you
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Green markers are currently receiving from your kitchen.
            </p>
          </div>
          <div className="h-[380px]">
            <RescueMap markers={markers} />
          </div>
        </div>
      </section>

      {lastPosted ? (
        <section className="card border-brand/30 p-4">
          <SectionTitle
            title="Match result"
            hint="Produced the moment you posted"
            action={
              <button
                type="button"
                className="btn px-2.5 py-1.5 text-[0.7rem]"
                onClick={() => setShowExplainer((value) => !value)}
              >
                {showExplainer ? "Hide" : "Show"} scoring detail
              </button>
            }
          />

          {lastPosted.status === "unmatched" ? (
            <p className="flex items-start gap-2 rounded-lg border border-rose-accent/30 bg-rose-accent/8 p-3 text-xs text-rose-accent">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {lastPosted.matchReason ??
                "No recipient could be reached safely inside the window."}
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-brand/30 bg-brand/8 p-3 text-xs text-brand">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              Matched to{" "}
              {shelters.find((s) => s.id === lastPosted.shelterId)?.name ??
                "a recipient"}{" "}
              at score {lastPosted.matchScore}. {lastPosted.matchReason}
            </p>
          )}

          {showExplainer && lastMatch ? (
            <div className="mt-3">
              <MatchExplainer result={lastMatch} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section>
        <SectionTitle
          title="Your donations"
          hint="Live status from posting through to delivery"
        />
        {myDonations.length === 0 ? (
          <EmptyState
            title="Nothing posted yet"
            body="Post your first surplus item above and the routing engine will find a recipient immediately."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {myDonations.slice(0, 10).map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                donor={donor}
                shelter={shelters.find((s) => s.id === donation.shelterId) ?? null}
                now={now}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
