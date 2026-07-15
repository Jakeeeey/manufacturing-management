import { NextRequest, NextResponse } from "next/server";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";
import { MovementRow } from "../inventory-movements-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TXN_TYPE_SALES_ISSUE = 4;

export interface LotAllocationDetail {
    productId: number;
    productName: string;
    lotId: number;
    lotName: string;
    batchNo: string;
    expiryDate: string | null;
    manufacturingDate: string | null;
    quantity: number;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const batchId = searchParams.get("batchId");

        if (!batchId) {
            return NextResponse.json({ message: "batchId is required" }, { status: 400 });
        }

        // Fetch movements for this source document
        const movRes = await fetch(
            `${DIRECTUS_URL}/items/inventory_movements`
            + `?filter[source_document_id][_eq]=${batchId}`
            + `&filter[transaction_type_id][_eq]=${TXN_TYPE_SALES_ISSUE}`
            + `&limit=500`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!movRes.ok) {
            return NextResponse.json({ message: "Failed to load movements" }, { status: 502 });
        }

        const movements: MovementRow[] = (await movRes.json()).data || [];

        // Net by (product_id, lot_id, batch_no, expiry_date, manufacturing_date)
        const netMap = new Map<string, { productId: number; lotId: number; batchNo: string; expiryDate: string | null; manufacturingDate: string | null; netQty: number }>();

        for (const m of movements) {
            const key = `${m.product_id}:${m.lot_id}:${m.batch_no}:${m.expiry_date || ""}:${m.manufacturing_date || ""}`;
            const existing = netMap.get(key);
            const qty = Number(m.quantity || 0);
            if (existing) {
                existing.netQty += qty;
            } else {
                netMap.set(key, {
                    productId: m.product_id,
                    lotId: m.lot_id,
                    batchNo: m.batch_no,
                    expiryDate: m.expiry_date,
                    manufacturingDate: m.manufacturing_date,
                    netQty: qty,
                });
            }
        }

        // Filter to only net-negative = outstanding deductions
        const netNegative: { productId: number; lotId: number; batchNo: string; expiryDate: string | null; manufacturingDate: string | null; netQty: number }[] = [];
        for (const entry of netMap.values()) {
            if (entry.netQty < 0) {
                netNegative.push({ ...entry, netQty: Math.abs(entry.netQty) });
            }
        }

        if (netNegative.length === 0) {
            return NextResponse.json({ allocations: [] });
        }

        // Resolve product names
        const productIds = [...new Set(netNegative.map((a) => a.productId))];
        const prodRes = await fetch(
            `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=product_id,product_name&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        const productNameMap = new Map<number, string>();
        if (prodRes.ok) {
            const prodData: { product_id: number; product_name: string }[] = (await prodRes.json()).data || [];
            for (const p of prodData) productNameMap.set(p.product_id, p.product_name);
        }

        // Resolve lot names
        const lotIds = [...new Set(netNegative.map((a) => a.lotId))];
        const lotRes = await fetch(
            `${DIRECTUS_URL}/items/lots?filter[lot_id][_in]=${lotIds.join(",")}&fields=lot_id,lot_name&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        const lotNameMap = new Map<number, string>();
        if (lotRes.ok) {
            const lotData: { lot_id: number; lot_name: string }[] = (await lotRes.json()).data || [];
            for (const l of lotData) lotNameMap.set(l.lot_id, l.lot_name);
        }

        const allocations: LotAllocationDetail[] = netNegative.map((a) => ({
            productId: a.productId,
            productName: productNameMap.get(a.productId) || `Product #${a.productId}`,
            lotId: a.lotId,
            lotName: lotNameMap.get(a.lotId) || `Lot #${a.lotId}`,
            batchNo: a.batchNo,
            expiryDate: a.expiryDate,
            manufacturingDate: a.manufacturingDate,
            quantity: a.netQty,
        }));

        return NextResponse.json({ allocations });
    } catch (e) {
        console.error("allocations GET error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
