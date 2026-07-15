import { Shipment, ShipmentLineItem, Branch, StorageLot } from "../types";

export async function fetchActiveShipments(filters: {
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    includeReceived?: boolean;
} = {}, signal?: AbortSignal): Promise<Shipment[]> {
    const params = new URLSearchParams({
        limit: "100",
        queue: "receiving",
        includeReceived: String(Boolean(filters.includeReceived))
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    const res = await fetch(`/api/manufacturing/purchase-orders?${params.toString()}`, { signal });
    if (!res.ok) throw new Error("Failed to load active shipments");
    const body = await res.json();
    return body.data || [];
}

export async function fetchBranches(signal?: AbortSignal): Promise<Branch[]> {
    const res = await fetch("/api/manufacturing/qa-receiving?action=branches", { signal });
    if (!res.ok) throw new Error("Failed to load branch list");
    return res.json();
}

export async function fetchStorageLots(signal?: AbortSignal): Promise<StorageLot[]> {
    const res = await fetch("/api/manufacturing/qa-receiving?action=lots", { signal });
    if (!res.ok) throw new Error("Failed to load storage lots");
    return res.json();
}

export async function fetchShipmentDetails(shipmentId: number, signal?: AbortSignal): Promise<ShipmentLineItem[]> {
    const res = await fetch(`/api/manufacturing/purchase-orders/${shipmentId}`, { signal });
    if (!res.ok) throw new Error("Failed to load shipment lines");
    const body = await res.json();
    return body.data || [];
}

export async function submitInspection(payload: {
    shipmentId: number;
    referenceNumber: string;
    branchId: number;
    branchName: string;
    lineItemUpdates: Array<{
        line_id: number;
        product_id: number;
        quantity_received: number;
        quantity_accepted: number;
        quantity_rejected: number;
        batch_no: string;
        lot_id: number;
        expiration_date: string | null;
        rejection_reason: string | null;
        qa_status: string;
    }>;
}): Promise<void> {
    const res = await fetch("/api/manufacturing/qa-receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to submit inspection details.");
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchFifoInventory(branchId: string, signal?: AbortSignal): Promise<any[]> {
    const res = await fetch(`/api/manufacturing/qa-receiving?branchId=${branchId}`, { signal });
    if (!res.ok) throw new Error("Failed to load branch inventory ledger");
    return res.json();
}
