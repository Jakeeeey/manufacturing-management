import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { DirectusShipment } from "@/modules/manufacturing-management/procurement/types";

interface DirectusPO {
    purchase_order_id: number;
    purchase_order_no?: string;
    reference?: string;
    supplier_name?: number | Record<string, unknown> | null;
    date_received?: string | null;
    lead_time_receiving?: string | null;
    total_amount?: number | string | null;
    gross_amount?: number | string | null;
    inventory_status?: number | null;
    date_encoded?: string | null;
    branch_id?: number | null;
    payment_type?: number | null;
    price_type?: string | null;
    exchange_rate?: number | string | null;
    total_foreign_currency?: number | string | null;
    remark?: string | null;
}

interface DirectusPOProduct {
    purchase_order_product_id: number;
    purchase_order_id: number;
    product_id: number | { product_id: number };
    ordered_quantity?: number | string;
    unit_price?: number | string;
}

interface ProductMin {
    product_id: number;
    product_name?: string;
    product_code?: string;
    unit_of_measurement?: any;
    unit_of_measurement_count?: number;
    parent_id?: any;
}

interface DirectusInventoryLot {
    id: number;
    product_id: number;
    quantity: number;
    qa_status?: string;
    unit_cost?: number;
    lot_number?: string;
    expiry_date?: string;
    branch_id?: number;
}

export interface ExtendedShipmentLineItem {
    line_id?: number;
    shipment_id?: number;
    product_id: number | { product_id: number; product_name?: string; product_code?: string };
    quantity_ordered?: number;
    quantity_received?: number;
    quantity_rejected?: number;
    rejection_reason?: string;
    qa_status?: string;
    base_unit_cost_php?: number;
    allocated_expense_php?: number;
    final_landed_unit_cost?: number;
    lot_number?: string;
    expiration_date?: string;
}

interface ExtendedShipment extends Partial<DirectusShipment> {
    remark?: string;
    notes?: string;
    branch_id?: number;
}

function mapPoStatusToShipment(statusId: number | null | undefined): "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received" | "Rejected" {
    if (!statusId) return "Ordered";
    switch (statusId) {
        case 1: return "Ordered";
        case 3: return "Approved";
        case 12: return "En Route";
        case 9: return "Receiving (QA)";
        case 6: return "Received";
        case 13: return "Rejected";
        default: return "Ordered";
    }
}

function mapShipmentStatusToPo(status: string): number {
    switch (status) {
        case "Ordered": return 1;
        case "Approved": return 3;
        case "En Route": return 12;
        case "Receiving (QA)": return 9;
        case "Received": return 6;
        case "Rejected": return 13;
        default: return 1;
    }
}

export async function fetchIncomingShipments(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/purchase_order?fields=*,supplier_name.*&sort=-date_encoded&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        const poList = ((await res.json()).data || []) as DirectusPO[];

        return poList.map((po) => {
            const rate = po.exchange_rate ? Number(po.exchange_rate) : 58.00;
            const totalPhp = Number(po.total_amount || po.gross_amount || 0);
            const foreignCurrency = po.total_foreign_currency ? Number(po.total_foreign_currency) : (totalPhp / rate);

            return {
                shipment_id: po.purchase_order_id,
                reference_number: po.reference || po.purchase_order_no || "",
                purchase_order_no: po.purchase_order_no || "",
                supplier_id: po.supplier_name || 0, // Directus resolves supplier_name.* as an object, which maps to supplier_id in type
                date_received: po.date_received || null,
                lead_time_receiving: po.lead_time_receiving || null,
                total_foreign_currency: foreignCurrency,
                exchange_rate: rate,
                total_php_value: totalPhp,
                status: mapPoStatusToShipment(po.inventory_status),
                remark: po.remark || "",
                created_at: po.date_encoded || "",
                branch_id: po.branch_id || null,
                payment_type: po.payment_type || null,
                price_type: po.price_type || null
            };
        });
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch incoming shipments:", e);
        return [];
    }
}

