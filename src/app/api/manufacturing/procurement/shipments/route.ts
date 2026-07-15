import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "../_directus";
import { canTransitionInventoryStatus, INVENTORY_STATUS, shipmentStatusToInventoryStatus } from "../_domain";
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
    legacyPurchaseOrderCreateSchema,
    legacyPurchaseOrderEditSchema,
    purchaseOrderStatusUpdateSchema
} from "../../purchase-orders/_schemas";
import { calculatePurchaseOrderTotals } from "../../purchase-orders/_domain";

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
        const parsed = legacyPurchaseOrderCreateSchema.safeParse(rawBody);
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
        const { shipmentId, action } = body;

        if (!shipmentId) {
            return NextResponse.json({ error: "Missing required field (shipmentId)" }, { status: 400 });
        }

        if (action === "approve") {
            return NextResponse.json({ error: "Legacy approval is disabled. Use the revision-guarded purchase-order approval endpoint." }, { status: 410 });
        }
        if (action === "reject") {
            return NextResponse.json({ error: "Legacy rejection is disabled. Use the revision-guarded purchase-order approval endpoint." }, { status: 410 });
        }

        const parsed = purchaseOrderStatusUpdateSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: "Invalid status update.", details: parsed.error.flatten() }, { status: 400 });
        if (parsed.data.status === "Approved" || parsed.data.status === "Rejected") {
            return NextResponse.json({ error: "Approved and Rejected transitions must use their dedicated workflow endpoints." }, { status: 409 });
        }
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
        const parsed = legacyPurchaseOrderEditSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ error: "Invalid purchase-order edit.", details: parsed.error.flatten() }, { status: 400 });
        await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.procurement });
        const { shipmentId, shipmentData, lineItems } = parsed.data;

        const currentResponse = await fetch(
            `${DIRECTUS_URL}/items/purchase_order/${shipmentId}?fields=inventory_status,currency_code,exchange_rate`,
            { headers, cache: "no-store" }
        );
        if (!currentResponse.ok) throw new Error("Failed to validate the current purchase order.");
        const currentOrder = (await currentResponse.json()).data || {};
        if (Number(currentOrder.inventory_status) !== INVENTORY_STATUS.REQUESTED) {
            return NextResponse.json({ error: "Only Requested purchase orders can be edited." }, { status: 409 });
        }
        const submittedCurrency = (shipmentData as { currency_code?: string }).currency_code;
        if (submittedCurrency && submittedCurrency !== (currentOrder.currency_code || "PHP")) {
            return NextResponse.json({ error: "Currency is locked after purchase-order submission." }, { status: 409 });
        }
        if (submittedCurrency && Math.abs(Number(shipmentData.exchange_rate) - Number(currentOrder.exchange_rate)) > 0.000001) {
            return NextResponse.json({ error: "Exchange rate is locked after purchase-order submission." }, { status: 409 });
        }

        // Recompute total from the actual submitted line items (quantity_ordered is the correct field
        // from ManifestLineFormItem; shipmentData.total_php_value may be stale)
        const exchangeRate = Number(shipmentData.exchange_rate) || 1;
        const calculated = calculatePurchaseOrderTotals(lineItems.map(item => ({
            quantity: Number(item.quantity_ordered || 0),
            unitPrice: Number(item.base_unit_cost_php || 0),
            discountPercent: Number((item as { discount_percent?: number }).discount_percent || 0),
            vatPercent: Number((item as { vat_percent?: number }).vat_percent || 0),
            withholdingPercent: Number((item as { withholding_percent?: number }).withholding_percent || 0)
        })), exchangeRate);
        const totalPhp = calculated.netPhp;

        // 1. Update purchase_order header
        const poPayload = {
            reference: shipmentData.reference_number,
            remark: null, // Clear rejection remarks
            supplier_name: shipmentData.supplier_id,
            gross_amount: calculated.grossPhp,
            total_amount: totalPhp,
            inventory_status: 1, // Reset to Requested (Ordered)
            exchange_rate: exchangeRate,
            total_foreign_currency: calculated.netForeign,
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
                const deleteResponse = await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${pop.purchase_order_product_id}`, {
                    method: "DELETE",
                    headers
                });
                if (!deleteResponse.ok) throw new Error(`Failed to replace purchase-order line ${pop.purchase_order_product_id}.`);
            }
        }

        // 3. Create new purchase_order_products
        // Note: lineItems come as ManifestLineFormItem from the frontend, which uses
        // `quantity_ordered` (not `ordered_quantity`) as the field name.
        for (let index = 0; index < lineItems.length; index += 1) {
            const item = lineItems[index];
            const qty = Number((item as { quantity_ordered?: number | string }).quantity_ordered || 0);
            const price = Number(item.base_unit_cost_php || 0);
            const discountPercent = Number((item as { discount_percent?: number }).discount_percent || 0);
            const amounts = calculated.lines[index];

            const createResponse = await fetch(`${DIRECTUS_URL}/items/purchase_order_products`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    purchase_order_id: shipmentId,
                    product_id: Number(item.product_id),
                    ordered_quantity: qty,
                    unit_price: price,
                    approved_price: price,
                    discount_type: (item as { discount_type?: number | null }).discount_type || null,
                    gross_amount: amounts.grossPhp,
                    discounted_price: (amounts.grossPhp - amounts.discountPhp) / qty,
                    discounted_amount: amounts.discountPhp,
                    net_amount: amounts.netPhp,
                    total_amount: amounts.netPhp,
                    purchase_intent: (item as { purchase_intent?: string }).purchase_intent || "Buffer_Stock",
                    job_order_id: (item as { job_order_id?: number | null }).job_order_id || null,
                    unit_price_foreign: price,
                    gross_amount_foreign: amounts.grossForeign,
                    net_amount_foreign: amounts.netForeign,
                    discount_percent: discountPercent,
                    vat_percent: Number((item as { vat_percent?: number }).vat_percent || 0),
                    withholding_percent: Number((item as { withholding_percent?: number }).withholding_percent || 0)
                })
            });
            if (!createResponse.ok) throw new Error(`Failed to create replacement purchase-order line ${index + 1}.`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error updating shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update shipment" }, {
            status: e instanceof PurchaseOrderAuthorizationError ? e.status : 500
        });
    }
}
