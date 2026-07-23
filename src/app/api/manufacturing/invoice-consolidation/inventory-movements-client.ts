import { DIRECTUS_URL, headers } from "../directus-api";

export interface MovementRow {
    movement_id: number;
    product_id: number;
    version_id?: number | null;
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

export interface PostMovementPayload {
    product_id: number;
    version_id?: number | null;
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
 * Resolve the consolidator_detail IDs for a batch to dual-read movements.
 */
async function fetchDetailIdsForBatch(batchId: number): Promise<number[]> {
    const { DIRECTUS_URL, headers } = await import("../directus-api");
    const res = await fetch(
        `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${batchId}&fields=id&limit=-1`,
        { headers, cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return ((json.data || []) as { id: number }[]).map((d) => d.id).filter(Boolean);
}

/**
 * Fetch all movements for a consolidation batch by dual-reading:
 *   new: source_document_id IN (consolidator_details.id)
 *   legacy: source_document_id = batchId (header-level)
 */
export async function fetchMovementsForBatch(
    batchId: number,
    transactionTypeId: number,
): Promise<MovementRow[]> {
    const { DIRECTUS_URL, headers } = await import("../directus-api");
    const detailIds = await fetchDetailIdsForBatch(batchId);
    const allMovements: MovementRow[] = [];

    if (detailIds.length > 0) {
        const newFilter = encodeURIComponent(JSON.stringify({
            _and: [
                { source_document_id: { _in: detailIds } },
                { transaction_type_id: { _eq: transactionTypeId } },
            ],
        }));
        const newRes = await fetch(
            `${DIRECTUS_URL}/items/inventory_movements?filter=${newFilter}&limit=-1`,
            { headers, cache: "no-store" }
        );
        if (newRes.ok) {
            const json = await newRes.json();
            allMovements.push(...(json.data || []));
        }
    }

    // Legacy: movements by header ID
    const legacyFilter = encodeURIComponent(JSON.stringify({
        _and: [
            { source_document_id: { _eq: batchId } },
            { transaction_type_id: { _eq: transactionTypeId } },
        ],
    }));
    const legacyRes = await fetch(
        `${DIRECTUS_URL}/items/inventory_movements?filter=${legacyFilter}&limit=-1`,
        { headers, cache: "no-store" }
    );
    if (legacyRes.ok) {
        const json = await legacyRes.json();
        allMovements.push(...(json.data || []));
    }

    return allMovements;
}

/**
 * Total net quantity for all movements across a batch (detail + legacy).
 */
export async function netForBatch(
    batchId: number,
    transactionTypeId: number,
): Promise<number> {
    const movements = await fetchMovementsForBatch(batchId, transactionTypeId);
    return movements.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
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
