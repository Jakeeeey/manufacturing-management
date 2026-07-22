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

export interface InventoryMovementQuantityRow {
    lot_id: number | string | null;
    quantity: number | string | null;
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

/**
 * Check if movements already exist for this source document and type.
 * Used for idempotency before posting.
 * Throws on network/API failure — callers must handle.
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
    if (!res.ok) throw new Error(`Failed to check movements for source ${sourceDocumentId}: ${res.status}`);
    const json = await res.json();
    const data: unknown[] = json.data || [];
    return data.length > 0;
}

/**
 * Check if net movement quantity for this source and type is zero.
 * Returns true when all negative movements have been compensated (re-picked).
 * Throws on network/API failure.
 */
export async function netMovementsZeroForSource(
    sourceDocumentId: number,
    transactionTypeId: number,
): Promise<boolean> {
    const url = `${DIRECTUS_URL}/items/inventory_movements`
        + `?filter[source_document_id][_eq]=${sourceDocumentId}`
        + `&filter[transaction_type_id][_eq]=${transactionTypeId}`
        + `&limit=-1`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch movements for source ${sourceDocumentId}: ${res.status}`);
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
 * Throws on network/API failure.
 */
export async function fetchSourceMovements(
    sourceDocumentId: number,
    transactionTypeId: number,
): Promise<MovementRow[]> {
    const url = `${DIRECTUS_URL}/items/inventory_movements`
        + `?filter[source_document_id][_eq]=${sourceDocumentId}`
        + `&filter[transaction_type_id][_eq]=${transactionTypeId}`
        + `&limit=-1`;

    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch source movements: ${res.status}`);
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
