import {
    LotLookup
} from "../types";

export interface RawProduct {
    product_id: number;
    product_name: string;
    product_code: string;
    unit_of_measurement?: {
        unit_shortcut?: string;
        unit_name?: string;
    } | null;
    product_type?: number | { id: number; name?: string } | null;
}

export interface RawBranch {
    id: number;
    branch_name: string;
}

export interface RawBatch {
    line_id: number;
    product_id: number;
    branch_id: number;
    lot_id: number | null;
    lot_name: string | null;
    lot_number: string | null;
    batch_no: string | null;
    expiration_date?: string | null;
    quantity_received: number;
    final_landed_unit_cost: number;
    base_unit_cost_php: number;
    qa_status: string;
    rejection_reason?: string | null;
    created_on?: string | null;
    source_reference?: string | null;
    source_type?: string | null;
    remarks?: string | null;
    transaction_type?: string | null;
}

export interface RawInventoryResponse {
    products: RawProduct[];
    batches: RawBatch[];
    branches: RawBranch[];
}

export async function fetchInventoryData(): Promise<RawInventoryResponse> {
    const res = await fetch("/api/manufacturing/inventory");
    if (!res.ok) {
        throw new Error("Failed to fetch inventory data from BFF");
    }
    return await res.json();
}

export async function fetchLotsList(): Promise<LotLookup[]> {
    const res = await fetch("/api/manufacturing/lots");
    if (!res.ok) {
        throw new Error("Failed to fetch lots for lookup from BFF");
    }
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((l: any) => ({
        lotId: l.lotId,
        lotName: l.lotName,
        inventoryTypeName: l.inventoryTypeName || "Unknown",
        maxBatchCapacity: l.maxBatchCapacity || 10
    }));
}
