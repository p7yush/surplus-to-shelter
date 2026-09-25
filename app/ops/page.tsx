"use client";

import { useMemo, useState } from "react";
import {
  Cpu,
  Dices,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { DonationCard } from "@/components/donation/DonationCard";
import { MatchExplainer } from "@/components/match/MatchExplainer";
import { Badge, KeyValue, SectionTitle, Stat } from "@/components/ui/primitives";
import {
  DISPATCH_DELAY_MINUTES,
  FOOD_TYPES,
  LOAD_MINUTES,
  MATCH_WEIGHTS,
  MAX_MATCH_DISTANCE_KM,
  SAFETY_BUFFER_MINUTES,
  UNLOAD_MINUTES,
} from "@/lib/domain/constants";
import { computeImpact } from "@/lib/domain/impact";
import { formatClock, formatDuration, HOUR, MINUTE } from "@/lib/domain/time";
import { useNow } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/useAppStore";
import type { DonationStatus, FoodType } from "@/lib/domain/types";

const FILTERS: { label: string; statuses: DonationStatus[] | null }[] = [
  { label: "Needs attention", statuses: ["posted", "unmatched"] },
  { label: "In flight", statuses: ["matched", "accepted", "assigned", "picked_up"] },
  { label: "Delivered", statuses: ["delivered"] },
  { label: "Lost", statuses: ["expired", "unmatched"] },
  { label: "Everything", statuses: null },
];

const SIMULATED: { text: string; foodType: FoodType; kg: number; hours: number }[] = [
  { text: "Surplus chole, rice and mixed sabzi from the dinner service", foodType: "prepared", kg: 22, hours: 4 },
  { text: "Crates of tomatoes and cabbage pulled from display", foodType: "produce", kg: 38, hours: 22 },
  { text: "End-of-day bread, buns and rusk", foodType: "bakery", kg: 14, hours: 16 },
  { text: "Chilled curd tubs and milk pouches close to date", foodType: "dairy", kg: 9, hours: 3 },
  { text: "Sealed dry ration packs of atta and pulses", foodType: "packaged", kg: 60, hours: 120 },
  { text: "Banquet surplus: paneer curry, dal and pulao", foodType: "prepared", kg: 85, hours: 5 },
];

export default function OpsPage() {
  const now = useNow();
  const donations = useAppStore((state) => state.donations);
  const donors = useAppStore((state) => state.donors);
  const shelters = useAppStore((state) => state.shelters);
  const drivers = useAppStore((state) => state.drivers);
  const candidatesFor = useAppStore((state) => state.candidatesFor);
  const matchAllPending = useAppStore((state) => state.matchAllPending);
  const resetDemo = useAppStore((state) => state.resetDemo);
  const advanceClock = useAppStore((state) => state.advanceClock);
  const postDonation = useAppStore((state) => state.postDonation);
  const clockOffsetMs = useAppStore((state) => state.clockOffsetMs);

  const [filterIndex, setFilterIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const impact = useMemo(() => computeImpact(donations, now), [donations, now]);

  const filtered = useMemo(() => {
    const filter = FILTERS[filterIndex];
    const list = filter.statuses
      ? donations.filter((donation) => filter.statuses!.includes(donation.status))
      : donations;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [donations, filterIndex]);

  const selected =
    donations.find((donation) => donation.id === selectedId) ?? filtered[0] ?? null;
  const match = selected ? candidatesFor(selected.id) : null;

  function simulateDonation() {
    const spec = SIMULATED[Math.floor(Math.random() * SIMULATED.length)];
    const donor = donors[Math.floor(Math.random() * donors.length)];
    const id = postDonation({
      donorId: donor.id,
      description: spec.text,
      foodType: spec.foodType,
      quantityKg: spec.kg,
      needsRefrigeration: FOOD_TYPES[spec.foodType].coldChain,
      readyAt: now,
      expiresAt: now + spec.hours * HOUR,
    });
    setSelectedId(id);
    setFilterIndex(4);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Control room</h1>
          <p className="mt-1 text-sm text-muted">
            Every routing decision is inspectable. Pick a donation to see which
            recipients were considered, how they scored, and exactly why the rest
            were disqualified.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={simulateDonation}>
            <Dices size={14} />
            Simulate donation
          </button>
          <button type="button" className="btn" onClick={matchAllPending}>
            <RefreshCw size={14} />
            Re-run pending matches
          </button>
          <button type="button" className="btn" onClick={() => advanceClock(60)}>
            +1 hour
          </button>
          <button type="button" className="btn btn-danger" onClick={resetDemo}>
            <RotateCcw size={14} />
            Reset demo
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Match rate"
          value={`${Math.round(impact.matchRate * 100)}%`}
          hint={`${impact.deliveredCount} delivered of ${impact.postedCount} posted`}
        />
        <Stat
          label="Median posting to delivery"
          value={
            impact.medianMinutesToDelivery === null
              ? "n/a"
              : formatDuration(impact.medianMinutesToDelivery)
          }
          hint="Across all completed handovers"
          tone="sky"
        />
        <Stat
          label="At risk right now"
          value={String(impact.atRiskCount)}
          hint="Inside the urgent or critical window"
          tone={impact.atRiskCount > 0 ? "amber" : "emerald"}
        />
        <Stat
          label="Lost to expiry"
          value={String(impact.expiredCount)}
          hint="Never reached a recipient safely"
          tone={impact.expiredCount > 0 ? "rose" : "emerald"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionTitle title="Donation queue" />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((filter, index) => (
              <button
                key={filter.label}
                type="button"
                className={`pill ${
                  index === filterIndex
                    ? "border-brand/50 bg-brand/12 text-brand"
                    : "border-line-strong text-muted"
                }`}
                onClick={() => setFilterIndex(index)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="card px-4 py-8 text-center text-xs text-faint">
                Nothing in this bucket.
              </p>
            ) : (
              filtered.slice(0, 40).map((donation) => {
                const donor = donors.find((d) => d.id === donation.donorId);
                const food = FOOD_TYPES[donation.foodType];
                const isSelected = selected?.id === donation.id;
                return (
                  <button
                    key={donation.id}
                    type="button"
                    onClick={() => setSelectedId(donation.id)}
                    className={`card-tight flex w-full items-center gap-2.5 p-2.5 text-left transition ${
                      isSelected
                        ? "border-brand/50 bg-brand/8"
                        : "hover:border-line-strong"
                    }`}
                  >
                    <span className="text-base">{food.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">
                        {donation.quantityKg.toFixed(1)} kg · {donor?.name ?? "Donor"}
                      </p>
                      <p className="truncate text-[0.68rem] text-muted">
                        {donation.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block text-[0.65rem] text-faint">
                        {formatClock(donation.createdAt)}
                      </span>
                      {donation.matchScore !== null ? (
                        <span className="block font-mono text-[0.7rem] text-brand">
                          {donation.matchScore}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-3">
          {selected ? (
            <>
              <DonationCard
                donation={selected}
                donor={donors.find((d) => d.id === selected.donorId)}
                shelter={shelters.find((s) => s.id === selected.shelterId) ?? null}
                now={now}
              />

              <div className="card p-4">
                <SectionTitle
                  title="Why this recipient"
                  hint="Gates are applied first, then the survivors are ranked"
                />
                {match ? (
                  <MatchExplainer result={match} limit={8} />
                ) : (
                  <p className="text-xs text-faint">No match data available.</p>
                )}
              </div>

              <div className="card p-4">
                <SectionTitle title="Audit trail" hint="Timestamped status history" />
                <ol className="space-y-2">
                  {selected.timeline.map((entry, index) => (
                    <li key={`${entry.status}-${index}`} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                      <div className="flex-1 border-b border-line pb-2 text-xs last:border-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-ink capitalize">
                            {entry.status.replace("_", " ")}
                          </span>
                          <span className="font-mono text-[0.68rem] text-faint">
                            {formatClock(entry.at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-muted">{entry.note}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <p className="card px-4 py-10 text-center text-xs text-faint">
              Select a donation to inspect its routing decision.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <SectionTitle
            title="Hard safety gates"
            hint="A candidate failing any of these cannot win on score"
          />
          <ul className="space-y-1.5 text-xs">
            {[
              `Arrival must be at least ${SAFETY_BUFFER_MINUTES} minutes before the safe-until time`,
              "Food type must be on the recipient's accepted list",
              "Cold-chain items require cold storage on site",
              "Remaining daily capacity must cover the full quantity",
              "Recipient must be open when the driver arrives",
              `Distance must be inside the ${MAX_MATCH_DISTANCE_KM} km rescue radius`,
              "A driver with enough vehicle capacity must be available",
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-2 text-muted">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-brand" />
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4">
          <SectionTitle title="Scoring weights" hint="Applied only to survivors" />
          <div className="divide-y divide-line">
            <KeyValue label="Proximity" value={`${MATCH_WEIGHTS.proximity * 100}%`} />
            <KeyValue label="Time margin" value={`${MATCH_WEIGHTS.timeMargin * 100}%`} />
            <KeyValue label="Capacity fit" value={`${MATCH_WEIGHTS.capacityFit * 100}%`} />
            <KeyValue label="Recipient need" value={`${MATCH_WEIGHTS.need * 100}%`} />
            <KeyValue label="Food preference" value={`${MATCH_WEIGHTS.preference * 100}%`} />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[0.68rem] text-faint">
            <Sliders size={12} className="mt-0.5 shrink-0" />
            Time margin is weighted second highest on purpose: a slightly longer
            drive that arrives with comfortable margin beats a closer recipient
            that only just makes it.
          </p>
        </div>

        <div className="card p-4">
          <SectionTitle title="Travel model" hint="Used for every ETA in the app" />
          <div className="divide-y divide-line">
            <KeyValue label="Dispatch delay" value={`${DISPATCH_DELAY_MINUTES} min`} />
            <KeyValue label="Loading at donor" value={`${LOAD_MINUTES} min`} />
            <KeyValue label="Unloading at recipient" value={`${UNLOAD_MINUTES} min`} />
            <KeyValue label="Road winding factor" value="1.35 × straight line" />
            <KeyValue label="Urban speed" value="21–27 km/h by vehicle" />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[0.68rem] text-faint">
            <Cpu size={12} className="mt-0.5 shrink-0" />
            Swapping this for a live routing API is a single module change, since
            every ETA flows through one travel-time function.
          </p>
        </div>
      </section>

      <section className="card p-4">
        <SectionTitle title="Network state" hint="Live capacity across all recipients" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {shelters.map((shelter) => {
            const remaining = Math.max(0, shelter.dailyCapacityKg - shelter.capacityUsedKg);
            const fraction = remaining / Math.max(1, shelter.dailyCapacityKg);
            return (
              <div key={shelter.id} className="card-tight p-3">
                <p className="truncate text-xs font-semibold text-ink">{shelter.name}</p>
                <p className="mt-0.5 text-[0.68rem] text-muted">
                  {remaining.toFixed(0)} kg free of {shelter.dailyCapacityKg} kg
                </p>
                <div className="meter mt-2">
                  <span
                    className={fraction < 0.2 ? "bg-rose-accent" : "bg-brand"}
                    style={{ width: `${Math.max(3, fraction * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {!shelter.hasRefrigeration ? <Badge tone="slate">No cold</Badge> : null}
                  <Badge tone="slate">{shelter.acceptedFoodTypes.length} types</Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
          <Badge tone="violet">{drivers.filter((d) => d.available).length} drivers on shift</Badge>
          <Badge tone="sky">{donors.length} donors connected</Badge>
          <span className="text-faint">
            Clock drift applied: {Math.round(clockOffsetMs / MINUTE)} min
          </span>
        </div>
      </section>
    </div>
  );
}
