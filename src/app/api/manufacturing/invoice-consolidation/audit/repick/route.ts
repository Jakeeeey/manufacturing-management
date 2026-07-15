import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers as directusHeaders } from "../../../directus-api";
import { fetchSourceMovements, postMovements, type PostMovementPayload } from "../../inventory-movements-client";

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

        // Only Picked batches can be re-picked; Audited is terminal.
        if (consolidator.status !== "Picked") {
            return NextResponse.json({ message: "Only Picked batches can be re-picked" }, { status: 400 });
        }

        // Fetch all sales-issue movements for this source document
        const movements = await fetchSourceMovements(batchId, TXN_TYPE_SALES_ISSUE);

        // Build compensating movements: flip the sign of every negative movement
        const compensations: PostMovementPayload[] = [];
        let compensatedCount = 0;

        for (const m of movements) {
            const qty = Number(m.quantity || 0);
            if (qty >= 0) continue; // only compensate negative (deduction) lines

            compensations.push({
                product_id: m.product_id,
                lot_id: m.lot_id,
                branch_id: m.branch_id,
                transaction_type_id: TXN_TYPE_SALES_ISSUE,
                source_document_id: batchId,
                source_document_no: consolidator.consolidator_no,
                batch_no: m.batch_no,
                expiry_date: m.expiry_date,
                manufacturing_date: m.manufacturing_date,
                quantity: Math.abs(qty), // positive = add back to stock
                created_by: userId,
                remarks: `Re-pick reversal - ${consolidator.consolidator_no}`,
            });
            compensatedCount++;
        }

        if (compensations.length === 0) {
            // No negative movements found — batch may have been picked with zero quantities
            // or net is already zero. Proceed with clearing details and reverting status.
            console.warn(`Re-pick ${batchId}: no negative movements to compensate — clearing picking data only`);
        } else {
            // Post compensating movements
            await postMovements(compensations);
        }

        // Clear picked quantities on all details
        const detRes = await fetch(
            `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${batchId}&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (detRes.ok) {
            const details: { id: number }[] = (await detRes.json()).data || [];
            for (const d of details) {
                await fetch(`${DIRECTUS_URL}/items/consolidator_details/${d.id}`, {
                    method: "PATCH",
                    headers: directusHeaders,
                    body: JSON.stringify({
                        picked_quantity: 0,
                        picked_by: null,
                        picked_at: null,
                        applied_quantity: 0,
                    }),
                }).catch(() => {});
            }
        }

        // Revert status to Picking
        const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
            method: "PATCH",
            headers: directusHeaders,
            body: JSON.stringify({
                status: "Picking",
                checked_by: null,
            }),
        });

        if (!patchRes.ok) {
            return NextResponse.json({ message: "Status revert failed" }, { status: 502 });
        }

        const msg = compensatedCount > 0
            ? `Batch reverted to Picking (${compensatedCount} movement(s) compensated)`
            : "Batch reverted to Picking (no movements to compensate)";

        return NextResponse.json({ success: true, message: msg, compensatedCount });
    } catch (e) {
        console.error("invoice-consolidation repick POST error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
