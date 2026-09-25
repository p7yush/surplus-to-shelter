"use client";

import { Ban, CheckCircle2, Route, Timer, Truck } from "lucide-react";
import { Badge, Meter } from "@/components/ui/primitives";
import { MATCH_WEIGHTS } from "@/lib/domain/constants";
import { formatClock, formatDuration } from "@/lib/domain/time";
import type { Candidate, MatchResult, ScoreBreakdown } from "@/lib/domain/matching";

const FACTORS: {
  key: keyof ScoreBreakdown;
  label: string;
  weight: number;
}[] = [
  { key: "proximity", label: "Proximity", weight: MATCH_WEIGHTS.proximity },
  { key: "timeMargin", label: "Time margin", weight: MATCH_WEIGHTS.timeMargin },
  { key: "capacityFit", label: "Capacity fit", weight: MATCH_WEIGHTS.capacityFit },
  { key: "need", label: "Need", weight: MATCH_WEIGHTS.need },
  { key: "preference", label: "Preference", weight: MATCH_WEIGHTS.preference },
];

function CandidateRow({ candidate, rank }: { candidate: Candidate; rank: number }) {
  return (
    <div
      className={`card-tight p-3 ${candidate.feasible ? "" : "opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            {candidate.feasible ? (
              <CheckCircle2 size={14} className="text-brand" />
            ) : (
              <Ban size={14} className="text-rose-accent" />
            )}
            <span className="text-faint">#{rank}</span>
            {candidate.shelterName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted">
            <span className="flex items-center gap-1">
              <Route size={11} />
              {candidate.distanceKm.toFixed(1)} km
            </span>
            {Number.isFinite(candidate.etaMinutes) ? (
              <span className="flex items-center gap-1">
                <Timer size={11} />
                ETA {formatDuration(candidate.etaMinutes)}
                {candidate.deliveredAt
                  ? ` (${formatClock(candidate.deliveredAt)})`
                  : ""}
              </span>
            ) : null}
            {candidate.driverName ? (
              <span className="flex items-center gap-1">
                <Truck size={11} />
                {candidate.driverName}
              </span>
            ) : null}
            <span>{candidate.remainingCapacityKg.toFixed(0)} kg free</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`text-lg font-bold tabular-nums ${
              candidate.feasible ? "text-brand" : "text-faint line-through"
            }`}
          >
            {candidate.score.toFixed(1)}
          </p>
          <p className="text-[0.6rem] tracking-wider text-faint uppercase">score</p>
        </div>
      </div>

      {candidate.feasible ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
          {FACTORS.map((factor) => (
            <div key={factor.key}>
              <div className="mb-1 flex items-baseline justify-between text-[0.63rem]">
                <span className="text-faint">{factor.label}</span>
                <span className="font-mono text-muted">
                  {Math.round(candidate.breakdown[factor.key] * 100)}
                </span>
              </div>
              <Meter value={candidate.breakdown[factor.key]} tone="emerald" />
              <p className="mt-0.5 text-[0.58rem] text-faint">
                weight {Math.round(factor.weight * 100)}%
              </p>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-2.5 space-y-1">
          {candidate.rejections.map((rejection) => (
            <li
              key={rejection.code}
              className="flex items-start gap-1.5 text-[0.7rem] text-rose-accent"
            >
              <Ban size={11} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-mono text-[0.62rem] tracking-wide uppercase opacity-70">
                  {rejection.code}
                </span>{" "}
                · {rejection.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MatchExplainer({
  result,
  limit = 6,
}: {
  result: MatchResult;
  limit?: number;
}) {
  const feasible = result.candidates.filter((c) => c.feasible).length;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={feasible > 0 ? "emerald" : "rose"}>
          {feasible} of {result.candidates.length} recipients pass the safety gates
        </Badge>
        {result.blockedReason ? (
          <Badge tone="rose">{result.blockedReason}</Badge>
        ) : null}
      </div>

      {result.candidates.slice(0, limit).map((candidate, index) => (
        <CandidateRow
          key={candidate.shelterId}
          candidate={candidate}
          rank={index + 1}
        />
      ))}
    </div>
  );
}
