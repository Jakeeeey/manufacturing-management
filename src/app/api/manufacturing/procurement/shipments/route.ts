import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { 
    fetchIncomingShipments, 
    fetchShipmentLineItems, 
    createIncomingShipment,
    updateIncomingShipmentStatus,
    receiveIncomingShipment
} from "./shipments-helper";

async function getUserIdFromSession(): Promise<number | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        if (token) {
            const parts = token.split(".");
            if (parts.length >= 2) {
                const base64Url = parts[1];
                let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                while (base64.length % 4) base64 += "=";
                const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
                const payload = JSON.parse(jsonPayload);
                const rawId = payload?.id || payload?.user_id || payload?.sub;
                if (rawId) {
                    const parsed = Number(rawId);
                    if (!isNaN(parsed)) return parsed;
                }
            }
        }
    } catch (e) {
        console.error("Failed to extract userId from session token:", e);
    }
    return null;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const shipmentId = searchParams.get("shipmentId");

        if (shipmentId) {
            const lineItems = await fetchShipmentLineItems(parseInt(shipmentId));
            return NextResponse.json(lineItems);
        }

        const shipments = await fetchIncomingShipments();
        return NextResponse.json(shipments);
    } catch (e) {
        console.error("API Error fetching shipments:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch shipments" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shipmentData, lineItems, isReceiveLog, branchId } = body;

        const userId = await getUserIdFromSession();

        if (isReceiveLog) {
            if (!shipmentData || !shipmentData.shipment_id || !branchId || !lineItems) {
                return NextResponse.json({ error: "Missing required fields for receive transaction" }, { status: 400 });
            }
            const result = await receiveIncomingShipment(shipmentData.shipment_id, branchId, lineItems, userId);
            return NextResponse.json(result);
        }

        if (!shipmentData || !shipmentData.reference_number || !shipmentData.supplier_id || !lineItems) {
            return NextResponse.json({ error: "Missing required fields (reference_number, supplier_id, lineItems)" }, { status: 400 });
        }

        const result = await createIncomingShipment(shipmentData, lineItems, userId);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error creating incoming shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create shipment" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, status, lead_time_receiving, approvedPrices, action } = body;

        if (!shipmentId) {
            return NextResponse.json({ error: "Missing required field (shipmentId)" }, { status: 400 });
        }

        const userId = await getUserIdFromSession();

        if (action === "approve") {
            let approvedTotal = 0;
            const popRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products?filter[purchase_order_id][_eq]=${shipmentId}&limit=-1`, { headers });
            const pops = (await popRes.json()).data || [];
            
            for (const pop of pops) {
                let price = pop.approved_price || pop.unit_price || 0;
                if (approvedPrices && typeof approvedPrices === "object" && approvedPrices[pop.product_id] !== undefined) {
                    const submittedPrice = Number(approvedPrices[pop.product_id]);
                    const originalPrice = Number(pop.approved_price || pop.unit_price || 0);
                    if (Math.abs(submittedPrice - originalPrice) > 0.0001) {
                        return NextResponse.json({ error: "Modifications to PO items or prices are not allowed during the approval cycle. Please Reject and edit instead." }, { status: 400 });
                    }
                    price = approvedPrices[pop.product_id];
                }
                const totalAmt = Number(price) * Number(pop.ordered_quantity || 0);
                approvedTotal += totalAmt;

                if (approvedPrices && typeof approvedPrices === "object" && approvedPrices[pop.product_id] !== undefined) {
                    await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${pop.purchase_order_product_id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({
                            approved_price: Number(price),
                            total_amount: totalAmt
                        })
                    });
                }
            }

            // Update PO header status to Approved (3) and ETA, plus approved/revised amount values
            const poPayload = {
                inventory_status: 3,
                lead_time_receiving: lead_time_receiving || null,
                approver_id: userId || null,
                date_approved: new Date().toISOString(),
                approved_amount: approvedTotal,
                revised_amount: approvedTotal,
                total_amount: approvedTotal,
                gross_amount: approvedTotal
            };
            const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(poPayload)
            });
            if (!poRes.ok) throw new Error("Failed to update PO status to Approved");

            return NextResponse.json({ success: true });
        }
        if (action === "reject") {
            const { remarks } = body;
            if (!remarks || !remarks.trim()) {
                return NextResponse.json({ error: "Remarks/Reason for rejection is mandatory." }, { status: 400 });
            }

            // Set PO status back to 13 (Rejected) and update comment
            const poPayload = {
                inventory_status: 13, // Status 13 for Rejected
                approver_id: null,
                date_approved: null,
                remark: `REJECTED: ${remarks}`
            };
            const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(poPayload)
            });
            if (!poRes.ok) throw new Error("Failed to reject PO");

            return NextResponse.json({ success: true });
        }

        if (!status) {
            return NextResponse.json({ error: "Missing status for standard update" }, { status: 400 });
        }

        const result = await updateIncomingShipmentStatus(parseInt(shipmentId), status, userId, lead_time_receiving);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error updating shipment status:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update shipment status" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, shipmentData, lineItems } = body;

        if (!shipmentId) {
            return NextResponse.json({ error: "Missing shipmentId" }, { status: 400 });
        }

        // Recompute total from the actual submitted line items (quantity_ordered is the correct field
        // from ManifestLineFormItem; shipmentData.total_php_value may be stale)
        const recomputedTotalPhp = (lineItems as Array<{ quantity_ordered?: number | string; base_unit_cost_php?: number | string }>).reduce((sum, item) => {
            const qty = Number(item.quantity_ordered || 0);
            const price = Number(item.base_unit_cost_php || 0);
            return sum + qty * price;
        }, 0);
        const totalPhp = recomputedTotalPhp || Number(shipmentData.total_php_value || 0);
        const exchangeRate = Number(shipmentData.exchange_rate) || 58.00;

        // 1. Update purchase_order header
        const poPayload = {
            reference: shipmentData.reference_number,
            remark: null, // Clear rejection remarks
            supplier_name: shipmentData.supplier_id,
            gross_amount: totalPhp,
            total_amount: totalPhp,
            inventory_status: 1, // Reset to Requested (Ordered)
            exchange_rate: exchangeRate,
            total_foreign_currency: totalPhp / exchangeRate,
            date_received: shipmentData.date_received || null,
            lead_time_receiving: null,
            approver_id: null,
            date_approved: null
        };

        const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(poPayload)
        });

        if (!poRes.ok) {
            throw new Error(`Failed to update PO header: ${poRes.status}`);
        }

        // 2. Delete old purchase_order_products
        const oldPopsRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products?filter[purchase_order_id][_eq]=${shipmentId}&limit=-1`, { headers });
        if (oldPopsRes.ok) {
            const oldPops = (await oldPopsRes.json()).data || [];
            for (const pop of oldPops) {
                await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${pop.purchase_order_product_id}`, {
                    method: "DELETE",
                    headers
                }).catch(err => console.error("Failed to delete PO product:", err));
            }
        }

        // 3. Create new purchase_order_products
        // Note: lineItems come as ManifestLineFormItem from the frontend, which uses
        // `quantity_ordered` (not `ordered_quantity`) as the field name.
        for (const item of lineItems) {
            const qty = Number((item as { quantity_ordered?: number | string }).quantity_ordered || 0);
            const price = Number(item.base_unit_cost_php || 0);

            await fetch(`${DIRECTUS_URL}/items/purchase_order_products`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    purchase_order_id: shipmentId,
                    product_id: Number(item.product_id),
                    ordered_quantity: qty,
                    unit_price: price,
                    approved_price: price,
                    total_amount: qty * price
                })
            }).catch(err => console.error("Failed to create PO product:", err));
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error updating shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update shipment" }, { status: 500 });
    }
}
