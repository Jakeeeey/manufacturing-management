"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DAGUPAN_COORDS: [number, number] = [16.0433, 120.3333];

interface PinningMapProps {
    pinnedCoords: [number, number] | null;
    onMapClick: (lat: number, lng: number) => void;
}

function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
}

export default function PinningMap({ pinnedCoords, onMapClick }: PinningMapProps) {
    const startIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center">
                 <div class="relative flex h-3.5 w-3.5 rounded-full bg-blue-600 border border-white flex-col items-center justify-center">
                   <div class="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></div>
                 </div>
               </div>`,
        className: "custom-div-icon",
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const destIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-rose-500/40 opacity-75"></span>
                 <div class="relative flex h-4 w-4 rounded-full bg-rose-600 border-2 border-white items-center justify-center">
                   <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                 </div>
               </div>`,
        className: "custom-div-icon",
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    return (
        <div className="w-full h-[180px] rounded-lg overflow-hidden border bg-muted relative z-0">
            <MapContainer
                center={pinnedCoords || DAGUPAN_COORDS}
                zoom={8}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapEventsHandler onMapClick={onMapClick} />
                <Marker position={DAGUPAN_COORDS} icon={startIcon} />
                {pinnedCoords && (
                    <Marker position={pinnedCoords} icon={destIcon} />
                )}
            </MapContainer>
            <div className="absolute bottom-1.5 left-1.5 z-[1000] bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-bold text-muted-foreground border">
                Click map to pin destination
            </div>
        </div>
    );
}
