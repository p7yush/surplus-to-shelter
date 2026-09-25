import { DAY, HOUR, MINUTE, atMinuteOfDay, startOfDay } from "@/lib/domain/time";
import type {
  AppData,
  Donation,
  DonationStatus,
  Donor,
  Driver,
  FoodType,
  Shelter,
} from "@/lib/domain/types";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DONORS: Donor[] = [
  {
    id: "donor-spice-route",
    name: "Spice Route Kitchen",
    kind: "restaurant",
    address: "Atta Market, Sector 18, Noida",
    location: { lat: 28.5706, lng: 77.3272 },
    contact: "+91 98110 20101",
  },
  {
    id: "donor-amity-dining",
    name: "Amity Campus Dining",
    kind: "campus",
    address: "Sector 125, Noida",
    location: { lat: 28.5438, lng: 77.3349 },
    contact: "+91 98110 20102",
  },
  {
    id: "donor-freshcart",
    name: "FreshCart Supermarket",
    kind: "grocer",
    address: "Sector 50 Market, Noida",
    location: { lat: 28.5738, lng: 77.3648 },
    contact: "+91 98110 20103",
  },
  {
    id: "donor-golden-crust",
    name: "Golden Crust Bakery",
    kind: "bakery",
    address: "Sector 15 Market, Noida",
    location: { lat: 28.5857, lng: 77.3117 },
    contact: "+91 98110 20104",
  },
  {
    id: "donor-grand-palms",
    name: "Grand Palms Banquet",
    kind: "caterer",
    address: "Sector 62, Noida",
    location: { lat: 28.627, lng: 77.372 },
    contact: "+91 98110 20105",
  },
  {
    id: "donor-tandoori-junction",
    name: "Tandoori Junction",
    kind: "restaurant",
    address: "Brahmaputra Market, Sector 29, Noida",
    location: { lat: 28.565, lng: 77.33 },
    contact: "+91 98110 20106",
  },
  {
    id: "donor-dayfresh",
    name: "DayFresh Grocers",
    kind: "grocer",
    address: "Sector 12 Market, Noida",
    location: { lat: 28.586, lng: 77.33 },
    contact: "+91 98110 20107",
  },
  {
    id: "donor-sunrise",
    name: "Sunrise Convention Centre",
    kind: "caterer",
    address: "Sector 137, Noida",
    location: { lat: 28.495, lng: 77.408 },
    contact: "+91 98110 20108",
  },
  {
    id: "donor-metro-cafe",
    name: "Metro Cafe & Deli",
    kind: "restaurant",
    address: "Sector 63, Noida",
    location: { lat: 28.626, lng: 77.381 },
    contact: "+91 98110 20109",
  },
  {
    id: "donor-harvest-bowl",
    name: "Harvest Bowl Cloud Kitchen",
    kind: "restaurant",
    address: "Sector 104, Noida",
    location: { lat: 28.545, lng: 77.356 },
    contact: "+91 98110 20110",
  },
];

const ALL_TYPES: FoodType[] = [
  "prepared",
  "produce",
  "bakery",
  "dairy",
  "packaged",
  "meat",
];
const VEGETARIAN: FoodType[] = [
  "prepared",
  "produce",
  "bakery",
  "dairy",
  "packaged",
];

