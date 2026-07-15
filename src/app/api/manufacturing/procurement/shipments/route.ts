import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "../_directus";
import { canTransitionInventoryStatus, calculatePurchaseLineAmounts, INVENTORY_STATUS, shipmentStatusToInventoryStatus } from "../_domain";
import { 
    fetchIncomingShipments, 
    fetchShipmentLineItems, 
    createIncomingShipment,
    updateIncomingShipmentStatus
} from "./shipments-helper";
import {
    PURCHASE_ORDER_MODULE_PATHS,
    PurchaseOrderAuthorizationError,
    requirePurchaseOrderModuleAccess
} from "../../purchase-orders/_auth";
import {
    modulesForStatus,
    purchaseOrderApprovalSchema,
    purchaseOrderCreateSchema,
    purchaseOrderEditSchema,
    purchaseOrderStatusUpdateSchema
} from "../../purchase-orders/_schemas";

class InvalidTransitionError extends Error {}

async function requireAllowedTransition(shipmentId: number, targetStatus: number): Promise<void> {
    const response = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}?fields=inventory_status`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load the current purchase order status.");
    const currentStatus = Number((await response.json()).data?.inventory_status || 0);
    if (!canTransitionInventoryStatus(currentStatus, targetStatus)) {
        throw new InvalidTransitionError(`Invalid purchase order status transition from ${currentStatus} to ${targetStatus}.`);
    }
}

export async function GET(request: Request) {
    try {
        await requirePurchaseOrderModuleAccess({
            modulePaths: Object.values(PURCHASE_ORDER_MODULE_PATHS)
        });
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
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch shipments" }, {
            status: e instanceof PurchaseOrderAuthorizationError ? e.status : 500
        });
    }
}

export async function POST(request: Request) {
    try {
        const rawBody = await request.json();
        const { isReceiveLog } = rawBody;

        if (isReceiveLog) {
            return NextResponse.json(
                { error: "Direct receiving is disabled. Submit inspected receipts through the QA receiving endpoint." },
                { status: 410 }
            );
        }
        const parsed = purchaseOrderCreateSchema.safeParse(rawBody);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid purchase order.", details: parsed.error.flatten() }, { status: 400 });
        }
        const actor = await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.procurement });
        const result = await createIncomingShipment(parsed.data.shipmentData, parsed.data.lineItems, actor.userId);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error creating incoming shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create shipment" }, {
            status: e instanceof PurchaseOrderAuthorizationError ? e.status : 500
        });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, lead_time_receiving, approvedPrices, action } = body;

        if (!shipmentId) {
            return NextResponse.json({ error: "Missing required field (shipmentId)" }, { status: 400 });
        }

        if (action === "approve") {
            const parsed = purchaseOrderApprovalSchema.safeParse(body);
            if (!parsed.success) return NextResponse.json({ error: "Invalid approval request.", details: parsed.error.flatten() }, { status: 400 });
            const actor = await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.approval });
            const userId = actor.userId;
            await requireAllowedTransition(Number(shipmentId), INVENTORY_STATUS.APPROVED);
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
                const totalAmt = pop.net_amount == null
                    ? Number(price) * Number(pop.ordered_quantity || 0)
                    : Number(pop.net_amount);
                approvedTotal += totalAmt;

                if (approvedPrices && typeof approvedPrices === "object" && approvedPrices[pop.product_id] !== undefined) {
                    await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${pop.purchase_order_product_id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({
                            approved_price: Number(price)
                        })
                    });
                }
            }

            // Update PO header status to Approved (3) and ETA, plus approved/revised amount values
            const poPayload = {
                inventory_status: INVENTORY_STATUS.APPROVED,
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
            const parsed = purchaseOrderApprovalSchema.safeParse(body);
            if (!parsed.success) return NextResponse.json({ error: "Invalid rejection request.", details: parsed.error.flatten() }, { status: 400 });
            await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.approval });
            const { remarks } = body;
            if (!remarks || !remarks.trim()) {
                return NextResponse.json({ error: "Remarks/Reason for rejection is mandatory." }, { status: 400 });
            }

            await requireAllowedTransition(Number(shipmentId), INVENTORY_STATUS.CANCELLED);
            const poPayload = {
                inventory_status: INVENTORY_STATUS.CANCELLED,
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

        const parsed = purchaseOrderStatusUpdateSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "Invalid status update.", details: parsed.error.flatten() }, { status: 400 });
        const actor = await requirePurchaseOrderModuleAccess({ modulePaths: modulesForStatus(parsed.data.status) });
        await requireAllowedTransition(parsed.data.shipmentId, shipmentStatusToInventoryStatus(parsed.data.status));

        const result = await updateIncomingShipmentStatus(parsed.data.shipmentId, parsed.data.status, actor.userId, parsed.data.lead_time_receiving);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error updating shipment status:", e);
        return NextResponse.json(
            { error: (e as Error).message || "Failed to update shipment status" },
            { status: e instanceof PurchaseOrderAuthorizationError ? e.status : e instanceof InvalidTransitionError ? 409 : 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const parsed = purchaseOrderEditSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ error: "Invalid purchase-order edit.", details: parsed.error.flatten() }, { status: 400 });
        await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.procurement });
        const { shipmentId, shipmentData, lineItems } = parsed.data;

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
            const discountPercent = Number((item as { discount_percent?: number }).discount_percent || 0);
            const amounts = calculatePurchaseLineAmounts(qty, price, discountPercent);

            await fetch(`${DIRECTUS_URL}/items/purchase_order_products`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    purchase_order_id: shipmentId,
                    product_id: Number(item.product_id),
                    ordered_quantity: qty,
                    unit_price: price,
                    approved_price: price,
                    discount_type: (item as { discount_type?: number | null }).discount_type || null,
                    gross_amount: amounts.grossAmount,
                    discounted_price: amounts.discountedPrice,
                    discounted_amount: amounts.discountedAmount,
                    net_amount: amounts.netAmount,
                    total_amount: amounts.netAmount
                })
            }).catch(err => console.error("Failed to create PO product:", err));
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error updating shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update shipment" }, {
            status: e instanceof PurchaseOrderAuthorizationError ? e.status : 500
        });
    }
}
