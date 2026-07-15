import { NextRequest, NextResponse } from "next/server";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MovementRow {
    product_id: number;
    lot_id: number;
    batch_no: string;
    expiry_date: string | null;
    manufacturing_date: string | null;
    quantity: number;
}

export async function GET(req: NextRequest) {
    try {
        const batchId = Number(new URL(req.url).searchParams.get("batchId"));
        if (!Number.isInteger(batchId) || batchId <= 0) {
            return NextResponse.json({ message: "A valid batchId is required" }, { status: 400 });
        }

        const [conRes, detRes] = await Promise.all([
            fetch(
                `${DIRECTUS_URL}/items/consolidator?filter[id][_eq]=${batchId}&filter[is_delete][_eq]=0&fields=id,branch_id&limit=1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
            fetch(
                `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${batchId}&fields=product_id&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
        ]);

        if (!conRes.ok || !detRes.ok) {
            return NextResponse.json({ message: "Failed to load batch stock context" }, { status: 502 });
        }

        const consolidators: { id: number; branch_id: number }[] = (await conRes.json()).data || [];
        if (consolidators.length === 0) {
            return NextResponse.json({ message: "Batch not found" }, { status: 404 });
        }

        const details: { product_id: number }[] = (await detRes.json()).data || [];
        const productIds = [...new Set(details.map((detail) => Number(detail.product_id)).filter((id) => id > 0))];
        if (productIds.length === 0) {
            return NextResponse.json({ availability: [] });
        }

        const branchId = Number(consolidators[0].branch_id);
        const movRes = await fetch(
            `${DIRECTUS_URL}/items/inventory_movements`
                + `?filter[branch_id][_eq]=${branchId}`
                + `&filter[product_id][_in]=${productIds.join(",")}`
                + "&fields=product_id,lot_id,batch_no,expiry_date,manufacturing_date,quantity"
                + "&limit=-1",
            { headers: directusHeaders, cache: "no-store" }
        );

        if (!movRes.ok) {
            return NextResponse.json({ message: "Failed to load inventory availability" }, { status: 502 });
        }

        const movements: MovementRow[] = (await movRes.json()).data || [];
        const lotBalances = new Map<string, { productId: number; quantity: number }>();

        for (const movement of movements) {
            const productId = Number(movement.product_id);
            const key = [
                productId,
                movement.lot_id,
                movement.batch_no,
                movement.expiry_date || "",
                movement.manufacturing_date || "",
            ].join(":");
            const balance = lotBalances.get(key) || { productId, quantity: 0 };
            balance.quantity += Number(movement.quantity || 0);
            lotBalances.set(key, balance);
        }

        const totals = new Map<number, number>(productIds.map((productId) => [productId, 0]));
        for (const balance of lotBalances.values()) {
            if (balance.quantity > 0) {
                totals.set(balance.productId, (totals.get(balance.productId) || 0) + balance.quantity);
            }
        }

        return NextResponse.json({
            availability: productIds.map((productId) => ({
                productId,
                availableQuantity: totals.get(productId) || 0,
            })),
        });
    } catch (error) {
        console.error("validate-stock GET error:", error);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
