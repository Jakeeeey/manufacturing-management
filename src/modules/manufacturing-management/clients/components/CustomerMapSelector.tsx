import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Search, Loader2, Layers } from "lucide-react";
import { toast } from "sonner";

interface CustomerMapSelectorProps {
    latitude: string;
    longitude: string;
    onChange: (lat: string, lng: string) => void;
}

interface GeocodeResult {
    lat: string;
    lon: string;
    display_name: string;
}

export default function CustomerMapSelector({
    latitude,
    longitude,
    onChange
}: CustomerMapSelectorProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markerRef = useRef<maplibregl.Marker | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [mapStyle, setMapStyle] = useState<"street" | "satellite">("street");

    const toggleStyle = () => {
        const nextStyle = mapStyle === "street" ? "satellite" : "street";
        setMapStyle(nextStyle);
        
        const map = mapRef.current;
        if (!map) return;

        if (nextStyle === "satellite") {
            map.setStyle({
                version: 8,
                sources: {
                    "satellite-tiles": {
                        type: "raster",
                        tiles: [
                            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        ],
                        tileSize: 256,
                        attribution: "Tiles &copy; Esri &mdash; Source: Esri"
                    }
                },
                layers: [
                    {
                        id: "satellite-layer",
                        type: "raster",
                        source: "satellite-tiles",
                        minzoom: 0,
                        maxzoom: 19
                    }
                ]
            });
        } else {
            map.setStyle("https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json");
        }
    };

    // Track the current values to prevent infinite recursive updates
    const lastCoordsRef = useRef({ lat: "", lng: "" });

    // Initialize Maplibre GL instance
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Default to center of Philippines (or Manila)
        const defaultLng = 120.9842;
        const defaultLat = 14.5995;

        // Use CartoDB Voyager style (open, free, no key required)
        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
            center: [defaultLng, defaultLat],
            zoom: 10
        });

        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl(), "top-right");

        // Set initial marker if coordinates already exist
        const initialLat = parseFloat(latitude);
        const initialLng = parseFloat(longitude);
        if (!isNaN(initialLat) && !isNaN(initialLng)) {
            const marker = new maplibregl.Marker({ draggable: true })
                .setLngLat([initialLng, initialLat])
                .addTo(map);

            markerRef.current = marker;
            lastCoordsRef.current = { lat: latitude, lng: longitude };

            marker.on("dragend", () => {
                const lngLat = marker.getLngLat();
                const newLat = lngLat.lat.toFixed(6);
                const newLng = lngLat.lng.toFixed(6);
                lastCoordsRef.current = { lat: newLat, lng: newLng };
                onChange(newLat, newLng);
            });

            map.setCenter([initialLng, initialLat]);
            map.setZoom(14);
        }

        // Click on map to place or reposition marker
        map.on("click", (e) => {
            const { lng, lat } = e.lngLat;
            const newLat = lat.toFixed(6);
            const newLng = lng.toFixed(6);

            lastCoordsRef.current = { lat: newLat, lng: newLng };

            if (markerRef.current) {
                markerRef.current.setLngLat([lng, lat]);
            } else {
                const marker = new maplibregl.Marker({ draggable: true })
                    .setLngLat([lng, lat])
                    .addTo(map);

                marker.on("dragend", () => {
                    const lngLat = marker.getLngLat();
                    const draggedLat = lngLat.lat.toFixed(6);
                    const draggedLng = lngLat.lng.toFixed(6);
                    lastCoordsRef.current = { lat: draggedLat, lng: draggedLng };
                    onChange(draggedLat, draggedLng);
                });

                markerRef.current = marker;
            }

            onChange(newLat, newLng);
        });

        return () => {
            map.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync map marker and view from parents inputs changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Skip if coordinates match the ones we just emitted to prevent loop
        if (latitude === lastCoordsRef.current.lat && longitude === lastCoordsRef.current.lng) {
            return;
        }

        const latNum = parseFloat(latitude);
        const lngNum = parseFloat(longitude);
        if (isNaN(latNum) || isNaN(lngNum)) {
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
            return;
        }

        lastCoordsRef.current = { lat: latitude, lng: longitude };

        if (markerRef.current) {
            markerRef.current.setLngLat([lngNum, latNum]);
            map.easeTo({ center: [lngNum, latNum] });
        } else {
            const marker = new maplibregl.Marker({ draggable: true })
                .setLngLat([lngNum, latNum])
                .addTo(map);

            marker.on("dragend", () => {
                const lngLat = marker.getLngLat();
                const draggedLat = lngLat.lat.toFixed(6);
                const draggedLng = lngLat.lng.toFixed(6);
                lastCoordsRef.current = { lat: draggedLat, lng: draggedLng };
                onChange(draggedLat, draggedLng);
            });

            markerRef.current = marker;
            map.easeTo({ center: [lngNum, latNum], zoom: 14 });
        }
    }, [latitude, longitude, onChange]);

    // Handle Location Search
    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const query = searchQuery.trim();
        if (!query) return;

        setSearching(true);
        try {
            // Using OpenStreetMap Nominatim API for geocoding
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
                {
                    headers: {
                        "Accept-Language": "en"
                    }
                }
            );
            if (!res.ok) throw new Error();
            const data = await res.json();
            setSearchResults(data);
            setShowResults(true);
            if (data.length === 0) {
                toast.error("No locations found matching search term.");
            }
        } catch {
            toast.error("Location search service is currently unavailable.");
        } finally {
            setSearching(false);
        }
    };

    const selectResult = (result: GeocodeResult) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        if (isNaN(lat) || isNaN(lng)) return;

        const map = mapRef.current;
        if (map) {
            map.flyTo({
                center: [lng, lat],
                zoom: 15,
                essential: true
            });

            const newLat = lat.toFixed(6);
            const newLng = lng.toFixed(6);
            lastCoordsRef.current = { lat: newLat, lng: newLng };

            if (markerRef.current) {
                markerRef.current.setLngLat([lng, lat]);
            } else {
                const marker = new maplibregl.Marker({ draggable: true })
                    .setLngLat([lng, lat])
                    .addTo(map);

                marker.on("dragend", () => {
                    const lngLat = marker.getLngLat();
                    const draggedLat = lngLat.lat.toFixed(6);
                    const draggedLng = lngLat.lng.toFixed(6);
                    lastCoordsRef.current = { lat: draggedLat, lng: draggedLng };
                    onChange(draggedLat, draggedLng);
                });

                markerRef.current = marker;
            }

            onChange(newLat, newLng);
        }
        setShowResults(false);
        setSearchQuery(result.display_name);
    };

    return (
        <div className="relative w-full h-64 border rounded-xl overflow-hidden shadow-inner bg-muted/20 mt-3 flex flex-col group">
            {/* Search Input Bar Overlay */}
            <div
                className="absolute top-2 left-2 right-2 z-10 max-w-[340px] flex items-center gap-1.5"
            >
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search coordinates or location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleSearch();
                            }
                        }}
                        className="w-full bg-card/95 backdrop-blur-sm border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold text-foreground shadow-md transition-all placeholder:text-muted-foreground/60"
                    />
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/80" />
                </div>
                <button
                    type="button"
                    onClick={() => handleSearch()}
                    disabled={searching}
                    className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-primary/95 transition-all cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-50"
                >
                    {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Go"}
                </button>
            </div>

            {/* Search Results Dropdown Overlay */}
            {showResults && searchResults.length > 0 && (
                <div className="absolute top-12 left-2 right-2 z-10 max-w-[340px] max-h-40 overflow-y-auto bg-card border rounded-lg shadow-xl divide-y text-xs scrollbar-thin">
                    {searchResults.map((res, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => selectResult(res)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted font-semibold block truncate text-foreground cursor-pointer transition-colors"
                            title={res.display_name}
                        >
                            {res.display_name}
                        </button>
                    ))}
                </div>
            )}

            {/* Click Outside overlay to close results */}
            {showResults && searchResults.length > 0 && (
                <div 
                    className="absolute inset-0 z-0" 
                    onClick={() => setShowResults(false)}
                />
            )}

            {/* Map Canvas */}
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Floating Navigation Instructions */}
            <div className="absolute bottom-2 left-2 z-10 bg-black/65 text-[9px] text-white px-2 py-1 rounded-md backdrop-blur-sm font-semibold pointer-events-none select-none shadow-md">
                📍 Click map or drag pin to select coordinates
            </div>

            {/* Map Style Toggle Button */}
            <button
                type="button"
                onClick={toggleStyle}
                className="absolute bottom-2 right-2 z-10 bg-card/95 hover:bg-card border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground shadow-md transition-all cursor-pointer flex items-center gap-1.5 select-none"
            >
                <Layers className="h-3.5 w-3.5 text-primary" />
                {mapStyle === "street" ? "Satellite View" : "Street View"}
            </button>
        </div>
    );
}
