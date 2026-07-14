import { NextRequest, NextResponse } from "next/server";
import { DIRECTUS_URL, headers as directusHeaders } from "../../directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branchId = searchParams.get("branchId");

        const filter: Record<string, unknown> = {
            _and: [
                { transaction_status: { _neq: "Cancelled" } },
                { _or: [
                    { isDispatched: { _eq: false } },
                    { isDispatched: { _null: true } },
                ]},
            ],
        };
        if (branchId) {
            (filter._and as Record<string, unknown>[]).push({ branch_id: { _eq: Number(branchId) } });
        }

        const qs = new URLSearchParams();
        qs.set("filter", JSON.stringify(filter));
        qs.set("limit", "-1");
        qs.set("fields", "invoice_id,invoice_no,invoice_date,gross_amount,net_amount,branch_id,customer_code");

        const invRes = await fetch(`${DIRECTUS_URL}/items/sales_invoice?${qs.toString()}`, {
            headers: directusHeaders,
            cache: "no-store",
        });
        if (!invRes.ok) {
            return NextResponse.json({ message: `Directus error (HTTP ${invRes.status})` }, { status: invRes.status });
        }

        const invJson = await invRes.json();
        let invoices: {
            invoice_id: number;
            invoice_no: string;
            invoice_date: string;
            gross_amount: number;
            net_amount: number;
            branch_id: number;
            customer_code: string;
        }[] = invJson.data || [];

        if (invoices.length === 0) {
            return NextResponse.json([]);
        }

        const clinvRes = await fetch(
            `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][consolidator_no][_starts_with]=CLINV-&filter[consolidator_id][is_delete][_eq]=0&limit=-1&fields=invoice_id`,
            { headers: directusHeaders, cache: "no-store" }
        );
        let linkedIds = new Set<number>();
        if (clinvRes.ok) {
            const clinvData = (await clinvRes.json()).data || [];
            linkedIds = new Set(clinvData.map((j: { invoice_id: number }) => j.invoice_id));
        } else {
            return NextResponse.json({ message: `Directus error (HTTP ${clinvRes.status})` }, { status: clinvRes.status });
        }

        invoices = invoices.filter((inv) => !linkedIds.has(inv.invoice_id));

        const customerCodes = [...new Set(invoices.map((inv) => inv.customer_code).filter(Boolean))];
        let customerMap = new Map<string, { customer_name: string; business_name?: string }>();
        if (customerCodes.length > 0) {
            const custRes = await fetch(
                `${DIRECTUS_URL}/items/customer?filter[customer_code][_in]=${customerCodes.map((c) => encodeURIComponent(c)).join(",")}&limit=-1&fields=customer_code,customer_name,business_name`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (custRes.ok) {
                const custData = (await custRes.json()).data || [];
                customerMap = new Map(custData.map((c: { customer_code: string; customer_name: string; business_name?: string }) => [c.customer_code, c]));
            }
        }

        const enriched = invoices.map((inv) => {
            const cust = customerMap.get(inv.customer_code);
            return {
                invoiceId: inv.invoice_id,
                invoiceNo: inv.invoice_no,
                invoiceDate: inv.invoice_date,
                grossAmount: Number(inv.gross_amount || 0),
                netAmount: Number(inv.net_amount || 0),
                branchId: inv.branch_id,
                customerCode: inv.customer_code,
                customerName: cust?.customer_name || inv.customer_code,
                businessName: cust?.business_name || "",
            };
        });

        return NextResponse.json(enriched);
    } catch (e) {
        console.error("invoice-consolidation candidates GET error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
