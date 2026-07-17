export interface ReceivingLotAllocation {
    storageLotId: number;
    quantity: number;
}

export function normalizeReceivingLotAllocations(
    acceptedQuantity: number,
    allocations: readonly ReceivingLotAllocation[] | undefined,
    fallbackStorageLotId: number | null
): ReceivingLotAllocation[] {
    if (acceptedQuantity <= 0) return [];
    if (allocations && allocations.length > 0) return allocations.map(allocation => ({ ...allocation }));
    return fallbackStorageLotId
        ? [{ storageLotId: fallbackStorageLotId, quantity: acceptedQuantity }]
        : [];
}

export function receivingLotAllocationError(
    acceptedQuantity: number,
    allocations: readonly ReceivingLotAllocation[],
    fallbackStorageLotId: number | null
): string | null {
    if (acceptedQuantity <= 0) {
        return allocations.length > 0 ? "Accepted-lot allocations are not allowed when accepted quantity is zero." : null;
    }

    const normalized = normalizeReceivingLotAllocations(acceptedQuantity, allocations, fallbackStorageLotId);
    if (normalized.length === 0) return "Select at least one storage lot for accepted inventory.";

    const seen = new Set<number>();
    let total = 0;
    for (const allocation of normalized) {
        if (!Number.isSafeInteger(allocation.storageLotId) || allocation.storageLotId <= 0) {
            return "Every accepted-lot allocation must reference a valid storage lot.";
        }
        if (!Number.isFinite(allocation.quantity) || allocation.quantity <= 0) {
            return "Every accepted-lot allocation must have a positive quantity.";
        }
        if (seen.has(allocation.storageLotId)) {
            return "A storage lot can only appear once in the accepted allocation.";
        }
        seen.add(allocation.storageLotId);
        total += allocation.quantity;
    }

    if (Math.abs(total - acceptedQuantity) > 1e-9) {
        return `Accepted-lot allocations (${total}) must equal accepted quantity (${acceptedQuantity}).`;
    }
    return null;
}
