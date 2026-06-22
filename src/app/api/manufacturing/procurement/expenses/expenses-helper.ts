import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { DirectusShipmentExpense } from "@/types/manufacturing";
import { fetchShipmentLineItems } from "../shipments/shipments-helper";

interface ExtendedProduct {
    product_id: number;
    product_name?: string;
    product_code?: string;
    weight?: number | string | null;
    product_weight?: number | string | null;
    cbm_height?: number | string | null;
    cbm_width?: number | string | null;
    cbm_length?: number | string | null;
}

interface ExtendedShipmentLineItem {
    line_id: number;
    shipment_id: number;
    product_id: ExtendedProduct;
    quantity_received: number;
    base_unit_cost_php: number;
    allocated_expense_php?: number;
    final_landed_unit_cost?: number;
}

function mapShipmentStatusToPo(status: string): number {
    switch (status) {
        case "Ordered": return 1;
        case "Approved": return 3;
        case "En Route": return 12;
        case "Receiving (QA)": return 9;
        case "Received": return 6;
        default: return 1;
    }
}

export async function fetchShipmentExpenses(shipmentId: number): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/shipment_expenses?filter[shipment_id][_eq]=${shipmentId}&fields=*,overhead_id.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch shipment expenses:", e);
        return [];
    }
}

/**
 * Allocate shipment expenses and calculate final landed unit costs
 */
