-- Surplus→Shelter — initial schema
--
-- Design notes:
--  * Domain instants are stored as bigint epoch milliseconds, not timestamptz. The app has a
--    demo clock that can be fast-forwarded, so every time value is an explicit domain number
--    rather than a wall-clock timestamp. This keeps a 1:1 mapping with the TypeScript model
--    and removes a whole class of conversion bugs. `updated_at` is the one real timestamptz,
--    used only for DB bookkeeping.
--  * Enums are real Postgres enums so the database validates the domain, not just the client.
--  * A donation's audit trail lives in a jsonb `timeline` array. It is append-only and always
--    read with its donation, so a separate table would only add a join and a race window.
--  * Locations are plain lat/lng doubles. PostGIS with a GiST index is the scale answer, but
--    candidate scanning currently happens client-side over a city-sized network.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type food_type as enum ('prepared', 'produce', 'bakery', 'dairy', 'packaged', 'meat');

create type donation_status as enum (
  'posted', 'matched', 'accepted', 'assigned', 'picked_up', 'delivered', 'expired', 'unmatched'
);

create type donor_kind as enum ('restaurant', 'grocer', 'caterer', 'campus', 'bakery');

create type vehicle_kind as enum ('bike', 'car', 'van');

create type participant_role as enum ('donor', 'shelter', 'driver', 'ops');

create type notification_tone as enum ('info', 'success', 'warning', 'danger');

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------
create table donors (
  id          text primary key,
  name        text        not null,
  kind        donor_kind  not null,
  address     text        not null,
  lat         double precision not null,
  lng         double precision not null,
  contact     text        not null,
  updated_at  timestamptz not null default now()
);

create table shelters (
  id                   text primary key,
  name                 text        not null,
  address              text        not null,
  lat                  double precision not null,
  lng                  double precision not null,
  contact              text        not null,
  daily_capacity_kg    double precision not null check (daily_capacity_kg > 0),
  capacity_used_kg     double precision not null default 0 check (capacity_used_kg >= 0),
  accepted_food_types  food_type[] not null default '{}',
  preferred_food_types food_type[] not null default '{}',
  has_refrigeration    boolean     not null default false,
  open_hour            int         not null check (open_hour between 0 and 24),
  close_hour           int         not null check (close_hour between 0 and 24),
  people_served_daily  int         not null default 0,
  last_delivery_at     bigint,
  updated_at           timestamptz not null default now()
);

create table drivers (
  id          text primary key,
  name        text         not null,
  vehicle     vehicle_kind not null,
  capacity_kg double precision not null check (capacity_kg > 0),
  lat         double precision not null,
  lng         double precision not null,
  available   boolean      not null default true,
  phone       text         not null,
  updated_at  timestamptz  not null default now()
);

-- ---------------------------------------------------------------------------
-- Donations
-- ---------------------------------------------------------------------------
create table donations (
  id                   text primary key,
  donor_id             text not null references donors (id) on delete cascade,
  shelter_id           text references shelters (id) on delete set null,
  driver_id            text references drivers (id) on delete set null,
  description          text not null,
  food_type            food_type not null,
  quantity_kg          double precision not null check (quantity_kg > 0),
  needs_refrigeration  boolean not null default false,
  ready_at             bigint not null,
  expires_at           bigint not null,
  status               donation_status not null default 'posted',
  created_at           bigint not null,
  picked_up_at         bigint,
  delivered_at         bigint,
  match_score          double precision,
  match_reason         text,
  declined_shelter_ids text[] not null default '{}',
  timeline             jsonb  not null default '[]'::jsonb,
  updated_at           timestamptz not null default now(),

  -- A donation must not expire before it is even ready for collection.
  constraint donations_window_valid check (expires_at > ready_at)
);

-- The queue views filter by status and sort by recency; the driver view filters by driver.
create index donations_status_created_idx on donations (status, created_at desc);
create index donations_driver_idx on donations (driver_id) where driver_id is not null;
create index donations_shelter_idx on donations (shelter_id) where shelter_id is not null;
-- The expiry sweep looks for live donations already past their window.
create index donations_expiry_idx on donations (expires_at)
  where status not in ('delivered', 'expired');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id          text primary key,
  at          bigint not null,
  audience    participant_role not null,
  title       text not null,
  body        text not null,
  tone        notification_tone not null default 'info',
  donation_id text references donations (id) on delete cascade,
  read        boolean not null default false
);

create index notifications_audience_at_idx on notifications (audience, at desc);

-- ---------------------------------------------------------------------------
-- Shared demo clock
--
-- The "+1 hour" control has to move the clock for every connected device, otherwise one
-- browser would think a donation expired while another still shows it live. Single row,
-- guarded so it can never become multi-row.
-- ---------------------------------------------------------------------------
create table demo_state (
  id              int primary key default 1 check (id = 1),
  clock_offset_ms bigint not null default 0,
  updated_at      timestamptz not null default now()
);

insert into demo_state (id, clock_offset_ms) values (1, 0);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger donors_touch    before update on donors     for each row execute function touch_updated_at();
create trigger shelters_touch  before update on shelters   for each row execute function touch_updated_at();
create trigger drivers_touch   before update on drivers    for each row execute function touch_updated_at();
create trigger donations_touch before update on donations  for each row execute function touch_updated_at();
create trigger demo_touch      before update on demo_state for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This is a public demo with no sign-in: a judge opens the link and immediately acts as a
-- donor, a shelter and a driver. So RLS is ENABLED on every table with policies that grant
-- the anon role read and write access. That is a deliberate, scoped decision, not an
-- oversight — the tables hold synthetic organisations and no personal data.
--
-- The production path is unchanged in shape: add Supabase Auth, give donors/shelters/drivers
-- their own rows, and replace `true` below with ownership predicates. No application or
-- domain code would need to change, because all writes already go through one adapter.
-- ---------------------------------------------------------------------------
alter table donors        enable row level security;
alter table shelters      enable row level security;
alter table drivers       enable row level security;
alter table donations     enable row level security;
alter table notifications enable row level security;
alter table demo_state    enable row level security;

create policy "demo read donors"    on donors        for select to anon, authenticated using (true);
create policy "demo write donors"   on donors        for all    to anon, authenticated using (true) with check (true);
create policy "demo read shelters"  on shelters      for select to anon, authenticated using (true);
create policy "demo write shelters" on shelters      for all    to anon, authenticated using (true) with check (true);
create policy "demo read drivers"   on drivers       for select to anon, authenticated using (true);
create policy "demo write drivers"  on drivers       for all    to anon, authenticated using (true) with check (true);
create policy "demo read donations" on donations     for select to anon, authenticated using (true);
create policy "demo write donations" on donations    for all    to anon, authenticated using (true) with check (true);
create policy "demo read notifs"    on notifications for select to anon, authenticated using (true);
create policy "demo write notifs"   on notifications for all    to anon, authenticated using (true) with check (true);
create policy "demo read clock"     on demo_state    for select to anon, authenticated using (true);
create policy "demo write clock"    on demo_state    for all    to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime
--
-- Every connected browser subscribes to these tables, which is what makes the donor,
-- recipient and driver views update each other across devices.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table donors;
alter publication supabase_realtime add table shelters;
alter publication supabase_realtime add table drivers;
alter publication supabase_realtime add table donations;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table demo_state;
