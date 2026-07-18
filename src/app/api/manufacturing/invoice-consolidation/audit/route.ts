import { NextRequest, NextResponse } from "next/server";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";
import { fetchSourceMovements, movementsExistForSource } from "../inventory-movements-client";
import { productLedgerMatchesQuantities } from "../product-ledger-client";
import { getUserIdFromToken } from "../_auth";

const TXN_TYPE_SALES_ISSUE = 4;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { batchId } = body;
        if (!batchId) {
            return NextResponse.json({ message: "batchId is required" }, { status: 400 });
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
        if (consolidator.status === "Audited") {
            // Idempotent retry: if already audited, return success.
            return NextResponse.json({ success: true, message: "Batch is already audited" });
        }
        if (consolidator.status !== "Picked") {
            return NextResponse.json({ message: "Batch must be in Picked status before audit" }, { status: 400 });
        }

        // Verify inventory movements have been posted before allowing audit
        const hasMovements = await movementsExistForSource(batchId, TXN_TYPE_SALES_ISSUE);
        if (!hasMovements) {
            return NextResponse.json({ message: "Cannot audit: no inventory movements posted for this batch. Complete picking first." }, { status: 400 });
        }
        const movements = await fetchSourceMovements(batchId, TXN_TYPE_SALES_ISSUE);
        const movementByProduct = new Map<number, number>();
        for (const movement of movements) {
            movementByProduct.set(
                Number(movement.product_id),
                (movementByProduct.get(Number(movement.product_id)) || 0) + Number(movement.quantity || 0)
            );
        }
        if (!await productLedgerMatchesQuantities(consolidator.consolidator_no, movementByProduct)) {
            return NextResponse.json({ message: "Cannot audit: product ledger does not match inventory movements" }, { status: 409 });
        }

        const [invRes, detRes] = await Promise.all([
            fetch(
                `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_eq]=${batchId}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
            fetch(
                `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${batchId}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
        ]);

        if (!invRes.ok || !detRes.ok) {
            return NextResponse.json({ message: "Failed to load batch data" }, { status: 502 });
        }

        const junctions = (await invRes.json()).data || [];
        const details = (await detRes.json()).data || [];

        // Reconfirm full picking before audit
        const shortDetails = details.filter(
            (d: { ordered_quantity: number; picked_quantity: number }) => Number(d.picked_quantity || 0) < Number(d.ordered_quantity || 0)
        );
        if (shortDetails.length > 0) {
            const shortProductIds = shortDetails.map((d: { product_id: number }) => d.product_id);
            return NextResponse.json({
                message: `Cannot audit: products ${shortProductIds.join(", ")} are not fully picked`,
            }, { status: 422 });
        }

        // Apply picked quantities (idempotent — PATCH to final value)
        for (const d of details) {
            const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator_details/${d.id}`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({ applied_quantity: Number(d.picked_quantity || 0) }),
            });
            if (!patchRes.ok) {
                return NextResponse.json({ message: `Failed to apply quantity for detail ${d.id}` }, { status: 502 });
            }
        }

        if (junctions.length > 0) {
            const invoiceIds = junctions.map((j: { invoice_id: number }) => j.invoice_id);
            // Dispatch invoices (idempotent — if already dispatched, PATCH still succeeds)
            const bulkRes = await fetch(`${DIRECTUS_URL}/items/sales_invoice`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({
                    query: { filter: { invoice_id: { _in: invoiceIds } } },
                    data: { isDispatched: true },
                }),
            });
            if (!bulkRes.ok) {
                return NextResponse.json({ message: `Failed to dispatch invoices (HTTP ${bulkRes.status})` }, { status: bulkRes.status });
            }

            const invoiceDetailsRes = await fetch(
                `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!invoiceDetailsRes.ok) {
                return NextResponse.json({ message: "Failed to load invoice reservations for audit" }, { status: 502 });
            }
            const invoiceDetailIds: number[] = ((await invoiceDetailsRes.json()).data || [])
                .map((row: { detail_id: number }) => Number(row.detail_id))
                .filter(Boolean);
            if (invoiceDetailIds.length > 0) {
                const reservationRes = await fetch(
                    `${DIRECTUS_URL}/items/sales_invoice_reservation?filter[sales_invoice_detail_id][_in]=${invoiceDetailIds.join(",")}&filter[status][_eq]=Reserved&fields=id&limit=-1`,
                    { headers: directusHeaders, cache: "no-store" }
                );
                if (!reservationRes.ok) {
                    return NextResponse.json({ message: "Failed to load unused invoice reservations" }, { status: 502 });
                }
                const unusedReservations: { id: number }[] = (await reservationRes.json()).data || [];
                const now = new Date().toISOString();
                for (const reservation of unusedReservations) {
                    const releaseRes = await fetch(`${DIRECTUS_URL}/items/sales_invoice_reservation/${reservation.id}`, {
                        method: "PATCH",
                        headers: directusHeaders,
                        body: JSON.stringify({ status: "Released", updated_by: userId, updated_at: now }),
                    });
                    // Idempotent: 204 or 200 on already-released rows is acceptable.
                    if (!releaseRes.ok) {
                        return NextResponse.json({ message: `Failed to release reservation ${reservation.id}` }, { status: 502 });
                    }
                }
            }
        }

        const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
            method: "PATCH",
            headers: directusHeaders,
            body: JSON.stringify({ status: "Audited", checked_by: userId }),
        });
        if (!patchRes.ok) {
            return NextResponse.json({ message: `Failed to update batch status (HTTP ${patchRes.status})` }, { status: patchRes.status });
        }

        return NextResponse.json({
            success: true,
            message: "Batch audited successfully",
            checkedBy: userId,
        });
    } catch (e) {
        console.error("invoice-consolidation audit POST error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
