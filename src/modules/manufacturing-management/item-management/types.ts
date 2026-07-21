export interface ItemType {
    id: number;
    type_name: string;
    displayNumber?: number;
    created_by?: number | null;
    created_at?: string | null;
    updated_by?: number | null;
    updated_at?: string | null;
    created_by_name?: string;
    updated_by_name?: string;
}

export interface ItemClassification {
    id: number;
    classification_name: string;
    displayNumber?: number;
    created_by?: number | null;
    created_at?: string | null;
    updated_by?: number | null;
    updated_at?: string | null;
    created_by_name?: string;
    updated_by_name?: string;
}

export interface CatalogItem {
    id: number;
    item_name: string;
    item_type: number | ItemType | null;
    item_classification: number | ItemClassification | null;
    displayNumber?: number;
    created_by?: number | null;
    created_at?: string | null;
    updated_by?: number | null;
    updated_at?: string | null;
    created_by_name?: string;
    updated_by_name?: string;
}

export interface CreateItemPayload {
    item_name: string;
    item_type: number;
    item_classification: number;
}

export interface CreateItemTypePayload {
    name: string;
}

export interface CreateItemClassificationPayload {
    name: string;
}
