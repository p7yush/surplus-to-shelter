"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  PackageCheck,
  Snowflake,
  ThumbsDown,
  Users,
} from "lucide-react";
import { DonationCard } from "@/components/donation/DonationCard";
import { Badge, EmptyState, Meter, SectionTitle, Stat } from "@/components/ui/primitives";
import { FOOD_TYPES, FOOD_TYPE_ORDER } from "@/lib/domain/constants";
import { mealsFromKg } from "@/lib/domain/impact";
import { remainingCapacityKg } from "@/lib/domain/matching";
import { formatMinuteOfDay, startOfDay } from "@/lib/domain/time";
import { useNow } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/useAppStore";
import type { FoodType } from "@/lib/domain/types";

const DECLINE_REASONS = [
  "Kitchen already at capacity tonight",
  "No volunteer on site to receive it",
  "Cannot store this safely",
  "Food type not usable for our meal plan",
];

const INBOUND = ["accepted", "assigned", "picked_up"];

export default function ShelterPage() {
  const now = useNow();
  const shelters = useAppStore((state) => state.shelters);
  const donors = useAppStore((state) => state.donors);
  const donations = useAppStore((state) => state.donations);
  const activeShelterId = useAppStore((state) => state.activeShelterId);
  const setActiveShelter = useAppStore((state) => state.setActiveShelter);
  const updateShelter = useAppStore((state) => state.updateShelter);
  const acceptMatch = useAppStore((state) => state.acceptMatch);
  const declineMatch = useAppStore((state) => state.declineMatch);

  const [decliningId, setDecliningId] = useState<string | null>(null);

  const shelter = shelters.find((item) => item.id === activeShelterId) ?? shelters[0];

  const mine = useMemo(
    () => donations.filter((donation) => donation.shelterId === shelter?.id),
    [donations, shelter?.id],
  );

  const proposed = mine.filter((donation) => donation.status === "matched");
  const inbound = mine.filter((donation) => INBOUND.includes(donation.status));
  const deliveredToday = mine.filter(
    (donation) =>
      donation.status === "delivered" &&
      donation.deliveredAt !== null &&
      startOfDay(donation.deliveredAt) === startOfDay(now),
  );

  const remaining = shelter ? remainingCapacityKg(shelter) : 0;
  const committed = inbound.reduce((sum, donation) => sum + donation.quantityKg, 0);
  const usedFraction = shelter
    ? Math.min(1, shelter.capacityUsedKg / Math.max(1, shelter.dailyCapacityKg))
    : 0;

  function toggleType(
    field: "acceptedFoodTypes" | "preferredFoodTypes",
    type: FoodType,
  ) {
    if (!shelter) return;
    const current = shelter[field];
    const next = current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type];

    if (field === "acceptedFoodTypes" && current.includes(type)) {
      updateShelter(shelter.id, {
        acceptedFoodTypes: next,
        preferredFoodTypes: shelter.preferredFoodTypes.filter((item) => item !== type),
      });
      return;
    }

    if (field === "preferredFoodTypes" && !current.includes(type)) {
      updateShelter(shelter.id, {
        preferredFoodTypes: next,
        acceptedFoodTypes: shelter.acceptedFoodTypes.includes(type)
          ? shelter.acceptedFoodTypes
          : [...shelter.acceptedFoodTypes, type],
      });
      return;
    }

    updateShelter(shelter.id, { [field]: next });
  }

  if (!shelter) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Recipient console</h1>
          <p className="mt-1 text-sm text-muted">
            Your capacity and preferences are what the matching engine reads. Keep
            them honest and you stop getting food you cannot use.
          </p>
        </div>
        <label className="min-w-56">
          <span className="field-label">Operating as</span>
          <select
            className="field"
            value={shelter.id}
            onChange={(event) => setActiveShelter(event.target.value)}
          >
            {shelters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Capacity left today"
          value={remaining.toFixed(0)}
          unit={`of ${shelter.dailyCapacityKg} kg`}
          hint={`${committed.toFixed(0)} kg already inbound`}
          tone={remaining < shelter.dailyCapacityKg * 0.2 ? "amber" : "emerald"}
        />
        <Stat
          label="Awaiting your decision"
          value={String(proposed.length)}
          hint="Proposed matches expire with the food"
          tone={proposed.length > 0 ? "sky" : "slate"}
        />
        <Stat
          label="On the way"
          value={String(inbound.length)}
          hint={`${committed.toFixed(0)} kg in transit or assigned`}
          tone="violet"
        />
        <Stat
          label="Received today"
          value={deliveredToday
            .reduce((sum, donation) => sum + donation.quantityKg, 0)
            .toFixed(0)}
          unit="kg"
          hint={`≈ ${Math.round(
            mealsFromKg(
              deliveredToday.reduce((sum, donation) => sum + donation.quantityKg, 0),
            ),
          )} meals served`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionTitle
            title="Proposed matches"
            hint="Accept to put the pickup on a driver's route"
          />
          {proposed.length === 0 ? (
            <EmptyState
              title="No pending proposals"
              body="When the engine finds surplus that fits your capacity, food types and opening hours, it will appear here."
              icon={<PackageCheck size={22} />}
            />
          ) : (
            <div className="space-y-3">
              {proposed.map((donation) => (
                <DonationCard
                  key={donation.id}
                  donation={donation}
                  donor={donors.find((d) => d.id === donation.donorId)}
                  now={now}
                  actions={
                    <>
                      <button
                        type="button"
                        className="btn btn-primary px-3 py-1.5 text-[0.72rem]"
                        onClick={() => acceptMatch(donation.id)}
                      >
                        <Check size={13} />
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger px-3 py-1.5 text-[0.72rem]"
                        onClick={() =>
                          setDecliningId(
                            decliningId === donation.id ? null : donation.id,
                          )
                        }
                      >
                        <ThumbsDown size={13} />
                        Decline
                      </button>
                    </>
                  }
                  footer={
                    decliningId === donation.id ? (
                      <div>
                        <p className="mb-2 text-xs text-muted">
                          Why are you declining? The engine will immediately re-run
                          the match without your organisation.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {DECLINE_REASONS.map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              className="btn px-2 py-1 text-[0.68rem]"
                              onClick={() => {
                                declineMatch(donation.id, reason);
                                setDecliningId(null);
                              }}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null
                  }
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <SectionTitle
              title="Inbound deliveries"
              hint="Confirmed and on a driver's route"
            />
            {inbound.length === 0 ? (
              <EmptyState
                title="Nothing inbound"
                body="Accepted matches will show here with their live pickup status."
              />
            ) : (
              <div className="space-y-3">
                {inbound.map((donation) => (
                  <DonationCard
                    key={donation.id}
                    donation={donation}
                    donor={donors.find((d) => d.id === donation.donorId)}
                    now={now}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <SectionTitle
              title="Capacity & preferences"
              hint="Changes take effect on the next match"
            />

            <div className="mb-3">
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className="text-faint">Used today</span>
                <span className="font-mono text-ink">
                  {shelter.capacityUsedKg.toFixed(0)} / {shelter.dailyCapacityKg} kg
                </span>
              </div>
              <Meter
                value={usedFraction}
                tone={usedFraction > 0.8 ? "amber" : "emerald"}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="field-label">Daily capacity (kg)</span>
                <input
                  className="field"
                  type="number"
                  min="10"
                  step="10"
                  value={shelter.dailyCapacityKg}
                  onChange={(event) =>
                    updateShelter(shelter.id, {
                      dailyCapacityKg: Math.max(0, Number(event.target.value)),
                    })
                  }
                />
              </label>
              <label>
                <span className="field-label">People served daily</span>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="10"
                  value={shelter.peopleServedDaily}
                  onChange={(event) =>
                    updateShelter(shelter.id, {
                      peopleServedDaily: Math.max(0, Number(event.target.value)),
                    })
                  }
                />
              </label>
              <label>
                <span className="field-label">Intake opens</span>
                <input
                  className="field"
                  type="time"
                  value={`${String(Math.floor(shelter.openHours.open / 60)).padStart(2, "0")}:${String(shelter.openHours.open % 60).padStart(2, "0")}`}
                  onChange={(event) => {
                    const [h, m] = event.target.value.split(":").map(Number);
                    updateShelter(shelter.id, {
                      openHours: { ...shelter.openHours, open: h * 60 + m },
                    });
                  }}
                />
              </label>
              <label>
                <span className="field-label">Intake closes</span>
                <input
                  className="field"
                  type="time"
                  value={`${String(Math.floor(shelter.openHours.close / 60)).padStart(2, "0")}:${String(shelter.openHours.close % 60).padStart(2, "0")}`}
                  onChange={(event) => {
                    const [h, m] = event.target.value.split(":").map(Number);
                    updateShelter(shelter.id, {
                      openHours: { ...shelter.openHours, close: h * 60 + m },
                    });
                  }}
                />
              </label>
            </div>

            <label className="card-tight mt-3 flex cursor-pointer items-center gap-2.5 p-3">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-brand)]"
                checked={shelter.hasRefrigeration}
                onChange={(event) =>
                  updateShelter(shelter.id, { hasRefrigeration: event.target.checked })
                }
              />
              <span className="text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <Snowflake size={13} className="text-sky-accent" />
                  Cold storage available
                </span>
                <span className="mt-0.5 block text-faint">
                  Required before dairy or meat can be routed here
                </span>
              </span>
            </label>

            <div className="mt-4">
              <span className="field-label">Accepted food types</span>
              <div className="flex flex-wrap gap-1.5">
                {FOOD_TYPE_ORDER.map((type) => {
                  const accepted = shelter.acceptedFoodTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`pill ${
                        accepted
                          ? "border-brand/50 bg-brand/12 text-brand"
                          : "border-line-strong text-faint"
                      }`}
                      onClick={() => toggleType("acceptedFoodTypes", type)}
                    >
                      {FOOD_TYPES[type].emoji} {FOOD_TYPES[type].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <span className="field-label">Preferred (scored higher)</span>
              <div className="flex flex-wrap gap-1.5">
                {FOOD_TYPE_ORDER.map((type) => {
                  const preferred = shelter.preferredFoodTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`pill ${
                        preferred
                          ? "border-violet-accent/50 bg-violet-accent/12 text-violet-accent"
                          : "border-line-strong text-faint"
                      }`}
                      onClick={() => toggleType("preferredFoodTypes", type)}
                    >
                      {FOOD_TYPES[type].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <SectionTitle title="Organisation" />
            <div className="space-y-2 text-xs">
              <p className="flex items-center gap-2 text-muted">
                <Users size={13} className="text-faint" />
                Serves {shelter.peopleServedDaily} people daily
              </p>
              <p className="flex items-center gap-2 text-muted">
                <Clock size={13} className="text-faint" />
                Intake {formatMinuteOfDay(shelter.openHours.open)} –{" "}
                {formatMinuteOfDay(shelter.openHours.close)}
              </p>
              <p className="text-muted">{shelter.address}</p>
              <p className="text-muted">{shelter.contact}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge tone={shelter.hasRefrigeration ? "sky" : "slate"}>
                  {shelter.hasRefrigeration ? "Cold storage" : "No cold storage"}
                </Badge>
                <Badge tone="emerald">
                  {shelter.acceptedFoodTypes.length} food types accepted
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle title="Received today" hint="Logged for impact reporting" />
        {deliveredToday.length === 0 ? (
          <EmptyState
            title="No deliveries logged today"
            body="Completed handovers appear here with their timestamps."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {deliveredToday.map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                donor={donors.find((d) => d.id === donation.donorId)}
                now={now}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
