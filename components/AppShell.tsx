"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Clock,
  FastForward,
  Gauge,
  LayoutDashboard,
  RotateCcw,
  Store,
  Truck,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { formatClock } from "@/lib/domain/time";
import { useHydratedStore, useNow } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/useAppStore";
import type { Role } from "@/lib/domain/types";

const NAV = [
  { href: "/", label: "Impact", icon: LayoutDashboard, role: null },
  { href: "/donate", label: "Donor", icon: Utensils, role: "donor" as Role },
  { href: "/shelter", label: "Recipient", icon: Store, role: "shelter" as Role },
  { href: "/driver", label: "Driver", icon: Truck, role: "driver" as Role },
  { href: "/ops", label: "Control room", icon: Gauge, role: "ops" as Role },
];

const TONE_DOT: Record<string, string> = {
  info: "bg-sky-accent",
  success: "bg-brand",
  warning: "bg-amber-accent",
  danger: "bg-rose-accent",
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useAppStore((state) => state.notifications);
  const markRead = useAppStore((state) => state.markNotificationsRead);
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        className="btn px-2.5 py-2"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={15} />
        {unread > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-accent px-1 text-[0.6rem] font-bold text-canvas">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="card absolute right-0 z-50 mt-2 w-80 p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-xs font-bold tracking-wide text-ink uppercase">
              Activity
            </p>
            <button
              type="button"
              className="text-[0.7rem] text-muted hover:text-brand"
              onClick={() => {
                (["donor", "shelter", "driver", "ops"] as Role[]).forEach(markRead);
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-faint">
                Nothing yet.
              </p>
            ) : (
              notifications.slice(0, 18).map((item) => (
                <div
                  key={item.id}
                  className="card-tight flex gap-2.5 p-2.5 text-xs"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-muted">{item.body}</p>
                    <p className="mt-1 text-[0.65rem] text-faint">
                      {item.audience} · {formatClock(item.at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DemoClock() {
  const now = useNow(5_000);
  const offset = useAppStore((state) => state.clockOffsetMs);
  const advanceClock = useAppStore((state) => state.advanceClock);
  const resetClock = useAppStore((state) => state.resetClock);
  const offsetMinutes = Math.round(offset / 60_000);

  return (
    <div className="flex items-center gap-1.5">
      <span className="pill border-line-strong bg-white/5 font-mono text-muted">
        <Clock size={12} />
        {formatClock(now)}
      </span>
      <button
        type="button"
        className="btn px-2 py-1.5 text-[0.7rem]"
        title="Advance the demo clock by 30 minutes"
        onClick={() => advanceClock(30)}
      >
        <FastForward size={12} />
        +30m
      </button>
      {offsetMinutes !== 0 ? (
        <button
          type="button"
          className="btn px-2 py-1.5 text-[0.7rem]"
          title="Reset the demo clock to real time"
          onClick={resetClock}
        >
          <RotateCcw size={12} />
          {offsetMinutes > 0 ? `+${offsetMinutes}m` : `${offsetMinutes}m`}
        </button>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydratedStore();
  const setRole = useAppStore((state) => state.setRole);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-emerald-600 text-base">
              🥗
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-ink">
                Surplus<span className="text-brand">→</span>Shelter
              </span>
              <span className="block text-[0.63rem] tracking-[0.1em] text-faint uppercase">
                Real-time food rescue routing
              </span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => item.role && setRole(item.role)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-brand/50 bg-brand/12 text-brand"
                      : "border-transparent text-muted hover:border-line-strong hover:text-ink"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {hydrated ? <DemoClock /> : null}
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {hydrated ? (
          children
        ) : (
          <div className="grid place-items-center py-24">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
              <p className="text-xs text-faint">Starting the rescue network…</p>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-line px-4 py-5">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 text-xs text-faint">
          <p>
            Built for <span className="text-muted">AmiHacks</span> Track A ·
            Surplus-to-Shelter
          </p>
          <div className="flex items-center gap-2">
            <Badge tone="emerald">Safety-gated matching</Badge>
            <Badge tone="sky">Live across tabs</Badge>
          </div>
        </div>
      </footer>
    </div>
  );
}
