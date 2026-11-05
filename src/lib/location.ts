import type { Facility } from "@/lib/types";

/** "Building · Floor" for a facility, shared by server and client components. */
export function locationLine(f: Pick<Facility, "building" | "floor_label">) {
  return [f.building?.name, f.floor_label].filter(Boolean).join(" · ") || "Location not set";
}
