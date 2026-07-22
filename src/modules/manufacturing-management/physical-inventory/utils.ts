import { PhysicalInventoryLineItem, CountSheetSummary } from "./types";

export function calculateCountSheetSummary(items: PhysicalInventoryLineItem[]): CountSheetSummary {
    const totalItems = items.length;
    let totalSystemQty = 0;
    let totalPhysicalQty = 0;
    let netVarianceQty = 0;
    let surplusItemsCount = 0;
    let deficitItemsCount = 0;
    let matchedItemsCount = 0;
    let uncountedItemsCount = 0;
    let totalSurplusCost = 0;
    let totalDeficitCost = 0;

    for (const item of items) {
        const sys = item.system_count || 0;
        totalSystemQty += sys;

        if (item.physical_count === null || item.physical_count === undefined) {
            uncountedItemsCount++;
            continue;
        }

        const phys = item.physical_count;
        totalPhysicalQty += phys;

        const variance = item.variance !== undefined ? item.variance : (phys - sys);
        netVarianceQty += variance;

        const price = item.unit_price || 0;
        const diffCost = item.difference_cost !== undefined ? item.difference_cost : (variance * price);

        if (variance > 0) {
            surplusItemsCount++;
            totalSurplusCost += diffCost;
        } else if (variance < 0) {
            deficitItemsCount++;
            totalDeficitCost += Math.abs(diffCost);
        } else {
            matchedItemsCount++;
        }
    }

    const netVarianceCost = totalSurplusCost - totalDeficitCost;
    const countedItemsCount = totalItems - uncountedItemsCount;

    return {
        totalItems,
        totalItemsCount: totalItems,
        countedItemsCount,
        totalSystemQty,
        totalPhysicalQty,
        netVarianceQty,
        surplusItemsCount,
        deficitItemsCount,
        matchedItemsCount,
        uncountedItemsCount,
        totalSurplusCost,
        surplusVarianceCost: totalSurplusCost,
        totalDeficitCost,
        deficitVarianceCost: totalDeficitCost,
        netVarianceCost
    };
}

export function formatCurrency(amount: number): string {
    const isNegative = amount < 0;
    const absValue = Math.abs(amount);
    const formatted = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(absValue);

    return isNegative ? `-${formatted}` : formatted;
}

export function formatDate(dateString?: string): string {
    if (!dateString) return "N/A";
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return dateString;
    }
}

