export interface ItemType {
    id: number;
    type_name: string;
    displayNumber?: number;
}

export interface ItemClassification {
    id: number;
    classification_name: string;
    displayNumber?: number;
}

export interface CatalogItem {
    id: number;
    item_name: string;
    item_type: number | ItemType | null;
    item_classification: number | ItemClassification | null;
    displayNumber?: number;
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
