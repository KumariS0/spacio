import { createElement } from "react";
import {
  Accessibility,
  Armchair,
  BookMarked,
  BookOpen,
  Building2,
  Check,
  Dumbbell,
  Ellipsis,
  FlaskConical,
  HeartPulse,
  LampDesk,
  Lock,
  MapPin,
  Monitor,
  Plug,
  Presentation,
  Printer,
  Projector,
  ShowerHead,
  Snowflake,
  Sun,
  Theater,
  VolumeX,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/** Icons admins can assign to categories and amenities (stored by name). */
export const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  "lamp-desk": LampDesk,
  "book-marked": BookMarked,
  "flask-conical": FlaskConical,
  theater: Theater,
  "building-2": Building2,
  ellipsis: Ellipsis,
  wifi: Wifi,
  plug: Plug,
  snowflake: Snowflake,
  "volume-x": VolumeX,
  sun: Sun,
  "heart-pulse": HeartPulse,
  lock: Lock,
  "shower-head": ShowerHead,
  presentation: Presentation,
  monitor: Monitor,
  printer: Printer,
  projector: Projector,
  accessibility: Accessibility,
  armchair: Armchair,
  "map-pin": MapPin,
  check: Check,
};

export const ICON_NAMES = Object.keys(ICONS);

const CATEGORY_ICON: Record<string, string> = {
  library: "book-open",
  gym: "dumbbell",
  study_room: "lamp-desk",
  reading_room: "book-marked",
  lab: "flask-conical",
  auditorium: "theater",
  building: "building-2",
  other: "ellipsis",
};

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || MapPin;
}

export function CategoryIcon({ category, icon, className }: { category?: string; icon?: string | null; className?: string }) {
  return createElement(iconFor(icon ?? (category ? CATEGORY_ICON[category] : null)), { className, "aria-hidden": true });
}
