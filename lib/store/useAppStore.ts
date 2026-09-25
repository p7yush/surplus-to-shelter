"use client";

import { create } from "zustand";
import { createSeedData } from "@/lib/data/seed";
import { suggestedExpiry } from "@/lib/domain/expiry";
import { findMatches, type MatchResult } from "@/lib/domain/matching";
import { MINUTE } from "@/lib/domain/time";
import type {
  AppData,
  AppNotification,
  Donation,
  DonationStatus,
  FoodType,
  Role,
  Shelter,
} from "@/lib/domain/types";

const STORAGE_KEY = "surplus-to-shelter:state:v1";
const CHANNEL_NAME = "surplus-to-shelter:sync";

export interface NewDonationInput {
  donorId: string;
  description: string;
  foodType: FoodType;
  quantityKg: number;
  needsRefrigeration: boolean;
  readyAt: number;
  expiresAt: number;
}

interface AppState extends AppData {
  hydrated: boolean;
  role: Role;
  activeDonorId: string;
  activeShelterId: string;
  activeDriverId: string;
  now: () => number;
  hydrate: () => void;
  setRole: (role: Role) => void;
  setActiveDonor: (id: string) => void;
  setActiveShelter: (id: string) => void;
  setActiveDriver: (id: string) => void;
  postDonation: (input: NewDonationInput) => string;
  matchDonation: (donationId: string) => void;
  acceptMatch: (donationId: string) => void;
  declineMatch: (donationId: string, reason: string) => void;
  markPickedUp: (donationId: string) => void;
  markDelivered: (donationId: string) => void;
  updateShelter: (shelterId: string, patch: Partial<Shelter>) => void;
  toggleDriverAvailability: (driverId: string) => void;
  matchAllPending: () => void;
  tick: () => void;
  advanceClock: (minutes: number) => void;
  resetClock: () => void;
  markNotificationsRead: (audience: Role) => void;
  resetDemo: () => void;
  candidatesFor: (donationId: string) => MatchResult | null;
}

let channel: BroadcastChannel | null = null;
let applyingRemote = false;

function dataOf(state: AppState): AppData {
  return {
    donors: state.donors,
    shelters: state.shelters,
    drivers: state.drivers,
    donations: state.donations,
    notifications: state.notifications,
    clockOffsetMs: state.clockOffsetMs,
  };
}

function persist(data: AppData) {
  if (typeof window === "undefined" || applyingRemote) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    channel?.postMessage(data);
  } catch {
    /* storage unavailable */
  }
}

