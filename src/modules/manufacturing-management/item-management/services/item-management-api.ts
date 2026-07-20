import {
    CatalogItem,
    ItemType,
    ItemClassification,
    CreateItemPayload,
    CreateItemTypePayload,
    CreateItemClassificationPayload
} from "../types";

export async function fetchItems(): Promise<CatalogItem[]> {
    const res = await fetch("/api/manufacturing/item-management/items");
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch catalog items");
    }
    return await res.json();
}

export async function createItem(payload: CreateItemPayload): Promise<{ success: boolean; item: CatalogItem }> {
    const res = await fetch("/api/manufacturing/item-management/items", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to create catalog item");
    }
    return await res.json();
}

export async function fetchItemTypes(): Promise<ItemType[]> {
    const res = await fetch("/api/manufacturing/item-management/item-types");
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch item types");
    }
    return await res.json();
}

export async function createItemType(payload: CreateItemTypePayload): Promise<{ success: boolean; type: ItemType }> {
    const res = await fetch("/api/manufacturing/item-management/item-types", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to create item type");
    }
    return await res.json();
}

export async function fetchItemClassifications(): Promise<ItemClassification[]> {
    const res = await fetch("/api/manufacturing/item-management/item-classifications");
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to fetch item classifications");
    }
    return await res.json();
}

export async function createItemClassification(
    payload: CreateItemClassificationPayload
): Promise<{ success: boolean; classification: ItemClassification }> {
    const res = await fetch("/api/manufacturing/item-management/item-classifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to create item classification");
    }
    return await res.json();
}

export async function updateItem(
    id: number,
    payload: CreateItemPayload
): Promise<{ success: boolean; item: CatalogItem }> {
    const res = await fetch("/api/manufacturing/item-management/items", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, ...payload })
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update catalog item");
    }
    return await res.json();
}

export async function updateItemType(
    id: number,
    payload: CreateItemTypePayload
): Promise<{ success: boolean; type: ItemType }> {
    const res = await fetch("/api/manufacturing/item-management/item-types", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, ...payload })
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update item type");
    }
    return await res.json();
}

export async function updateItemClassification(
    id: number,
    payload: CreateItemClassificationPayload
): Promise<{ success: boolean; classification: ItemClassification }> {
    const res = await fetch("/api/manufacturing/item-management/item-classifications", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, ...payload })
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update item classification");
    }
    return await res.json();
}
