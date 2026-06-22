"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const LOCATION_COORDINATES: Record<string, [number, number]> = {
    "dagupan": [16.0433, 120.3333],
    "manila": [14.5995, 120.9842],
    "pampanga": [15.0286, 120.6890],
    "san fernando": [15.0286, 120.6890],
    "batangas": [13.9416, 121.1622],
    "lipa": [13.9416, 121.1622],
    "laguna": [14.2237, 121.1656],
    "calamba": [14.2237, 121.1656],
    "baguio": [16.4023, 120.5960],
    "cavite": [14.4791, 120.8973],
    "tagaytay": [14.1153, 120.9621],
    "bulacan": [14.8526, 120.8160],
    "subic": [14.8115, 120.2642],
    "tarlac": [15.4802, 120.5979],
    "clark": [15.1784, 120.5303],
    "bataan": [14.6812, 120.5401],
    "zambales": [15.3250, 119.9804],
    "pangasinan": [16.0349, 120.3484],
    "naga": [13.6218, 123.1948]
};

function getDestinationCoordinates(routeName: string, distanceKm: number): [number, number] {
    const nameLower = routeName.toLowerCase();
    for (const key in LOCATION_COORDINATES) {
        if (nameLower.includes(key) && key !== "dagupan") {
            return LOCATION_COORDINATES[key];
        }
    }
    // Fallback: offset Dagupan by distance
    const origin = LOCATION_COORDINATES["dagupan"];
    const latOffset = (distanceKm / 111) * 0.7; // rough lat conversion
    const lngOffset = (distanceKm / 111) * 0.7;
    return [origin[0] + latOffset, origin[1] + lngOffset];
}

interface ChangeMapViewProps {
    center: [number, number];
    zoom: number;
}

function ChangeMapView({ center, zoom }: ChangeMapViewProps) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

interface SimulationMapProps {
    routeName?: string;
    distanceKm?: number;
}

export default function SimulationMap({ routeName, distanceKm }: SimulationMapProps) {
    const startCoords: [number, number] = LOCATION_COORDINATES["dagupan"];
    let destCoords: [number, number] | null = null;

    if (routeName && distanceKm) {
        destCoords = getDestinationCoordinates(routeName, distanceKm);
    }

    const mapCenter: [number, number] = destCoords
        ? [ (startCoords[0] + destCoords[0]) / 2, (startCoords[1] + destCoords[1]) / 2 ]
        : startCoords;

    const zoom = destCoords && typeof distanceKm === "number" ? (distanceKm > 150 ? 7 : 9) : 8;

    const startIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-500/40 opacity-75"></span>
                 <div class="relative flex h-4 w-4 rounded-full bg-blue-600 border-2 border-white items-center justify-center">
                   <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                 </div>
               </div>`,
        className: "custom-div-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const destIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-rose-500/40 opacity-75"></span>
                 <div class="relative flex h-4 w-4 rounded-full bg-rose-600 border-2 border-white items-center justify-center">
                   <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                 </div>
               </div>`,
        className: "custom-div-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    return (
        <div className="w-full h-[240px] rounded-xl overflow-hidden border bg-muted relative z-0">
            <MapContainer
                center={mapCenter}
                zoom={zoom}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ChangeMapView center={mapCenter} zoom={zoom} />
                <Marker position={startCoords} icon={startIcon}>
                    <Popup>
                        <div className="text-xs">
                            <p className="font-bold text-foreground">Dagupan City</p>
                            <p className="text-[10px] text-muted-foreground">Main Warehouse (Men2 Marketing)</p>
                        </div>
                    </Popup>
                </Marker>
                {destCoords && (
                    <>
                        <Marker position={destCoords} icon={destIcon}>
                            <Popup>
                                <div className="text-xs font-semibold">
                                    <p className="font-bold text-foreground">{routeName}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Destination ({distanceKm} km)</p>
                                </div>
                            </Popup>
                        </Marker>
                        <Polyline
                            positions={[startCoords, destCoords]}
                            color="#2563eb"
                            weight={3}
                            dashArray="5, 10"
                        />
                    </>
                )}
            </MapContainer>
        </div>
    );
}
