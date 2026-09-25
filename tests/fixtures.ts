import { HOUR } from "@/lib/domain/time";
import type {
  Donation,
  Donor,
  Driver,
  FoodType,
  LatLng,
  Shelter,
} from "@/lib/domain/types";

export const BASE_NOW = new Date(2026, 8, 25, 13, 0, 0).getTime();

const ALL_TYPES: FoodType[] = [
  "prepared",
  "produce",
  "bakery",
  "dairy",
  "packaged",
  "meat",
];

export function makeDonor(overrides: Partial<Donor> = {}): Donor {
  return {
    id: "donor-1",
    name: "Test Kitchen",
    kind: "restaurant",
    address: "Sector 18, Noida",
    location: { lat: 28.57, lng: 77.33 },
    contact: "+91 90000 00001",
    ...overrides,
  };
}

export function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: "shelter-1",
    name: "Test Shelter",
    address: "Sector 27, Noida",
    location: { lat: 28.58, lng: 77.33 },
    contact: "+91 90000 00002",
    dailyCapacityKg: 100,
    capacityUsedKg: 0,
    acceptedFoodTypes: ALL_TYPES,
    preferredFoodTypes: [],
    hasRefrigeration: true,
    openHours: { open: 8 * 60, close: 22 * 60 },
    peopleServedDaily: 100,
    lastDeliveryAt: null,
    ...overrides,
  };
}

export function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: "driver-1",
    name: "Test Driver",
    vehicle: "van",
    capacityKg: 200,
    location: { lat: 28.571, lng: 77.331 },
    available: true,
    phone: "+91 90000 00003",
    ...overrides,
  };
}

export function makeDonation(overrides: Partial<Donation> = {}): Donation {
  const createdAt = overrides.createdAt ?? BASE_NOW;
  return {
    id: "donation-1",
    donorId: "donor-1",
    description: "20 kg of cooked rice and dal",
    foodType: "prepared",
    quantityKg: 20,
    needsRefrigeration: false,
    readyAt: createdAt,
    expiresAt: createdAt + 4 * HOUR,
    status: "posted",
    shelterId: null,
    driverId: null,
    createdAt,
    pickedUpAt: null,
    deliveredAt: null,
    matchScore: null,
    matchReason: null,
    declinedShelterIds: [],
    timeline: [],
    ...overrides,
  };
}

export const at = (lat: number, lng: number): LatLng => ({ lat, lng });
