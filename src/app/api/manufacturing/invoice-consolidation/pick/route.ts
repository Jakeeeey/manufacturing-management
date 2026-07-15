import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";
import {
    netMovementsZeroForSource,
    fetchAvailableStock,
    fefoAllocate,
    postMovements,
    type PostMovementPayload,
} from "../inventory-movements-client";

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
                // Outstanding negative movements exist that haven't been compensated.
                if (currentStatus === "Picking") {
                    // Prior POST succeeded but PATCH to "Picked" failed.
                    // Recover by advancing status.
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
                // Status is Picked or Audited — cannot re-post without re-pick.
                return NextResponse.json({ message: "Outstanding movements exist — re-pick the batch first" }, { status: 409 });
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

            // --- FEFO allocate & build movement payloads ---
            const movementsToPost: PostMovementPayload[] = [];
            const branchId = Number(consolidator.branch_id);

            for (const detail of details) {
                const pickedQty = Number(detail.picked_quantity || 0);
                if (pickedQty <= 0) continue;

                const availableStock = await fetchAvailableStock(detail.product_id, branchId);
                const { allocations, shortfall } = fefoAllocate(pickedQty, availableStock);

                if (shortfall > 0) {
                    return NextResponse.json({
                        message: "Insufficient stock to cover picked quantity",
                        productId: detail.product_id,
                        required: pickedQty,
                        available: pickedQty - shortfall,
                        shortfall,
                    }, { status: 422 });
                }

                for (const alloc of allocations) {
                    movementsToPost.push({
                        product_id: detail.product_id,
                        lot_id: alloc.lot_id,
                        branch_id: branchId,
                        transaction_type_id: TXN_TYPE_SALES_ISSUE,
                        source_document_id: batchId,
                        source_document_no: consolidator.consolidator_no,
                        batch_no: alloc.batch_no,
                        expiry_date: alloc.expiry_date,
                        manufacturing_date: alloc.manufacturing_date,
                        quantity: -Math.abs(alloc.quantity),
                        created_by: userId,
                        remarks: `Invoice consolidation pick - ${consolidator.consolidator_no}`,
                    });
                }
            }

            if (movementsToPost.length > 0) {
                const postedCount = await postMovements(movementsToPost);
                if (postedCount !== movementsToPost.length) {
                    return NextResponse.json({ message: "Partial movement post — server error" }, { status: 502 });
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
                message: "Batch moved to Picked with inventory movements",
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