export function createShelters(now: number): Shelter[] {
  return [
    {
      id: "shelter-aasra",
      name: "Aasra Night Shelter",
      address: "Sector 8, Noida",
      location: { lat: 28.588, lng: 77.3 },
      contact: "+91 98110 30201",
      dailyCapacityKg: 120,
      capacityUsedKg: 26,
      acceptedFoodTypes: ALL_TYPES,
      preferredFoodTypes: ["prepared", "bakery"],
      hasRefrigeration: true,
      openHours: { open: 8 * 60, close: 22 * 60 },
      peopleServedDaily: 180,
      lastDeliveryAt: now - 5 * HOUR,
    },
    {
      id: "shelter-umeed",
      name: "Umeed Children's Home",
      address: "Sector 45, Noida",
      location: { lat: 28.55, lng: 77.34 },
      contact: "+91 98110 30202",
      dailyCapacityKg: 80,
      capacityUsedKg: 18,
      acceptedFoodTypes: VEGETARIAN,
      preferredFoodTypes: ["dairy", "bakery", "produce"],
      hasRefrigeration: true,
      openHours: { open: 9 * 60, close: 20 * 60 },
      peopleServedDaily: 95,
      lastDeliveryAt: now - 21 * HOUR,
    },
    {
      id: "shelter-seva",
      name: "Seva Community Kitchen",
      address: "Sector 27, Noida",
      location: { lat: 28.576, lng: 77.328 },
      contact: "+91 98110 30203",
      dailyCapacityKg: 200,
      capacityUsedKg: 64,
      acceptedFoodTypes: ALL_TYPES,
      preferredFoodTypes: ["prepared", "produce"],
      hasRefrigeration: true,
      openHours: { open: 7 * 60, close: 22 * 60 },
      peopleServedDaily: 420,
      lastDeliveryAt: now - 3 * HOUR,
    },
    {
      id: "shelter-nari-shakti",
      name: "Nari Shakti Women's Shelter",
      address: "Sector 55, Noida",
      location: { lat: 28.592, lng: 77.356 },
      contact: "+91 98110 30204",
      dailyCapacityKg: 60,
      capacityUsedKg: 12,
      acceptedFoodTypes: VEGETARIAN,
      preferredFoodTypes: ["prepared"],
      hasRefrigeration: false,
      openHours: { open: 10 * 60, close: 19 * 60 },
      peopleServedDaily: 70,
      lastDeliveryAt: now - 30 * HOUR,
    },
    {
      id: "shelter-apna-ghar",
      name: "Apna Ghar Elder Care",
      address: "Sector 71, Noida",
      location: { lat: 28.599, lng: 77.381 },
      contact: "+91 98110 30205",
      dailyCapacityKg: 70,
      capacityUsedKg: 9,
      acceptedFoodTypes: ["prepared", "produce", "bakery", "dairy"],
      preferredFoodTypes: ["prepared", "dairy"],
      hasRefrigeration: true,
      openHours: { open: 8 * 60, close: 19 * 60 },
      peopleServedDaily: 60,
      lastDeliveryAt: now - 14 * HOUR,
    },
    {
      id: "shelter-sahara",
      name: "Sahara Relief Centre",
      address: "Alpha 1, Greater Noida",
      location: { lat: 28.4744, lng: 77.504 },
      contact: "+91 98110 30206",
      dailyCapacityKg: 150,
      capacityUsedKg: 20,
      acceptedFoodTypes: ALL_TYPES,
      preferredFoodTypes: ["packaged", "produce"],
      hasRefrigeration: false,
      openHours: { open: 9 * 60, close: 18 * 60 },
      peopleServedDaily: 260,
      lastDeliveryAt: now - 40 * HOUR,
    },
    {
      id: "shelter-bal-asha",
      name: "Bal Asha Shelter",
      address: "Sector 122, Noida",
      location: { lat: 28.523, lng: 77.355 },
      contact: "+91 98110 30207",
      dailyCapacityKg: 90,
      capacityUsedKg: 31,
      acceptedFoodTypes: VEGETARIAN,
      preferredFoodTypes: ["bakery", "dairy"],
      hasRefrigeration: true,
      openHours: { open: 9 * 60, close: 21 * 60 },
      peopleServedDaily: 110,
      lastDeliveryAt: now - 8 * HOUR,
    },
    {
      id: "shelter-roti-bank",
      name: "Roti Bank Noida",
      address: "Sector 37, Noida",
      location: { lat: 28.548, lng: 77.326 },
      contact: "+91 98110 30208",
      dailyCapacityKg: 250,
      capacityUsedKg: 78,
      acceptedFoodTypes: ALL_TYPES,
      preferredFoodTypes: ["prepared", "packaged"],
      hasRefrigeration: true,
      openHours: { open: 6 * 60, close: 23 * 60 },
      peopleServedDaily: 520,
      lastDeliveryAt: now - 2 * HOUR,
    },
  ];
}

export const DRIVERS: Driver[] = [
  {
    id: "driver-ravi",
    name: "Ravi Kumar",
    vehicle: "bike",
    capacityKg: 25,
    location: { lat: 28.5712, lng: 77.3255 },
    available: true,
    phone: "+91 98110 40301",
  },
  {
    id: "driver-meena",
    name: "Meena Joshi",
    vehicle: "car",
    capacityKg: 60,
    location: { lat: 28.6255, lng: 77.3705 },
    available: true,
    phone: "+91 98110 40302",
  },
  {
    id: "driver-arjun",
    name: "Arjun Patel",
    vehicle: "van",
    capacityKg: 200,
    location: { lat: 28.5495, lng: 77.3272 },
    available: true,
    phone: "+91 98110 40303",
  },
  {
    id: "driver-sneha",
    name: "Sneha Rao",
    vehicle: "bike",
    capacityKg: 20,
    location: { lat: 28.5842, lng: 77.3129 },
    available: true,
    phone: "+91 98110 40304",
  },
  {
    id: "driver-imran",
    name: "Imran Sheikh",
    vehicle: "van",
    capacityKg: 180,
    location: { lat: 28.506, lng: 77.376 },
    available: true,
    phone: "+91 98110 40305",
  },
  {
    id: "driver-pooja",
    name: "Pooja Verma",
    vehicle: "car",
    capacityKg: 55,
    location: { lat: 28.5745, lng: 77.3632 },
    available: true,
    phone: "+91 98110 40306",
  },
];