export async function fetchShipmentLineItems(shipmentId: number): Promise<ExtendedShipmentLineItem[]> {
    try {
        // Fetch purchase_order_products
        const popUrl = `${DIRECTUS_URL}/items/purchase_order_products?filter[purchase_order_id][_eq]=${shipmentId}&fields=*,product_id.*,product_id.unit_of_measurement.*&limit=-1`;
        const popRes = await fetch(popUrl, { headers, cache: "no-store" });
        if (!popRes.ok) return [];
        const popData = (await popRes.json()).data as DirectusPOProduct[] || [];

        // Fetch inventory_lots for this procurement PO
        const filterQuery = encodeURIComponent(JSON.stringify({
            _and: [
                { source_type: { _eq: "procurement" } },
                { source_reference: { _eq: String(shipmentId) } }
            ]
        }));
        const porUrl = `${DIRECTUS_URL}/items/inventory_lots?filter=${filterQuery}&limit=-1`;
        const porRes = await fetch(porUrl, { headers, cache: "no-store" });
        const porData = (porRes.ok ? (await porRes.json()).data || [] : []) as DirectusInventoryLot[];

        // Fetch actual product details from products table as a fallback/guarantee
        const productIds = popData.map((p) => typeof p.product_id === "object" && p.product_id ? p.product_id.product_id : p.product_id).filter(Boolean);
        let products: ProductMin[] = [];
        if (productIds.length > 0) {
            const prodUrl = `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=*,unit_of_measurement.*,parent_id.unit_of_measurement.unit_shortcut&limit=-1`;
            const prodRes = await fetch(prodUrl, { headers, cache: "no-store" });
            if (prodRes.ok) {
                products = (await prodRes.json()).data as ProductMin[] || [];
            }
        }

        // Merge them
        return popData.map((pop) => {
            const rawProdId = typeof pop.product_id === "object" && pop.product_id ? pop.product_id.product_id : pop.product_id;
            const productObj = products.find((p) => Number(p.product_id) === Number(rawProdId)) || {
                product_id: Number(rawProdId) || 0,
                product_name: `Product ID: ${rawProdId}`,
                product_code: `ID-${rawProdId}`
            };
            const matchingLots = porData.filter((r) => Number(r.product_id) === Number(rawProdId));
            const totalQtyReceived = matchingLots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);
            const acceptedLot = matchingLots.find(lot => Number(lot.branch_id) !== 182);
            const activeLot = acceptedLot || matchingLots[0];

            return {
                line_id: pop.purchase_order_product_id, // map line_id to pop.purchase_order_product_id so QA receiving can update it
                shipment_id: shipmentId,
                product_id: productObj,
                quantity_ordered: Number(pop.ordered_quantity || 0),
                quantity_received: totalQtyReceived,
                quantity_rejected: 0,
                rejection_reason: "",
                qa_status: activeLot ? activeLot.qa_status || "Pending" : "Pending",
                base_unit_cost_php: Number(pop.unit_price || 0),
                allocated_expense_php: 0,
                final_landed_unit_cost: activeLot ? Number(activeLot.unit_cost || 0) : Number(pop.unit_price || 0),
                lot_number: activeLot ? activeLot.lot_number || "" : "",
                expiration_date: activeLot ? activeLot.expiry_date || "" : ""
            };
        });
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch shipment line items:", e);
        return [];
    }
}

