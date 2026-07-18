export function relationId(value: unknown, key: string): number {
    const raw = value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : value;
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function movementQuantity(value: unknown): number {
    const quantity = Number(value || 0);
    return Number.isFinite(quantity) ? quantity : 0;
}

export function movementLotId(row: Record<string, unknown>): number {
    return relationId(row.lot_id, "lot_id");
}

export function movementStockKey(row: Record<string, unknown>): string {
    const productId = relationId(row.product_id, "product_id");
    const branchId = relationId(row.branch_id, "id") || relationId(row.branch_id, "branch_id");
    const lotId = movementLotId(row);
    const batchNo = String(row.batch_no ?? row.lot_number ?? "LOT-N/A").trim() || "LOT-N/A";
    return `${productId}:${branchId}:${lotId}:${batchNo}`;
}

export function sumMovementQuantitiesByLot(rows: Record<string, unknown>[]): Map<number, number> {
    const quantities = new Map<number, number>();
    for (const row of rows) {
        const lotId = movementLotId(row);
        if (!lotId) continue;
        quantities.set(lotId, (quantities.get(lotId) || 0) + movementQuantity(row.quantity));
    }
    return quantities;
}

export function sumMovementQuantitiesByStock(rows: Record<string, unknown>[]): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const row of rows) {
        const key = movementStockKey(row);
        if (key.startsWith("0:")) continue;
        quantities.set(key, (quantities.get(key) || 0) + movementQuantity(row.quantity));
    }
    return quantities;
}
