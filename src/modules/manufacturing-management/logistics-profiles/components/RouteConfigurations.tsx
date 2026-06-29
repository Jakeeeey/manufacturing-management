"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Route } from "../types";
import { Plus, Edit2, Trash2, X, MapPin } from "lucide-react";

const PinningMap = dynamic(() => import("./PinningMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[180px] rounded-lg border bg-muted flex items-center justify-center animate-pulse">
            <span className="text-[10px] font-bold text-muted-foreground">Loading interactive pinning interface...</span>
        </div>
    )
});

interface RouteConfigurationsProps {
    routes: Route[];
    onSave: (route: Route) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}

export default function RouteConfigurations({ routes, onSave, onDelete }: RouteConfigurationsProps) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [editRoute, setEditRoute] = useState<Route | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    // Form states
    const [name, setName] = useState("");
    const [distanceKm, setDistanceKm] = useState(100);
    const [tollsPhp, setTollsPhp] = useState(200);
    const [fuelPricePhp, setFuelPricePhp] = useState(58.0);
    const [description, setDescription] = useState("");
    const [pinnedCoords, setPinnedCoords] = useState<[number, number] | null>(null);
    const [mapSearchQuery, setMapSearchQuery] = useState("");

    const openCreate = () => {
        setEditRoute(null);
        setName("");
        setDistanceKm(100);
        setTollsPhp(200);
        setFuelPricePhp(58.0);
        setDescription("");
        setPinnedCoords(null);
        setMapSearchQuery("");
        setIsOpen(true);
    };

    const openEdit = (route: Route) => {
        setEditRoute(route);
        setName(route.name);
        setDistanceKm(route.distance_km);
        setTollsPhp(route.tolls_php);
        setFuelPricePhp(route.fuel_price_php);
        setDescription(route.description || "");
        setMapSearchQuery("");
        if (route.lat && route.lng) {
            setPinnedCoords([route.lat, route.lng]);
        } else {
            setPinnedCoords(null);
        }
        setIsOpen(true);
    };

    const handleMapSearch = async () => {
        if (!mapSearchQuery.trim()) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&limit=1`, {
                headers: {
                    "User-Agent": "VOS-Manufacturing-Management/1.0"
                }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                handleMapClick(lat, lon);
            } else {
                alert("Location not found. Please try a different search term.");
            }
        } catch (err) {
            console.error("Geocoding error:", err);
            alert("Error searching location. Please try again.");
        }
    };

    const handleMapClick = (lat: number, lng: number) => {
        setPinnedCoords([lat, lng]);
        
        // Compute distance from Dagupan warehouse (16.0433, 120.3333)
        const R = 6371; // Earth's radius in km
        const dLat = (lat - 16.0433) * Math.PI / 180;
        const dLon = (lng - 120.3333) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(16.0433 * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        setDistanceKm(Math.round(distance));

        // Attempt reverse geocoding with OpenStreetMap Nominatim API
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, {
            headers: {
                "User-Agent": "VOS-Manufacturing-Management/1.0"
            }
        })
        .then((res) => res.json())
        .then((dataRes) => {
            if (dataRes && dataRes.address) {
                const city = dataRes.address.city || dataRes.address.municipality || dataRes.address.town || dataRes.address.village || "";
                const state = dataRes.address.state || dataRes.address.region || "";
                const locationName = city ? `${city}, ${state}` : state;
                if (locationName) {
                    setName(`Dagupan to ${locationName}`);
                }
            }
        })
        .catch((err) => console.error("[Nominatim reverse geocode] error:", err));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert("Route Name is required.");
            return;
        }

        setSaving(true);
        try {
            await onSave({
                id: editRoute?.id,
                name,
                distance_km: Number(distanceKm),
                tolls_php: Number(tollsPhp),
                fuel_price_php: Number(fuelPricePhp),
                description,
                lat: pinnedCoords ? pinnedCoords[0] : undefined,
                lng: pinnedCoords ? pinnedCoords[1] : undefined
            });
            setIsOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-foreground">Shipping Routes & Fuel Index</h4>
                    <p className="text-[10px] text-muted-foreground">Configure delivery destinations, standard highway distances, toll fees, and baseline regional fuel prices.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
                >
                    <Plus className="h-3.5 w-3.5" /> Configure Route
                </button>
            </div>

            {/* routes grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {routes.length === 0 ? (
                    <div className="col-span-full border border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center">
                        <MapPin className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <span className="text-xs font-bold text-muted-foreground">No shipping routes configured</span>
                        <span className="text-[10px] text-muted-foreground/60 mt-1">Configure standard distribution routes to map client delivery profiles.</span>
                    </div>
                ) : (
                    routes.map((r) => (
                        <div key={r.id} className="border bg-card hover:border-primary/30 transition-all rounded-xl p-4 flex flex-col justify-between group shadow-sm">
                            <div>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-2.5">
                                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary mt-0.5">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h5 className="font-bold text-xs text-foreground">{r.name}</h5>
                                                {r.lat && r.lng && (
                                                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                        Mapped
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{r.description || "No description provided."}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={() => openEdit(r)}
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                        >
                                            <Edit2 className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => r.id && onDelete(r.id)}
                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 border-t pt-3 mt-3 text-[10px]">
                                    <div>
                                        <span className="text-muted-foreground">One-Way Distance:</span>
                                        <p className="font-bold text-foreground font-mono">{r.distance_km} km</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Tolls Allocation:</span>
                                        <p className="font-bold text-foreground font-mono">₱{r.tolls_php.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Fuel Price (PHP/L):</span>
                                        <p className="font-bold text-emerald-500 font-mono">₱{r.fuel_price_php.toLocaleString(undefined, { minimumFractionDigits: 2 })}/L</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-card rounded-xl border shadow-lg flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between border-b px-4 py-3">
                            <h5 className="text-xs font-bold text-foreground uppercase tracking-wide">
                                {editRoute ? "Edit Shipping Route" : "Configure Shipping Route"}
                            </h5>
                            <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Route Name / Destination <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Metro Manila to San Fernando, Pampanga"
                                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Route Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Specify details like highways used, hubs connected..."
                                    rows={2}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase block">Interactive Route Pinning Map</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={mapSearchQuery}
                                        onChange={(e) => setMapSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleMapSearch();
                                            }
                                        }}
                                        autoFocus
                                        placeholder="Search location to pin (e.g. Lipa, Batangas)..."
                                        className="flex-1 h-8 px-2.5 rounded-lg border bg-background text-[11px] outline-none focus:ring-1 focus:ring-primary font-semibold"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleMapSearch}
                                        className="h-8 px-3 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg hover:bg-primary/95 transition-all shadow-sm"
                                    >
                                        Search
                                    </button>
                                </div>
                                <PinningMap pinnedCoords={pinnedCoords} onMapClick={handleMapClick} />
                            </div>

                            <div className="grid grid-cols-3 gap-3 border-t pt-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Distance (km)</label>
                                    <input
                                        type="number"
                                        value={distanceKm}
                                        onChange={(e) => setDistanceKm(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Tolls (PHP)</label>
                                    <input
                                        type="number"
                                        value={tollsPhp}
                                        onChange={(e) => setTollsPhp(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Fuel Price/L</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={fuelPricePhp}
                                        onChange={(e) => setFuelPricePhp(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div className="flex border-t pt-4 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 h-9 rounded-lg border hover:bg-muted text-xs font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                >
                                    {saving ? "Saving..." : "Save Route"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
