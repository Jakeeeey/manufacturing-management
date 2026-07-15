import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";
import {
    fetchSourceMovements,
    netMovementsZeroForSource,
    postMovements,
    type PostMovementPayload,
} from "../inventory-movements-client";
import { productLedgerMatchesQuantities, syncProductLedgerToTarget } from "../product-ledger-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserIdFromToken(): Promise<number | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        const payload = JSON.parse(json);
        return Number(payload.user_id || payload.userId || payload.sub) || null;
    } catch {
        return null;
    }
}

const TXN_TYPE_SALES_ISSUE = 4;

interface ReservedInvoiceLot {
    id: number;
    sales_invoice_detail_id: {
        detail_id: number;
        product_id: number;
    } | number;
    inventory_lot_id: {
        id: number;
        lot_id: number;
        lot_number: string | null;
        batch_no: string | null;
        expiry_date: string | null;
        created_on: string | null;
        quantity: number;
    } | number;
    quantity: number;
    status: "Reserved";
}

function relationId(value: unknown, key = "id"): number {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value) || 0;
    if (value && typeof value === "object") {
        return Number((value as Record<string, unknown>)[key]) || 0;
    }
    return 0;
}

async function reservationConsumptionMatchesMovements(batchId: number, consolidatorNo: string): Promise<boolean> {
    const invoiceLinksRes = await fetch(
        `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_eq]=${batchId}&fields=invoice_id&limit=-1`,
        { headers: directusHeaders, cache: "no-store" }
    );
    if (!invoiceLinksRes.ok) return false;
    const invoiceIds: number[] = ((await invoiceLinksRes.json()).data || [])
        .map((row: { invoice_id: number }) => Number(row.invoice_id))
        .filter(Boolean);
    if (invoiceIds.length === 0) return false;

    const detailsRes = await fetch(
        `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id&limit=-1`,
        { headers: directusHeaders, cache: "no-store" }
    );
    if (!detailsRes.ok) return false;
    const detailIds: number[] = ((await detailsRes.json()).data || [])
        .map((row: { detail_id: number }) => Number(row.detail_id))
        .filter(Boolean);
    if (detailIds.length === 0) return false;

    const reservationRes = await fetch(
        `${DIRECTUS_URL}/items/sales_invoice_reservation?filter[sales_invoice_detail_id][_in]=${detailIds.join(",")}&filter[status][_eq]=Consumed&fields=sales_invoice_detail_id.product_id,quantity&limit=-1`,
        { headers: directusHeaders, cache: "no-store" }
    );
    if (!reservationRes.ok) return false;

    const consumedByProduct = new Map<number, number>();
    for (const row of (await reservationRes.json()).data || []) {
        const detail = typeof row.sales_invoice_detail_id === "object" ? row.sales_invoice_detail_id : null;
        const productId = Number(detail?.product_id || 0);
        if (productId) {
            consumedByProduct.set(productId, (consumedByProduct.get(productId) || 0) + Number(row.quantity || 0));
        }
    }

    const movements = await fetchSourceMovements(batchId, TXN_TYPE_SALES_ISSUE);
    const movementByProduct = new Map<number, number>();
    for (const movement of movements) {
        movementByProduct.set(
            Number(movement.product_id),
            (movementByProduct.get(Number(movement.product_id)) || 0) + Number(movement.quantity || 0)
        );
    }

    const productIds = new Set([...consumedByProduct.keys(), ...movementByProduct.keys()]);
    const quantitiesMatch = productIds.size > 0 && [...productIds].every((productId) =>
        Math.abs((consumedByProduct.get(productId) || 0) - Math.max(0, -(movementByProduct.get(productId) || 0))) < 0.000001
    );
    return quantitiesMatch && await productLedgerMatchesQuantities(consolidatorNo, movementByProduct);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { batchId, action } = body;

        if (!batchId || !action) {
            return NextResponse.json({ message: "batchId and action are required" }, { status: 400 });
        }

        const userId = await getUserIdFromToken();
        if (!userId || isNaN(userId)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const getRes = await fetch(
            `${DIRECTUS_URL}/items/consolidator?filter[id][_eq]=${batchId}&filter[is_delete][_eq]=0&limit=1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!getRes.ok) {
            return NextResponse.json({ message: `Directus error (HTTP ${getRes.status})` }, { status: getRes.status });
        }

        const items = (await getRes.json()).data || [];
        if (items.length === 0) {
            return NextResponse.json({ message: "Batch not found" }, { status: 404 });
        }

        const consolidator = items[0];
        const currentStatus = consolidator.status || "Pending";

        if (action === "start") {
            if (currentStatus !== "Pending") {
                return NextResponse.json({ message: "Only Pending batches can start picking" }, { status: 400 });
            }
            const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({ status: "Picking" }),
            });
            if (!patchRes.ok) {
                return NextResponse.json({ message: `Failed to update status (HTTP ${patchRes.status})` }, { status: patchRes.status });
            }
            return NextResponse.json({ success: true, message: "Batch moved to Picking", status: "Picking" });
        }

        if (action === "complete") {
            if (currentStatus !== "Picking") {
                return NextResponse.json({ message: "Only Picking batches can be completed" }, { status: 400 });
            }

            // --- Idempotency / recovery check ---
            // netMovementsZeroForSource returns true when no movements exist
            // OR when all prior negative movements have been compensated (re-picked).
            const netZero = await netMovementsZeroForSource(batchId, TXN_TYPE_SALES_ISSUE);

            if (!netZero) {
                // Advance only when every posted movement has a matching consumed reservation.
                // Otherwise a prior attempt stopped between movement posting and lot finalization.
                if (currentStatus === "Picking" && await reservationConsumptionMatchesMovements(batchId, consolidator.consolidator_no)) {
                    const recoverRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
                        method: "PATCH",
                        headers: directusHeaders,
                        body: JSON.stringify({ status: "Picked" }),
                    });
                    if (!recoverRes.ok) {
                        return NextResponse.json({ message: "Movements posted but status recovery failed" }, { status: 502 });
                    }
                    return NextResponse.json({ success: true, message: "Batch moved to Picked (recovered)", status: "Picked" });
                }
                return NextResponse.json({
                    message: currentStatus === "Picking"
                        ? "Pick movements exist but reservation finalization is incomplete; manual recovery is required"
                        : "Outstanding movements exist — re-pick the batch first",
                }, { status: 409 });
            }

            // --- Load details ---
            const detailRes = await fetch(
                `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${batchId}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!detailRes.ok) {
                return NextResponse.json({ message: "Failed to load batch details" }, { status: 502 });
            }
            const details: { id: number; product_id: number; picked_quantity: number }[] = (await detailRes.json()).data || [];

            if (details.length === 0) {
                return NextResponse.json({ message: "Batch has no details" }, { status: 400 });
            }

            // Allocate actual picked quantities only from invoice lots reserved before consolidation.
            const branchId = Number(consolidator.branch_id);
            const productPickedMap = new Map<number, number>();
            for (const d of details) {
                const qty = Number(d.picked_quantity || 0);
                if (qty <= 0) continue;
                productPickedMap.set(d.product_id, (productPickedMap.get(d.product_id) || 0) + qty);
            }

            const invoiceLinksRes = await fetch(
                `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_eq]=${batchId}&fields=invoice_id&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!invoiceLinksRes.ok) {
                return NextResponse.json({ message: "Failed to load linked invoices" }, { status: 502 });
            }
            const invoiceIds: number[] = ((await invoiceLinksRes.json()).data || [])
                .map((row: { invoice_id: number }) => Number(row.invoice_id))
                .filter(Boolean);
            if (invoiceIds.length === 0) {
                return NextResponse.json({ message: "Batch has no linked invoices" }, { status: 400 });
            }

            const invoiceDetailsRes = await fetch(
                `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!invoiceDetailsRes.ok) {
                return NextResponse.json({ message: "Failed to load invoice details" }, { status: 502 });
            }
            const invoiceDetailIds: number[] = ((await invoiceDetailsRes.json()).data || [])
                .map((row: { detail_id: number }) => Number(row.detail_id))
                .filter(Boolean);

            const reservationRes = await fetch(
                `${DIRECTUS_URL}/items/sales_invoice_reservation?filter[sales_invoice_detail_id][_in]=${invoiceDetailIds.join(",")}&filter[status][_eq]=Reserved&fields=id,sales_invoice_detail_id.detail_id,sales_invoice_detail_id.product_id,inventory_lot_id.id,inventory_lot_id.lot_id,inventory_lot_id.lot_number,inventory_lot_id.batch_no,inventory_lot_id.expiry_date,inventory_lot_id.created_on,inventory_lot_id.quantity,quantity,status&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!reservationRes.ok) {
                return NextResponse.json({ message: "Failed to load invoice reservations" }, { status: 502 });
            }
            const reservations: ReservedInvoiceLot[] = (await reservationRes.json()).data || [];

            const reservationsByProduct = new Map<number, ReservedInvoiceLot[]>();
            for (const reservation of reservations) {
                const detail = typeof reservation.sales_invoice_detail_id === "object"
                    ? reservation.sales_invoice_detail_id
                    : null;
                const productId = Number(detail?.product_id || 0);
                if (!productId) continue;
                const rows = reservationsByProduct.get(productId) || [];
                rows.push(reservation);
                reservationsByProduct.set(productId, rows);
            }

            const consumptionByReservation = new Map<number, number>();
            for (const [productId, pickedQuantity] of productPickedMap) {
                const productReservations = (reservationsByProduct.get(productId) || []).sort((a, b) => {
                    const aLot = typeof a.inventory_lot_id === "object" ? a.inventory_lot_id : null;
                    const bLot = typeof b.inventory_lot_id === "object" ? b.inventory_lot_id : null;
                    const expiryCompare = (aLot?.expiry_date || "9999-12-31").localeCompare(bLot?.expiry_date || "9999-12-31");
                    if (expiryCompare !== 0) return expiryCompare;
                    const createdCompare = (aLot?.created_on || "9999-12-31").localeCompare(bLot?.created_on || "9999-12-31");
                    return createdCompare !== 0 ? createdCompare : a.id - b.id;
                });
                const reservedQuantity = productReservations.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
                if (reservedQuantity < pickedQuantity) {
                    return NextResponse.json({
                        message: "Reserved stock no longer covers the picked quantity",
                        productId,
                    }, { status: 422 });
                }

                let remaining = pickedQuantity;
                for (const reservation of productReservations) {
                    const consumed = Math.min(remaining, Number(reservation.quantity || 0));
                    consumptionByReservation.set(reservation.id, consumed);
                    remaining -= consumed;
                }
            }

            const movementsToPost: PostMovementPayload[] = [];
            const consumedByInventoryLot = new Map<number, number>();
            for (const reservation of reservations) {
                const consumed = consumptionByReservation.get(reservation.id) || 0;
                if (consumed <= 0) continue;
                const detail = typeof reservation.sales_invoice_detail_id === "object" ? reservation.sales_invoice_detail_id : null;
                const lot = typeof reservation.inventory_lot_id === "object" ? reservation.inventory_lot_id : null;
                const productId = Number(detail?.product_id || 0);
                const inventoryLotId = relationId(reservation.inventory_lot_id);
                const physicalLotId = Number(lot?.lot_id || 0);
                if (!productId || !inventoryLotId || !physicalLotId) {
                    return NextResponse.json({ message: `Reservation ${reservation.id} has incomplete lot data` }, { status: 422 });
                }

                movementsToPost.push({
                    product_id: productId,
                    lot_id: physicalLotId,
                    branch_id: branchId,
                    transaction_type_id: TXN_TYPE_SALES_ISSUE,
                    source_document_id: batchId,
                    source_document_no: consolidator.consolidator_no,
                    batch_no: lot?.batch_no || lot?.lot_number || "LOT-N/A",
                    expiry_date: lot?.expiry_date || null,
                    manufacturing_date: lot?.created_on ? lot.created_on.slice(0, 10) : null,
                    quantity: -Math.abs(consumed),
                    created_by: userId,
                    remarks: `Invoice consolidation reservation ${reservation.id} - ${consolidator.consolidator_no}`,
                });
                consumedByInventoryLot.set(
                    inventoryLotId,
                    (consumedByInventoryLot.get(inventoryLotId) || 0) + consumed
                );
            }

            const currentLotQuantities = new Map<number, number>();
            if (consumedByInventoryLot.size > 0) {
                const consumedLotIds = [...consumedByInventoryLot.keys()];
                const currentLotsRes = await fetch(
                    `${DIRECTUS_URL}/items/inventory_lots?filter[id][_in]=${consumedLotIds.join(",")}&fields=id,quantity&limit=-1`,
                    { headers: directusHeaders, cache: "no-store" }
                );
                if (!currentLotsRes.ok) {
                    return NextResponse.json({ message: "Failed to revalidate reserved inventory lots" }, { status: 502 });
                }
                for (const lot of (await currentLotsRes.json()).data || []) {
                    currentLotQuantities.set(Number(lot.id), Number(lot.quantity || 0));
                }
            }

            for (const [inventoryLotId, consumed] of consumedByInventoryLot) {
                if ((currentLotQuantities.get(inventoryLotId) || 0) < consumed) {
                    return NextResponse.json({ message: `Inventory lot ${inventoryLotId} changed during picking` }, { status: 409 });
                }
            }

            const ledgerTarget = new Map<number, number>();
            for (const movement of movementsToPost) {
                ledgerTarget.set(
                    movement.product_id,
                    (ledgerTarget.get(movement.product_id) || 0) + Number(movement.quantity || 0)
                );
            }
            await syncProductLedgerToTarget({
                branchId,
                documentNo: consolidator.consolidator_no,
                targetByProduct: ledgerTarget,
                description: `Invoice consolidation pick - ${consolidator.consolidator_no}`,
            });

            if (movementsToPost.length > 0) {
                const postedCount = await postMovements(movementsToPost);
                if (postedCount !== movementsToPost.length) {
                    return NextResponse.json({ message: "Partial movement post — server error" }, { status: 502 });
                }
            }

            for (const [inventoryLotId, consumed] of consumedByInventoryLot) {
                const currentQuantity = currentLotQuantities.get(inventoryLotId) || 0;
                const lotPatchRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots/${inventoryLotId}`, {
                    method: "PATCH",
                    headers: directusHeaders,
                    body: JSON.stringify({ quantity: currentQuantity - consumed }),
                });
                if (!lotPatchRes.ok) {
                    return NextResponse.json({ message: `Movements posted but inventory lot ${inventoryLotId} was not updated` }, { status: 502 });
                }
            }

            const reservationNow = new Date().toISOString();
            for (const reservation of reservations) {
                const consumed = consumptionByReservation.get(reservation.id) || 0;
                const reserved = Number(reservation.quantity || 0);
                if (consumed <= 0) {
                    // Keep unused quantities reserved until audit so re-pick can restore the full plan.
                    continue;
                }

                const consumedPatchRes = await fetch(`${DIRECTUS_URL}/items/sales_invoice_reservation/${reservation.id}`, {
                    method: "PATCH",
                    headers: directusHeaders,
                    body: JSON.stringify({ quantity: consumed, status: "Consumed", updated_by: userId, updated_at: reservationNow }),
                });
                if (!consumedPatchRes.ok) {
                    return NextResponse.json({ message: `Inventory deducted but reservation ${reservation.id} was not consumed` }, { status: 502 });
                }

                if (consumed < reserved) {
                    const remainderPayload = {
                        sales_invoice_detail_id: relationId(reservation.sales_invoice_detail_id, "detail_id"),
                        inventory_lot_id: relationId(reservation.inventory_lot_id),
                        quantity: reserved - consumed,
                        status: "Reserved",
                        created_by: userId,
                        created_at: reservationNow,
                        updated_by: userId,
                        updated_at: reservationNow,
                    };
                    await fetch(`${DIRECTUS_URL}/items/sales_invoice_reservation`, {
                        method: "POST",
                        headers: directusHeaders,
                        body: JSON.stringify(remainderPayload),
                    });
                }
            }

            // --- Advance status ---
            const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({ status: "Picked" }),
            });
            if (!patchRes.ok) {
                // Movements ARE posted — the next invocation will hit the recovery
                // branch above. Return a clear error so the UI can prompt a retry.
                return NextResponse.json({ message: "Movements posted but status update failed — retry to complete" }, { status: 502 });
            }

            return NextResponse.json({
                success: true,
                message: "Batch moved to Picked with inventory and product ledger entries",
                status: "Picked",
                movementsPosted: movementsToPost.length,
            }, { status: movementsToPost.length > 0 ? 201 : 200 });
        }

        return NextResponse.json({ message: "Action must be 'start' or 'complete'" }, { status: 400 });
    } catch (e) {
        console.error("invoice-consolidation pick POST error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { batchId, quantities } = body;

        if (!batchId || !quantities || !Array.isArray(quantities) || quantities.length === 0) {
            return NextResponse.json({ message: "batchId and quantities are required" }, { status: 400 });
        }

        const userId = await getUserIdFromToken();
        if (!userId || isNaN(userId)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const getRes = await fetch(
            `${DIRECTUS_URL}/items/consolidator?filter[id][_eq]=${batchId}&filter[is_delete][_eq]=0&limit=1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!getRes.ok) {
            return NextResponse.json({ message: `Directus error (HTTP ${getRes.status})` }, { status: getRes.status });
        }

        const items = (await getRes.json()).data || [];
        if (items.length === 0) {
            return NextResponse.json({ message: "Batch not found" }, { status: 404 });
        }

        const consolidator = items[0];

        if (consolidator.status !== "Picking") {
            return NextResponse.json({ message: "Can only update quantities for batches in Picking status" }, { status: 400 });
        }

        for (const q of quantities) {
            if (!q.detailId || typeof q.pickedQuantity !== "number" || q.pickedQuantity < 0) {
                return NextResponse.json({ message: "Each quantity must have a valid detailId and non-negative pickedQuantity" }, { status: 400 });
            }
            const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator_details/${q.detailId}`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({
                    picked_quantity: q.pickedQuantity,
                    picked_by: userId,
                    picked_at: new Date().toISOString(),
                }),
            });
            if (!patchRes.ok) {
                return NextResponse.json({ message: `Failed to update detail ${q.detailId} (HTTP ${patchRes.status})` }, { status: patchRes.status });
            }
        }

        return NextResponse.json({ success: true, message: "Quantities updated" });
    } catch (e) {
        console.error("invoice-consolidation pick PATCH error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
