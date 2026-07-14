import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";

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
        let nextStatus: string | null = null;

        if (action === "start") {
            if (currentStatus !== "Pending") {
                return NextResponse.json({ message: "Only Pending batches can start picking" }, { status: 400 });
            }
            nextStatus = "Picking";
        } else if (action === "complete") {
            if (currentStatus !== "Picking") {
                return NextResponse.json({ message: "Only Picking batches can be completed" }, { status: 400 });
            }
            nextStatus = "Picked";
        } else {
            return NextResponse.json({ message: "Action must be 'start' or 'complete'" }, { status: 400 });
        }

        const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
            method: "PATCH",
            headers: directusHeaders,
            body: JSON.stringify({ status: nextStatus }),
        });
        if (!patchRes.ok) {
            return NextResponse.json({ message: `Failed to update status (HTTP ${patchRes.status})` }, { status: patchRes.status });
        }

        return NextResponse.json({
            success: true,
            message: `Batch moved to ${nextStatus}`,
            status: nextStatus,
        });
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
