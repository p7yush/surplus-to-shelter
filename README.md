# Surplus→Shelter

**Real-time food rescue routing.** Turn a restaurant's unsold food into a shelter's next meal before it hits the dumpster.

Built for **AmiHacks — Track A (NGO / Social Impact)**: _Surplus-to-Shelter: Real-Time Food Rescue Routing_.

---

## The problem

Restaurants, grocers and campus dining halls throw away edible surplus every day — not because nobody wants it, but because there is no fast way to connect *what is available right now, nearby* with *who can collect it before it spoils*. Most surplus food has only a **2–6 hour usable window**, and donations are still coordinated over phone calls, spreadsheets and WhatsApp groups.

Three groups each carry a different part of that failure:

- **Donors** face disposal costs and have no easy, compliance-friendly channel.
- **Shelters and food banks** cannot discover donations in time and have no way to advertise capacity.
- **Volunteer drivers** have no dispatch telling them where to go and when.

## What this is

A working system where a donor posts surplus in one line of plain text, the routing engine proposes the best *safe* recipient within seconds, a driver gets a sequenced multi-stop route, and every handover is timestamped so diverted weight becomes reportable rather than estimated.

The brief is explicit that this "is not a CRUD app" — the difficulty lives in real-time matching under a deadline, geographic routing, and messy input data. So the engineering is concentrated there rather than in forms over a database.

## The core idea: gate before you rank

Most naive versions of this problem pick the nearest shelter. That is actively unsafe. This engine runs **hard feasibility gates first**, and only ranks whatever survives:

| Gate | Rejection rule |
| --- | --- |
| `expiry` | Projected arrival must be ≥ **30 minutes** before the safe-until time |
| `food-type` | Food type must be on the recipient's accepted list |
| `refrigeration` | Cold-chain items require cold storage on site |
| `capacity` | Remaining daily capacity must cover the full quantity |
| `closed` | Recipient must be open when the driver actually arrives |
| `distance` | Must be inside the 25 km rescue radius |
| `no-driver` | A driver with enough vehicle capacity must be available |

Survivors are then scored 0–100 on five weighted factors:

| Factor | Weight | Why |
| --- | --- | --- |
| Proximity | 30% | Shorter drive, less risk |
| Time margin | 25% | Buffer before the window closes |
| Capacity fit | 20% | Good utilisation without overflow |
| Recipient need | 15% | Staleness since last delivery + unmet capacity |
| Food preference | 10% | Recipients get more of what they can actually use |

Time margin is weighted second highest deliberately: a slightly longer drive that arrives with comfortable margin beats a closer recipient that only just makes it.

Because the gates run first, a nearby shelter can lose to a farther one — and the UI always shows *why*, including the exact rejection reason for every disqualified recipient.

## Features

**Donor portal** — Post surplus in under a minute. A deterministic parser reads free text (`"40 lbs of cooked pasta, good until 9pm"`) and extracts weight, food type, cold-chain need and the safe-until time, converting pounds, trays, crates, loaves and litres into kilograms. Every inferred field stays editable.

**Recipient console** — Set daily capacity, accepted and preferred food types, cold storage and intake hours; these are the inputs the engine reads. Accept or decline proposals; declining immediately re-runs the match excluding your organisation.

**Driver dispatch** — Assigned pickups are sequenced into one route by a nearest-neighbour seed improved with constrained 2-opt, respecting pickup-before-dropoff precedence and treating expiry deadlines as a hard penalty. The gain over handling one donation at a time is shown explicitly.

**Control room** — Inspect any donation's full candidate ranking, per-factor score bars, every rejection reason, and a timestamped audit trail. Simulate donations, re-run pending matches and advance the clock to watch windows close.

**Impact dashboard** — Meals rescued, weight diverted, CO₂e avoided, median time from posting to delivery, seven-day trend and food-type split, all derived from actual timestamped handovers.

**Live across tabs** — Every mutation is broadcast over `BroadcastChannel`, so a donor window, a shelter window and a driver window update each other in real time. Open three windows side by side to demo the whole loop.

## Impact accounting

| Conversion | Value |
| --- | --- |
| Meals per kilogram | 1 meal = 0.5 kg |
| Emissions avoided | 2.5 kg CO₂e per kg diverted |
| Water footprint | 1,250 L per kg |
| Safety buffer | 30 minutes |

## Tech stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS 4** for styling
- **Leaflet** + OpenStreetMap tiles for mapping (no API key required)
- **Zustand** for state, persisted to `localStorage` and synced across tabs
- **Vitest** for unit tests

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm test` | Run the unit test suite |
| `npm run lint` | Lint |

## Tests

The domain logic is pure and covered by unit tests, including the cases that matter most:

- A shelter that cannot be reached inside the safe window is rejected, even if it is closest.
- A farther shelter wins when the nearer one cannot accept the food type.
- Cold-chain food is never routed to a recipient without refrigeration.
- No proposed match ever has less than the safety buffer of margin.
- A pickup is always visited before its matching drop-off.
- The optimised route is never longer than handling donations one at a time.
- The parser does not read "ice" out of "rice", or "oil" out of "boiled".

```bash
npm test
```

## Project structure

```
app/                 Routes: impact dashboard, donor, recipient, driver, control room
components/          UI primitives, map, charts, donation card, match explainer
lib/domain/          Pure logic: matching, routing, expiry, parsing, impact, geo, time
lib/data/seed.ts     Deterministic seed network (Noida / Delhi NCR)
lib/store/           Zustand store with persistence and cross-tab sync
tests/               Vitest suites
```

## Where the seams are

This is a hackathon build, and the shortcuts are deliberate and isolated rather than spread through the code:

- **Travel times** are modelled as straight-line distance × 1.35 winding factor at a per-vehicle urban speed. Every ETA in the app flows through one `travelMinutes` function, so swapping in a live routing API is a single-module change.
- **Persistence** is `localStorage` behind the store's action surface. Moving to Postgres means reimplementing that one module, not touching the engine or the UI.
- **Notifications** are in-app. Real SMS or push would slot in at the same place notifications are created.

The matching engine, route optimiser, parser and impact maths are all pure functions with no I/O, so none of the above affects them.
