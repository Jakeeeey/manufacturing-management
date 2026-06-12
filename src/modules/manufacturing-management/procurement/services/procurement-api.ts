import { Supplier, IncomingShipment, ShipmentLineItem, ShipmentExpense, RawMaterial } from "../types";

async function handleResponse(res: Response, fallbackMessage: string) {
    if (!res.ok) {
        let errMsg = fallbackMessage;
        try {
            const data = await res.json();
            if (data && data.error) errMsg = data.error;
        } catch {}
        throw new Error(errMsg);
    }
    return res.json();
}

export async function fetchSuppliers(): Promise<Supplier[]> {
    const res = await fetch("/api/manufacturing/procurement/suppliers");
    return handleResponse(res, "Failed to fetch suppliers");
}

export async function createSupplier(supplierData: Partial<Supplier>): Promise<any> {
    const res = await fetch("/api/manufacturing/procurement/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierData)
    });
    return handleResponse(res, "Failed to create supplier");
}

export async function fetchShipments(): Promise<IncomingShipment[]> {
    const res = await fetch("/api/manufacturing/procurement/shipments");
    return handleResponse(res, "Failed to fetch shipments");
}

export async function fetchShipmentLineItems(shipmentId: number): Promise<ShipmentLineItem[]> {
    const res = await fetch(`/api/manufacturing/procurement/shipments?shipmentId=${shipmentId}`);
    return handleResponse(res, "Failed to fetch shipment line items");
}

export async function createShipment(shipmentData: Partial<IncomingShipment>, lineItems: any[]): Promise<any> {
    const res = await fetch("/api/manufacturing/procurement/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentData, lineItems })
    });
    return handleResponse(res, "Failed to create shipment");
}

export async function fetchShipmentExpenses(shipmentId: number): Promise<ShipmentExpense[]> {
    const res = await fetch(`/api/manufacturing/procurement/expenses?shipmentId=${shipmentId}`);
    return handleResponse(res, "Failed to fetch shipment expenses");
}

export async function saveAndAllocateExpenses(
    shipmentId: number,
    status: string,
    expenses: Partial<ShipmentExpense>[],
    allocationMethod: string,
    lineItemUpdates?: any[]
): Promise<any> {
    const res = await fetch("/api/manufacturing/procurement/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId, status, expenses, allocationMethod, lineItemUpdates })
    });
    return handleResponse(res, "Failed to save and allocate expenses");
}

export async function fetchRawMaterials(): Promise<RawMaterial[]> {
    const res = await fetch("/api/manufacturing/finished-goods/products?limit=250");
    if (!res.ok) throw new Error("Failed to fetch raw materials");
    const products = await res.json();
    
    return products.map((p: any) => ({
        product_id: p.product_id,
        parent_id: p.parent_id ? (typeof p.parent_id === "object" ? p.parent_id.product_id : p.parent_id) : null,
        product_code: p.product_code || `SKU-${p.product_id}`,
        product_name: p.product_name,
        description: p.description || "",
        barcode: p.barcode || "",
        unit_of_measurement: p.unit_of_measurement ? {
            unit_id: p.unit_of_measurement.unit_id,
            unit_shortcut: p.unit_of_measurement.unit_shortcut,
            unit_name: p.unit_of_measurement.unit_name || p.unit_of_measurement.unit_shortcut
        } : undefined,
        cost_per_unit: Number(p.cost_per_unit || 0),
        estimated_unit_cost: Number(p.estimated_unit_cost || 0),
        density_factor: Number(p.density_factor || 1.0),
        date_added: p.date_added,
        last_updated: p.last_updated
    }));
}

export async function updateShipmentStatus(shipmentId: number, status: string): Promise<any> {
    const res = await fetch("/api/manufacturing/procurement/shipments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId, status })
    });
    return handleResponse(res, "Failed to update shipment status");
}