export async function createIncomingShipment(
    shipmentData: Partial<DirectusShipment>,
    lineItems: ExtendedShipmentLineItem[],
    userId?: number | null
): Promise<unknown> {
    let poId: number | null = null;
    const createdProductIds: number[] = [];
    try {
        const totalPhp = Number(shipmentData.total_php_value || 0);
        const extendedData = shipmentData as ExtendedShipment;

        const poPayload = {
            purchase_order_no: `PO-${extendedData.reference_number || Date.now()}`,
            reference: extendedData.reference_number,
            remark: extendedData.remark || extendedData.notes || "Registered via Incoming Shipments portal.",
            supplier_name: typeof extendedData.supplier_id === "object" && extendedData.supplier_id ? (extendedData.supplier_id as Record<string, unknown>).id : extendedData.supplier_id,
            receiving_type: 1,
            payment_type: 1,
            price_type: "Internal",
            date_encoded: new Date().toISOString(),
            date: new Date().toISOString().split("T")[0],
            time: new Date().toTimeString().split(" ")[0],
            datetime: new Date().toISOString().replace("Z", "").replace("T", " "),
            gross_amount: totalPhp,
            total_amount: totalPhp,
            inventory_status: mapShipmentStatusToPo(extendedData.status || "Ordered"),
            payment_status: 1, // Pending Payment
            branch_id: extendedData.branch_id || 182,
            is_posted: 0,
            lead_time_receiving: extendedData.date_received || null,
            encoder_id: userId || null,
            exchange_rate: Number(extendedData.exchange_rate) || 58.00,
            total_foreign_currency: Number(extendedData.total_foreign_currency) || (totalPhp / (Number(extendedData.exchange_rate) || 58.00))
        };

        const res = await fetch(`${DIRECTUS_URL}/items/purchase_order`, {
            method: "POST",
            headers,
            body: JSON.stringify(poPayload)
        });

        if (!res.ok) {
            let errorMsg = `Failed to create PO header: ${res.status}`;
            try {
                const errorJson = await res.json();
                if (errorJson.errors && errorJson.errors[0]?.message) {
                    errorMsg = errorJson.errors[0].message;
                }
            } catch {}
            throw new Error(errorMsg);
        }
        const poJson = await res.json();
        poId = poJson.data.purchase_order_id;

        // Sync to purchase_order_products for this PO

        for (const item of lineItems) {
            const qty = Number(item.quantity_ordered || 0);
            const price = Number(item.base_unit_cost_php || 0);

            const popRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    purchase_order_id: poId,
                    product_id: item.product_id,
                    ordered_quantity: qty,
                    unit_price: price,
                    approved_price: price,
                    total_amount: qty * price,
                    branch_id: (shipmentData as ExtendedShipment).branch_id || 182,
                    received: 0
                })
            });

            if (!popRes.ok) {
                let errorMsg = `Failed to create PO product item: ${popRes.status}`;
                try {
                    const errorJson = await popRes.json();
                    if (errorJson.errors && errorJson.errors[0]?.message) {
                        errorMsg = errorJson.errors[0].message;
                    }
                } catch {}
                throw new Error(errorMsg);
            }
            const popJson = await popRes.json();
            createdProductIds.push(popJson.data.purchase_order_product_id);
        }

        return { success: true, shipment_id: poId };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to save purchase order. Rolling back...", e);
        for (const pid of createdProductIds) {
            await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${pid}`, { method: "DELETE", headers }).catch(() => {});
        }
        if (poId) {
            await fetch(`${DIRECTUS_URL}/items/purchase_order/${poId}`, { method: "DELETE", headers }).catch(() => {});
        }
        throw e;
    }
}

export async function updateIncomingShipmentStatus(
    shipmentId: number, 
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received",
    userId?: number | null,
    leadTimeReceiving?: string | null
) {
    try {
        if (status === "Receiving (QA)" || status === "Received") {
            const linesRes = await fetchShipmentLineItems(shipmentId);
            for (const l of linesRes) {
                const finalLandedUnitCost = Number(l.final_landed_unit_cost || l.base_unit_cost_php || 0);
                const prod = l.product_id;
                const prodId = prod && typeof prod === "object" ? prod.product_id : prod;
                if (finalLandedUnitCost > 0 && prodId) {
                    await fetch(`${DIRECTUS_URL}/items/products/${prodId}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({
                            cost_per_unit: finalLandedUnitCost,
                            estimated_unit_cost: finalLandedUnitCost
                        })
                    }).catch(err => console.error("Error updating product cost on status change:", err));
                }
            }
        }

        const updatePayload: Record<string, unknown> = {
            inventory_status: mapShipmentStatusToPo(status)
        };
        if (status === "Received" || status === "Receiving (QA)") {
            updatePayload.date_received = new Date().toISOString().split('T')[0];
            updatePayload.receiver_id = userId || null;
        }
        if (status === "Approved") {
            updatePayload.approver_id = userId || null;
            updatePayload.date_approved = new Date().toISOString();
        }
        if (leadTimeReceiving !== undefined) {
            updatePayload.lead_time_receiving = leadTimeReceiving;
        }
        const res = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(updatePayload)
        });

        if (!res.ok) throw new Error(`Failed to update purchase order status: ${res.status}`);

        return { success: true };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to update purchase order status:", e);
        throw e;
    }
}

export async function receiveIncomingShipment(
    shipmentId: number,
    branchId: number,
    lineItemUpdates: Array<{
        product_id: number;
        batch_no?: string | null;
        lot_no?: string | null;
        expiry_date?: string | null;
        received_quantity: number;
        unit_price: number;
        total_amount: number;
        qa_status?: string | null;
        quantity_rejected?: number | null;
        rejection_reason?: string | null;
    }>,
    userId?: number | null
) {
    try {
        // Insert into purchase_order_receiving table for each item
        for (const item of lineItemUpdates) {
            const porPayload = {
                purchase_order_id: shipmentId,
                product_id: item.product_id,
                batch_no: item.batch_no || null,
                lot_no: item.lot_no || null,
                expiry_date: item.expiry_date || null,
                received_quantity: item.received_quantity,
                unit_price: item.unit_price,
                discounted_amount: 0,
                total_amount: item.total_amount,
                branch_id: branchId,
                receipt_no: `REC-${shipmentId}-${Date.now()}`,
                received_date: new Date().toISOString(),
                isPosted: 1,
                qa_status: item.qa_status || "Passed",
                quantity_rejected: item.quantity_rejected || 0,
                rejection_reason: item.rejection_reason || null,
                allocated_expense_php: 0,
                final_landed_unit_cost: item.unit_price
            };

            const porRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_receiving`, {
                method: "POST",
                headers,
                body: JSON.stringify(porPayload)
            });
            if (!porRes.ok) {
                const errText = await porRes.text();
                throw new Error(`Failed to insert receiving log for product ${item.product_id}: ${errText}`);
            }
        }

        // Update purchase_order status to Received (6)
        const poPayload = {
            inventory_status: 6,
            date_received: new Date().toISOString(),
            receiver_id: userId || null
        };
        const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(poPayload)
        });
        if (!poRes.ok) {
            throw new Error(`Failed to update PO header: ${poRes.statusText}`);
        }

        return { success: true };
    } catch (e) {
        console.error("Error in receiveIncomingShipment helper:", e);
        throw e;
    }
}


