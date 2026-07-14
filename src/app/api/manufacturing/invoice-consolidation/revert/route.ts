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

        const invRes = await fetch(
            `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_eq]=${batchId}&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!invRes.ok) {
            return NextResponse.json({ message: "Failed to load batch invoices" }, { status: 502 });
        }
        const junctions = (await invRes.json()).data || [];

        if (junctions.length > 0) {
            const invoiceIds = junctions.map((j: { invoice_id: number }) => j.invoice_id);
            const bulkRes = await fetch(`${DIRECTUS_URL}/items/sales_invoice`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({
                    query: { filter: { invoice_id: { _in: invoiceIds } } },
                    data: { isDispatched: false },
                }),
            });
            if (!bulkRes.ok) {
                return NextResponse.json({ message: `Failed to unrevert invoices (HTTP ${bulkRes.status})` }, { status: bulkRes.status });
            }
        }

        const updateBody: Record<string, unknown> = {
            status: "Pending",
            checked_by: null,
        };
        const patchRes = await fetch(`${DIRECTUS_URL}/items/consolidator/${batchId}`, {
            method: "PATCH",
            headers: directusHeaders,
            body: JSON.stringify(updateBody),
        });
        if (!patchRes.ok) {
            return NextResponse.json({ message: `Failed to update batch status (HTTP ${patchRes.status})` }, { status: patchRes.status });
        }

        return NextResponse.json({
            success: true,
            message: "Batch reverted to Pending",
        });
    } catch (e) {
        console.error("invoice-consolidation revert POST error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
