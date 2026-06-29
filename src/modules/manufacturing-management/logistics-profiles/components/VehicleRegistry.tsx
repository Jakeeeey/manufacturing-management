"use client";

import React, { useState } from "react";
import { Vehicle } from "../types";
import { Plus, Edit2, X, Info, Truck, Power } from "lucide-react";

interface VehicleRegistryProps {
    vehicles: Vehicle[];
    onSave: (vehicle: Vehicle) => Promise<void>;
}

export default function VehicleRegistry({ vehicles, onSave }: VehicleRegistryProps) {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
    const [saving, setSaving] = useState<boolean>(false);

    // Form states
    const [name, setName] = useState("");
    const [type, setType] = useState("Medium Duty");
    const [plate, setPlate] = useState("");
    const [capacityKg, setCapacityKg] = useState(0);
    const [capacityCbm, setCapacityCbm] = useState(0);
    const [driverFee, setDriverFee] = useState(0);
    const [helperFee, setHelperFee] = useState(0);
    const [fuelConsumptionKml, setFuelConsumptionKml] = useState(0);
    const [fuelType, setFuelType] = useState("Diesel");
    const [vehicleStatus, setVehicleStatus] = useState("active");

    // Search and filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const openCreate = () => {
        setEditVehicle(null);
        setName("");
        setType("Medium Duty");
        setPlate("");
        setCapacityKg(0);
        setCapacityCbm(0);
        setDriverFee(0);
        setHelperFee(0);
        setFuelConsumptionKml(0);
        setFuelType("Diesel");
        setVehicleStatus("active");
        setIsOpen(true);
    };

    const openEdit = (vehicle: Vehicle) => {
        setEditVehicle(vehicle);
        setName(vehicle.name);
        setType(vehicle.type);
        setPlate(vehicle.plate);
        setCapacityKg(vehicle.capacity_kg);
        setCapacityCbm(vehicle.capacity_cbm);
        setDriverFee(vehicle.driver_fee);
        setHelperFee(vehicle.helper_fee);
        setFuelConsumptionKml(vehicle.fuel_consumption_kml);
        setFuelType(vehicle.fuel_type || "Diesel");
        setVehicleStatus(vehicle.status || "active");
        setIsOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !plate.trim()) {
            alert("Name and Plate Number are required.");
            return;
        }

        setSaving(true);
        try {
            await onSave({
                id: editVehicle?.id,
                name,
                type,
                plate,
                capacity_kg: Number(capacityKg),
                capacity_cbm: Number(capacityCbm),
                driver_fee: Number(driverFee),
                helper_fee: Number(helperFee),
                fuel_consumption_kml: Number(fuelConsumptionKml),
                fuel_type: fuelType,
                status: vehicleStatus
            });
            setIsOpen(false);
        } catch (err) {
            console.error(err);
            const msg = (err as Error).message || "";
            if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("plate")) {
                alert("This plate number is already registered. Please check and use a unique plate number.");
            } else {
                alert("Failed to save vehicle: " + msg);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (vehicle: Vehicle) => {
        const nextStatus = (vehicle.status || "active").toLowerCase() === "active" ? "inactive" : "active";
        const confirmMsg = `Are you sure you want to ${nextStatus === "active" ? "activate" : "deactivate"} this vehicle?`;
        if (!confirm(confirmMsg)) return;

        try {
            await onSave({
                ...vehicle,
                status: nextStatus
            });
        } catch (err) {
            console.error(err);
            alert("Failed to toggle vehicle status: " + (err as Error).message);
        }
    };

    const filteredVehicles = React.useMemo(() => {
        return vehicles.filter(v => {
            const matchesSearch = !searchTerm || 
                (v.plate || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                (v.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(v.capacity_kg).includes(searchTerm) ||
                String(v.capacity_cbm).includes(searchTerm);
            
            const matchesStatus = statusFilter === "All" || 
                (statusFilter === "Active" && (v.status || "active").toLowerCase() === "active") ||
                (statusFilter === "Inactive" && (v.status || "active").toLowerCase() === "inactive");

            return matchesSearch && matchesStatus;
        });
    }, [vehicles, searchTerm, statusFilter]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h4 className="text-sm font-bold text-foreground">Delivery Fleet Registry</h4>
                    <p className="text-[10px] text-muted-foreground">Manage active shipping vehicles, cargo sizing constraints, and crew allowances.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm self-start sm:self-auto"
                >
                    <Plus className="h-3.5 w-3.5" /> Register Vehicle
                </button>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row gap-3 bg-muted/10 p-3 border rounded-xl">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, plate, weight capacity, or volume capacity..."
                    className="flex-1 h-9 px-3 rounded-lg border bg-background text-xs outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full sm:w-40 h-9 rounded-lg border bg-background text-xs font-semibold px-3 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active Only</option>
                    <option value="Inactive">Inactive Only</option>
                </select>
            </div>

            {/* fleet grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVehicles.length === 0 ? (
                    <div className="col-span-full border border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center">
                        <Truck className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <span className="text-xs font-bold text-muted-foreground">No fleet vehicles found</span>
                        <span className="text-[10px] text-muted-foreground/60 mt-1">Refine your search parameters or register a new vehicle.</span>
                    </div>
                ) : (
                    filteredVehicles.map((v) => (
                        <div key={v.id} className="border bg-card hover:border-primary/30 transition-all rounded-xl p-4 flex flex-col justify-between group relative overflow-hidden shadow-sm">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase">
                                                {v.type}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                (v.status || "active").toLowerCase() === "active"
                                                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
                                                    : "bg-amber-500/10 border border-amber-500/20 text-amber-500"
                                            }`}>
                                                {(v.status || "active").toLowerCase() === "active" ? "Active" : "Inactive"}
                                            </span>
                                            {v.fuel_type && (
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                                    {v.fuel_type}
                                                </span>
                                            )}
                                        </div>
                                        <h5 className="font-bold text-xs text-foreground mt-1.5">{v.name || "Unnamed Vehicle"}</h5>
                                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Plate: {v.plate}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={() => openEdit(v)}
                                            title="Edit Vehicle"
                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                                        >
                                            <Edit2 className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => v.id && handleToggleStatus(v)}
                                            title={(v.status || "active").toLowerCase() === "active" ? "Deactivate Vehicle" : "Activate Vehicle"}
                                            className={`p-1 rounded transition-all ${
                                                (v.status || "active").toLowerCase() === "active"
                                                    ? "hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500"
                                                    : "hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-600"
                                            }`}
                                        >
                                            <Power className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-x-2 gap-y-2 border-t pt-2.5 text-[10px]">
                                    <div>
                                        <span className="text-muted-foreground">Weight Capacity:</span>
                                        <p className="font-semibold text-foreground">{(v.capacity_kg).toLocaleString()} kg</p>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Vol. Capacity:</span>
                                        <p className="font-semibold text-foreground">{v.capacity_cbm} CBM</p>
                                    </div>
                                    <div className="border-t pt-1.5">
                                        <span className="text-muted-foreground">Driver Allowance:</span>
                                        <p className="font-semibold text-emerald-500">₱{v.driver_fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="border-t pt-1.5">
                                        <span className="text-muted-foreground">Helper Allowance:</span>
                                        <p className="font-semibold text-emerald-500">₱{v.helper_fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 bg-muted/30 border-t -mx-4 -mb-4 px-4 py-2 flex items-center justify-between text-[9px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Info className="h-3 w-3 text-muted-foreground/60" /> Standard Fuel Index:
                                </span>
                                <span className="font-bold text-foreground font-mono">{v.fuel_consumption_kml} km/L</span>
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
                                {editVehicle ? "Edit Vehicle Settings" : "Register New Fleet Vehicle"}
                            </h5>
                            <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground transition-all">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Vehicle Name / Model</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Fuso Wing Van 32cbm"
                                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Vehicle Type</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="w-full h-9 rounded-lg border bg-background text-xs px-3 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                    >
                                        <option value="Light Duty">Light Duty (e.g. L300)</option>
                                        <option value="Medium Duty">Medium Duty (e.g. Elf)</option>
                                        <option value="Heavy Duty">Heavy Duty (e.g. 10-Wheeler)</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Plate Number</label>
                                    <input
                                        type="text"
                                        value={plate}
                                        onChange={(e) => setPlate(e.target.value)}
                                        placeholder="e.g. NDG-8902"
                                        className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t pt-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Weight Capacity (kg)</label>
                                    <input
                                        type="number"
                                        value={capacityKg}
                                        onChange={(e) => setCapacityKg(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Volumetric Capacity (CBM)</label>
                                    <input
                                        type="number"
                                        value={capacityCbm}
                                        onChange={(e) => setCapacityCbm(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t pt-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Driver Allowance (PHP)</label>
                                    <input
                                        type="number"
                                        value={driverFee}
                                        onChange={(e) => setDriverFee(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Helper Fee (PHP)</label>
                                    <input
                                        type="number"
                                        value={helperFee}
                                        onChange={(e) => setHelperFee(Number(e.target.value))}
                                        className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>

                             <div className="space-y-1.5 border-t pt-3">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Fuel Efficiency Index (km/L)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={fuelConsumptionKml}
                                    onChange={(e) => setFuelConsumptionKml(Number(e.target.value))}
                                    className="w-full h-9 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                                <span className="text-[9px] text-muted-foreground block mt-0.5">Used to divide route distances to calculate diesel volume requirement.</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t pt-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Fuel Type</label>
                                    <select
                                        value={fuelType}
                                        onChange={(e) => setFuelType(e.target.value)}
                                        className="w-full h-9 rounded-lg border bg-background text-xs px-3 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                    >
                                        <option value="Diesel">Diesel</option>
                                        <option value="Gasoline">Gasoline</option>
                                        <option value="Electric">Electric</option>
                                        <option value="LPG">LPG</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                                    <select
                                        value={vehicleStatus}
                                        onChange={(e) => setVehicleStatus(e.target.value)}
                                        className="w-full h-9 rounded-lg border bg-background text-xs px-3 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
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
                                    {saving ? "Saving..." : "Save Vehicle"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
