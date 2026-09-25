export type FoodType =
  | "prepared"
  | "produce"
  | "bakery"
  | "dairy"
  | "packaged"
  | "meat";

export type DonationStatus =
  | "posted"
  | "matched"
  | "accepted"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "expired"
  | "unmatched";

export type Role = "donor" | "shelter" | "driver" | "ops";

export type DonorKind =
  | "restaurant"
  | "grocer"
  | "caterer"
  | "campus"
  | "bakery";

export type VehicleKind = "bike" | "car" | "van";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Donor {
  id: string;
  name: string;
  kind: DonorKind;
  address: string;
  location: LatLng;
  contact: string;
}

export interface OpenHours {
  open: number;
  close: number;
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  contact: string;
  dailyCapacityKg: number;
  capacityUsedKg: number;
  acceptedFoodTypes: FoodType[];
  preferredFoodTypes: FoodType[];
  hasRefrigeration: boolean;
  openHours: OpenHours;
  peopleServedDaily: number;
  lastDeliveryAt: number | null;
}

export interface Driver {
  id: string;
  name: string;
  vehicle: VehicleKind;
  capacityKg: number;
  location: LatLng;
  available: boolean;
  phone: string;
}

export interface TimelineEntry {
  at: number;
  status: DonationStatus;
  note: string;
}

export interface Donation {
  id: string;
  donorId: string;
  description: string;
  foodType: FoodType;
  quantityKg: number;
  needsRefrigeration: boolean;
  readyAt: number;
  expiresAt: number;
  status: DonationStatus;
  shelterId: string | null;
  driverId: string | null;
  createdAt: number;
  pickedUpAt: number | null;
  deliveredAt: number | null;
  matchScore: number | null;
  matchReason: string | null;
  declinedShelterIds: string[];
  timeline: TimelineEntry[];
}

export interface AppNotification {
  id: string;
  at: number;
  audience: Role;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "danger";
  donationId: string | null;
  read: boolean;
}

export interface AppData {
  donors: Donor[];
  shelters: Shelter[];
  drivers: Driver[];
  donations: Donation[];
  notifications: AppNotification[];
  clockOffsetMs: number;
}