export async function processShipmentLandedCosts(
    shipmentId: number,
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received",
    expenses: Array<Partial<DirectusShipmentExpense>>,
    allocationMethod: "Value" | "Weight" | "Volume",
    lineItemUpdates?: Array<{ line_id: number; quantity_received: number }>
): Promise<unknown> {
    try {
        // 0. Process any QA received quantity updates first
        if (lineItemUpdates && lineItemUpdates.length > 0) {
            for (const upd of lineItemUpdates) {
                // Find PO product to get product_id and purchase_order_id
                const popRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${upd.line_id}`, { headers });
                if (popRes.ok) {
                    const pop = (await popRes.json()).data;
                    const pId = pop.product_id;
                    const poId = pop.purchase_order_id;

                    // Check if receiving record exists in inventory_lots
                    const filterQuery = encodeURIComponent(JSON.stringify({
                        _and: [
                            { source_type: { _eq: "procurement" } },
                            { source_reference: { _eq: String(poId) } },
                            { product_id: { _eq: pId } }
                        ]
                    }));
                    const porRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${filterQuery}&limit=1`, { headers });
                    const porList = porRes.ok ? (await porRes.json()).data || [] : [];

                    if (porList.length > 0) {
                        const recId = porList[0].id;
                        await fetch(`${DIRECTUS_URL}/items/inventory_lots/${recId}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({ quantity: upd.quantity_received })
                        }).catch(err => console.error("Error updating inventory lot quantity:", err));
                    } else {
                        await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                source_type: "procurement",
                                source_reference: String(poId),
                                product_id: pId,
                                quantity: upd.quantity_received,
                                unit_cost: pop.unit_price,
                                qa_status: "Pending"
                            })
                        }).catch(err => console.error("Error creating inventory lot:", err));
                    }
                }
            }
        }

        // 1. Delete existing expenses for this shipment (linked via shipment_id field using PO ID)
        const oldExpensesRes = await fetch(`${DIRECTUS_URL}/items/shipment_expenses?filter[shipment_id][_eq]=${shipmentId}&limit=-1`, { headers });
        if (oldExpensesRes.ok) {
            const oldExpenses = (await oldExpensesRes.json()).data || [];
            for (const exp of oldExpenses) {
                await fetch(`${DIRECTUS_URL}/items/shipment_expenses/${exp.expense_id}`, { method: "DELETE", headers }).catch(() => {});
            }
        }

        // 2. Save new expenses and sum up PHP total
        let totalExpensesPhp = 0;
        for (const exp of expenses) {
            const resExp = await fetch(`${DIRECTUS_URL}/items/shipment_expenses`, {
                method: "POST",
                headers,
                body: JSON.stringify({ ...exp, shipment_id: shipmentId, allocation_method: allocationMethod })
            });
            if (resExp.ok) {
                const data = (await resExp.json()).data;
                totalExpensesPhp += Number(data.amount_php || 0);
            }
        }

        // 3. Fetch shipment line items using our helper
        const lines = await fetchShipmentLineItems(shipmentId);

        if (lines.length === 0) {
            // No lines, just update status
            await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ inventory_status: mapShipmentStatusToPo(status) })
            });
            return { success: true };
        }

        // 4. Calculate total base values for allocation
        let totalWeight = 0;
        let totalVolume = 0;
        let totalCommercialValuePhp = 0;

        (lines as ExtendedShipmentLineItem[]).forEach((l) => {
            const qty = Number(l.quantity_received) || 0;
            const price = Number(l.base_unit_cost_php) || 0;
            totalCommercialValuePhp += qty * price;

            const prod = l.product_id;
            const weight = Number(prod?.weight || prod?.product_weight || 0);
            totalWeight += qty * weight;

            const height = Number(prod?.cbm_height || 0);
            const width = Number(prod?.cbm_width || 0);
            const length = Number(prod?.cbm_length || 0);
            totalVolume += qty * (height * width * length);
        });

        // 5. Allocate expenses and update inventory_lots
        for (const l of lines as ExtendedShipmentLineItem[]) {
            const qty = Number(l.quantity_received) || 1;
            const price = Number(l.base_unit_cost_php) || 0;
            const lineValuePhp = qty * price;

            let ratio = 0;
            if (allocationMethod === "Weight" && totalWeight > 0) {
                const prod = l.product_id;
                const weight = Number(prod?.weight || prod?.product_weight || 0);
                ratio = (qty * weight) / totalWeight;
            } else if (allocationMethod === "Volume" && totalVolume > 0) {
                const prod = l.product_id;
                const height = Number(prod?.cbm_height || 0);
                const width = Number(prod?.cbm_width || 0);
                const length = Number(prod?.cbm_length || 0);
                ratio = (qty * (height * width * length)) / totalVolume;
            } else {
                // Default: Commercial Value
                if (totalCommercialValuePhp > 0) {
                    ratio = lineValuePhp / totalCommercialValuePhp;
                } else {
                    ratio = 1 / lines.length;
                }
            }

            const allocatedExpense = ratio * totalExpensesPhp;
            const finalLandedUnitCost = price + (qty > 0 ? (allocatedExpense / qty) : 0);

            // Find or create inventory lot to store allocated cost
            const pId = l.product_id?.product_id || l.product_id;
            const filterQuery = encodeURIComponent(JSON.stringify({
                _and: [
                    { source_type: { _eq: "procurement" } },
                    { source_reference: { _eq: String(shipmentId) } },
                    { product_id: { _eq: pId } }
                ]
            }));
            const porRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${filterQuery}&limit=1`, { headers });
            const porList = porRes.ok ? (await porRes.json()).data || [] : [];
            
            const allocationPayload = {
                unit_cost: finalLandedUnitCost
            };

            if (porList.length > 0) {
                const recId = porList[0].id;
                await fetch(`${DIRECTUS_URL}/items/inventory_lots/${recId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(allocationPayload)
                });
            } else {
                await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        ...allocationPayload,
                        source_type: "procurement",
                        source_reference: String(shipmentId),
                        product_id: pId,
                        quantity: qty,
                        qa_status: "Pending"
                    })
                });
            }

            // If shipment is received, update product table cost_per_unit & estimated_unit_cost
            if (status === "Received" || status === "Receiving (QA)") {
                await fetch(`${DIRECTUS_URL}/items/products/${pId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        cost_per_unit: finalLandedUnitCost,
                        estimated_unit_cost: finalLandedUnitCost
                    })
                });
            }
        }

        // 6. Update Purchase Order Header Status
        const updatePayload: Record<string, unknown> = {
            inventory_status: mapShipmentStatusToPo(status)
        };
        if (status === "Received" || status === "Receiving (QA)") {
            updatePayload.date_received = new Date().toISOString().split('T')[0];
        }
        await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(updatePayload)
        });

        return { success: true };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to allocate expenses:", e);
        return { success: false, error: (e as Error).message };
    }
}


