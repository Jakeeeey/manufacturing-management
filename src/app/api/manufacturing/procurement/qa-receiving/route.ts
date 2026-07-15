/* eslint-disable */
import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "../_directus";
import { canonicalBatchNumber } from "../_domain";
import { handleQaReceivingPost } from "./_receiving-service";

interface DirectusLotLog {
    id: number;
    product_id: number | { product_id: number } | null | undefined;
    quantity: number;
    source_type?: string;
    source_reference?: string;
    lot_number?: string;
    batch_no?: string;
    lot_id?: number | { lot_id: number; lot_name?: string } | null;
    expiry_date?: string;
    created_on?: string;
    branch_id?: number;
    qa_status?: string;
    rejection_reason?: string;
    unit_cost?: number;
}

interface DirectusProductMin {
    product_id: number;
    product_name: string;
    product_code: string;
}

interface DirectusPurchaseOrderMin {
    purchase_order_id: number;
    purchase_order_no: string;
    reference: string;
    date_received: string;
    date_encoded: string;
    datetime: string;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const productId = searchParams.get("productId");
        const action = searchParams.get("action");

        // Action: Fetch branches
        if (action === "branches") {
            const res = await fetch(`${DIRECTUS_URL}/items/branches?filter[isActive][_eq]=1&sort=branch_name&limit=100`, { headers, cache: "no-store" });
            if (!res.ok) throw new Error(`Directus error loading branches: ${res.status}`);
            const json = await res.json();
            return NextResponse.json(json.data);
        }

        if (action === "lots") {
            const res = await fetch(
                `${DIRECTUS_URL}/items/lots?fields=lot_id,lot_name,inventory_type_id,max_batch_capacity&sort=lot_name&limit=-1`,
                { headers, cache: "no-store" }
            );
            if (!res.ok) throw new Error(`Directus error loading storage lots: ${res.status}`);
            return NextResponse.json((await res.json()).data || []);
        }

