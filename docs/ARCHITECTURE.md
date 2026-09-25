# Architecture — Surplus→Shelter

**Live demo:** [surplus-to-shelter-pi.vercel.app](https://surplus-to-shelter-pi.vercel.app) · **Repo:** [github.com/p7yush/surplus-to-shelter](https://github.com/p7yush/surplus-to-shelter)

All diagrams below are Mermaid and render directly on GitHub. Two are also exported as standalone vector files for slides and reports, so they scale to any size without going blurry:

- [`docs/architecture.svg`](./architecture.svg) — the system diagram
- [`docs/matching-pipeline.svg`](./matching-pipeline.svg) — the gate-before-rank pipeline

---

## 1. System architecture

The guiding constraint is that **all decision logic is pure and I/O-free.** The four role views never compute anything themselves — they read from one store, and the store calls pure domain functions. That is what makes the travel model, the persistence layer and the notification channel swappable without touching the engine.

```mermaid
flowchart TB
    subgraph views["Presentation layer — Next.js App Router, React 19"]
        direction LR
        V1["Impact dashboard<br/><code>app/page.tsx</code>"]
        V2["Donor portal<br/><code>app/donate</code>"]
        V3["Recipient console<br/><code>app/shelter</code>"]
        V4["Driver dispatch<br/><code>app/driver</code>"]
        V5["Control room<br/><code>app/ops</code>"]
    end

    subgraph ui["Shared components"]
        direction LR
        C1["RescueMap<br/>Leaflet, ssr false"]
        C2["MatchExplainer<br/>gates + score bars"]
        C3["Charts<br/>trend, food split"]
        C4["DonationCard<br/>+ primitives"]
    end

    subgraph state["State layer — single source of truth"]
        ST["Zustand store<br/><code>lib/store/useAppStore.ts</code><br/>all mutations funnel through here"]
        HK["useNow<br/>hydration-safe clock"]
    end

    subgraph domain["Domain layer — pure functions, zero I/O, unit tested"]
        direction LR
        D1["matching.ts<br/>gates + weighted scoring"]
        D2["routing.ts<br/>nearest-neighbour + 2-opt"]
        D3["parse.ts<br/>free text to structured"]
        D4["expiry.ts<br/>risk grading"]
        D5["impact.ts<br/>meals, CO2e, water"]
        D6["geo.ts + time.ts<br/>haversine, travel model"]
        D7["constants.ts<br/>every tuning value"]
    end

    subgraph data["Data layer — one interface, two implementations"]
        AD["DataAdapter interface<br/><code>lib/data/adapter.ts</code>"]
        SA["Supabase adapter<br/>reference-diffed row writes<br/>+ realtime subscriptions"]
        LA["localStorage adapter<br/>snapshot + BroadcastChannel<br/>offline fallback"]
        SD["seed.ts<br/>deterministic network"]
    end

    subgraph backend["Supabase — Postgres"]
        PG[("donors · shelters · drivers<br/>donations · notifications<br/>demo_state")]
        RT["Realtime<br/>logical replication"]
        RLS["Row Level Security"]
    end

    views --> ui
    views -->|"read selectors"| ST
    views -->|"dispatch actions"| ST
    ST -->|"calls"| domain
    D1 --> D6
    D2 --> D6
    D1 --> D7
    ST <-->|"persist / hydrate"| AD
    AD --> SA
    AD --> LA
    SD -->|"seeds an empty database"| AD
    SA <-->|"upsert / select"| PG
    RT -->|"row changed on<br/>another device"| SA
    PG --> RT
    RLS -.->|"guards"| PG

    classDef pure fill:#064e3b,stroke:#34d399,color:#ecfdf5
    classDef seam fill:#3f2d12,stroke:#fbbf24,color:#fffbeb
    classDef db fill:#0c2d48,stroke:#38bdf8,color:#e0f2fe
    class D1,D2,D3,D4,D5,D6,D7 pure
    class AD,SA,LA,SD seam
    class PG,RT,RLS db
```

**Green = pure and tested. Amber = the storage seam. Blue = managed infrastructure.**

Two things this buys:

1. **The database was added without touching the engine or the UI.** Every mutation already funnelled through a single `persist(snapshot)` call, so the Supabase adapter just compares each new snapshot against the last one and writes only the rows whose object reference changed. The store updates state immutably and reuses untouched rows, so marking a donation delivered writes one donation row, one shelter row and one notification — not a table rewrite. No store action, domain function or component changed.
2. **The app still runs with no backend at all.** If the Supabase environment variables are absent, `createAdapter()` returns the localStorage adapter instead. That keeps the test suite dependency-free and keeps the demo alive if the venue wifi dies.

---

## 2. The matching pipeline — gate before you rank

This is the core of the project. A naive implementation sorts shelters by distance; that can route dairy to a shelter with no cold storage, or food that arrives eight minutes before it expires. So **every candidate must clear seven hard gates before it is allowed to be scored at all.**

```mermaid
flowchart TD
    A["Donation posted<br/>free text or form"] --> B["parse.ts<br/>extract kg, food type,<br/>cold chain, safe-until"]
    B --> C["For each recipient in the network"]

    C --> D{"Food type<br/>accepted?"}
    D -->|no| X1["REJECT · food-type"]
    D -->|yes| E{"Cold chain<br/>satisfied?"}
    E -->|no| X2["REJECT · refrigeration"]
    E -->|yes| F{"Remaining capacity<br/>covers quantity?"}
    F -->|no| X3["REJECT · capacity"]
    F -->|yes| G{"Within 25 km<br/>rescue radius?"}
    G -->|no| X4["REJECT · distance"]
    G -->|yes| H["bestDriverFor:<br/>nearest free driver whose<br/>vehicle can carry the load"]
    H --> I{"Any driver<br/>available?"}
    I -->|no| X5["REJECT · no-driver"]
    I -->|yes| J["Simulate the full chain:<br/>dispatch delay, drive to donor,<br/>load, drive to shelter, unload"]
    J --> K{"Recipient open<br/>on arrival?"}
    K -->|no| X6["REJECT · closed"]
    K -->|yes| L{"Slack before expiry<br/>>= 30 min buffer?"}
    L -->|no| X7["REJECT · expiry"]
    L -->|yes| M["FEASIBLE — now score it"]

    M --> N["Weighted score 0-100"]
    N --> N1["proximity 30%"]
    N --> N2["time margin 25%"]
    N --> N3["capacity fit 20%"]
    N --> N4["recipient need 15%"]
    N --> N5["food preference 10%"]
    N1 --> O["Rank survivors by score"]
    N2 --> O
    N3 --> O
    N4 --> O
    N5 --> O
    O --> P["Propose best match<br/>+ full explanation of<br/>every rejection"]

    classDef reject fill:#450a0a,stroke:#f87171,color:#fef2f2
    classDef pass fill:#064e3b,stroke:#34d399,color:#ecfdf5
    class X1,X2,X3,X4,X5,X6,X7 reject
    class M,P pass
```

Because gates run first, **a nearer shelter can legitimately lose to a farther one** — and the control room always shows the exact reason each candidate was disqualified, so no decision is a black box.

### Travel and ETA model

Every ETA in the app flows through one function, which is why it is replaceable:

```
distance   = haversine(a, b) × 1.35          winding factor for real roads
minutes    = distance / vehicleSpeed         bike 24, car 27, van 21 km/h
arriveAt   = max(now + 6 min dispatch + driveToDonor, readyAt)
pickupAt   = arriveAt + 8 min load
deliveredAt= pickupAt + driveToShelter + 8 min unload
slack      = expiresAt − deliveredAt         must be ≥ 30 min or REJECT
```

---

## 3. Donation lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Donor
    participant Store as Zustand store
    participant Parse as parse.ts
    participant Match as matching.ts
    participant Route as routing.ts
    actor Shelter as Recipient
    actor Driver

    Donor->>Store: postDonation("18 kg cooked dal, good for 3 hours")
    Store->>Parse: parseDonationText
    Parse-->>Store: 18 kg · prepared · no cold chain · expires +3h
    Store->>Match: findMatches(donation, shelters, drivers, now)
    Match->>Match: apply 7 hard gates
    Match->>Match: score + rank survivors
    Match-->>Store: ranked candidates + rejection reasons
    Store-->>Donor: proposed match + why
    Store-->>Shelter: broadcast — new proposal

    Shelter->>Store: acceptMatch
    Store->>Store: status matched to accepted to assigned
    Store-->>Driver: broadcast — new pickup assigned

    Driver->>Store: open dispatch view
    Store->>Route: planRoute(assigned donations)
    Route->>Route: nearest-neighbour seed
    Route->>Route: 2-opt, precedence + deadline constrained
    Route-->>Driver: ordered stops, ETAs, leg distances

    Driver->>Store: markPickedUp
    Store-->>Shelter: broadcast — in transit
    Driver->>Store: markDelivered
    Store->>Store: capacityUsedKg += qty, timestamp handover
    Store-->>Donor: broadcast — delivered, impact updated
```

The `broadcast` arrows are real. Each mutation upserts the changed rows into Postgres, and Supabase Realtime pushes them to every other subscribed device, so the donor's laptop, the recipient's phone and the driver's tablet update each other within a few hundred milliseconds.

Realtime also echoes a device's *own* writes back to it. Replaying an echo is harmless because upserts are keyed by id, but if a newer local edit had already landed the UI would visibly flicker backwards — so the adapter fingerprints the rows it wrote and drops matching echoes.

---

## 4. Donation state machine

```mermaid
stateDiagram-v2
    [*] --> posted: donor submits
    posted --> matched: engine finds a feasible recipient
    posted --> unmatched: every candidate fails a gate
    matched --> accepted: recipient accepts
    matched --> posted: recipient declines, re-match excluding them
    accepted --> assigned: driver attached
    assigned --> picked_up: driver collects
    picked_up --> delivered: handover logged
    delivered --> [*]
    posted --> expired: safe window closed first
    matched --> expired: safe window closed first
    unmatched --> expired: safe window closed first
    expired --> [*]
```

`unmatched` and `expired` are first-class outcomes, not errors — the control room reports them, because a system that silently drops failures cannot be trusted with food safety.

---

## 5. Data model

```mermaid
erDiagram
    DONOR ||--o{ DONATION : posts
    SHELTER ||--o{ DONATION : receives
    DRIVER ||--o{ DONATION : transports
    DONATION ||--|{ TIMELINE_ENTRY : "audit trail"

    DONOR {
        string id
        string name
        string kind
        LatLng location
    }
    SHELTER {
        string id
        number dailyCapacityKg
        number capacityUsedKg
        boolean hasRefrigeration
        FoodTypeList acceptedFoodTypes
        FoodTypeList preferredFoodTypes
        OpenHours openHours
        number lastDeliveryAt
    }
    DRIVER {
        string id
        string vehicle
        number capacityKg
        boolean available
        LatLng location
    }
    DONATION {
        string id
        number quantityKg
        FoodType foodType
        boolean needsRefrigeration
        number readyAt
        number expiresAt
        DonationStatus status
        string shelterId
        string driverId
        StringList declinedShelterIds
    }
    TIMELINE_ENTRY {
        DonationStatus status
        number at
        string note
    }
```

`declinedShelterIds` exists so a decline re-runs matching while permanently excluding that recipient for that donation — without it, the engine would propose the same shelter forever.

---

## 6. Deployment

```mermaid
flowchart LR
    DEV["Local dev<br/>npm run dev"] --> GIT["git push origin main"]
    GIT --> GH["GitHub<br/>p7yush/surplus-to-shelter"]
    GH -->|"connected project,<br/>auto-deploy on push"| VC["Vercel build<br/>Next.js 16 + Turbopack"]
    VC --> PROD["Production<br/>surplus-to-shelter-pi.vercel.app"]
    PROD --> CDN["Vercel edge CDN<br/>6 prerendered static routes"]
    CDN --> B1["Laptop<br/>donor view"]
    CDN --> B2["Phone<br/>recipient view"]
    CDN --> B3["Tablet<br/>driver view"]
    B1 <--> SB[("Supabase<br/>Postgres + Realtime")]
    B2 <--> SB
    B3 <--> SB
    OSM["OpenStreetMap tiles<br/>no API key"] --> CDN

    subgraph gates["Quality gates before every push"]
        direction TB
        T1["npm test · 66 unit tests"]
        T2["npm run lint · ESLint clean"]
        T3["npm run build · type-checked"]
    end
    DEV --> gates
    gates --> GIT
```

The app itself prerenders to six static routes plus client JS, so there is no server on the decision path: matching runs in the browser in well under a millisecond, satisfying the brief's "near-instant for a good demo" constraint. Postgres is used for shared state and realtime fan-out, not for computing matches.

Every device subscribes to the same tables, which is what makes the multi-role demo work across hardware rather than across browser tabs.

### Provisioning

`npm run provision` builds the backend from nothing via the Supabase Management API: it creates the project, waits for the database to become healthy, applies `supabase/migrations/*.sql`, reads the anon key, and writes `.env.local`. It is safe to re-run — an existing project is adopted and an applied schema is skipped. The database seeds itself on first load, and because every seed id is deterministic, two browsers racing to seed an empty database write the same rows instead of duplicating the network.

---

## 7. How the brief's constraints are met

| Constraint from the problem statement | How the architecture addresses it |
| --- | --- |
| **Safety** — never route expired-risk food | `expiry` gate rejects any candidate with under 30 min of slack after a full simulated pickup-and-delivery chain. Enforced in `matching.ts`, covered by unit tests. |
| **Reliability** — a failed match wastes the food | Failures are explicit states (`unmatched`, `expired`) surfaced in the control room with reasons, never silent. |
| **Cost / latency** — matching must be near-instant | Pure in-browser computation over the candidate set; no network round trip on the decision path. |
| **Accessibility** — usable by non-technical staff | Donors type one plain sentence; the parser does the structuring. Recipient and driver views are single-action screens. |
| **Privacy** — handle location and contact data responsibly | Participants are organisations with approximate coordinates; no personal contact data is collected. Row Level Security is enabled on every table, and the demo's permissive `anon` policies are the single place that would tighten under real auth. No third-party analytics; map tiles are the only external request. |
| **Scalability** — extend beyond one city | No logic is hardcoded to a city, and all thresholds live in `constants.ts`. The candidate scan is the one piece that would need a geospatial index at scale: swap the lat/lng columns for PostGIS `geography` with a GiST index and filter the radius in SQL. It sits behind one function. |
| **Ethical** — don't discourage small donors | No minimum quantity, and a single-sentence post is the entire donor workload. |

---

## 8. Innovation opportunities from the brief — what was implemented

The brief lists optional advanced directions and warns that "a well-executed matching engine beats a bolted-on AI feature." Two were implemented because they genuinely serve the core problem; the rest were deliberately declined.

| Opportunity | Status |
| --- | --- |
| **NLP** — parse free-text donations into structured data | **Implemented** in `parse.ts`. Deterministic and unit-tested rather than an LLM call, so it is instant, offline and cannot hallucinate a weight. Handles kg, lb, trays, crates, sacks, loaves, litres and dozens, plus relative and absolute expiry times. |
| **Optimization** — multi-stop routing for several pickups | **Implemented** in `routing.ts`. Nearest-neighbour seed improved by 2-opt under pickup-before-dropoff precedence and expiry-deadline penalties. The gain over one-at-a-time handling is displayed in the driver view. |
| **Data analytics** — impact reporting | **Implemented** in `impact.ts`, computed from actual timestamped handovers, not estimates. |
| Computer vision food classification | Declined — adds an accuracy risk and a latency cost to the one step that already takes 20 seconds by hand. |
| Agentic AI dispatcher | Declined — the negotiation it would automate is exactly the decision that needs to stay explainable for food-safety accountability. |
| ML demand prediction | Declined — needs historical volume no pilot has on day one. |
