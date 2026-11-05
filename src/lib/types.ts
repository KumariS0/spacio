export type BookingMode = "seat" | "capacity" | "none";
export type ReservationStatus = "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "EXPIRED" | "NO_SHOW";
export type SeatState = "available" | "reserved" | "occupied" | "unavailable";

export interface Building {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  map_x: number | null;
  map_y: number | null;
  is_demo: boolean;
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
  sort_order: number;
}

export interface Facility {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  building_id: string | null;
  floor_label: string | null;
  image_url: string | null;
  booking_mode: BookingMode;
  capacity: number | null;
  slot_minutes: number;
  max_booking_minutes: number;
  no_show_grace_minutes: number;
  checkin_early_minutes: number;
  rules: string[];
  is_active: boolean;
  is_temporarily_closed: boolean;
  closure_note: string | null;
  lat: number | null;
  lng: number | null;
  map_x: number | null;
  map_y: number | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  building?: Pick<Building, "id" | "name" | "code" | "map_x" | "map_y" | "lat" | "lng"> | null;
}

export interface Availability {
  facility_id: string;
  booking_mode: BookingMode;
  capacity: number | null;
  occupied: number;
  reserved: number;
  available: number | null;
  unavailable: number;
  is_open_now: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface OperatingHours {
  id: string;
  facility_id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
}

export interface Amenity {
  id: string;
  facility_id: string;
  label: string;
  icon: string;
  sort_order: number;
}

export interface Seat {
  id: string;
  facility_id: string;
  label: string;
  row_label: string;
  col_index: number;
  status: "active" | "maintenance" | "disabled";
}

export interface SeatMapRow {
  seat_id: string;
  label: string;
  row_label: string;
  col_index: number;
  seat_status: Seat["status"];
  state: SeatState;
  is_mine: boolean;
}

export interface Slot {
  slot_start: string;
  slot_end: string;
  capacity: number | null;
  booked: number;
  available: number;
  is_past: boolean;
}

export interface ReservationFacility {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  category: string;
  floor_label: string | null;
  booking_mode: BookingMode;
  checkin_early_minutes: number;
  no_show_grace_minutes: number;
  building?: { name: string } | null;
}

export interface Reservation {
  id: string;
  user_id: string;
  facility_id: string;
  seat_id: string | null;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  /** Random token shown as the booking's QR pass (owner and admins only, via RLS). */
  pass_token?: string;
  checked_in_by?: string | null;
  checked_out_by?: string | null;
  facility?: ReservationFacility | null;
  seat?: { label: string } | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  register_number: string | null;
  role: "student" | "admin";
  created_at: string;
}

export interface CampusStats {
  total_facilities: number;
  bookable_facilities: number;
  total_capacity: number;
  available: number;
  occupied: number;
  reserved: number;
  active_reservations: number;
  my_active_reservations: number;
}

export interface AdminStats extends CampusStats {
  inactive_facilities: number;
  upcoming_reservations: number;
  expired_24h: number;
  no_show_24h: number;
  checkouts_24h: number;
  students: number;
  seats_in_maintenance: number;
}

export type ScanResultCode =
  | "INVALID_QR"
  | "RATE_LIMITED"
  | "FACILITY_UNAVAILABLE"
  | "NOT_BOOKABLE"
  | "CHECKED_IN"
  | "JUST_CHECKED_IN"
  | "CONFIRM_CHECKOUT"
  | "TOO_EARLY"
  | "NO_RESERVATION_HERE"
  | "NO_RESERVATION"
  | "CHECKED_OUT"
  | "ALREADY_CHECKED_OUT"
  | "NOT_CHECKED_IN"
  | "WRONG_FACILITY"
  | "RESERVATION_NOT_FOUND";

export interface ScanReservation {
  id: string;
  status: ReservationStatus;
  starts_at: string;
  ends_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  seat_label: string | null;
}

export interface ScanResult {
  result: ScanResultCode;
  facility?: { id: string; slug: string; name: string };
  reservation?: ScanReservation | null;
  other_facility?: { name: string; slug: string } | null;
}

export interface ActivityEvent {
  event_at: string;
  kind: "in" | "out" | "auto_out";
  reservation_id: string;
  student_name: string | null;
  student_email: string;
  is_demo: boolean;
  facility_name: string;
  facility_slug: string;
  building_name: string | null;
  floor_label: string | null;
  seat_label: string | null;
}

/** What an admin can do with a booking pass right now. */
export type PassState = "CHECK_IN" | "CHECK_OUT" | "TOO_EARLY" | "MISSED" | "DONE" | "CANCELLED" | "UNAVAILABLE";

export interface PassLookup {
  result: string;
  state?: PassState;
  reservation?: ScanReservation | null;
  student?: { name: string | null; email: string; register_number: string | null } | null;
  facility?: {
    id: string;
    slug: string;
    name: string;
    floor_label: string | null;
    building: string | null;
    checkin_opens_at: string;
    checkin_deadline: string;
  } | null;
}
