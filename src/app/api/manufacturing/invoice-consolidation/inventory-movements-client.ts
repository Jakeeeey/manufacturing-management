import { DIRECTUS_URL, headers } from "../directus-api";

export interface MovementRow {
    movement_id: number;
    product_id: number;
    lot_id: number;
    branch_id: number;
    transaction_type_id: number;
    source_document_id: number;
    source_document_no: string | null;
    batch_no: string;
    expiry_date: string | null;
    manufacturing_date: string | null;
    quantity: number;
    created_by: number;
    created_at: string;
    remarks: string | null;
}

export interface AvailableStockLine {
    lot_id: number;
    batch_no: string;
    expiry_date: string | null;
    manufacturing_date: string | null;
    current_stock: number;
}

export interface PostMovementPayload {
    product_id: number;
    lot_id: number;
    branch_id: number;
    transaction_type_id: number;
    source_document_id: number;
    source_document_no: string | null;
    batch_no: string;
    expiry_date: string | null;
    manufacturing_date: string | null;
    quantity: number;
    created_by: number;
    remarks: string | null;
}

export interface AllocationLine {
    lot_id: number;
    batch_no: string;
    expiry_date: string | null;
    manufacturing_date: string | null;
    quantity: number;
}

export interface AllocationResult {
    allocations: AllocationLine[];
    shortfall: number;
}

/**
 * Fetch available (positive) stock for a product in a branch
 * aggregated from inventory_movements ledger, sorted FEFO.
 */
export async function fetchAvailableStock(
    productId: number,
    branchId: number
): Promise<AvailableStockLine[]> {
    const url = `${DIRECTUS_URL}/items/inventory_movements`
        + `?filter[product_id][_eq]=${productId}`
        + `&filter[branch_id][_eq]=${branchId}`
        + `&sort=movement_id&limit=500`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Directus inventory_movements error: ${res.status}`);
    }

    const json = await res.json();
    const rows: MovementRow[] = json.data || [];

    // Aggregate positive stock by lot_id, batch_no, expiry, manufacturing_date
    const stockMap = new Map<string, AvailableStockLine>();

    for (const row of rows) {
        const key = `${row.lot_id}:${row.batch_no}:${row.expiry_date || ""}:${row.manufacturing_date || ""}`;
        const existing = stockMap.get(key);
        const qty = Number(row.quantity || 0);

        if (existing) {
            existing.current_stock += qty;
        } else {
            stockMap.set(key, {
                lot_id: row.lot_id,
                batch_no: row.batch_no,
                expiry_date: row.expiry_date,
                manufacturing_date: row.manufacturing_date,
                current_stock: qty,
            });
        }
    }

    // Filter to only positive stock, then sort FEFO
    const result: AvailableStockLine[] = [];
    for (const line of stockMap.values()) {
        if (line.current_stock > 0) {
            result.push(line);
        }
    }

    result.sort((a, b) => {
        const aExp = a.expiry_date || "9999-12-31";
        const bExp = b.expiry_date || "9999-12-31";
        const cmp = aExp.localeCompare(bExp);
        if (cmp !== 0) return cmp;
        const aMfg = a.manufacturing_date || "9999-12-31";
        const bMfg = b.manufacturing_date || "9999-12-31";
        return aMfg.localeCompare(bMfg);
    });

    return result;
}

/**
 * FEFO allocate a required quantity from available stock.
 * Returns allocated lines and the remaining shortfall (0 if fully covered).
 */
export function fefoAllocate(
    requiredQty: number,
    availableStock: AvailableStockLine[],
): AllocationResult {
    const allocations: AllocationLine[] = [];
    let remaining = requiredQty;

    for (const stock of availableStock) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, stock.current_stock);
        allocations.push({
            lot_id: stock.lot_id,
            batch_no: stock.batch_no,
            expiry_date: stock.expiry_date,
            manufacturing_date: stock.manufacturing_date,
            quantity: take,
        });
        remaining -= take;
    }

    return { allocations, shortfall: remaining };
}

/**
 * Check if movements already exist for this source document and type.
 * Used for idempotency before posting.
 */
export async function movementsExistForSource(
    sourceDocumentId: number,
    transactionTypeId: number,
): Promise<boolean> {
    const url = `${DIRECTUS_URL}/items/inventory_movements`
        + `?filter[source_document_id][_eq]=${sourceDocumentId}`
        + `&filter[transaction_type_id][_eq]=${transactionTypeId}`
        + `&limit=1`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return false;
    const json = await res.json();
    const data: unknown[] = json.data || [];
    return data.length > 0;
}

/**
 * Check if net movement quantity for this source and type is zero.
 * Returns true when all negative movements have been compensated (re-picked).
 */
export async function netMovementsZeroForSource(
    sourceDocumentId: number,
    transactionTypeId: number,
): Promise<boolean> {
    const url = `${DIRECTUS_URL}/items/inventory_movements`
        + `?filter[source_document_id][_eq]=${sourceDocumentId}`
        + `&filter[transaction_type_id][_eq]=${transactionTypeId}`
        + `&limit=500`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return false;
    const json = await res.json();
    const rows: MovementRow[] = json.data || [];

    let net = 0;
    for (const row of rows) {
        net += Number(row.quantity || 0);
    }
    return net === 0;
}

/**
 * Fetch all movements (positive and negative) for a source document.
 * Used by re-pick to determine what needs compensating.
 */
export async function fetchSourceMovements(
    sourceDocumentId: number,
    transactionTypeId: number,
): Promise<MovementRow[]> {
    const url = `${DIRECTUS_URL}/items/inventory_movements`
        + `?filter[source_document_id][_eq]=${sourceDocumentId}`
        + `&filter[transaction_type_id][_eq]=${transactionTypeId}`
        + `&limit=500`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Failed to fetch source movements: ${res.status}`);
    }
    const json = await res.json();
    return json.data || [];
}

/**
 * Post inventory movements to Directus.
 * Throws on failure.
 */
export async function postMovements(
    movements: PostMovementPayload[],
): Promise<number> {
    const res = await fetch(`${DIRECTUS_URL}/items/inventory_movements`, {
        method: "POST",
        headers,
        body: JSON.stringify(movements),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Directus inventory_movements POST failed: ${res.status} - ${text}`);
    }

    const json = await res.json();
    const data = json.data || [];
    return Array.isArray(data) ? data.length : 1;
}
