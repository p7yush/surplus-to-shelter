import {
  createClient,
  type RealtimePostgresChangesPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { AppData } from "@/lib/domain/types";
import {
  diffById,
  emptyData,
  type ConnectionStatus,
  type DataAdapter,
  type EntityTable,
} from "./adapter";
import {
  fromDonation,
  fromDonor,
  fromDriver,
  fromNotification,
  fromShelter,
  toDonation,
  toDonor,
  toDriver,
  toNotification,
  toShelter,
  type DonationRow,
  type DonorRow,
  type DriverRow,
  type NotificationRow,
  type ShelterRow,
} from "./mappers";

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function createSupabaseAdapter(url: string, anonKey: string): DataAdapter {
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  let baseline: AppData = emptyData();
  let queue: Promise<unknown> = Promise.resolve();
  let reportStatus: (status: ConnectionStatus) => void = () => {};

  // Realtime echoes our own writes back to us. Replaying an echo is idempotent, but if a newer
  // local edit already landed it would visibly flicker backwards, so identical payloads are
  // recognised and dropped.
  const ownWrites = new Map<string, string>();

  function remember(table: EntityTable, id: string, row: unknown) {
    ownWrites.set(`${table}:${id}`, JSON.stringify(row));
    if (ownWrites.size > 400) {
      const oldest = ownWrites.keys().next().value;
      if (oldest !== undefined) ownWrites.delete(oldest);
    }
  }

  function isOwnEcho(table: EntityTable, id: string, row: unknown) {
    const key = `${table}:${id}`;
    const seen = ownWrites.get(key);
    if (seen !== undefined && seen === JSON.stringify(row)) {
      ownWrites.delete(key);
      return true;
    }
    return false;
  }

  function enqueue(work: () => Promise<unknown>) {
    queue = queue.then(work).catch((error) => {
      console.error("[supabase] write failed", error);
      reportStatus("error");
    });
    return queue;
  }

  async function writeDiff(next: AppData) {
    const donors = diffById(baseline.donors, next.donors);
    const shelters = diffById(baseline.shelters, next.shelters);
    const drivers = diffById(baseline.drivers, next.drivers);
    const donations = diffById(baseline.donations, next.donations);
    const notifications = diffById(baseline.notifications, next.notifications);
    const clockChanged = baseline.clockOffsetMs !== next.clockOffsetMs;
    baseline = next;

    // Notifications reference donations, and donations reference participants, so upserts run
    // outermost-first and deletes run in the opposite order.
    if (donors.changed.length) {
      const rows = donors.changed.map(fromDonor);
      rows.forEach((row) => remember("donors", row.id, row));
      await client.from("donors").upsert(rows).throwOnError();
    }
    if (shelters.changed.length) {
      const rows = shelters.changed.map(fromShelter);
      rows.forEach((row) => remember("shelters", row.id, row));
      await client.from("shelters").upsert(rows).throwOnError();
    }
    if (drivers.changed.length) {
      const rows = drivers.changed.map(fromDriver);
      rows.forEach((row) => remember("drivers", row.id, row));
      await client.from("drivers").upsert(rows).throwOnError();
    }
    if (donations.changed.length) {
      const rows = donations.changed.map(fromDonation);
      rows.forEach((row) => remember("donations", row.id, row));
      await client.from("donations").upsert(rows).throwOnError();
    }
    if (notifications.changed.length) {
      const rows = notifications.changed.map(fromNotification);
      rows.forEach((row) => remember("notifications", row.id, row));
      await client.from("notifications").upsert(rows).throwOnError();
    }

    if (notifications.removedIds.length) {
      await client.from("notifications").delete().in("id", notifications.removedIds).throwOnError();
    }
    if (donations.removedIds.length) {
      await client.from("donations").delete().in("id", donations.removedIds).throwOnError();
    }

    if (clockChanged) {
      await client
        .from("demo_state")
        .update({ clock_offset_ms: next.clockOffsetMs })
        .eq("id", 1)
        .throwOnError();
    }
  }

  return {
    kind: "supabase",

    load: async () => {
      const [donors, shelters, drivers, donations, notifications, demo] = await Promise.all([
        client.from("donors").select("*").throwOnError(),
        client.from("shelters").select("*").throwOnError(),
        client.from("drivers").select("*").throwOnError(),
        client.from("donations").select("*").order("created_at", { ascending: false }).throwOnError(),
        client.from("notifications").select("*").order("at", { ascending: false }).throwOnError(),
        client.from("demo_state").select("clock_offset_ms").eq("id", 1).maybeSingle().throwOnError(),
      ]);

      // An empty network means the database has never been seeded.
      if ((donors.data ?? []).length === 0) return null;

      const data: AppData = {
        donors: (donors.data as DonorRow[]).map(toDonor),
        shelters: (shelters.data as ShelterRow[]).map(toShelter),
        drivers: (drivers.data as DriverRow[]).map(toDriver),
        donations: (donations.data as DonationRow[]).map(toDonation),
        notifications: (notifications.data as NotificationRow[]).map(toNotification),
        clockOffsetMs: Number(
          (demo.data as { clock_offset_ms: number } | null)?.clock_offset_ms ?? 0,
        ),
      };

      baseline = data;
      return data;
    },

    persist: (next) => {
      void enqueue(() => writeDiff(next));
    },

    reset: async (data) => {
      await enqueue(async () => {
        await client.from("notifications").delete().neq("id", "").throwOnError();
        await client.from("donations").delete().neq("id", "").throwOnError();
        await client.from("donors").upsert(data.donors.map(fromDonor)).throwOnError();
        await client.from("shelters").upsert(data.shelters.map(fromShelter)).throwOnError();
        await client.from("drivers").upsert(data.drivers.map(fromDriver)).throwOnError();
        await client.from("donations").upsert(data.donations.map(fromDonation)).throwOnError();
        await client
          .from("notifications")
          .upsert(data.notifications.map(fromNotification))
          .throwOnError();
        await client
          .from("demo_state")
          .update({ clock_offset_ms: data.clockOffsetMs })
          .eq("id", 1)
          .throwOnError();
        baseline = data;
      });
    },

    subscribe: (onEvent, onStatus) => {
      reportStatus = onStatus;
      onStatus("connecting");

      function relay<Row extends { id: string }>(
        table: EntityTable,
        map: (row: Row) => { id: string },
      ) {
        return (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as Partial<Row>)?.id;
            if (id) onEvent({ type: "delete", table, id });
            return;
          }
          const row = payload.new as Row;
          if (!row?.id || isOwnEcho(table, row.id, row)) return;
          onEvent({ type: "upsert", table, row: map(row) as never });
        };
      }

      const channel = client
        .channel("surplus-to-shelter")
        .on("postgres_changes", { event: "*", schema: "public", table: "donors" },
          relay<DonorRow>("donors", toDonor))
        .on("postgres_changes", { event: "*", schema: "public", table: "shelters" },
          relay<ShelterRow>("shelters", toShelter))
        .on("postgres_changes", { event: "*", schema: "public", table: "drivers" },
          relay<DriverRow>("drivers", toDriver))
        .on("postgres_changes", { event: "*", schema: "public", table: "donations" },
          relay<DonationRow>("donations", toDonation))
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" },
          relay<NotificationRow>("notifications", toNotification))
        .on("postgres_changes", { event: "*", schema: "public", table: "demo_state" }, (payload) => {
          const row = payload.new as { clock_offset_ms?: number } | null;
          if (row?.clock_offset_ms !== undefined) {
            onEvent({ type: "clock", clockOffsetMs: Number(row.clock_offset_ms) });
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") onStatus("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus("error");
        });

      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
