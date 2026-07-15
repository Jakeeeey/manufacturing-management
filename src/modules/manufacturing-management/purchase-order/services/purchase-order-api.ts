import type { IncomingShipment, ShipmentLineItem } from "../../procurement/types";
import type { PurchaseOrderListQuery, PurchaseOrderListResponse } from "../types";

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || fallback);
    }
    return response.json();
}

export async function fetchPurchaseOrders(query: PurchaseOrderListQuery = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const response = await fetch(`/api/manufacturing/purchase-orders?${params.toString()}`, { signal });
    return responseJson<PurchaseOrderListResponse<IncomingShipment>>(response, "Failed to load purchase orders.");
}

export async function fetchPurchaseOrderLines(id: number, signal?: AbortSignal) {
    const response = await fetch(`/api/manufacturing/purchase-orders/${id}`, { signal });
    const body = await responseJson<{ data: ShipmentLineItem[] }>(response, "Failed to load purchase-order lines.");
    return body.data;
}

export async function createPurchaseOrder(shipmentData: unknown, lineItems: unknown[]) {
    const response = await fetch("/api/manufacturing/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentData, lineItems })
    });
    return responseJson(response, "Failed to create purchase order.");
}

export async function editPurchaseOrder(id: number, shipmentData: unknown, lineItems: unknown[]) {
    const response = await fetch(`/api/manufacturing/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentData, lineItems })
    });
    return responseJson(response, "Failed to edit purchase order.");
}

export async function updatePurchaseOrderStatus(id: number, status: string) {
    const response = await fetch(`/api/manufacturing/purchase-orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
    return responseJson(response, "Failed to update purchase-order status.");
}

export async function submitPurchaseOrderApproval(id: number, payload: Record<string, unknown>) {
    const response = await fetch(`/api/manufacturing/purchase-orders/${id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return responseJson(response, "Failed to submit purchase-order approval.");
}