function notify(
  notifications: AppNotification[],
  entry: Omit<AppNotification, "id" | "read">,
): AppNotification[] {
  const item: AppNotification = {
    ...entry,
    id: `notif-${entry.at}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
  };
  return [item, ...notifications].slice(0, 60);
}

function advance(
  donation: Donation,
  status: DonationStatus,
  at: number,
  note: string,
): Donation {
  return {
    ...donation,
    status,
    timeline: [...donation.timeline, { at, status, note }],
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...createSeedData(Date.now()),
  hydrated: false,
  role: "donor",
  activeDonorId: "donor-spice-route",
  activeShelterId: "shelter-seva",
  activeDriverId: "driver-arjun",

  now: () => Date.now() + get().clockOffsetMs,

  hydrate: () => {
    if (typeof window === "undefined" || get().hydrated) return;

    let data: AppData | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw) as AppData;
    } catch {
      data = null;
    }

    const next = data ?? createSeedData(Date.now());
    set({ ...next, hydrated: true });
    if (!data) persist(next);

    if (!channel && "BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<AppData>) => {
        applyingRemote = true;
        set({ ...event.data });
        applyingRemote = false;
      };
    }
  },

  setRole: (role) => set({ role }),
  setActiveDonor: (activeDonorId) => set({ activeDonorId }),
  setActiveShelter: (activeShelterId) => set({ activeShelterId }),
  setActiveDriver: (activeDriverId) => set({ activeDriverId }),

  postDonation: (input) => {
    const now = get().now();
    const id = `donation-${now}-${Math.random().toString(36).slice(2, 7)}`;

    const donation: Donation = {
      id,
      donorId: input.donorId,
      description: input.description,
      foodType: input.foodType,
      quantityKg: input.quantityKg,
      needsRefrigeration: input.needsRefrigeration,
      readyAt: input.readyAt,
      expiresAt:
        input.expiresAt > input.readyAt
          ? input.expiresAt
          : suggestedExpiry(input.foodType, input.readyAt),
      status: "posted",
      shelterId: null,
      driverId: null,
      createdAt: now,
      pickedUpAt: null,
      deliveredAt: null,
      matchScore: null,
      matchReason: null,
      declinedShelterIds: [],
      timeline: [{ at: now, status: "posted", note: "Surplus posted by donor" }],
    };

    set((state) => {
      const next = {
        donations: [donation, ...state.donations],
        notifications: notify(state.notifications, {
          at: now,
          audience: "ops",
          title: "New surplus posted",
          body: `${input.quantityKg.toFixed(1)} kg from ${
            state.donors.find((d) => d.id === input.donorId)?.name ?? "a donor"
          }`,
          tone: "info",
          donationId: id,
        }),
      };
      persist({ ...dataOf(state), ...next });
      return next;
    });

    get().matchDonation(id);
    return id;
  },

  matchDonation: (donationId) => {
    const state = get();
    const now = state.now();
    const donation = state.donations.find((d) => d.id === donationId);
    if (!donation) return;

    const donor = state.donors.find((d) => d.id === donation.donorId);
    if (!donor) return;

    const eligibleShelters = state.shelters.filter(
      (shelter) => !donation.declinedShelterIds.includes(shelter.id),
    );
    const result = findMatches(donation, donor, eligibleShelters, state.drivers, now);

    set((current) => {
      let notifications = current.notifications;

      const donations = current.donations.map((item) => {
        if (item.id !== donationId) return item;

        if (result.best) {
          return {
            ...advance(
              item,
              "matched",
              now,
              `Matched to ${result.best.shelterName} at score ${result.best.score}`,
            ),
            shelterId: result.best.shelterId,
            driverId: result.best.driverId,
            matchScore: result.best.score,
            matchReason: result.best.driverName
              ? `${result.best.distanceKm.toFixed(1)} km away, ${Math.round(
                  result.best.slackMinutes,
                )} min of margin before expiry, driver ${result.best.driverName}`
              : null,
          };
        }

        return {
          ...advance(
            item,
            "unmatched",
            now,
            result.blockedReason ?? "No safe recipient found",
          ),
          shelterId: null,
          driverId: null,
          matchScore: null,
          matchReason: result.blockedReason,
        };
      });

      notifications = result.best
        ? notify(notifications, {
            at: now,
            audience: "shelter",
            title: "New match proposed",
            body: `${donation.quantityKg.toFixed(1)} kg of ${donation.foodType} for ${result.best.shelterName}, score ${result.best.score}`,
            tone: "info",
            donationId,
          })
        : notify(notifications, {
            at: now,
            audience: "ops",
            title: "Match blocked",
            body: result.blockedReason ?? "No safe recipient found in range",
            tone: "warning",
            donationId,
          });

      const next = { donations, notifications };
      persist({ ...dataOf(current), ...next });
      return next;
    });
  },

  acceptMatch: (donationId) => {
    const now = get().now();
    set((state) => {
      const donations = state.donations.map((donation) => {
        if (donation.id !== donationId) return donation;
        const accepted = advance(
          donation,
          "accepted",
          now,
          "Recipient confirmed the match",
        );
        return donation.driverId
          ? advance(accepted, "assigned", now, "Driver assigned to the pickup")
          : accepted;
      });

      const donation = donations.find((d) => d.id === donationId);
      const notifications = notify(state.notifications, {
        at: now,
        audience: "driver",
        title: "New pickup assigned",
        body: donation
          ? `${donation.quantityKg.toFixed(1)} kg pickup added to your route`
          : "A pickup was added to your route",
        tone: "success",
        donationId,
      });

      const next = { donations, notifications };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  declineMatch: (donationId, reason) => {
    const now = get().now();
    set((state) => {
      const donations = state.donations.map((donation) => {
        if (donation.id !== donationId) return donation;
        return {
          ...advance(donation, "posted", now, `Recipient declined: ${reason}`),
          declinedShelterIds: donation.shelterId
            ? [...donation.declinedShelterIds, donation.shelterId]
            : donation.declinedShelterIds,
          shelterId: null,
          driverId: null,
          matchScore: null,
          matchReason: null,
        };
      });

      const next = { donations };
      persist({ ...dataOf(state), ...next });
      return next;
    });

    get().matchDonation(donationId);
  },

  markPickedUp: (donationId) => {
    const now = get().now();
    set((state) => {
      const donations = state.donations.map((donation) =>
        donation.id === donationId
          ? {
              ...advance(donation, "picked_up", now, "Food collected from the donor"),
              pickedUpAt: now,
            }
          : donation,
      );
      const next = { donations };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  markDelivered: (donationId) => {
    const now = get().now();
    set((state) => {
      const donation = state.donations.find((d) => d.id === donationId);
      const donations = state.donations.map((item) =>
        item.id === donationId
          ? {
              ...advance(item, "delivered", now, "Delivered and logged"),
              deliveredAt: now,
            }
          : item,
      );

      const shelters = state.shelters.map((shelter) =>
        donation && shelter.id === donation.shelterId
          ? {
              ...shelter,
              capacityUsedKg: shelter.capacityUsedKg + donation.quantityKg,
              lastDeliveryAt: now,
            }
          : shelter,
      );

      const notifications = notify(state.notifications, {
        at: now,
        audience: "donor",
        title: "Donation delivered",
        body: donation
          ? `${donation.quantityKg.toFixed(1)} kg reached ${
              state.shelters.find((s) => s.id === donation.shelterId)?.name ??
              "the recipient"
            }`
          : "A donation was delivered",
        tone: "success",
        donationId,
      });

      const next = { donations, shelters, notifications };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  updateShelter: (shelterId, patch) => {
    set((state) => {
      const shelters = state.shelters.map((shelter) =>
        shelter.id === shelterId ? { ...shelter, ...patch } : shelter,
      );
      const next = { shelters };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  toggleDriverAvailability: (driverId) => {
    set((state) => {
      const drivers = state.drivers.map((driver) =>
        driver.id === driverId ? { ...driver, available: !driver.available } : driver,
      );
      const next = { drivers };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  matchAllPending: () => {
    const pending = get()
      .donations.filter(
        (donation) => donation.status === "posted" || donation.status === "unmatched",
      )
      .map((donation) => donation.id);
    pending.forEach((id) => get().matchDonation(id));
  },

  tick: () => {
    const now = get().now();
    const stale = get().donations.filter(
      (donation) =>
        donation.expiresAt <= now &&
        donation.status !== "delivered" &&
        donation.status !== "expired" &&
        donation.status !== "picked_up",
    );
    if (stale.length === 0) return;

    set((state) => {
      const staleIds = new Set(stale.map((d) => d.id));
      const donations = state.donations.map((donation) =>
        staleIds.has(donation.id)
          ? advance(
              donation,
              "expired",
              now,
              "Safe window closed before the handover completed",
            )
          : donation,
      );

      let notifications = state.notifications;
      for (const donation of stale) {
        notifications = notify(notifications, {
          at: now,
          audience: "ops",
          title: "Donation expired",
          body: `${donation.quantityKg.toFixed(1)} kg passed its safe window before handover`,
          tone: "danger",
          donationId: donation.id,
        });
      }

      const next = { donations, notifications };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  advanceClock: (minutes) => {
    set((state) => {
      const next = { clockOffsetMs: state.clockOffsetMs + minutes * MINUTE };
      persist({ ...dataOf(state), ...next });
      return next;
    });
    get().tick();
  },

  resetClock: () => {
    set((state) => {
      const next = { clockOffsetMs: 0 };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  markNotificationsRead: (audience) => {
    set((state) => {
      const notifications = state.notifications.map((item) =>
        item.audience === audience ? { ...item, read: true } : item,
      );
      const next = { notifications };
      persist({ ...dataOf(state), ...next });
      return next;
    });
  },

  resetDemo: () => {
    const fresh = createSeedData(Date.now());
    set({ ...fresh });
    persist(fresh);
  },

  candidatesFor: (donationId) => {
    const state = get();
    const donation = state.donations.find((d) => d.id === donationId);
    if (!donation) return null;
    const donor = state.donors.find((d) => d.id === donation.donorId);
    if (!donor) return null;
    return findMatches(donation, donor, state.shelters, state.drivers, state.now());
  },
}));
