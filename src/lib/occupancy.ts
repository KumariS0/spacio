export type OccupancyLevel = "plenty" | "moderate" | "busy" | "full" | "none";

export function occupancyPercent(capacity: number | null | undefined, available: number | null | undefined) {
  if (!capacity || capacity <= 0 || available == null) return null;
  const used = Math.max(0, capacity - available);
  return Math.min(100, Math.round((used / capacity) * 100));
}

/** Thresholds: under 40% plenty, 40–75% moderate, over 75% busy, 100% full. */
export function occupancyLevel(percent: number | null): OccupancyLevel {
  if (percent == null) return "none";
  if (percent >= 100) return "full";
  if (percent > 75) return "busy";
  if (percent >= 40) return "moderate";
  return "plenty";
}

export const occupancyLabel: Record<OccupancyLevel, string> = {
  plenty: "Plenty of space",
  moderate: "Moderate",
  busy: "Busy",
  full: "Full right now",
  none: "Not bookable",
};