interface DonationSpec {
  id: string;
  donorId: string;
  description: string;
  foodType: FoodType;
  quantityKg: number;
  needsRefrigeration: boolean;
  readyAt: number;
  expiresAt: number;
  createdAt: number;
  status: DonationStatus;
  shelterId: string | null;
  driverId: string | null;
  pickedUpAt?: number | null;
  deliveredAt?: number | null;
  matchScore?: number | null;
  matchReason?: string | null;
}

const STATUS_NOTE: Record<DonationStatus, string> = {
  posted: "Surplus posted by donor",
  matched: "Matched to a recipient by the routing engine",
  accepted: "Recipient confirmed the match",
  assigned: "Driver assigned to the pickup",
  picked_up: "Food collected from the donor",
  delivered: "Delivered and logged",
  expired: "Safe window closed before pickup",
  unmatched: "No safe recipient found in range",
};

const STATUS_SEQUENCE: DonationStatus[] = [
  "posted",
  "matched",
  "accepted",
  "assigned",
  "picked_up",
  "delivered",
];

function buildTimeline(spec: DonationSpec): Donation["timeline"] {
  const targetIndex = STATUS_SEQUENCE.indexOf(spec.status);
  if (targetIndex === -1) {
    return [
      { at: spec.createdAt, status: "posted", note: STATUS_NOTE.posted },
      { at: spec.expiresAt, status: spec.status, note: STATUS_NOTE[spec.status] },
    ];
  }

  const finalAt = spec.deliveredAt ?? spec.pickedUpAt ?? spec.createdAt + 45 * MINUTE;
  const span = Math.max(10 * MINUTE, finalAt - spec.createdAt);

  return STATUS_SEQUENCE.slice(0, targetIndex + 1).map((status, index) => ({
    at: spec.createdAt + (span * index) / Math.max(1, targetIndex),
    status,
    note: STATUS_NOTE[status],
  }));
}

function toDonation(spec: DonationSpec): Donation {
  return {
    id: spec.id,
    donorId: spec.donorId,
    description: spec.description,
    foodType: spec.foodType,
    quantityKg: spec.quantityKg,
    needsRefrigeration: spec.needsRefrigeration,
    readyAt: spec.readyAt,
    expiresAt: spec.expiresAt,
    status: spec.status,
    shelterId: spec.shelterId,
    driverId: spec.driverId,
    createdAt: spec.createdAt,
    pickedUpAt: spec.pickedUpAt ?? null,
    deliveredAt: spec.deliveredAt ?? null,
    matchScore: spec.matchScore ?? null,
    matchReason: spec.matchReason ?? null,
    declinedShelterIds: [],
    timeline: buildTimeline(spec),
  };
}

const HISTORY_DESCRIPTIONS: Record<FoodType, string[]> = {
  prepared: [
    "Cooked dal, rice and mixed sabzi from the lunch buffet",
    "Untouched thali counter trays after the corporate lunch",
    "Vegetable pulao and paneer curry, still warm",
  ],
  produce: [
    "Ripe bananas, tomatoes and cabbage nearing shelf date",
    "Crates of seasonal vegetables pulled from display",
    "Mixed salad greens and cucumbers from cold display",
  ],
  bakery: [
    "End-of-day bread loaves and buns",
    "Unsold pastries, rusk and cookies",
    "Assorted breads and croissants from the morning bake",
  ],
  dairy: [
    "Chilled milk pouches close to date",
    "Paneer blocks and curd tubs from cold room",
    "Yogurt cups pulled from the chiller",
  ],
  packaged: [
    "Sealed dry ration packs: atta, rice and pulses",
    "Packaged snacks and instant noodles cartons",
    "Shelf-stable cereal and biscuit cartons",
  ],
  meat: [
    "Chilled chicken portions from the cold room",
    "Boiled eggs and marinated kebabs from the counter",
    "Fish fillets under cold chain",
  ],
};

