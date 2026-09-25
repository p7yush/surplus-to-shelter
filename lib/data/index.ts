import type { DataAdapter } from "./adapter";
import { createLocalAdapter } from "./localAdapter";
import { createSupabaseAdapter, supabaseConfig } from "./supabaseAdapter";

/**
 * Picks the storage backend at runtime.
 *
 * With Supabase credentials present the app runs on Postgres with realtime across devices.
 * Without them it falls back to localStorage plus BroadcastChannel, which keeps `npm run dev`
 * and the test suite working with no external dependency — and keeps the demo alive if the
 * venue wifi dies mid-presentation.
 */
export function createAdapter(): DataAdapter {
  const config = supabaseConfig();
  return config
    ? createSupabaseAdapter(config.url, config.anonKey)
    : createLocalAdapter();
}
