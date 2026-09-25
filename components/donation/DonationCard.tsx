"use client";

import { AlertTriangle, MapPin, Snowflake, Timer, Weight } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Meter, type Tone } from "@/components/ui/primitives";
import { FOOD_TYPES, STATUS_META } from "@/lib/domain/constants";
import { expiryRisk } from "@/lib/domain/expiry";
import { mealsFromKg } from "@/lib/domain/impact";
import { formatClock, formatDuration } from "@/lib/domain/time";
import type { Donation, Donor, Shelter } from "@/lib/domain/types";

export function DonationCard({
  donation,
  donor,
  shelter,
  now,
  actions,
  footer,
}: {
  donation: Donation;
  donor?: Donor;
  shelter?: Shelter | null;
  now: number;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const food = FOOD_TYPES[donation.foodType];
  const risk = expiryRisk(donation, now);
  const status = STATUS_META[donation.status];
  const settled = donation.status === "delivered";

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
          style={{ background: `${food.accent}1f`, border: `1px solid ${food.accent}55` }}
        >
          {food.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={status.tone as Tone}>{status.label}</Badge>
            {!settled ? (
              <Badge tone={risk.tone as Tone}>
                <Timer size={11} />
                {risk.level === "expired"
                  ? "Window closed"
                  : `${formatDuration(risk.minutesLeft)} left`}
              </Badge>
            ) : null}
            {donation.needsRefrigeration ? (
              <Badge tone="sky">
                <Snowflake size={11} />
                Cold chain
              </Badge>
            ) : null}
            {donation.matchScore !== null ? (
              <Badge tone="violet">Score {donation.matchScore}</Badge>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-semibold text-ink">{donation.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Weight size={12} />
              {donation.quantityKg.toFixed(1)} kg ·{" "}
              {Math.round(mealsFromKg(donation.quantityKg))} meals
            </span>
            {donor ? (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {donor.name}
              </span>
            ) : null}
            <span>{food.shortLabel}</span>
          </div>

          {shelter ? (
            <p className="mt-2 text-xs text-muted">
              Routed to <span className="font-semibold text-ink">{shelter.name}</span>
              {shelter.address ? ` · ${shelter.address}` : ""}
            </p>
          ) : null}

          {donation.status === "unmatched" && donation.matchReason ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-accent/30 bg-rose-accent/8 p-2 text-xs text-rose-accent">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {donation.matchReason}
            </p>
          ) : null}

          {donation.status !== "unmatched" && donation.matchReason ? (
            <p className="mt-2 text-xs text-faint">Why: {donation.matchReason}</p>
          ) : null}

          {!settled ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[0.65rem] text-faint">
                <span>Safe window</span>
                <span>Closes {formatClock(donation.expiresAt)}</span>
              </div>
              <Meter value={risk.windowFractionLeft} tone={risk.tone as Tone} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-brand">
              Delivered{" "}
              {donation.deliveredAt ? `at ${formatClock(donation.deliveredAt)}` : ""}
            </p>
          )}
        </div>

        {actions ? <div className="flex shrink-0 flex-col gap-1.5">{actions}</div> : null}
      </div>

      {footer ? <div className="mt-3 border-t border-line pt-3">{footer}</div> : null}
    </article>
  );
}
