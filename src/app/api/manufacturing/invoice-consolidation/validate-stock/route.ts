import { NextRequest, NextResponse } from "next/server";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";
import { getUserIdFromToken } from "../_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReservationRow {
    inventory_lot_id: {
        id: number;
        product_id: number;
        quantity: number;
    } | number;
    quantity: number;
}

export async function GET(req: NextRequest) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId || isNaN(userId)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const batchId = Number(new URL(req.url).searchParams.get("batchId"));
        if (!Number.isInteger(batchId) || batchId <= 0) {
            return NextResponse.json({ message: "A valid batchId is required" }, { status: 400 });
        }

        const [consolidatorRes, invoiceLinksRes] = await Promise.all([
            fetch(
                `${DIRECTUS_URL}/items/consolidator?filter[id][_eq]=${batchId}&filter[is_delete][_eq]=0&fields=id&limit=1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
            fetch(
                `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_eq]=${batchId}&fields=invoice_id&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
        ]);
        if (!consolidatorRes.ok || !invoiceLinksRes.ok) {
            return NextResponse.json({ message: "Failed to load batch reservation context" }, { status: 502 });
        }
        if (((await consolidatorRes.json()).data || []).length === 0) {
            return NextResponse.json({ message: "Batch not found" }, { status: 404 });
        }

        const invoiceIds: number[] = ((await invoiceLinksRes.json()).data || [])
            .map((row: { invoice_id: number }) => Number(row.invoice_id))
            .filter(Boolean);
        if (invoiceIds.length === 0) return NextResponse.json({ availability: [] });

        const detailsRes = await fetch(
            `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!detailsRes.ok) {
            return NextResponse.json({ message: "Failed to load invoice details" }, { status: 502 });
        }
        const detailIds: number[] = ((await detailsRes.json()).data || [])
            .map((row: { detail_id: number }) => Number(row.detail_id))
            .filter(Boolean);
        if (detailIds.length === 0) return NextResponse.json({ availability: [] });

        const reservationRes = await fetch(
            `${DIRECTUS_URL}/items/sales_invoice_reservation?filter[sales_invoice_detail_id][_in]=${detailIds.join(",")}&filter[status][_eq]=Reserved&fields=inventory_lot_id.id,inventory_lot_id.product_id,inventory_lot_id.quantity,quantity&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!reservationRes.ok) {
            return NextResponse.json({ message: "Failed to load reserved invoice stock" }, { status: 502 });
        }

        const reservations: ReservationRow[] = (await reservationRes.json()).data || [];
        const reservedByLot = new Map<number, { productId: number; physicalQuantity: number; reservedQuantity: number }>();
        for (const reservation of reservations) {
            const lot = typeof reservation.inventory_lot_id === "object" ? reservation.inventory_lot_id : null;
            const lotId = Number(lot?.id || reservation.inventory_lot_id || 0);
            const productId = Number(lot?.product_id || 0);
            if (!lotId || !productId) continue;
            const current = reservedByLot.get(lotId) || {
                productId,
                physicalQuantity: Number(lot?.quantity || 0),
                reservedQuantity: 0,
            };
            current.reservedQuantity += Number(reservation.quantity || 0);
            reservedByLot.set(lotId, current);
        }

        const totals = new Map<number, number>();
        for (const lot of reservedByLot.values()) {
            totals.set(
                lot.productId,
                (totals.get(lot.productId) || 0) + Math.min(lot.physicalQuantity, lot.reservedQuantity)
            );
        }

        return NextResponse.json({
            availability: [...totals].map(([productId, availableQuantity]) => ({ productId, availableQuantity })),
        });
    } catch (error) {
        console.error("validate-stock GET error:", error);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
