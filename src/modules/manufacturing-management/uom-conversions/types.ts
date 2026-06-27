export interface DensityFactor {
    id: string;
    name: string;
    density: number; // in kg/L
    description: string;
    isSystem?: boolean;
}

export interface UOMScale {
    fromUnit: string;
    toUnit: string;
    multiplier: number;
    description: string;
}

export interface ConversionLog {
    id: string;
    timestamp: string;
    createdAt?: string;
    oilType: string;
    value: number;
    fromUnit: string;
    result: number;
    toUnit: string;
}

