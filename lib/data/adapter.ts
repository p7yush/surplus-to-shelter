import type {
  AppData,
  AppNotification,
  Donation,
  Donor,
  Driver,
  Shelter,
} from "@/lib/domain/types";

export type EntityTable =
  | "donors"
  | "shelters"
  | "drivers"
  | "donations"
  | "notifications";

export type EntityRow = Donor | Shelter | Driver | Donation | AppNotification;

export type RemoteEvent =
  | { type: "snapshot"; data: AppData }
  | { type: "upsert"; table: EntityTable; row: EntityRow }
  | { type: "delete"; table: EntityTable; id: string }
  | { type: "clock"; clockOffsetMs: number };

export type ConnectionStatus = "local" | "connecting" | "live" | "error";

export interface DataAdapter {
  readonly kind: "local" | "supabase";
  load: () => Promise<AppData | null>;
  persist: (next: AppData) => void;
  reset: (data: AppData) => Promise<void>;
  subscribe: (
    onEvent: (event: RemoteEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
  ) => () => void;
}

export function emptyData(): AppData {
  return {
    donors: [],
    shelters: [],
    drivers: [],
    donations: [],
    notifications: [],
    clockOffsetMs: 0,
  };
}

interface Diff<T> {
  changed: T[];
  removedIds: string[];
}

export function diffById<T extends { id: string }>(
  previous: T[],
  next: T[],
): Diff<T> {
  const before = new Map(previous.map((row) => [row.id, row]));
  const changed: T[] = [];

  for (const row of next) {
    if (before.get(row.id) !== row) changed.push(row);
    before.delete(row.id);
  }

  return { changed, removedIds: [...before.keys()] };
}

export function upsertById<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index === -1) return [row, ...rows];
  const next = rows.slice();
  next[index] = row;
  return next;
}
