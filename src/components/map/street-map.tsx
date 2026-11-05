"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import Link from "next/link";
import type { Availability, Facility } from "@/lib/types";
import { occupancyPercent } from "@/lib/occupancy";

function pin(selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:999px;background:${selected ? "#163f30" : "#1f5642"};border:2px solid #fbf9f3;box-shadow:0 6px 16px -6px rgb(28 42 35/.5)"><span style="width:8px;height:8px;border-radius:99px;background:#fbf9f3"></span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * OpenStreetMap view. Only facilities with administrator-entered, verified
 * coordinates are passed in — no guessed geography.
 */
export default function StreetMap({
  center,
  facilities,
  availability,
  selectedId,
  onSelect,
}: {
  center: { lat: number; lng: number; zoom: number };
  facilities: Facility[];
  availability: Record<string, Availability | undefined>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="aspect-[10/7] w-full overflow-hidden rounded-card border border-line">
      <MapContainer center={[center.lat, center.lng]} zoom={center.zoom} scrollWheelZoom={false} className="size-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {facilities.map((f) => {
          const lat = f.lat ?? f.building?.lat;
          const lng = f.lng ?? f.building?.lng;
          if (lat == null || lng == null) return null;
          const a = availability[f.id];
          const pct = occupancyPercent(a?.capacity, a?.available);
          return (
            <Marker key={f.id} position={[lat, lng]} icon={pin(selectedId === f.id)} eventHandlers={{ click: () => onSelect(f.id) }}>
              <Popup>
                <strong>{f.name}</strong>
                <br />
                {pct != null && f.booking_mode !== "none" ? `${pct}% occupied` : "Location only"}
                <br />
                <Link href={`/spaces/${f.slug}`}>View details</Link>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
