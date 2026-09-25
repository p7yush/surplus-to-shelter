import type { ReactNode } from "react";

export type Tone =
  | "slate"
  | "emerald"
  | "sky"
  | "amber"
  | "rose"
  | "violet"
  | "indigo";

const TONE_CLASS: Record<Tone, string> = {
  slate: "text-muted border-line-strong bg-white/5",
  emerald: "text-brand border-brand/40 bg-brand/10",
  sky: "text-sky-accent border-sky-accent/40 bg-sky-accent/10",
  amber: "text-amber-accent border-amber-accent/40 bg-amber-accent/10",
  rose: "text-rose-accent border-rose-accent/40 bg-rose-accent/10",
  violet: "text-violet-accent border-violet-accent/40 bg-violet-accent/10",
  indigo: "text-indigo-300 border-indigo-400/40 bg-indigo-400/10",
};

const TONE_BAR: Record<Tone, string> = {
  slate: "bg-faint",
  emerald: "bg-brand",
  sky: "bg-sky-accent",
  amber: "bg-amber-accent",
  rose: "bg-rose-accent",
  violet: "bg-violet-accent",
  indigo: "bg-indigo-400",
};

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`pill ${TONE_CLASS[tone]} ${className}`}>{children}</span>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-ink uppercase">
          {title}
        </h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "emerald",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="card p-4">
      <p className="text-[0.65rem] font-bold tracking-[0.12em] text-faint uppercase">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-ink">{value}</span>
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      <div className="meter mt-3">
        <span className={`${TONE_BAR[tone]} w-full opacity-70`} />
      </div>
    </div>
  );
}

export function Meter({
  value,
  tone = "emerald",
}: {
  value: number;
  tone?: Tone;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="meter">
      <span className={TONE_BAR[tone]} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="text-faint">{icon}</div> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-xs text-muted">{body}</p>
    </div>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-faint">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
