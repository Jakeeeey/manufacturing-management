import { Shipment, ShipmentLineItem, Branch } from "../types";

export async function fetchActiveShipments(): Promise<Shipment[]> {
    const res = await fetch("/api/manufacturing/procurement/shipments");
    if (!res.ok) throw new Error("Failed to load active shipments");
    return res.json();
}

export async function fetchBranches(): Promise<Branch[]> {
    const res = await fetch("/api/manufacturing/procurement/qa-receiving?action=branches");
    if (!res.ok) throw new Error("Failed to load branch list");
    return res.json();
}

export async function fetchShipmentDetails(shipmentId: number): Promise<ShipmentLineItem[]> {
    const res = await fetch(`/api/manufacturing/procurement/shipments?shipmentId=${shipmentId}`);
    if (!res.ok) throw new Error("Failed to load shipment lines");
    return res.json();
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
        quantity_rejected: number;
        lot_number: string | null;
        expiration_date: string | null;
        rejection_reason: string | null;
        qa_status: string;
    }>;
}): Promise<void> {
    const res = await fetch("/api/manufacturing/procurement/qa-receiving", {
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
export async function fetchFifoInventory(branchId: string): Promise<any[]> {
    const res = await fetch(`/api/manufacturing/procurement/qa-receiving?branchId=${branchId}`);
    if (!res.ok) throw new Error("Failed to load branch inventory ledger");
    return res.json();
}
