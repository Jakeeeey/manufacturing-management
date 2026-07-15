import { Shipment, ShipmentLineItem, Branch, StorageLot, QaSpecification, ReceivingQaEvaluation } from "../types";

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

export async function fetchProductQaSpecifications(productId: number, signal?: AbortSignal): Promise<QaSpecification[]> {
    const params = new URLSearchParams({ productId: String(productId) });
    const res = await fetch(`/api/manufacturing/qa/specifications?${params.toString()}`, { signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body.error || "Failed to load the product QA checklist.");
    }
    return Array.isArray(body.data) ? body.data : [];
}

export async function previewReceivingQa(payload: {
    shipmentId: number;
    receiptNumber: string;
    destinationBranchId: number;
    lines: Array<{
        lineId: number;
        productId: number;
        receivedQuantity: number;
        acceptedQuantity: number;
        rejectedQuantity: number;
        storageLotId: number | null;
        supplierBatchNumber: string;
        manufacturingDate: string | null;
        expiryDate: string | null;
        remarks: string | null;
        isPackaging: boolean;
        readings: Array<{ specId: number; actualReading: string }>;
    }>;
}, signal?: AbortSignal): Promise<ReceivingQaEvaluation[]> {
    const res = await fetch("/api/manufacturing/qa-receiving/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body.error || "Failed to generate receiving preview.");
    }
    return Array.isArray(body.data) ? body.data : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchFifoInventory(branchId: string, signal?: AbortSignal): Promise<any[]> {
    const res = await fetch(`/api/manufacturing/qa-receiving?branchId=${branchId}`, { signal });
    if (!res.ok) throw new Error("Failed to load branch inventory ledger");
    return res.json();
}
