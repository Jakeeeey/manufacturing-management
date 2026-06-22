"use client";

import React, { useState } from "react";
import { useLogisticsProfiles } from "./hooks/useLogisticsProfiles";
import VehicleRegistry from "./components/VehicleRegistry";
import RouteConfigurations from "./components/RouteConfigurations";
import TripCostSimulator from "./components/TripCostSimulator";
import RequirementsSpecTab from "./components/RequirementsSpecTab";
import { Loader2, Truck, Navigation, Activity, FileText, Settings, ShieldCheck } from "lucide-react";

export default function LogisticsProfilesModule() {
    const {
        vehicles,
        routes,
        loading,
        simVehicleId,
        setSimVehicleId,
        simRouteId,
        setSimRouteId,
        cargoWeight,
        setCargoWeight,
        cargoVolume,
        setCargoVolume,
        isRoundTrip,
        setIsRoundTrip,
        handleSaveVehicle,
        handleDeleteVehicle,
        handleSaveRoute,
        handleDeleteRoute,
        getSimulationResult
    } = useLogisticsProfiles();

    const [activeTab, setActiveTab] = useState<string>("simulator");

    return (
        <div className="flex flex-col min-h-0 min-w-0 flex-1 space-y-4">
            {/* Module Header Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                        <Truck className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Active Fleet Size</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">{loading ? "..." : vehicles.length} Vehicles</h4>
                    </div>
                </div>

                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                        <Navigation className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Configured Routes</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">{loading ? "..." : routes.length} Routes</h4>
                    </div>
                </div>

                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Dispatch Rules</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">Automated</h4>
                    </div>
                </div>

                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                        <Settings className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Integration State</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">Local Fallback</h4>
                    </div>
                </div>
            </div>

            {/* Tab Navigation header */}
            <div className="flex border-b bg-muted/10 shrink-0 rounded-xl overflow-hidden border">
                {[
                    { id: "simulator", label: "Trip Cost Simulator", icon: Activity },
                    { id: "fleet", label: "Fleet Fleet Registry", icon: Truck },
                    { id: "routes", label: "Shipping Routes", icon: Navigation },
                    { id: "specs", label: "Requirements Spec", icon: FileText }
                ].map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3.5 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                                isActive 
                                    ? "border-primary text-primary bg-background" 
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content Window */}
            <div className="flex-1 min-h-0 relative bg-background border rounded-xl p-4 md:p-6 shadow-sm">
                {loading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                <div className="w-full h-full">
                    {activeTab === "simulator" && (
                        <TripCostSimulator
                            vehicles={vehicles}
                            routes={routes}
                            simVehicleId={simVehicleId}
                            setSimVehicleId={setSimVehicleId}
                            simRouteId={simRouteId}
                            setSimRouteId={setSimRouteId}
                            cargoWeight={cargoWeight}
                            setCargoWeight={setCargoWeight}
                            cargoVolume={cargoVolume}
                            setCargoVolume={setCargoVolume}
                            isRoundTrip={isRoundTrip}
                            setIsRoundTrip={setIsRoundTrip}
                            getSimulationResult={getSimulationResult}
                        />
                    )}
                    {activeTab === "fleet" && (
                        <VehicleRegistry
                            vehicles={vehicles}
                            onSave={handleSaveVehicle}
                            onDelete={handleDeleteVehicle}
                        />
                    )}
                    {activeTab === "routes" && (
                        <RouteConfigurations
                            routes={routes}
                            onSave={handleSaveRoute}
                            onDelete={handleDeleteRoute}
                        />
                    )}
                    {activeTab === "specs" && (
                        <RequirementsSpecTab />
                    )}
                </div>
            </div>
        </div>
    );
}