export function createSeedData(now: number): AppData {
  const shelters = createShelters(now);
  const random = mulberry32(20260925);
  const donations: Donation[] = [];

  const historyTypes: FoodType[] = [
    "prepared",
    "produce",
    "bakery",
    "packaged",
    "prepared",
    "dairy",
    "produce",
    "prepared",
  ];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
    const dayStart = startOfDay(now) - dayOffset * DAY;
    const deliveriesToday = dayOffset === 0 ? 4 : 5 + Math.floor(random() * 4);

    for (let index = 0; index < deliveriesToday; index += 1) {
      const donor = DONORS[Math.floor(random() * DONORS.length)];
      const foodType = historyTypes[Math.floor(random() * historyTypes.length)];
      const needsRefrigeration = foodType === "dairy" || foodType === "meat";
      const descriptions = HISTORY_DESCRIPTIONS[foodType];
      const description = descriptions[Math.floor(random() * descriptions.length)];

      const eligibleShelters = shelters.filter(
        (candidate) =>
          candidate.acceptedFoodTypes.includes(foodType) &&
          (!needsRefrigeration || candidate.hasRefrigeration),
      );
      const shelter =
        eligibleShelters[Math.floor(random() * eligibleShelters.length)] ??
        shelters[0];

      const deliverMinute = 9 * 60 + Math.floor(random() * 11 * 60);
      let deliveredAt = dayStart + deliverMinute * MINUTE;
      if (dayOffset === 0) {
        deliveredAt = Math.min(deliveredAt, now - 25 * MINUTE);
        if (deliveredAt <= dayStart + 6 * HOUR) {
          deliveredAt = now - (30 + index * 40) * MINUTE;
        }
      }

      const leadMinutes = 38 + Math.floor(random() * 95);
      const createdAt = deliveredAt - leadMinutes * MINUTE;
      const pickedUpAt = deliveredAt - Math.floor(leadMinutes * 0.35) * MINUTE;
      const quantityKg = Math.round((4 + random() * 52) * 10) / 10;
      const capableDrivers = DRIVERS.filter(
        (candidate) => candidate.capacityKg >= quantityKg,
      );
      const driver =
        capableDrivers[Math.floor(random() * capableDrivers.length)] ?? DRIVERS[2];

      donations.push(
        toDonation({
          id: `donation-h${dayOffset}-${index}`,
          donorId: donor.id,
          description,
          foodType,
          quantityKg,
          needsRefrigeration,
          readyAt: createdAt,
          expiresAt: createdAt + (3 + Math.floor(random() * 6)) * HOUR,
          createdAt,
          status: "delivered",
          shelterId: shelter.id,
          driverId: driver.id,
          pickedUpAt,
          deliveredAt,
          matchScore: Math.round((62 + random() * 33) * 10) / 10,
          matchReason: "Closest recipient with capacity inside the safe window",
        }),
      );
    }
  }

  const live: DonationSpec[] = [
    {
      id: "donation-live-1",
      donorId: "donor-spice-route",
      description: "18 kg of cooked dal makhani and jeera rice from the lunch buffet",
      foodType: "prepared",
      quantityKg: 18,
      needsRefrigeration: false,
      readyAt: now - 10 * MINUTE,
      expiresAt: now + 3.5 * HOUR,
      createdAt: now - 12 * MINUTE,
      status: "posted",
      shelterId: null,
      driverId: null,
    },
    {
      id: "donation-live-2",
      donorId: "donor-freshcart",
      description: "35 kg of tomatoes, cabbage and bananas pulled from display",
      foodType: "produce",
      quantityKg: 35,
      needsRefrigeration: false,
      readyAt: now - 40 * MINUTE,
      expiresAt: now + 19 * HOUR,
      createdAt: now - 46 * MINUTE,
      status: "matched",
      shelterId: "shelter-seva",
      driverId: null,
      matchScore: 81.4,
      matchReason:
        "3.4 km away, arrives 18h 20m before the safe window closes, uses 24% of remaining capacity",
    },
    {
      id: "donation-live-3",
      donorId: "donor-golden-crust",
      description: "12 kg of end-of-day bread loaves, buns and rusk",
      foodType: "bakery",
      quantityKg: 12,
      needsRefrigeration: false,
      readyAt: now - 70 * MINUTE,
      expiresAt: now + 13 * HOUR,
      createdAt: now - 78 * MINUTE,
      status: "assigned",
      shelterId: "shelter-bal-asha",
      driverId: "driver-sneha",
      matchScore: 76.2,
      matchReason:
        "7.1 km away, arrives 12h 05m before the safe window closes, bakery is a preferred food type",
    },
    {
      id: "donation-live-4",
      donorId: "donor-amity-dining",
      description: "45 kg of vegetable pulao and paneer curry from the mess counters",
      foodType: "prepared",
      quantityKg: 45,
      needsRefrigeration: false,
      readyAt: now - 105 * MINUTE,
      expiresAt: now + 4.5 * HOUR,
      createdAt: now - 118 * MINUTE,
      status: "picked_up",
      shelterId: "shelter-roti-bank",
      driverId: "driver-arjun",
      pickedUpAt: now - 22 * MINUTE,
      matchScore: 88.9,
      matchReason:
        "2.6 km away, arrives 4h 05m before the safe window closes, prepared food is a preferred type",
    },
    {
      id: "donation-live-5",
      donorId: "donor-metro-cafe",
      description: "8 kg of chilled milk pouches and curd tubs, cold chain required",
      foodType: "dairy",
      quantityKg: 8,
      needsRefrigeration: true,
      readyAt: now - 5 * MINUTE,
      expiresAt: now + 72 * MINUTE,
      createdAt: now - 8 * MINUTE,
      status: "posted",
      shelterId: null,
      driverId: null,
    },
    {
      id: "donation-live-6",
      donorId: "donor-grand-palms",
      description: "90 kg of banquet surplus: chole, rajma, rice and mixed sabzi",
      foodType: "prepared",
      quantityKg: 90,
      needsRefrigeration: false,
      readyAt: now + 15 * MINUTE,
      expiresAt: now + 5 * HOUR,
      createdAt: now - 4 * MINUTE,
      status: "posted",
      shelterId: null,
      driverId: null,
    },
    {
      id: "donation-live-8",
      donorId: "donor-dayfresh",
      description: "42 kg of crated tomatoes, cauliflower and bananas",
      foodType: "produce",
      quantityKg: 42,
      needsRefrigeration: false,
      readyAt: now - 15 * MINUTE,
      expiresAt: now + 17 * HOUR,
      createdAt: now - 21 * MINUTE,
      status: "assigned",
      shelterId: "shelter-aasra",
      driverId: "driver-arjun",
      matchScore: 79.5,
      matchReason:
        "3.2 km away, arrives 16h 20m before the safe window closes, uses 31% of remaining capacity",
    },
    {
      id: "donation-live-9",
      donorId: "donor-harvest-bowl",
      description: "30 kg of paneer curry, dal and rice from the cloud kitchen",
      foodType: "prepared",
      quantityKg: 30,
      needsRefrigeration: false,
      readyAt: now - 25 * MINUTE,
      expiresAt: now + 4 * HOUR,
      createdAt: now - 32 * MINUTE,
      status: "assigned",
      shelterId: "shelter-bal-asha",
      driverId: "driver-arjun",
      matchScore: 84.1,
      matchReason:
        "2.6 km away, arrives 3h 30m before the safe window closes, prepared food is a preferred type",
    },
    {
      id: "donation-live-7",
      donorId: "donor-sunrise",
      description: "6 kg of leftover sandwiches from an evening event",
      foodType: "prepared",
      quantityKg: 6,
      needsRefrigeration: false,
      readyAt: now - 6 * HOUR,
      expiresAt: now - 35 * MINUTE,
      createdAt: now - 6.5 * HOUR,
      status: "expired",
      shelterId: null,
      driverId: null,
    },
  ];

  donations.push(...live.map(toDonation));

  return {
    donors: DONORS,
    shelters,
    drivers: DRIVERS,
    donations,
    notifications: [
      {
        id: "notif-seed-1",
        at: now - 22 * MINUTE,
        audience: "driver",
        title: "Pickup collected",
        body: "Arjun Patel collected 45 kg from Amity Campus Dining.",
        tone: "success",
        donationId: "donation-live-4",
        read: false,
      },
      {
        id: "notif-seed-2",
        at: now - 12 * MINUTE,
        audience: "shelter",
        title: "New match proposed",
        body: "Seva Community Kitchen has a 35 kg produce match awaiting confirmation.",
        tone: "info",
        donationId: "donation-live-2",
        read: false,
      },
      {
        id: "notif-seed-3",
        at: now - 35 * MINUTE,
        audience: "ops",
        title: "Donation expired unrescued",
        body: "6 kg from Sunrise Convention Centre passed its safe window before a match was confirmed.",
        tone: "danger",
        donationId: "donation-live-7",
        read: false,
      },
    ],
    clockOffsetMs: 0,
  };
}

export const SEED_REFERENCE_MINUTE = atMinuteOfDay(Date.now(), 13 * 60);
