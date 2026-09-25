"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { boundsOf, centroid } from "@/lib/domain/geo";
import type { LatLng } from "@/lib/domain/types";

export interface MapMarker {
  id: string;
  position: LatLng;
  label: string;
  sublabel?: string;
  color: string;
  glyph: string;
  pulse?: boolean;
  size?: number;
}

export interface MapLine {
  id: string;
  points: LatLng[];
  color: string;
  dashed?: boolean;
  weight?: number;
}

export interface RescueMapProps {
  markers: MapMarker[];
  lines?: MapLine[];
  className?: string;
  fallbackCenter?: LatLng;
  zoom?: number;
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;

    if (markers.length === 1) {
      map.setView([markers[0].position.lat, markers[0].position.lng], 14);
      return;
    }

    const bounds = boundsOf(markers.map((m) => m.position));
    if (!bounds) return;

    map.fitBounds(
      [
        [bounds[0].lat, bounds[0].lng],
        [bounds[1].lat, bounds[1].lng],
      ],
      { padding: [36, 36], maxZoom: 14 },
    );
  }, [map, markers]);

  return null;
}

function buildIcon(marker: MapMarker) {
  const size = marker.size ?? 26;
  return L.divIcon({
    className: "",
    html: `<div class="pin ${marker.pulse ? "pulse" : ""}" style="background:${marker.color};width:${size}px;height:${size}px;color:#04120c">${marker.glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function RescueMapView({
  markers,
  lines = [],
  className = "h-full w-full",
  fallbackCenter = { lat: 28.5706, lng: 77.3272 },
  zoom = 12,
}: RescueMapProps) {
  const center = useMemo(
    () => (markers.length > 0 ? centroid(markers.map((m) => m.position)) : fallbackCenter),
    [markers, fallbackCenter],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className={className}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {lines.map((line) => (
        <Polyline
          key={line.id}
          positions={line.points.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: line.color,
            weight: line.weight ?? 3,
            opacity: 0.85,
            dashArray: line.dashed ? "6 8" : undefined,
          }}
        />
      ))}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.position.lat, marker.position.lng]}
          icon={buildIcon(marker)}
        >
          <Popup>
            <strong>{marker.label}</strong>
            {marker.sublabel ? (
              <>
                <br />
                <span style={{ color: "#8ba0b2" }}>{marker.sublabel}</span>
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}

      <FitBounds markers={markers} />
    </MapContainer>
  );
}
