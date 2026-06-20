"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Vehicle, Route, SimulationResult } from "../types";
import { Play, ShieldAlert, Sparkles, Scale, Percent } from "lucide-react";

const SimulationMap = dynamic(() => import("./SimulationMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[240px] rounded-xl border bg-muted flex items-center justify-center animate-pulse">
            <span className="text-xs font-bold text-muted-foreground">Loading interactive telemetry map...</span>
        </div>
    )
});

interface TripCostSimulatorProps {
    vehicles: Vehicle[];
    routes: Route[];
    simVehicleId: string;
    setSimVehicleId: (id: string) => void;
    simRouteId: string;
    setSimRouteId: (id: string) => void;
    cargoWeight: number;
    setCargoWeight: (val: number) => void;
    cargoVolume: number;
    setCargoVolume: (val: number) => void;
    isRoundTrip: boolean;
    setIsRoundTrip: (val: boolean) => void;
    getSimulationResult: () => SimulationResult | null;
}

export default function TripCostSimulator({
    vehicles,
    routes,
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
    getSimulationResult
}: TripCostSimulatorProps) {
    const result = getSimulationResult();
    const vehicle = vehicles.find(v => String(v.id) === simVehicleId);

    // Overload flags
    const weightOverloaded = vehicle ? cargoWeight > vehicle.capacity_kg : false;
    const volumeOverloaded = vehicle ? cargoVolume > vehicle.capacity_cbm : false;

    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-sm font-bold text-foreground">Freight & Dispatch Cost Simulator</h4>
                <p className="text-[10px] text-muted-foreground">stress-test logistics allowances, tolls, and fuel indexes to evaluate unit cost mappings.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Simulator Inputs Form */}
                <div className="lg:col-span-5 border bg-card/40 backdrop-blur-sm rounded-xl p-4 space-y-4">
                    <span className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> Simulation Sandbox
                    </span>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">Target Fleet Vehicle</label>
                            <select
                                value={simVehicleId}
                                onChange={(e) => setSimVehicleId(e.target.value)}
                                className="w-full h-9 rounded-lg border bg-background text-xs font-semibold px-3 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                                <option value="" disabled>-- Select Vehicle --</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.plate})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">Target Route</label>
                            <select
                                value={simRouteId}
                                onChange={(e) => setSimRouteId(e.target.value)}
                                className="w-full h-9 rounded-lg border bg-background text-xs font-semibold px-3 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                            >
                                <option value="" disabled>-- Select Route --</option>
                                {routes.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.distance_km} km)</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t pt-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Cargo Weight (kg)</label>
                                <input
                                    type="number"
                                    value={cargoWeight}
                                    onChange={(e) => setCargoWeight(Number(e.target.value))}
                                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-muted-foreground uppercase">Cargo Volume (CBM)</label>
                                <input
                                    type="number"
                                    value={cargoVolume}
                                    onChange={(e) => setCargoVolume(Number(e.target.value))}
                                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Enable Round-Trip Rates</span>
                            <button
                                type="button"
                                onClick={() => setIsRoundTrip(!isRoundTrip)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                    isRoundTrip ? "bg-primary" : "bg-muted"
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                                        isRoundTrip ? "translate-x-4" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Simulator Outputs Panel */}
                <div className="lg:col-span-7 space-y-4">
                    {result ? (
                        <div className="border rounded-xl bg-card p-5 space-y-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b pb-4">
                                <div>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Calculated Standard Cost</span>
                                    <h3 className="text-xl font-black text-foreground mt-0.5">
                                        ₱{result.totalTripCostPhp.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h3>
                                </div>
                                <div className="text-[10px] text-muted-foreground sm:text-right">
                                    <p className="font-semibold text-foreground">Round-Trip Distance: {result.distanceKm} km</p>
                                    <p className="mt-0.5">Est. Fuel: {result.fuelConsumedLiters.toFixed(2)} Liters</p>
                                </div>
                            </div>

                            {/* Telemetry Map */}
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Route Telemetry & Dispatch Path</span>
                                <SimulationMap routeName={result.routeName} distanceKm={result.distanceKm / (isRoundTrip ? 2 : 1)} />
                            </div>

                            {/* Cost Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                                <div className="p-3 bg-muted/20 border rounded-lg">
                                    <span className="text-muted-foreground">Driver Fee</span>
                                    <p className="font-bold text-foreground mt-0.5">₱{result.driverFee.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-muted/20 border rounded-lg">
                                    <span className="text-muted-foreground">Helper Fee</span>
                                    <p className="font-bold text-foreground mt-0.5">₱{result.helperFee.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-muted/20 border rounded-lg">
                                    <span className="text-muted-foreground">Tolls Allocation</span>
                                    <p className="font-bold text-foreground mt-0.5">₱{result.tollFees.toLocaleString()}</p>
                                </div>
                                <div className="p-3 bg-muted/20 border rounded-lg">
                                    <span className="text-muted-foreground">Fuel Allocation</span>
                                    <p className="font-bold text-foreground mt-0.5">₱{result.fuelCostPhp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            {/* Cargo Efficiency Meters */}
                            <div className="space-y-3.5 border-t pt-4">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                    <Percent className="h-3.5 w-3.5" /> Fleet Sizing Capacity Utilization
                                </span>
                                
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-semibold">
                                            <span className="text-muted-foreground">Weight Load Efficiency ({cargoWeight}kg / {vehicle?.capacity_kg}kg)</span>
                                            <span className={weightOverloaded ? "text-rose-500 font-bold" : "text-foreground font-bold"}>
                                                {result.cargoLoadPercentageWeight.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    weightOverloaded ? "bg-rose-500" : "bg-primary"
                                                }`}
                                                style={{ width: `${result.cargoLoadPercentageWeight}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-semibold">
                                            <span className="text-muted-foreground">Volume Load Efficiency ({cargoVolume} CBM / {vehicle?.capacity_cbm} CBM)</span>
                                            <span className={volumeOverloaded ? "text-rose-500 font-bold" : "text-foreground font-bold"}>
                                                {result.cargoLoadPercentageVolume.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    volumeOverloaded ? "bg-rose-500" : "bg-primary"
                                                }`}
                                                style={{ width: `${result.cargoLoadPercentageVolume}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Unit Cost Mapping */}
                            <div className="border-t pt-4 flex gap-4 text-[10px]">
                                <div className="flex-1 p-3 border rounded-lg bg-emerald-500/5 flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Scale className="h-3.5 w-3.5 text-emerald-500" /> Logistics overhead / kg
                                    </span>
                                    <span className="font-bold text-emerald-600 text-xs">
                                        ₱{result.costPerKgPhp.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                    </span>
                                </div>
                                <div className="flex-1 p-3 border rounded-lg bg-emerald-500/5 flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Scale className="h-3.5 w-3.5 text-emerald-500" /> Logistics overhead / CBM
                                    </span>
                                    <span className="font-bold text-emerald-600 text-xs">
                                        ₱{result.costPerCbmPhp.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                    </span>
                                </div>
                            </div>

                            {/* Warnings */}
                            {(weightOverloaded || volumeOverloaded) && (
                                <div className="p-3.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 text-[10px] font-bold flex items-start gap-2 animate-in fade-in zoom-in duration-300">
                                    <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                                    <div>
                                        <p className="uppercase tracking-wider">FLEET DISPATCH CAP LIMIT EXCEEDED</p>
                                        <p className="font-normal text-rose-500 mt-0.5 leading-relaxed">
                                            The proposed cargo load exceeds the payload specifications of this vehicle category. Consider selecting a larger delivery vehicle template or reducing batch sizes.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="border rounded-xl bg-card p-5 space-y-5 shadow-sm flex flex-col justify-between min-h-[300px]">
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Interactive Telemetry Map</span>
                                <SimulationMap />
                            </div>
                            <div className="border rounded-xl p-6 text-center flex flex-col items-center justify-center bg-muted/20">
                                <Play className="h-6 w-6 text-muted-foreground/40 mb-2" />
                                <span className="text-xs font-bold text-muted-foreground">Select a vehicle and route to run simulation</span>
                                <span className="text-[10px] text-muted-foreground/60 mt-1">Configure both registries to map out dispatch costs.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
