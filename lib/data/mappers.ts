import type {
  AppNotification,
  Donation,
  DonationStatus,
  Donor,
  DonorKind,
  Driver,
  FoodType,
  Role,
  Shelter,
  TimelineEntry,
  VehicleKind,
} from "@/lib/domain/types";

export interface DonorRow {
  id: string;
  name: string;
  kind: DonorKind;
  address: string;
  lat: number;
  lng: number;
  contact: string;
}

export interface ShelterRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  contact: string;
  daily_capacity_kg: number;
  capacity_used_kg: number;
  accepted_food_types: FoodType[];
  preferred_food_types: FoodType[];
  has_refrigeration: boolean;
  open_minute: number;
  close_minute: number;
  people_served_daily: number;
  last_delivery_at: number | null;
}

export interface DriverRow {
  id: string;
  name: string;
  vehicle: VehicleKind;
  capacity_kg: number;
  lat: number;
  lng: number;
  available: boolean;
  phone: string;
}

export interface DonationRow {
  id: string;
  donor_id: string;
  shelter_id: string | null;
  driver_id: string | null;
  description: string;
  food_type: FoodType;
  quantity_kg: number;
  needs_refrigeration: boolean;
  ready_at: number;
  expires_at: number;
  status: DonationStatus;
  created_at: number;
  picked_up_at: number | null;
  delivered_at: number | null;
  match_score: number | null;
  match_reason: string | null;
  declined_shelter_ids: string[];
  timeline: TimelineEntry[];
}

export interface NotificationRow {
  id: string;
  at: number;
  audience: Role;
  title: string;
  body: string;
  tone: AppNotification["tone"];
  donation_id: string | null;
  read: boolean;
}

export function toDonor(row: DonorRow): Donor {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    address: row.address,
    location: { lat: row.lat, lng: row.lng },
    contact: row.contact,
  };
}

export function fromDonor(donor: Donor): DonorRow {
  return {
    id: donor.id,
    name: donor.name,
    kind: donor.kind,
    address: donor.address,
    lat: donor.location.lat,
    lng: donor.location.lng,
    contact: donor.contact,
  };
}

export function toShelter(row: ShelterRow): Shelter {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    location: { lat: row.lat, lng: row.lng },
    contact: row.contact,
    dailyCapacityKg: row.daily_capacity_kg,
    capacityUsedKg: row.capacity_used_kg,
    acceptedFoodTypes: row.accepted_food_types ?? [],
    preferredFoodTypes: row.preferred_food_types ?? [],
    hasRefrigeration: row.has_refrigeration,
    openHours: { open: row.open_minute, close: row.close_minute },
    peopleServedDaily: row.people_served_daily,
    lastDeliveryAt: row.last_delivery_at,
  };
}

export function fromShelter(shelter: Shelter): ShelterRow {
  return {
    id: shelter.id,
    name: shelter.name,
    address: shelter.address,
    lat: shelter.location.lat,
    lng: shelter.location.lng,
    contact: shelter.contact,
    daily_capacity_kg: shelter.dailyCapacityKg,
    capacity_used_kg: shelter.capacityUsedKg,
    accepted_food_types: shelter.acceptedFoodTypes,
    preferred_food_types: shelter.preferredFoodTypes,
    has_refrigeration: shelter.hasRefrigeration,
    open_minute: shelter.openHours.open,
    close_minute: shelter.openHours.close,
    people_served_daily: shelter.peopleServedDaily,
    last_delivery_at: shelter.lastDeliveryAt,
  };
}

export function toDriver(row: DriverRow): Driver {
  return {
    id: row.id,
    name: row.name,
    vehicle: row.vehicle,
    capacityKg: row.capacity_kg,
    location: { lat: row.lat, lng: row.lng },
    available: row.available,
    phone: row.phone,
  };
}

export function fromDriver(driver: Driver): DriverRow {
  return {
    id: driver.id,
    name: driver.name,
    vehicle: driver.vehicle,
    capacity_kg: driver.capacityKg,
    lat: driver.location.lat,
    lng: driver.location.lng,
    available: driver.available,
    phone: driver.phone,
  };
}

export function toDonation(row: DonationRow): Donation {
  return {
    id: row.id,
    donorId: row.donor_id,
    description: row.description,
    foodType: row.food_type,
    quantityKg: row.quantity_kg,
    needsRefrigeration: row.needs_refrigeration,
    readyAt: Number(row.ready_at),
    expiresAt: Number(row.expires_at),
    status: row.status,
    shelterId: row.shelter_id,
    driverId: row.driver_id,
    createdAt: Number(row.created_at),
    pickedUpAt: row.picked_up_at === null ? null : Number(row.picked_up_at),
    deliveredAt: row.delivered_at === null ? null : Number(row.delivered_at),
    matchScore: row.match_score,
    matchReason: row.match_reason,
    declinedShelterIds: row.declined_shelter_ids ?? [],
    timeline: row.timeline ?? [],
  };
}

export function fromDonation(donation: Donation): DonationRow {
  return {
    id: donation.id,
    donor_id: donation.donorId,
    shelter_id: donation.shelterId,
    driver_id: donation.driverId,
    description: donation.description,
    food_type: donation.foodType,
    quantity_kg: donation.quantityKg,
    needs_refrigeration: donation.needsRefrigeration,
    ready_at: donation.readyAt,
    expires_at: donation.expiresAt,
    status: donation.status,
    created_at: donation.createdAt,
    picked_up_at: donation.pickedUpAt,
    delivered_at: donation.deliveredAt,
    match_score: donation.matchScore,
    match_reason: donation.matchReason,
    declined_shelter_ids: donation.declinedShelterIds,
    timeline: donation.timeline,
  };
}

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    at: Number(row.at),
    audience: row.audience,
    title: row.title,
    body: row.body,
    tone: row.tone,
    donationId: row.donation_id,
    read: row.read,
  };
}

export function fromNotification(item: AppNotification): NotificationRow {
  return {
    id: item.id,
    at: item.at,
    audience: item.audience,
    title: item.title,
    body: item.body,
    tone: item.tone,
    donation_id: item.donationId,
    read: item.read,
  };
}
