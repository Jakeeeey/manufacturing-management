export interface CostingMaterialInput {
    quantity: number;
    unitCost: number;
    wastagePercent?: number | null;
    isByProduct?: boolean;
}

export interface CostingRouteInput {
    machineHourlyRate: number;
    stepBatchSize?: number | null;
    setupTimeHours: number;
    runTimeHours: number;
    baseQuantity: number;
    materials?: CostingMaterialInput[];
}

export interface CostingRouteBreakdown {
    materialsCost: number;
    machineHours: number;
    totalMachineCost: number;
    machineOverheadCost: number;
    machineCostPerUnit: number;
    stepBatchSize: number;
    totalCost: number;
}

export interface CostingBreakdown {
    baseQuantity: number;
    /** Yield-adjusted cost for one finished unit. */
    unitCost: number;
    /** Yield-adjusted cost for the configured base batch. */
    batchCost: number;
    materialsCost: number;
    machineOverheadCost: number;
    machineHours: number;
    totalMachineCost: number;
    customOverheadCost: number;
    preYieldDirectCost: number;
    yieldAdjustedUnitCost: number;
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

export function calculateRouteBreakdown(input: CostingRouteInput): CostingRouteBreakdown {
    const baseQuantity = Number(input.baseQuantity) > 0 ? Number(input.baseQuantity) : 1;
    const stepBatchSize = Number(input.stepBatchSize) > 0 ? Number(input.stepBatchSize) : 1;
    const setupHours = Math.max(0, Number(input.setupTimeHours) || 0);
    const runHours = Math.max(0, Number(input.runTimeHours) || 0);
    const machineHourlyRate = Math.max(0, Number(input.machineHourlyRate) || 0);

    const setupHoursPerUnit = setupHours / baseQuantity;
    const runHoursPerUnit = runHours / stepBatchSize;
    const machineCostPerUnit = machineHourlyRate * (setupHoursPerUnit + runHoursPerUnit);

    const machineHours = setupHours + (runHours / stepBatchSize) * baseQuantity; // approximate for the batch
    const totalMachineCost = machineCostPerUnit * baseQuantity;

    const materialsBatchCost = (input.materials || []).reduce(
        (total, material) => total + calculateMaterialCost(material),
        0
    );
    const materialsCost = materialsBatchCost / baseQuantity;
    const machineOverheadCost = machineCostPerUnit;

    return {
        materialsCost,
        machineHours,
        totalMachineCost,
        machineOverheadCost,
        machineCostPerUnit,
        stepBatchSize,
        totalCost: machineCostPerUnit
    };
}

export function calculateCostBreakdown(input: {
    materialsCost: number;
    machineOverheadCost: number;
    customOverheadCost?: number | null;
    expectedYieldPercentage?: number | null;
    baseQuantity?: number | null;
    machineHours?: number | null;
    totalMachineCost?: number | null;
}): CostingBreakdown {
    const baseQuantity = Number(input.baseQuantity) > 0 ? Number(input.baseQuantity) : 1;
    const materialsCost = Number(input.materialsCost) || 0;
    const machineOverheadCost = Number(input.machineOverheadCost) || 0;
    const customOverheadCost = Math.max(0, Number(input.customOverheadCost) || 0);
    const yieldPercentage = Number(input.expectedYieldPercentage) > 0
        ? Number(input.expectedYieldPercentage)
        : 100;
    const yieldFactor = yieldPercentage / 100;
    const preYieldDirectCost = materialsCost + machineOverheadCost + customOverheadCost;
    const yieldAdjustedUnitCost = preYieldDirectCost / (yieldFactor > 0 ? yieldFactor : 1);
    const batchCost = yieldAdjustedUnitCost * baseQuantity;

    return {
        baseQuantity,
        unitCost: yieldAdjustedUnitCost,
        batchCost,
        materialsCost,
        machineOverheadCost,
        machineHours: Math.max(0, Number(input.machineHours) || 0),
        totalMachineCost: Math.max(0, Number(input.totalMachineCost) || 0),
        customOverheadCost,
        preYieldDirectCost,
        yieldAdjustedUnitCost,
        yieldPercentage,
        yieldFactor,
        totalBaseCost: batchCost
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
