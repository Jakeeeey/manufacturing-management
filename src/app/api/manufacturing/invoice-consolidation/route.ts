import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers as directusHeaders } from "../directus-api";

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

function requireAuth(userId: number | null): NextResponse | null {
    if (!userId || isNaN(userId)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return null;
}

let branchesCache: Map<number, { branchName: string; branchCode: string }> | null = null;

async function getBranchesMap(): Promise<Map<number, { branchName: string; branchCode: string }>> {
    if (branchesCache) return branchesCache;
    const res = await fetch(
        `${DIRECTUS_URL}/items/branches?filter[isActive][_eq]=1&limit=-1&fields=id,branch_name,branch_code`,
        { headers: directusHeaders, cache: "no-store" }
    );
    if (res.ok) {
        const data = (await res.json()).data || [];
        branchesCache = new Map(data.map((b: { id: number; branch_name: string; branch_code: string }) => [b.id, { branchName: b.branch_name, branchCode: b.branch_code }]));
    } else {
        branchesCache = new Map();
    }
    return branchesCache;
}

async function generateConsolidatorNo(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `CLINV-${today}-`;
    const res = await fetch(
        `${DIRECTUS_URL}/items/consolidator?filter[consolidator_no][_starts_with]=${prefix}&filter[is_delete][_eq]=0&sort=-consolidator_no&limit=1&fields=consolidator_no`,
        { headers: directusHeaders, cache: "no-store" }
    );
    if (res.ok) {
        const data = (await res.json()).data || [];
        if (data.length > 0) {
            const lastNo = data[0].consolidator_no;
            const seq = parseInt(lastNo.slice(-3), 10) + 1;
            return `${prefix}${String(seq).padStart(3, "0")}`;
        }
    }
    return `${prefix}001`;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = Math.max(0, parseInt(searchParams.get("page") || "0"));
        const size = Math.max(1, Math.min(100, parseInt(searchParams.get("size") || "50")));
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const branchId = searchParams.get("branchId");

        if (!branchId) {
            return NextResponse.json({ message: "branchId is required" }, { status: 400 });
        }

        const qs = new URLSearchParams();
        qs.set("filter[consolidator_no][_starts_with]", "CLINV-");
        qs.set("filter[is_delete][_eq]", "0");
        qs.set("filter[branch_id][_eq]", branchId);
        qs.set("sort", "-created_at");
        qs.set("limit", String(size));
        qs.set("offset", String(page * size));
        qs.set("meta", "filter_count");

        if (status && status !== "All") {
            qs.set("filter[status][_eq]", status);
        }
        if (search) {
            qs.set("filter[consolidator_no][_contains]", search);
        }

        const res = await fetch(`${DIRECTUS_URL}/items/consolidator?${qs.toString()}`, {
            headers: directusHeaders,
            cache: "no-store",
        });
        if (!res.ok) {
            return NextResponse.json({ message: `Directus error (HTTP ${res.status})` }, { status: res.status });
        }

        const json = await res.json();
        const items = json.data || [];
        const total = json.meta?.filter_count ?? items.length;
        const ids = items.map((c: { id: number }) => c.id);

        let invJunctions: { id: number; consolidator_id: number; invoice_id: number; created_at: string }[] = [];
        if (ids.length > 0) {
            const invRes = await fetch(
                `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][_in]=${ids.join(",")}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!invRes.ok) {
                return NextResponse.json({ message: `Directus error (HTTP ${invRes.status})` }, { status: invRes.status });
            }
            invJunctions = (await invRes.json()).data || [];
        }

        let detJunctions: { id: number; consolidator_id: number; product_id: number; ordered_quantity: number; picked_quantity: number; applied_quantity: number; picked_by: number | null; picked_at: string | null }[] = [];
        if (ids.length > 0) {
            const detRes = await fetch(
                `${DIRECTUS_URL}/items/consolidator_details?filter[consolidator_id][_in]=${ids.join(",")}&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!detRes.ok) {
                return NextResponse.json({ message: `Directus error (HTTP ${detRes.status})` }, { status: detRes.status });
            }
            detJunctions = (await detRes.json()).data || [];
        }

        const junctionMap = new Map<number, typeof invJunctions>();
        for (const j of invJunctions) {
            const list = junctionMap.get(j.consolidator_id) || [];
            list.push(j);
            junctionMap.set(j.consolidator_id, list);
        }

        const detailMap = new Map<number, typeof detJunctions>();
        for (const d of detJunctions) {
            const list = detailMap.get(d.consolidator_id) || [];
            list.push(d);
            detailMap.set(d.consolidator_id, list);
        }

        const allInvoiceIds = [...new Set(invJunctions.map((j) => j.invoice_id))];
        let invoiceMap = new Map<number, { invoice_no: string; branch_id: number; total_amount: number }>();
        if (allInvoiceIds.length > 0) {
            const siRes = await fetch(
                `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_id][_in]=${allInvoiceIds.join(",")}&fields=invoice_id,invoice_no,branch_id,total_amount&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!siRes.ok) {
                return NextResponse.json({ message: `Directus error (HTTP ${siRes.status})` }, { status: siRes.status });
            }
            const siData = (await siRes.json()).data || [];
            invoiceMap = new Map(siData.map((s: { invoice_id: number; invoice_no: string; branch_id: number; total_amount: number }) => [s.invoice_id, s]));
        }

        const allProductIds = [...new Set(detJunctions.map((d) => d.product_id))];
        let productMap = new Map<number, { product_name: string; product_code: string }>();
        if (allProductIds.length > 0) {
            const prodRes = await fetch(
                `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${allProductIds.join(",")}&fields=product_id,product_name,product_code&limit=-1`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (prodRes.ok) {
                const prodData = (await prodRes.json()).data || [];
                productMap = new Map(prodData.map((p: { product_id: number; product_name: string; product_code: string }) => [p.product_id, p]));
            }
        }

        const branchMap = await getBranchesMap();
        const enriched = items.map((c: { id: number; consolidator_no: string; status: string; created_by: number; checked_by: number | null; branch_id: number; created_at: string; updated_at: string }) => {
            const junctions = junctionMap.get(c.id) || [];
            const invoices = junctions.map((j) => {
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
            const totalAmount = invoices.reduce((sum: number, inv) => {
                const si = invoiceMap.get(inv.invoiceId);
                return sum + (si ? Number(si.total_amount || 0) : 0);
            }, 0);

            const details = (detailMap.get(c.id) || []).map((d) => {
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

            return {
                id: c.id,
                consolidatorNo: c.consolidator_no,
                status: c.status || "Pending",
                createdBy: c.created_by,
                checkedBy: c.checked_by,
                branchId: c.branch_id,
                branchName: branchMap.get(c.branch_id)?.branchName || `Branch #${c.branch_id}`,
                totalSalesOrderAmount: totalAmount,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                details,
                dispatches: [],
                invoices,
            };
        });

        return NextResponse.json({
            content: enriched,
            totalElements: total,
            totalPages: Math.ceil(total / size),
        });
    } catch (e) {
        console.error("invoice-consolidation GET error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await getUserIdFromToken();
        const authError = requireAuth(userId);
        if (authError) return authError;

        const body = await req.json();
        const { branchId, invoiceIds } = body;

        if (!branchId || !invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return NextResponse.json({ message: "branchId and invoiceIds are required" }, { status: 400 });
        }

        if (invoiceIds.some((id: unknown) => typeof id !== "number" || id <= 0 || !Number.isInteger(id))) {
            return NextResponse.json({ message: "All invoiceIds must be positive integers" }, { status: 400 });
        }

        const uniqueIds = [...new Set<number>(invoiceIds)];
        if (uniqueIds.length !== invoiceIds.length) {
            return NextResponse.json({ message: "Duplicate invoice IDs are not allowed" }, { status: 400 });
        }

        const siRes = await fetch(
            `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_id][_in]=${uniqueIds.join(",")}&fields=invoice_id,invoice_no,branch_id,isDispatched,transaction_status&limit=-1`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!siRes.ok) {
            return NextResponse.json({ message: `Failed to verify invoices (HTTP ${siRes.status})` }, { status: siRes.status });
        }
        const siData: { invoice_id: number; invoice_no: string; branch_id: number; total_amount: number; isDispatched: boolean | null; transaction_status: string }[] = (await siRes.json()).data || [];

        if (siData.length !== uniqueIds.length) {
            const found = new Set(siData.map((s) => s.invoice_id));
            const missing = uniqueIds.filter((id) => !found.has(id));
            return NextResponse.json({ message: `Invoices not found: ${missing.join(", ")}` }, { status: 400 });
        }

        for (const inv of siData) {
            if (inv.branch_id !== Number(branchId)) {
                return NextResponse.json({ message: `Invoice ${inv.invoice_no} belongs to a different branch` }, { status: 400 });
            }
            if (inv.isDispatched === true) {
                return NextResponse.json({ message: `Invoice ${inv.invoice_no} is already dispatched` }, { status: 400 });
            }
            if (inv.transaction_status === "Cancelled") {
                return NextResponse.json({ message: `Invoice ${inv.invoice_no} is cancelled` }, { status: 400 });
            }
        }

        const clinvRes = await fetch(
            `${DIRECTUS_URL}/items/consolidator_invoices?filter[invoice_id][_in]=${uniqueIds.join(",")}&filter[consolidator_id][consolidator_no][_starts_with]=CLINV-&filter[consolidator_id][is_delete][_eq]=0&limit=-1&fields=invoice_id`,
            { headers: directusHeaders, cache: "no-store" }
        );
        if (!clinvRes.ok) {
            return NextResponse.json({ message: `Failed to check existing links (HTTP ${clinvRes.status})` }, { status: clinvRes.status });
        }
        const linked: { invoice_id: number }[] = (await clinvRes.json()).data || [];
        if (linked.length > 0) {
            const alreadyLinked = linked.map((l) => l.invoice_id);
            return NextResponse.json({ message: `Invoices already in another batch: ${alreadyLinked.join(", ")}` }, { status: 409 });
        }

        const consolidatorNo = await generateConsolidatorNo();

        const createBody: Record<string, unknown> = {
            consolidator_no: consolidatorNo,
            status: "Pending",
            branch_id: Number(branchId),
            created_by: userId,
        };

        const createRes = await fetch(`${DIRECTUS_URL}/items/consolidator`, {
            method: "POST",
            headers: directusHeaders,
            body: JSON.stringify(createBody),
        });
        if (!createRes.ok) {
            return NextResponse.json({ message: `Failed to create consolidator: ${createRes.status}` }, { status: createRes.status });
        }
        const newConsolidator = (await createRes.json()).data;
        const newId = newConsolidator.id;

        let createdJunctionIds: number[] = [];
        let createdDetailIds: number[] = [];

        try {
            const linkPayload = uniqueIds.map((invoiceId: number) => ({
                consolidator_id: newId,
                invoice_id: invoiceId,
            }));
            const linkRes = await fetch(`${DIRECTUS_URL}/items/consolidator_invoices`, {
                method: "POST",
                headers: directusHeaders,
                body: JSON.stringify(linkPayload),
            });
            if (!linkRes.ok) {
                const errText = await linkRes.text();
                throw new Error(`Failed to link invoices: ${linkRes.status} - ${errText}`);
            }
            const linkData = (await linkRes.json()).data || [];
            createdJunctionIds = linkData.map((j: { id: number }) => j.id);

            const detRes = await fetch(
                `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${uniqueIds.join(",")}&limit=-1&fields=product_id,quantity`,
                { headers: directusHeaders, cache: "no-store" }
            );
            if (!detRes.ok) {
                throw new Error(`Failed to fetch invoice details (HTTP ${detRes.status})`);
            }
            const detData: { product_id: number; quantity: number }[] = (await detRes.json()).data || [];

            const aggMap = new Map<number, number>();
            for (const d of detData) {
                aggMap.set(d.product_id, (aggMap.get(d.product_id) || 0) + Number(d.quantity || 0));
            }

            if (aggMap.size === 0) {
                throw new Error("Selected invoices have no valid product lines to consolidate");
            }

            const detailPayload = Array.from(aggMap.entries()).map(([productId, qty]) => ({
                consolidator_id: newId,
                product_id: productId,
                ordered_quantity: qty,
                picked_quantity: 0,
                applied_quantity: 0,
            }));
            const detCreateRes = await fetch(`${DIRECTUS_URL}/items/consolidator_details`, {
                method: "POST",
                headers: directusHeaders,
                body: JSON.stringify(detailPayload),
            });
            if (!detCreateRes.ok) {
                const errText = await detCreateRes.text();
                throw new Error(`Failed to create details: ${detCreateRes.status} - ${errText}`);
            }
            const detCreateData = (await detCreateRes.json()).data || [];
            createdDetailIds = detCreateData.map((d: { id: number }) => d.id);

            const productIds = Array.from(aggMap.keys());
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

            const details = Array.from(aggMap.entries()).map(([productId, qty]) => {
                const prod = productMap.get(productId);
                return {
                    productId,
                    productName: prod?.product_name || `Product #${productId}`,
                    productCode: prod?.product_code || "",
                    orderedQuantity: qty,
                    pickedQuantity: 0,
                    appliedQuantity: 0,
                };
            });

            const branchMap = await getBranchesMap();
            return NextResponse.json({
                id: newId,
                consolidatorNo,
                status: "Pending",
                createdBy: userId,
                checkedBy: null,
                branchId: Number(branchId),
                branchName: branchMap.get(Number(branchId))?.branchName || `Branch #${branchId}`,
                totalSalesOrderAmount: siData.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
                createdAt: newConsolidator.created_at,
                updatedAt: newConsolidator.updated_at,
                details,
                dispatches: [],
                invoices: siData.map((s) => ({
                    id: 0,
                    consolidatorId: newId,
                    invoiceId: s.invoice_id,
                    invoiceNo: s.invoice_no,
                    branchId: s.branch_id,
                    createdAt: new Date().toISOString(),
                })),
            });
        } catch (e) {
            for (const pid of createdDetailIds) {
                await fetch(`${DIRECTUS_URL}/items/consolidator_details/${pid}`, {
                    method: "DELETE",
                    headers: directusHeaders,
                }).catch(() => {});
            }
            for (const jid of createdJunctionIds) {
                await fetch(`${DIRECTUS_URL}/items/consolidator_invoices/${jid}`, {
                    method: "DELETE",
                    headers: directusHeaders,
                }).catch(() => {});
            }
            await fetch(`${DIRECTUS_URL}/items/consolidator/${newId}`, {
                method: "PATCH",
                headers: directusHeaders,
                body: JSON.stringify({ is_delete: 1, deleted_at: new Date().toISOString(), deleted_by: userId }),
            }).catch(() => {});

            const msg = e instanceof Error ? e.message : "Failed to create consolidation";
            return NextResponse.json({ message: msg }, { status: 500 });
        }
    } catch (e) {
        console.error("invoice-consolidation POST error:", e);
        return NextResponse.json({ message: "BFF Network Error" }, { status: 502 });
    }
}
