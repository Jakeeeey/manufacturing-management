export interface CostingMaterialInput {
    quantity: number;
    unitCost: number;
    wastagePercent?: number | null;
    isByProduct?: boolean;
}

export interface CostingRouteInput {
    laborCost: number;
    machineHourlyRate: number;
    setupTimeHours: number;
    runTimeHours: number;
    baseQuantity: number;
    materials?: CostingMaterialInput[];
}

export interface CostingBreakdown {
    materialsCost: number;
    laborCost: number;
    machineOverheadCost: number;
    customOverheadCost: number;
    preYieldDirectCost: number;
    yieldPercentage: number;
    yieldFactor: number;
    totalBaseCost: number;
}

export interface OverheadSummary {
    customOverhead: number;
    additionalOperatingOverhead: number;
    totalOverheadExpenses: number;
    includedInCogs: number;
    excludedFromCogs: number;
}

export interface MarginSummary {
    grossProfit: number;
    grossMarginPercent: number;
    netProfit: number;
    netMarginPercent: number;
    marginBasis: "sales";
}

export function calculateMaterialCost(input: CostingMaterialInput): number {
    const quantity = Number(input.quantity) || 0;
    const unitCost = Number(input.unitCost) || 0;
    const wastagePercent = Number(input.wastagePercent) || 0;
    const usableFactor = 1 - (wastagePercent / 100);
    const cost = (quantity * unitCost) / (usableFactor > 0 ? usableFactor : 1);

    return input.isByProduct ? -Math.abs(cost) : cost;
}

export function calculateRouteBreakdown(input: CostingRouteInput) {
    const baseQuantity = Number(input.baseQuantity) > 0 ? Number(input.baseQuantity) : 1;
    const laborCost = (Number(input.laborCost) || 0) / baseQuantity;
    const setupHoursPerUnit = (Number(input.setupTimeHours) || 0) / baseQuantity;
    const runHours = Number(input.runTimeHours) || 0;
    const machineHours = setupHoursPerUnit + runHours;
    const machineOverheadCost = (Number(input.machineHourlyRate) || 0) * machineHours;
    const materialsCost = (input.materials || []).reduce(
        (total, material) => total + calculateMaterialCost(material),
        0
    );

    return {
        materialsCost,
        laborCost,
        machineHours,
        machineOverheadCost,
        totalCost: laborCost + machineOverheadCost
    };
}

export function calculateCostBreakdown(input: {
    materialsCost: number;
    laborCost: number;
    machineOverheadCost: number;
    customOverheadCost?: number | null;
    expectedYieldPercentage?: number | null;
}): CostingBreakdown {
    const materialsCost = Number(input.materialsCost) || 0;
    const laborCost = Number(input.laborCost) || 0;
    const machineOverheadCost = Number(input.machineOverheadCost) || 0;
    const customOverheadCost = Math.max(0, Number(input.customOverheadCost) || 0);
    const yieldPercentage = Number(input.expectedYieldPercentage) > 0
        ? Number(input.expectedYieldPercentage)
        : 100;
    const yieldFactor = yieldPercentage / 100;
    const preYieldDirectCost = materialsCost + laborCost + machineOverheadCost + customOverheadCost;

    return {
        materialsCost,
        laborCost,
        machineOverheadCost,
        customOverheadCost,
        preYieldDirectCost,
        yieldPercentage,
        yieldFactor,
        totalBaseCost: preYieldDirectCost / (yieldFactor > 0 ? yieldFactor : 1)
    };
}

export function calculateOverheadSummary(
    customOverheadCost: number,
    additionalOverheadAmounts: number[] = []
): OverheadSummary {
    const customOverhead = Math.max(0, Number(customOverheadCost) || 0);
    const additionalOperatingOverhead = additionalOverheadAmounts.reduce(
        (total, amount) => total + Math.max(0, Number(amount) || 0),
        0
    );

    return {
        customOverhead,
        additionalOperatingOverhead,
        totalOverheadExpenses: customOverhead + additionalOperatingOverhead,
        includedInCogs: customOverhead,
        excludedFromCogs: additionalOperatingOverhead
    };
}

export function calculateMarginSummary(
    sellingPrice: number,
    cogs: number,
    excludedOperatingOverhead: number = 0
): MarginSummary {
    const price = Number(sellingPrice) || 0;
    const cost = Number(cogs) || 0;
    const operatingOverhead = Math.max(0, Number(excludedOperatingOverhead) || 0);
    const grossProfit = price - cost;
    const netProfit = grossProfit - operatingOverhead;
    const marginPercent = (profit: number) => price > 0 ? (profit / price) * 100 : 0;

    return {
        grossProfit,
        grossMarginPercent: marginPercent(grossProfit),
        netProfit,
        netMarginPercent: marginPercent(netProfit),
        marginBasis: "sales"
    };
}
