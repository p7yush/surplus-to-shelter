"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Building2,
  Droplets,
  Leaf,
  Package,
  ShieldCheck,
  Timer,
  Truck,
  Utensils,
} from "lucide-react";
import { DailyBars, FoodTypeSplit } from "@/components/charts/Charts";
import { RescueMap, type MapLine, type MapMarker } from "@/components/map/RescueMap";
import { Badge, SectionTitle, Stat } from "@/components/ui/primitives";
import { FOOD_TYPES, SAFETY_BUFFER_MINUTES } from "@/lib/domain/constants";
import { expiryRisk } from "@/lib/domain/expiry";
import { computeImpact, mealsFromKg } from "@/lib/domain/impact";
import { formatDuration } from "@/lib/domain/time";
import { useNow } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/useAppStore";

const ACTIVE = new Set(["posted", "matched", "accepted", "assigned", "picked_up"]);

const STEPS = [
  {
    icon: Utensils,
    title: "Post in under a minute",
    body: "A donor types one line of plain text. The parser pulls out weight, food type and the safe-until time.",
  },
  {
    icon: ShieldCheck,
    title: "Gate before you rank",
    body: `Shelters that cannot accept the food type, lack cold storage, are out of capacity, closed on arrival, or would be reached with under ${SAFETY_BUFFER_MINUTES} minutes of margin are disqualified outright.`,
  },
  {
    icon: Truck,
    title: "Dispatch and optimise",
    body: "The nearest capable driver is assigned, and their pickups are sequenced into one route that respects every expiry deadline.",
  },
  {
    icon: Leaf,
    title: "Log the impact",
    body: "Every handover is timestamped, so diverted weight, meals and avoided emissions are reportable rather than estimated.",
  },
];