        // Action: Fetch FIFO Inventory for a product across all branches
        if (productId) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/inventory_lots?filter[product_id][_eq]=${productId}&filter[quantity][_gt]=0&fields=*,lot_id.lot_id,lot_id.lot_name&limit=150`,
                { headers }
            );
            if (!res.ok) throw new Error(`Directus error loading product receiving logs: ${res.status}`);
            const json = await res.json();

            const rawLogs = (json.data || []) as DirectusLotLog[];
            const productIds = rawLogs.map((r) => typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id).filter(Boolean);
            let products: DirectusProductMin[] = [];
            if (productIds.length > 0) {
                const prodUrl = `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&limit=-1`;
                const prodRes = await fetch(prodUrl, { headers, cache: "no-store" });
                if (prodRes.ok) {
                    products = (await prodRes.json()).data || [];
                }
            }

            interface DirectusBranch {
                id: number;
                branch_name: string;
                branch_code?: string;
            }
            const poMap: Record<string, DirectusPurchaseOrderMin> = {};
            const branchMap: Record<number, any> = {};
            if (rawLogs.length > 0) {
                const [poRes, branchRes] = await Promise.all([
                    fetch(`${DIRECTUS_URL}/items/purchase_order?limit=-1&fields=purchase_order_id,purchase_order_no,reference,date_received,date_encoded,datetime`, { headers }),
                    fetch(`${DIRECTUS_URL}/items/branches?limit=-1`, { headers })
                ]);
                const poList = (poRes.ok ? (await poRes.json()).data || [] : []) as DirectusPurchaseOrderMin[];
                poList.forEach((po) => {
                    poMap[String(po.purchase_order_id)] = po;
                    if (po.purchase_order_no) {
                        poMap[String(po.purchase_order_no)] = po;
                    }
                });
                const branchList = branchRes.ok ? (await branchRes.json()).data || [] : [];
                branchList.forEach((b: any) => {
                    branchMap[Number(b.id)] = b;
                });
            }

            const mapped = rawLogs.map((r) => {
                const rawProdId = typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id;
                const productObj = products.find((p) => Number(p.product_id) === Number(rawProdId)) || {
                    product_id: Number(rawProdId) || 0,
                    product_name: `Product ID: ${rawProdId}`,
                    product_code: `ID-${rawProdId}`
                };

                const poRef = r.source_reference || "";
                let cleanPoRef = poRef;
                if (poRef.startsWith("PO-")) {
                    cleanPoRef = poRef.substring(3);
                }
                const matchedPo = poMap[poRef] || poMap[cleanPoRef] || null;

                return {
                    line_id: r.id,
                    shipment_id: {
                        shipment_id: matchedPo ? matchedPo.purchase_order_id : (parseInt(cleanPoRef) || null),
                        reference_number: matchedPo ? (matchedPo.reference || matchedPo.purchase_order_no) : poRef,
                        date_received: matchedPo ? (matchedPo.date_received || r.created_on) : r.created_on,
                        created_at: matchedPo ? (matchedPo.date_encoded || matchedPo.datetime) : r.created_on
                    },
                    product_id: productObj,
                    quantity_received: Number(r.quantity || 0),
                    batch_no: canonicalBatchNumber(r.batch_no, r.lot_number),
                    lot_number: canonicalBatchNumber(r.batch_no, r.lot_number) || "LOT-N/A",
                    lot_id: typeof r.lot_id === "object" ? r.lot_id?.lot_id : r.lot_id || null,
                    lot_name: typeof r.lot_id === "object" ? r.lot_id?.lot_name || null : null,
                    storage_assignment_state: r.lot_id ? "assigned" : "legacy_unassigned",
                    expiration_date: r.expiry_date,
                    branch_id: branchMap[Number(r.branch_id)] || { branch_name: `Branch ID ${r.branch_id}`, branch_code: `BR-${r.branch_id}` },
                    rejection_reason: "",
                    qa_status: r.qa_status || "Passed",
                    base_unit_cost_php: Number(r.unit_cost || 0),
                    allocated_expense_php: 0,
                    final_landed_unit_cost: Number(r.unit_cost || 0)
                };
            });

            return NextResponse.json(mapped);
        }

        // Action: Fetch FIFO Inventory for a branch
        if (branchId) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/inventory_lots?filter[branch_id][_eq]=${branchId}&filter[quantity][_gt]=0&fields=*,lot_id.lot_id,lot_id.lot_name&limit=150`,
                { headers }
            );
            if (!res.ok) throw new Error(`Directus error loading branch receiving logs: ${res.status}`);
            const json = await res.json();

            const rawLogs = (json.data || []) as DirectusLotLog[];
            const productIds = rawLogs.map((r) => typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id).filter(Boolean);
            let products: DirectusProductMin[] = [];
            if (productIds.length > 0) {
                const prodUrl = `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&limit=-1`;
                const prodRes = await fetch(prodUrl, { headers, cache: "no-store" });
                if (prodRes.ok) {
                    products = (await prodRes.json()).data || [];
                }
            }

            const poMap: Record<string, DirectusPurchaseOrderMin> = {};
            if (rawLogs.length > 0) {
                const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order?limit=-1&fields=purchase_order_id,purchase_order_no,reference,date_received,date_encoded,datetime`, { headers });
                const poList = (poRes.ok ? (await poRes.json()).data || [] : []) as DirectusPurchaseOrderMin[];
                poList.forEach((po) => {
                    poMap[String(po.purchase_order_id)] = po;
                    if (po.purchase_order_no) {
                        poMap[String(po.purchase_order_no)] = po;
                    }
                });
            }

            const mapped = rawLogs.map((r) => {
                const rawProdId = typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id;
                const productObj = products.find((p) => Number(p.product_id) === Number(rawProdId)) || {
                    product_id: Number(rawProdId) || 0,
                    product_name: `Product ID: ${rawProdId}`,
                    product_code: `ID-${rawProdId}`
                };

                const poRef = r.source_reference || "";
                let cleanPoRef = poRef;
                if (poRef.startsWith("PO-")) {
                    cleanPoRef = poRef.substring(3);
                }
                const matchedPo = poMap[poRef] || poMap[cleanPoRef] || null;

                return {
                    line_id: r.id,
                    shipment_id: {
                        shipment_id: matchedPo ? matchedPo.purchase_order_id : (parseInt(cleanPoRef) || null),
                        reference_number: matchedPo ? (matchedPo.reference || matchedPo.purchase_order_no) : poRef,
                        date_received: matchedPo ? (matchedPo.date_received || r.created_on) : r.created_on,
                        created_at: matchedPo ? (matchedPo.date_encoded || matchedPo.datetime) : r.created_on
                    },
                    product_id: productObj,
                    quantity_received: Number(r.quantity || 0),
                    batch_no: canonicalBatchNumber(r.batch_no, r.lot_number),
                    lot_number: canonicalBatchNumber(r.batch_no, r.lot_number) || "LOT-N/A",
                    lot_id: typeof r.lot_id === "object" ? r.lot_id?.lot_id : r.lot_id || null,
                    lot_name: typeof r.lot_id === "object" ? r.lot_id?.lot_name || null : null,
                    storage_assignment_state: r.lot_id ? "assigned" : "legacy_unassigned",
                    expiration_date: r.expiry_date,
                    branch_id: r.branch_id,
                    rejection_reason: "",
                    qa_status: r.qa_status || "Passed",
                    base_unit_cost_php: Number(r.unit_cost || 0),
                    allocated_expense_php: 0,
                    final_landed_unit_cost: Number(r.unit_cost || 0)
                };
            });

            return NextResponse.json(mapped);
        }

        return NextResponse.json({ error: "Missing parameter branchId or action=branches" }, { status: 400 });
    } catch (e) {
        console.error("API Error in QA Receiving route:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    return handleQaReceivingPost(request);
}
