# AmiHacks Submission — Surplus→Shelter

**Track A (NGO / Social Impact)** — Surplus-to-Shelter: Real-Time Food Rescue Routing

> Turn a restaurant's unsold food into a shelter's next meal before it hits the dumpster.

| | |
| --- | --- |
| **Live demo** | **https://surplus-to-shelter-pi.vercel.app** |
| **Repository** | **https://github.com/p7yush/surplus-to-shelter** |

---

## 1. Technical deliverables

| Deliverable | Where it is |
| --- | --- |
| **GitHub repository link** | [github.com/p7yush/surplus-to-shelter](https://github.com/p7yush/surplus-to-shelter) |
| **Source code** | The repository above. `lib/domain/` holds the engine, `app/` the five role views, `supabase/migrations/` the schema. |
| **Architecture diagram** | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — six diagrams (system, matching pipeline, lifecycle sequence, state machine, data model, deployment). Vector exports: [`architecture.svg`](./docs/architecture.svg), [`matching-pipeline.svg`](./docs/matching-pipeline.svg). |
| **Deployment link** | [surplus-to-shelter-pi.vercel.app](https://surplus-to-shelter-pi.vercel.app) — live on Vercel, backed by Supabase Postgres. |
| **README documentation** | [`README.md`](./README.md) — problem, core idea, features, impact maths, stack, setup, tests, and an honest list of shortcuts. |
| **Team contribution details** | [Section 4](#4-team-contribution) below. |

---

## 2. The three-minute demo

Run it in this order. Every number on screen is computed from timestamped records, not hardcoded.

**1. The problem framing — Impact dashboard** (`/`)
Meals rescued, weight diverted, CO₂e avoided, and a seven-day trend. Point out the header badge reading **Live**: state is in Postgres, not the browser.

**2. Posting takes one sentence — Donor portal** (`/donate`)
Type `18 kg of cooked dal and jeera rice from the lunch buffet, good for 4 hours`. The parser extracts weight, food type, cold-chain need and the safe-until time; every inferred field stays editable. Press **Post and match now**.

**3. The actual contribution — the match explanation**
The result names the recipient, the score, the distance, the margin before expiry and the driver. Expand the scoring detail: five weighted factors per candidate, and for rejected candidates the exact reason.

**4. Why gates matter — Control room** (`/ops`)
Select the 90 kg banquet donation. Four recipients are struck through with reasons like `capacity · Only 61.0 kg of capacity left, needs 90.0 kg` and `distance · 28.8 km is beyond the 25 km rescue radius`. **The winner is not the closest recipient** — that is the whole point.

**5. It is genuinely real-time — two devices**
Open the demo on a phone as well. Accept the match on the phone's **Recipient** console and watch the laptop update within a moment. No refresh.

**6. Routing is real — Driver dispatch** (`/driver`)
Ravi Kumar's route is sequenced with pickup-before-dropoff ordering and per-leg ETAs. With more than one assignment, an **Optimiser gain** panel shows kilometres saved against handling donations one at a time.

**7. Time pressure is modelled — the `+30m` control**
Advance the clock and watch donations move into the urgent window and eventually expire. The clock is shared through the database, so every connected device moves together.

---

## 3. What is actually hard here, and what was built

The brief states this "is not a CRUD app" — the difficulty is real-time matching under a deadline, geographic routing and messy input. So the engineering is concentrated there.

### Gate before you rank

Most naive versions sort shelters by distance. That is actively unsafe: the nearest shelter may lack cold storage for dairy, be closed when the driver arrives, or be reachable only with eight minutes left on a 2–6 hour window. This engine applies **seven hard feasibility gates before any scoring happens**, and only ranks the survivors.

| Gate | Rejects when |
| --- | --- |
| `expiry` | Projected arrival leaves under **30 minutes** of margin |
| `food-type` | Food type is not on the recipient's accepted list |
| `refrigeration` | Cold-chain food, no cold storage on site |
| `capacity` | Remaining daily capacity cannot cover the quantity |
| `closed` | Recipient is shut when the driver actually arrives |
| `distance` | Beyond the 25 km rescue radius |
| `no-driver` | No available driver whose vehicle can carry the load |

Survivors are scored 0–100 on proximity (30%), time margin (25%), capacity fit (20%), recipient need (15%) and food preference (10%). Time margin is weighted second highest on purpose: a slightly longer drive that arrives comfortably beats a closer recipient that only just makes it.

The safety margin is enforced against a **simulated delivery chain**, not a straight-line guess: dispatch delay, drive to donor, loading, drive to recipient, unloading.

### Implemented from the brief's "innovation opportunities"

The brief warns that "a well-executed matching engine beats a bolted-on AI feature." Three were implemented because they serve the core problem; three were declined deliberately.

| Opportunity | Status |
| --- | --- |
| **NLP** — parse free-text donations | **Built** (`lib/domain/parse.ts`). Deterministic and unit-tested rather than an LLM call, so it is instant, offline, and cannot hallucinate a weight. Handles kg, lb, trays, crates, sacks, loaves, litres, dozens, plus relative and absolute expiry times. |
| **Optimisation** — multi-stop routing | **Built** (`lib/domain/routing.ts`). Nearest-neighbour seed improved by 2-opt under pickup-before-dropoff precedence and expiry-deadline penalties. |
| **Data analytics** — impact reporting | **Built** (`lib/domain/impact.ts`), computed from real timestamped handovers. |
| Computer vision intake | Declined — adds accuracy risk and latency to the one step that already takes 20 seconds by hand. |
| Agentic dispatcher | Declined — the negotiation it would automate is exactly the decision that must stay explainable for food-safety accountability. |
| ML demand prediction | Declined — needs historical volume no pilot has on day one. |

### Architecture in one paragraph

All decision logic is pure and I/O-free. The five role views never compute anything themselves; they read from one store, and the store calls unit-tested domain functions. Storage sits behind a single `DataAdapter` interface, so Postgres was added **without changing one store action, domain function or component** — the adapter compares each new state snapshot against the previous one and writes only the rows whose object reference changed. With no Supabase credentials configured the app falls back to `localStorage`, which keeps the test suite dependency-free and keeps the demo alive if the venue wifi dies.

### Engineering evidence

| | |
| --- | --- |
| Unit tests | **73 passing**, no database or network required (`npm test`) |
| Lint | ESLint clean (`npm run lint`) |
| Build | Type-checked, six prerendered static routes (`npm run build`) |
| Database | 6 tables, 6 enums, CHECK constraints, 4 partial indexes, RLS on every table |
| Backend provisioning | One command (`npm run provision`), idempotent |

Tests worth noting, because they encode the safety rules rather than just chasing coverage:

- A shelter that cannot be reached inside the safe window is rejected **even if it is closest**.
- Cold-chain food is never routed to a recipient without refrigeration.
- No proposed match ever has less than the 30-minute buffer.
- A pickup is always visited before its matching drop-off.
- The optimised route is never longer than handling donations one at a time.
- The parser does not read "ice" out of "rice", or "oil" out of "boiled".
- Every seed row satisfies the database's own constraints, enums and foreign keys, so the schema and the seed cannot silently drift apart.

---

## 4. Team contribution

Solo submission — design, engineering, database, deployment and documentation by one person.

<!-- TODO: replace the two placeholders below before submitting. -->

| | |
| --- | --- |
| **Name** | `TODO — full name` |
| **Enrollment number** | `TODO — enrollment number` |
| **GitHub** | [@p7yush](https://github.com/p7yush) |
| **Track** | A — NGO / Social Impact |

| Workstream | What was done |
| --- | --- |
| Problem analysis | Read the brief, chose Track A, identified that the binding constraint is the 2–6 hour safety window rather than discovery |
| Domain design | Modelled donors, recipients, drivers, donations and the audit trail; chose the gate-before-rank architecture |
| Matching engine | Seven hard gates, simulated delivery chain, five-factor weighted scoring, full rejection reporting |
| Route optimisation | Nearest-neighbour seed with precedence- and deadline-constrained 2-opt |
| Free-text parsing | Deterministic unit/quantity/time extraction with word-boundary matching |
| Impact analytics | Meals, CO₂e, water footprint, median time to delivery, seven-day trend |
| Frontend | Five role views, dark design system, Leaflet mapping, charts, match explainer |
| Database | Postgres schema with enums, constraints, indexes, RLS and realtime; adapter with row-level diffing |
| Testing | 73 unit tests covering the engine, parser, router, impact maths, mappers and seed integrity |
| DevOps | GitHub repository, Vercel deployment with auto-deploy, one-command Supabase provisioning |
| Documentation | README, architecture document with six diagrams, this submission index |

---

## 5. Known limitations

Stated plainly, because a reviewer will find them anyway and each is isolated to one module.

- **Travel times are modelled**, not fetched: straight-line distance × 1.35 winding factor at a per-vehicle urban speed. Every ETA flows through one `travelMinutes` function, so a real routing API is a single-module swap.
- **There is no authentication.** A judge opens the link and immediately acts as donor, recipient and driver, which is the point of the demo. RLS is enabled on every table but the policies grant the `anon` role read and write. The tables hold synthetic organisations and no personal data. Adding Supabase Auth means replacing `true` with ownership predicates in one migration; no application code changes.
- **Notifications are in-app**, not SMS or push.
- **Distance filtering happens client-side** over a city-sized network. At national scale the lat/lng columns become PostGIS `geography` with a GiST index and the radius filter moves into SQL.
- **The seed network is synthetic** — 10 donors, 8 recipients and 6 drivers across Noida / Delhi NCR, generated deterministically so demos are reproducible.

The matching engine, route optimiser, parser and impact maths are pure functions with no I/O, so none of the above affects their correctness.