export default function ImpactDashboardPage() {
  const now = useNow();
  const donations = useAppStore((state) => state.donations);
  const donors = useAppStore((state) => state.donors);
  const shelters = useAppStore((state) => state.shelters);
  const drivers = useAppStore((state) => state.drivers);

  const impact = useMemo(() => computeImpact(donations, now), [donations, now]);

  const active = useMemo(
    () => donations.filter((donation) => ACTIVE.has(donation.status)),
    [donations],
  );

  const atRisk = useMemo(
    () =>
      active
        .map((donation) => ({ donation, risk: expiryRisk(donation, now) }))
        .filter((item) => item.risk.level === "urgent" || item.risk.level === "critical")
        .sort((a, b) => a.risk.minutesLeft - b.risk.minutesLeft),
    [active, now],
  );

  const { markers, lines } = useMemo(() => {
    const donorById = new Map(donors.map((d) => [d.id, d]));
    const shelterById = new Map(shelters.map((s) => [s.id, s]));
    const activeDonorIds = new Set(active.map((d) => d.donorId));

    const nextMarkers: MapMarker[] = [
      ...shelters.map((shelter) => ({
        id: `shelter-${shelter.id}`,
        position: shelter.location,
        label: shelter.name,
        sublabel: `${Math.max(0, shelter.dailyCapacityKg - shelter.capacityUsedKg).toFixed(0)} kg of capacity left`,
        color: "#38bdf8",
        glyph: "🏠",
      })),
      ...donors.map((donor) => ({
        id: `donor-${donor.id}`,
        position: donor.location,
        label: donor.name,
        sublabel: donor.address,
        color: activeDonorIds.has(donor.id) ? "#fbbf24" : "#64748b",
        glyph: "🍽️",
        size: activeDonorIds.has(donor.id) ? 26 : 20,
      })),
      ...drivers
        .filter((driver) => driver.available)
        .map((driver) => ({
          id: `driver-${driver.id}`,
          position: driver.location,
          label: driver.name,
          sublabel: `${driver.vehicle} · ${driver.capacityKg} kg capacity`,
          color: "#a78bfa",
          glyph: "🚚",
          size: 22,
        })),
    ];

    const nextLines: MapLine[] = active
      .filter((donation) => donation.shelterId !== null)
      .map((donation): MapLine | null => {
        const donor = donorById.get(donation.donorId);
        const shelter = shelterById.get(donation.shelterId!);
        if (!donor || !shelter) return null;
        const risk = expiryRisk(donation, now);
        return {
          id: `line-${donation.id}`,
          points: [donor.location, shelter.location],
          color: risk.level === "critical" || risk.level === "urgent" ? "#fb7185" : "#34d399",
          dashed: donation.status !== "picked_up",
        };
      })
      .filter((line): line is MapLine => line !== null);

    return { markers: nextMarkers, lines: nextLines };
  }, [active, donors, drivers, now, shelters]);

  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <Badge tone="emerald">AmiHacks · Track A · NGO / Social impact</Badge>
          <h1 className="mt-4 text-3xl leading-tight font-bold text-ink sm:text-4xl">
            Turn a restaurant&apos;s unsold food into a shelter&apos;s next meal
            <span className="text-brand"> before it hits the dumpster.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
            Surplus food has a 2–6 hour usable window, but donations are still
            coordinated over phone calls and WhatsApp groups. Surplus→Shelter
            replaces that with safety-gated matching, live dispatch and an audit
            trail that makes diverted weight reportable.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/donate" className="btn btn-primary">
              <Utensils size={15} />
              Post surplus food
              <ArrowRight size={14} />
            </Link>
            <Link href="/ops" className="btn">
              <ShieldCheck size={15} />
              See how a match is decided
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Meals rescued"
          value={Math.round(impact.meals).toLocaleString()}
          hint={`${impact.deliveredCount} completed handovers`}
          tone="emerald"
        />
        <Stat
          label="Weight diverted"
          value={impact.kgRescued.toFixed(0)}
          unit="kg"
          hint="Kept out of landfill"
          tone="sky"
        />
        <Stat
          label="CO₂e avoided"
          value={impact.co2eKg.toFixed(0)}
          unit="kg"
          hint={`≈ ${(impact.waterLitres / 1000).toFixed(0)} m³ of water footprint`}
          tone="violet"
        />
        <Stat
          label="Live rescues"
          value={String(impact.activeCount)}
          hint={
            impact.atRiskCount > 0
              ? `${impact.atRiskCount} inside the urgent window`
              : "Nothing urgent right now"
          }
          tone={impact.atRiskCount > 0 ? "amber" : "emerald"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-bold tracking-wide text-ink uppercase">
                Live rescue map
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Solid lines are food already collected, dashed lines are matched
                pickups still pending.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="sky">🏠 Recipients</Badge>
              <Badge tone="amber">🍽️ Donors</Badge>
              <Badge tone="violet">🚚 Drivers</Badge>
            </div>
          </div>
          <div className="h-[420px]">
            <RescueMap markers={markers} lines={lines} />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <SectionTitle
              title="Diverted per day"
              hint="Kilograms delivered over the last seven days"
            />
            <DailyBars daily={impact.daily} />
          </div>

          <div className="card p-4">
            <SectionTitle title="What gets rescued" hint="Share of delivered weight" />
            <FoodTypeSplit kgByFoodType={impact.kgByFoodType} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <SectionTitle
            title="Closing soonest"
            hint="Live donations inside the urgent or critical window"
            action={
              <Link href="/ops" className="btn px-2.5 py-1.5 text-[0.7rem]">
                Control room
              </Link>
            }
          />
          {atRisk.length === 0 ? (
            <p className="py-6 text-center text-xs text-faint">
              Nothing is close to its safe-window cut-off right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {atRisk.slice(0, 5).map(({ donation, risk }) => {
                const donor = donors.find((d) => d.id === donation.donorId);
                const food = FOOD_TYPES[donation.foodType];
                return (
                  <li
                    key={donation.id}
                    className="card-tight flex items-center gap-3 p-3"
                  >
                    <span className="text-base">{food.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">
                        {donation.quantityKg.toFixed(1)} kg · {donor?.name ?? "Donor"}
                      </p>
                      <p className="truncate text-[0.7rem] text-muted">
                        {donation.description}
                      </p>
                    </div>
                    <Badge tone={risk.tone as "amber" | "rose"}>
                      <Timer size={11} />
                      {formatDuration(risk.minutesLeft)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <SectionTitle title="Network" hint="Participants wired into the graph" />
          <div className="space-y-3">
            {[
              { icon: Utensils, label: "Food donors", value: donors.length },
              { icon: Building2, label: "Recipient organisations", value: shelters.length },
              {
                icon: Truck,
                label: "Drivers on shift",
                value: drivers.filter((d) => d.available).length,
              },
              { icon: Package, label: "Donations logged", value: donations.length },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface-2 text-muted">
                  <row.icon size={14} />
                </span>
                <span className="flex-1 text-xs text-muted">{row.label}</span>
                <span className="text-sm font-bold tabular-nums text-ink">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-start gap-2 text-xs text-muted">
              <Droplets size={14} className="mt-0.5 shrink-0 text-sky-accent" />
              <p>
                Median time from posting to delivery:{" "}
                <span className="font-semibold text-ink">
                  {impact.medianMinutesToDelivery === null
                    ? "n/a"
                    : formatDuration(impact.medianMinutesToDelivery)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          title="How the routing works"
          hint="Safety gates run before ranking, so an unsafe match can never win on distance alone"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/40 bg-brand/10 text-brand">
                  <step.icon size={15} />
                </span>
                <span className="font-mono text-xs text-faint">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{step.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle
          title="Impact accounting"
          hint="Conversions used across this dashboard"
        />
        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <div className="card-tight p-3">
            <p className="font-semibold text-ink">0.5 kg = 1 meal</p>
            <p className="mt-1 text-muted">
              {impact.kgRescued.toFixed(0)} kg rescued becomes{" "}
              {Math.round(mealsFromKg(impact.kgRescued)).toLocaleString()} meals.
            </p>
          </div>
          <div className="card-tight p-3">
            <p className="font-semibold text-ink">2.5 kg CO₂e per kg</p>
            <p className="mt-1 text-muted">
              Covers embedded production emissions plus avoided landfill methane.
            </p>
          </div>
          <div className="card-tight p-3">
            <p className="font-semibold text-ink">{SAFETY_BUFFER_MINUTES} minute buffer</p>
            <p className="mt-1 text-muted">
              No match is proposed unless the food arrives at least this far ahead
              of its safe-until time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
