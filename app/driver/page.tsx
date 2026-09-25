"use client";

import { useMemo } from "react";
import {
  ArrowDownToLine,
  CircleSlash,
  Navigation,
  PackageCheck,
  Power,
  Route as RouteIcon,
  TriangleAlert,
} from "lucide-react";
import { RescueMap, type MapLine, type MapMarker } from "@/components/map/RescueMap";
import { Badge, EmptyState, SectionTitle, Stat } from "@/components/ui/primitives";
import { FOOD_TYPES } from "@/lib/domain/constants";
import { expiryRisk } from "@/lib/domain/expiry";
import {
  buildRouteStops,
  evaluateOrder,
  planRoute,
  type RouteStop,
} from "@/lib/domain/routing";
import { formatClock, formatDuration } from "@/lib/domain/time";
import { useNow } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/useAppStore";

export default function DriverPage() {
  const now = useNow();
  const drivers = useAppStore((state) => state.drivers);
  const donors = useAppStore((state) => state.donors);
  const shelters = useAppStore((state) => state.shelters);
  const donations = useAppStore((state) => state.donations);
  const activeDriverId = useAppStore((state) => state.activeDriverId);
  const setActiveDriver = useAppStore((state) => state.setActiveDriver);
  const markPickedUp = useAppStore((state) => state.markPickedUp);
  const markDelivered = useAppStore((state) => state.markDelivered);
  const toggleAvailability = useAppStore((state) => state.toggleDriverAvailability);

  const driver = drivers.find((item) => item.id === activeDriverId) ?? drivers[0];

  const assigned = useMemo(
    () =>
      donations.filter(
        (donation) =>
          donation.driverId === driver?.id &&
          (donation.status === "assigned" || donation.status === "picked_up"),
      ),
    [donations, driver?.id],
  );

  const stops = useMemo(
    () => buildRouteStops(assigned, donors, shelters),
    [assigned, donors, shelters],
  );

  const plan = useMemo(
    () => (driver ? planRoute(driver, stops, now) : null),
    [driver, stops, now],
  );

  const naivePlan = useMemo(() => {
    if (!driver || stops.length === 0) return null;
    const naiveOrder: RouteStop[] = [];
    for (const donation of assigned) {
      const pickup = stops.find(
        (stop) => stop.donationId === donation.id && stop.kind === "pickup",
      );
      const dropoff = stops.find(
        (stop) => stop.donationId === donation.id && stop.kind === "dropoff",
      );
      if (pickup) naiveOrder.push(pickup);
      if (dropoff) naiveOrder.push(dropoff);
    }
    return evaluateOrder(driver, naiveOrder, now);
  }, [assigned, driver, now, stops]);

  const savedKm =
    naivePlan && plan ? Math.max(0, naivePlan.totalKm - plan.totalKm) : 0;

  const { markers, lines } = useMemo(() => {
    if (!driver || !plan) return { markers: [] as MapMarker[], lines: [] as MapLine[] };

    const nextMarkers: MapMarker[] = [
      {
        id: "driver",
        position: driver.location,
        label: `${driver.name} (you)`,
        sublabel: `${driver.vehicle} · ${driver.capacityKg} kg capacity`,
        color: "#a78bfa",
        glyph: "🚚",
        size: 28,
      },
      ...plan.stops.map((stop, index) => ({
        id: stop.id,
        position: stop.location,
        label: `${index + 1}. ${stop.label}`,
        sublabel: `${stop.kind === "pickup" ? "Pick up" : "Drop off"} ${stop.quantityKg.toFixed(1)} kg · ${formatClock(stop.arrivalAt)}`,
        color: stop.kind === "pickup" ? "#fbbf24" : "#34d399",
        glyph: stop.kind === "pickup" ? "🍽️" : "🏠",
        pulse: stop.lateByMinutes > 0,
      })),
    ];

    const nextLines: MapLine[] =
      plan.stops.length > 0
        ? [
            {
              id: "route",
              points: [driver.location, ...plan.stops.map((stop) => stop.location)],
              color: "#a78bfa",
              weight: 3,
            },
          ]
        : [];

    return { markers: nextMarkers, lines: nextLines };
  }, [driver, plan]);

  if (!driver) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Driver dispatch</h1>
          <p className="mt-1 text-sm text-muted">
            Your pickups are sequenced into one route. Pickups always come before
            their drop-off, and the order is chosen to protect expiry deadlines
            first, distance second.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="min-w-48">
            <span className="field-label">Driving as</span>
            <select
              className="field"
              value={driver.id}
              onChange={(event) => setActiveDriver(event.target.value)}
            >
              {drivers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.vehicle} · {item.capacityKg} kg
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`btn ${driver.available ? "" : "btn-danger"}`}
            onClick={() => toggleAvailability(driver.id)}
          >
            <Power size={14} />
            {driver.available ? "On shift" : "Off shift"}
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Stops on route"
          value={String(plan?.stops.length ?? 0)}
          hint={`${assigned.length} donations in hand`}
          tone="violet"
        />
        <Stat
          label="Route distance"
          value={(plan?.totalKm ?? 0).toFixed(1)}
          unit="km"
          hint={
            savedKm > 0.05
              ? `${savedKm.toFixed(1)} km saved vs one-by-one`
              : "Already the shortest valid order"
          }
          tone="sky"
        />
        <Stat
          label="Shift duration"
          value={formatDuration(plan?.totalMinutes ?? 0)}
          hint="Includes 8 minutes of handling per stop"
        />
        <Stat
          label="Deadline risk"
          value={String(plan?.lateStops ?? 0)}
          hint={
            plan?.feasible
              ? "Every drop-off lands inside its window"
              : "Some drop-offs would miss the window"
          }
          tone={plan?.feasible ? "emerald" : "rose"}
        />
      </section>

      {plan && !plan.feasible ? (
        <p className="flex items-start gap-2 rounded-lg border border-rose-accent/30 bg-rose-accent/8 p-3 text-xs text-rose-accent">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          This route cannot deliver everything inside the safe windows. Drop the
          flagged stop or hand it to another driver rather than delivering food
          that is no longer safe.
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-ink uppercase">
              <RouteIcon size={15} className="text-violet-accent" />
              Optimised route
            </h2>
            <div className="flex gap-1.5">
              <Badge tone="amber">🍽️ Pickup</Badge>
              <Badge tone="emerald">🏠 Drop-off</Badge>
            </div>
          </div>
          <div className="h-[420px]">
            <RescueMap markers={markers} lines={lines} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionTitle title="Stop list" hint="In driving order" />
          {!plan || plan.stops.length === 0 ? (
            <EmptyState
              title="No stops assigned"
              body="When a recipient accepts a match near you, the pickup lands on your route automatically."
              icon={<Navigation size={22} />}
            />
          ) : (
            <ol className="space-y-2">
              {plan.stops.map((stop, index) => {
                const donation = donations.find((item) => item.id === stop.donationId);
                const food = donation ? FOOD_TYPES[donation.foodType] : null;
                const risk = donation ? expiryRisk(donation, now) : null;
                const isPickup = stop.kind === "pickup";

                return (
                  <li key={stop.id} className="card-tight p-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-bold ${
                          isPickup
                            ? "border-amber-accent/40 bg-amber-accent/10 text-amber-accent"
                            : "border-brand/40 bg-brand/10 text-brand"
                        }`}
                      >
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink">
                          {isPickup ? "Pick up from" : "Deliver to"} {stop.label}
                          {stop.lateByMinutes > 0 ? (
                            <Badge tone="rose">
                              {formatDuration(stop.lateByMinutes)} late
                            </Badge>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[0.7rem] text-muted">
                          {stop.sublabel}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-faint">
                          <span>
                            {food?.emoji} {stop.quantityKg.toFixed(1)} kg
                          </span>
                          <span>ETA {formatClock(stop.arrivalAt)}</span>
                          <span>{stop.legKm.toFixed(1)} km leg</span>
                          {risk && isPickup ? (
                            <span className={risk.routable ? "" : "text-rose-accent"}>
                              window {formatDuration(risk.minutesLeft)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {donation ? (
                        <button
                          type="button"
                          className={`btn shrink-0 px-2.5 py-1.5 text-[0.7rem] ${
                            isPickup ? "" : "btn-primary"
                          }`}
                          onClick={() =>
                            isPickup
                              ? markPickedUp(donation.id)
                              : markDelivered(donation.id)
                          }
                          disabled={isPickup && donation.status === "picked_up"}
                        >
                          {isPickup ? (
                            <>
                              <ArrowDownToLine size={12} />
                              Collected
                            </>
                          ) : (
                            <>
                              <PackageCheck size={12} />
                              Delivered
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {naivePlan && plan && assigned.length > 1 ? (
            <div className="card mt-4 p-4">
              <SectionTitle
                title="Optimiser gain"
                hint="Nearest-neighbour seed improved by constrained 2-opt"
              />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">One donation at a time</span>
                  <span className="font-mono text-ink">
                    {naivePlan.totalKm.toFixed(1)} km
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Optimised multi-stop</span>
                  <span className="font-mono text-brand">
                    {plan.totalKm.toFixed(1)} km
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2">
                  <span className="text-muted">Saved</span>
                  <span className="font-mono font-bold text-brand">
                    {savedKm.toFixed(1)} km
                    {naivePlan.totalKm > 0
                      ? ` (${Math.round((savedKm / naivePlan.totalKm) * 100)}%)`
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle title="Other drivers on the network" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {drivers
            .filter((item) => item.id !== driver.id)
            .map((item) => {
              const load = donations.filter(
                (donation) =>
                  donation.driverId === item.id &&
                  (donation.status === "assigned" || donation.status === "picked_up"),
              ).length;
              return (
                <div key={item.id} className="card flex items-center gap-3 p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2">
                    {item.available ? "🚚" : <CircleSlash size={14} className="text-faint" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{item.name}</p>
                    <p className="text-[0.68rem] text-muted">
                      {item.vehicle} · {item.capacityKg} kg · {load} active
                    </p>
                  </div>
                  <Badge tone={item.available ? "emerald" : "slate"}>
                    {item.available ? "On shift" : "Off"}
                  </Badge>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
