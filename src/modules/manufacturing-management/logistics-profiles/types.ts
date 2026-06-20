export interface Vehicle {
    id?: number;
    name: string;
    type: string;
    plate: string;
    capacity_kg: number;
    capacity_cbm: number;
    driver_fee: number;
    helper_fee: number;
    fuel_consumption_kml: number;
}

export interface Route {
    id?: number;
    name: string;
    distance_km: number;
    tolls_php: number;
    fuel_price_php: number;
    description?: string;
    lat?: number;
    lng?: number;
}

export interface SimulationResult {
    vehicleName: string;
    routeName: string;
    distanceKm: number;
    driverFee: number;
    helperFee: number;
    tollFees: number;
    fuelConsumedLiters: number;
    fuelCostPhp: number;
    totalTripCostPhp: number;
    cargoLoadPercentageWeight: number;
    cargoLoadPercentageVolume: number;
    costPerKgPhp: number;
    costPerCbmPhp: number;
}
