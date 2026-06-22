"use client";

import { useState, useEffect, useCallback } from "react";
import { Vehicle, Route, SimulationResult } from "../types";
import { fetchLogisticsProfiles, saveLogisticsProfile, deleteLogisticsProfile } from "../services/logistics-api";
import { toast } from "sonner";

export function useLogisticsProfiles() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Modal Control States
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState<boolean>(false);
    const [isRouteModalOpen, setIsRouteModalOpen] = useState<boolean>(false);

    // Form States
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

    // Simulator inputs
    const [simVehicleId, setSimVehicleId] = useState<string>("");
    const [simRouteId, setSimRouteId] = useState<string>("");
    const [cargoWeight, setCargoWeight] = useState<number>(1000);
    const [cargoVolume, setCargoVolume] = useState<number>(5);
    const [isRoundTrip, setIsRoundTrip] = useState<boolean>(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchLogisticsProfiles();
            setVehicles(data.vehicles);
            setRoutes(data.routes);
            
            // Set default simulator values if data exists
            if (data.vehicles.length > 0 && !simVehicleId) {
                setSimVehicleId(String(data.vehicles[0].id));
            }
            if (data.routes.length > 0 && !simRouteId) {
                setSimRouteId(String(data.routes[0].id));
            }
        } catch {
            toast.error("Failed to load logistics profiles.");
        } finally {
            setLoading(false);
        }
    }, [simVehicleId, simRouteId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Save vehicle
    const handleSaveVehicle = async (vehicleData: Vehicle) => {
        try {
            await saveLogisticsProfile("vehicle", vehicleData);
            toast.success(vehicleData.id ? "Vehicle updated successfully!" : "Vehicle registered successfully!");
            setIsVehicleModalOpen(false);
            setSelectedVehicle(null);
            loadData();
        } catch (e) {
            toast.error((e as Error).message || "Failed to save vehicle.");
        }
    };

    // Delete vehicle
    const handleDeleteVehicle = async (id: number) => {
        if (!confirm("Are you sure you want to delete this vehicle profile?")) return;
        try {
            await deleteLogisticsProfile("vehicle", id);
            toast.success("Vehicle profile deleted.");
            loadData();
        } catch {
            toast.error("Failed to delete vehicle.");
        }
    };

    // Save route
    const handleSaveRoute = async (routeData: Route) => {
        try {
            await saveLogisticsProfile("route", routeData);
            toast.success(routeData.id ? "Route updated successfully!" : "Route configured successfully!");
            setIsRouteModalOpen(false);
            setSelectedRoute(null);
            loadData();
        } catch (e) {
            toast.error((e as Error).message || "Failed to save route.");
        }
    };

    // Delete route
    const handleDeleteRoute = async (id: number) => {
        if (!confirm("Are you sure you want to delete this route profile?")) return;
        try {
            await deleteLogisticsProfile("route", id);
            toast.success("Route profile deleted.");
            loadData();
        } catch {
            toast.error("Failed to delete route.");
        }
    };

    // Run Trip Simulation calculations
    const getSimulationResult = (): SimulationResult | null => {
        const vehicle = vehicles.find(v => String(v.id) === simVehicleId);
        const route = routes.find(r => String(r.id) === simRouteId);

        if (!vehicle || !route) return null;

        const multiplier = isRoundTrip ? 2 : 1;
        const distanceKm = route.distance_km * multiplier;
        const fuelConsumedLiters = distanceKm / vehicle.fuel_consumption_kml;
        const fuelCostPhp = fuelConsumedLiters * route.fuel_price_php;
        
        // Total costs
        const driverFee = vehicle.driver_fee * multiplier;
        const helperFee = vehicle.helper_fee * multiplier;
        const tollFees = route.tolls_php * multiplier;
        const totalTripCostPhp = driverFee + helperFee + tollFees + fuelCostPhp;

        // Efficiencies
        const cargoLoadPercentageWeight = Math.min((cargoWeight / vehicle.capacity_kg) * 100, 100);
        const cargoLoadPercentageVolume = Math.min((cargoVolume / vehicle.capacity_cbm) * 100, 100);

        // Unit splits
        const costPerKgPhp = cargoWeight > 0 ? totalTripCostPhp / cargoWeight : 0;
        const costPerCbmPhp = cargoVolume > 0 ? totalTripCostPhp / cargoVolume : 0;

        return {
            vehicleName: vehicle.name,
            routeName: route.name,
            distanceKm,
            driverFee,
            helperFee,
            tollFees,
            fuelConsumedLiters,
            fuelCostPhp,
            totalTripCostPhp,
            cargoLoadPercentageWeight,
            cargoLoadPercentageVolume,
            costPerKgPhp,
            costPerCbmPhp
        };
    };

    return {
        vehicles,
        routes,
        loading,
        isVehicleModalOpen,
        setIsVehicleModalOpen,
        isRouteModalOpen,
        setIsRouteModalOpen,
        selectedVehicle,
        setSelectedVehicle,
        selectedRoute,
        setSelectedRoute,
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
        getSimulationResult,
        refreshData: loadData
    };
}
