import { NextRequest, NextResponse } from "next/server";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ consolidatorNo: string }> }
) {
    try {
        const { consolidatorNo } = await params;
        const escNo = encodeURIComponent(consolidatorNo);

        const res = await fetch(
            `${DIRECTUS_URL}/items/consolidator?filter[consolidator_no][_eq]=${escNo}&filter[is_delete][_eq]=0&limit=1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!res.ok) {
            return NextResponse.json({ message: `Directus error (HTTP ${res.status})` }, { status: res.status });
        }

        const json = await res.json();
        const items = json.data || [];
        if (items.length === 0) {
            return NextResponse.json({ message: "Consolidation not found" }, { status: 404 });
        }

        const c = items[0];

        const [invRes, detRes] = await Promise.all([
            fetch(
                `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_eq]=${c.id}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
            fetch(
                `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_eq]=${c.id}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            ),
        ]);

        if (!invRes.ok || !detRes.ok) {
            return NextResponse.json({ message: "Failed to load batch details" }, { status: 502 });
        }

        const invJunctions: Array<{ id: number; consolidator_id: number; invoice_id: number; created_at: string }> = (await invRes.json()).data || [];
        const detJunctions: Array<{ id: number; consolidator_id: number; product_id: number; ordered_quantity: number; picked_quantity: number; applied_quantity: number; picked_by: number | null; picked_at: string | null }> = (await detRes.json()).data || [];

        const invoiceIds = invJunctions.map((j) => j.invoice_id);
        let invoiceMap = new Map<number, { invoice_no: string; branch_id: number; total_amount: number }>();
        if (invoiceIds.length > 0) {
            const siRes = await fetch(
                `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_id][_in]=${invoiceIds.join(",")}&fields=invoice_id,invoice_no,branch_id,total_amount&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!siRes.ok) {
                return NextResponse.json({ message: `Directus error (HTTP ${siRes.status})` }, { status: siRes.status });
            }
            const siData = (await siRes.json()).data || [];
            invoiceMap = new Map(siData.map((s: { invoice_id: number; invoice_no: string; branch_id: number; total_amount: number }) => [s.invoice_id, s]));
        }

        const productIds = [...new Set(detJunctions.map((d) => d.product_id))];
        let productMap = new Map<number, { product_name: string; product_code: string }>();
        if (productIds.length > 0) {
            const prodRes = await fetch(
                `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=product_id,product_name,product_code&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (prodRes.ok) {
                const prodData = (await prodRes.json()).data || [];
                productMap = new Map(prodData.map((p: { product_id: number; product_name: string; product_code: string }) => [p.product_id, p]));
            }
        }

        const invoices = invJunctions.map((j) => {
            const si = invoiceMap.get(j.invoice_id);
            return {
                id: j.id,
                consolidatorId: j.consolidator_id,
                invoiceId: j.invoice_id,
                invoiceNo: si?.invoice_no || `#${j.invoice_id}`,
                branchId: si?.branch_id ?? c.branch_id,
                createdAt: j.created_at,
            };
        });

        const details = detJunctions.map((d) => {
            const prod = productMap.get(d.product_id);
            return {
                id: d.id,
                consolidatorId: d.consolidator_id,
                productId: d.product_id,
                productName: prod?.product_name || `Product #${d.product_id}`,
                productCode: prod?.product_code || "",
                orderedQuantity: Number(d.ordered_quantity || 0),
                pickedQuantity: Number(d.picked_quantity || 0),
                appliedQuantity: Number(d.applied_quantity || 0),
                pickedById: d.picked_by,
                pickedAt: d.picked_at,
            };
        });

        const totalAmount = invoices.reduce((sum: number, inv) => {
            const si = invoiceMap.get(inv.invoiceId);
            return sum + (si ? Number(si.total_amount || 0) : 0);
        }, 0);

        return NextResponse.json({
            id: c.id,
            consolidatorNo: c.consolidator_no,
            status: c.status || "Pending",
            createdBy: c.created_by,
            checkedBy: c.checked_by,
            branchId: c.branch_id,
            branchName: `Branch #${c.branch_id}`,
            totalSalesOrderAmount: totalAmount,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            details,
            dispatches: [],
            invoices,
        });
    } catch (e) {
        console.error("invoice-consolidation byNo GET error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
