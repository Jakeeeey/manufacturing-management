// ─── Directus Response Types (snake_case at Directus boundary) ───────

export interface DirectusLot {
    lot_id: number;
    lot_name: string;
    inventory_type_id: number | { id: number; name: string } | null;
    max_batch_capacity: number;
    created_at: string;
    updated_at: string;
    created_by: number | { user_id: number; username: string } | null;
    updated_by: number | { user_id: number; username: string } | null;
}

export interface DirectusInventoryType {
    id: number;
    name: string;
}

// ─── Frontend Types (camelCase) ──────────────────────────────────────

export interface Lot {
    lotId: number;
    lotName: string;
    inventoryTypeId: number;
    inventoryTypeName: string;
    maxBatchCapacity: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
    displayNumber?: number;
}

export interface InventoryType {
    inventoryTypeId: number;
    typeName: string;
}

export interface CreateLotPayload {
    lot_name: string;
    inventory_type_id: number;
    max_batch_capacity: number;
}

export interface UpdateLotPayload {
    lot_name?: string;
    inventory_type_id?: number;
    max_batch_capacity?: number;
}
